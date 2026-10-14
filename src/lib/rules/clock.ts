import type { Referral, SlaConfig } from "@/lib/domain/types";

const H = 3_600_000;
const D = 24 * H;

export type ClockMode = "demo" | "business";
export type ClockState = "on_track" | "due_soon" | "overdue" | "stopped" | "waiting_to_start";

export interface ClockResult {
  state: ClockState;
  leftMs: number;
  dueAt: number;
  elapsedMs: number;
  firstContactMs?: number;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" });
    fmtCache.set(tz, f);
  }
  return f;
}
function parts(tz: string, ms: number) {
  const p: Record<string, string> = {};
  for (const x of fmt(tz).formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second, weekday: p.weekday };
}
function tzOffset(tz: string, ms: number) {
  const p = parts(tz, ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ms / 1000) * 1000;
}
function zonedToUtc(y: number, m: number, d: number, h: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, h);
  const off = tzOffset(tz, guess);
  return guess - off;
}

interface Window { start: number; end: number }

/** Business windows (Mon–Fri, start–end hour, state time zone, skipping holidays) from `from` onward. */
function* windows(from: number, sla: SlaConfig, maxDays = 60): Generator<Window> {
  const p = parts(sla.timezone, from);
  let y = p.y, m = p.m, d = p.d;
  for (let i = 0; i < maxDays; i++) {
    const noon = zonedToUtc(y, m, d, 12, sla.timezone);
    const local = parts(sla.timezone, noon);
    const iso = `${local.y}-${String(local.m).padStart(2, "0")}-${String(local.d).padStart(2, "0")}`;
    const weekend = local.weekday === "Sat" || local.weekday === "Sun";
    if (!weekend && !sla.holidays.includes(iso)) {
      yield { start: zonedToUtc(local.y, local.m, local.d, sla.startHour, sla.timezone), end: zonedToUtc(local.y, local.m, local.d, sla.endHour, sla.timezone) };
    }
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    y = next.getUTCFullYear(); m = next.getUTCMonth() + 1; d = next.getUTCDate();
  }
}

/** Business milliseconds between start and end (BR04, business-hours mode). */
export function businessElapsed(start: number, end: number, sla: SlaConfig): number {
  if (end <= start) return 0;
  let total = 0;
  for (const w of windows(start, sla)) {
    if (w.start >= end) break;
    const a = Math.max(start, w.start), b = Math.min(end, w.end);
    if (b > a) total += b - a;
  }
  return total;
}

/** The moment `targetMs` of business time has elapsed after start. */
export function businessDueAt(start: number, targetMs: number, sla: SlaConfig): number {
  let remaining = targetMs;
  for (const w of windows(start, sla)) {
    const a = Math.max(start, w.start);
    if (w.end <= a) continue;
    const span = w.end - a;
    if (span >= remaining) return a + remaining;
    remaining -= span;
  }
  return start + targetMs;
}

export function isStopped(r: Pick<Referral, "firstContactAt" | "status">): boolean {
  return Boolean(r.firstContactAt) || r.status !== "New";
}

/** BR04–BR06 response clock. Demo mode = continuous 8-hour countdown; business mode = state business hours. */
export function clockFor(r: Referral, now: number, mode: ClockMode, sla: SlaConfig | undefined): ClockResult {
  const s: SlaConfig = sla ?? { state: r.state, targetHours: 8, stretch: "", startHour: 8, endHour: 17, timezone: "America/New_York", holidays: [], dueSoonHours: 2 };
  const target = s.targetHours * H;
  const dueSoon = s.dueSoonHours * H;
  const business = mode === "business";
  const dueAt = business ? businessDueAt(r.receivedAt, target, s) : r.receivedAt + target;

  if (isStopped(r)) {
    const stopAt = r.firstContactAt ?? r.history.find((h) => h.to !== "Received" && h.to !== "Routed")?.at ?? r.receivedAt;
    const firstContactMs = business ? businessElapsed(r.receivedAt, stopAt, s) : stopAt - r.receivedAt;
    return { state: "stopped", leftMs: 0, dueAt, elapsedMs: firstContactMs, firstContactMs };
  }
  const elapsed = business ? businessElapsed(r.receivedAt, now, s) : now - r.receivedAt;
  const left = target - elapsed;
  if (business && elapsed === 0 && now >= r.receivedAt) {
    return { state: "waiting_to_start", leftMs: target, dueAt, elapsedMs: 0 };
  }
  const state: ClockState = left < 0 ? "overdue" : left <= dueSoon ? "due_soon" : "on_track";
  return { state, leftMs: left, dueAt, elapsedMs: elapsed };
}

export function hms(ms: number): string {
  const neg = ms < 0;
  const a = Math.abs(ms);
  const h = Math.floor(a / H);
  const m = Math.floor((a % H) / 60_000);
  const sec = Math.floor((a % 60_000) / 1000);
  return `${neg ? "−" : ""}${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function hoursText(ms: number): string {
  const h = ms / H;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  return `${h.toFixed(1)} h`;
}

export const MS = { H, D };
