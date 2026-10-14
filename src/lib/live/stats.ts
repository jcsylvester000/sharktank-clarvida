// Live Operations numbers. Aggregates only: no client names, phones or ages, so every role may see them.
import type { DB, LiveFeedItem, Role } from "@/lib/domain/types";
import { clockFor } from "@/lib/rules/clock";

const H = 3_600_000;
const D = 24 * H;
export const LIVE_TZ = "America/New_York";

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function parts(t: number, tz = LIVE_TZ) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    fmtCache.set(tz, f);
  }
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(t))) p[x.type] = x.value;
  return { h: +p.hour, m: +p.minute, s: +p.second };
}

/** Midnight (Eastern) of the day containing t. */
export function dayStart(t: number, tz = LIVE_TZ): number {
  const p = parts(t, tz);
  return t - ((p.h * 60 + p.m) * 60 + p.s) * 1000 - (t % 1000);
}

export function hourOf(t: number, tz = LIVE_TZ): number {
  return parts(t, tz).h;
}

export function fmtSimClock(t: number): { day: string; time: string; full: string } {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: LIVE_TZ, weekday: "short", month: "short", day: "numeric" }).format(new Date(t));
  const time = new Intl.DateTimeFormat("en-US", { timeZone: LIVE_TZ, hour: "numeric", minute: "2-digit" }).format(new Date(t));
  return { day, time, full: `${day}, ${time} ET` };
}

const hourLabel = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);

/** Roles that may read Care Zone feed lines (referral IDs and intake actions). Everyone else gets the counts-only line. */
export const CARE_FEED_ROLES: Role[] = ["intake", "intake_sup", "compliance"];

export function feedLine(item: LiveFeedItem, role: Role): { text: string; link?: string } {
  if (item.zone === "Care" && !CARE_FEED_ROLES.includes(role)) return { text: item.publicText };
  return { text: item.text, link: item.link };
}

export function liveStats(db: DB, now: number) {
  const start = dayStart(now);
  const target = 8 * H;
  const sla = (s: string) => db.sla.find((x) => x.state === s);
  const open = db.referrals.filter((r) => r.status !== "Closed" && r.status !== "Redirected" && r.status !== "Intake completed");
  const clocks = open.map((r) => clockFor(r, now, db.demo.clockMode, sla(r.state)));
  const week = db.referrals.filter((r) => r.receivedAt >= now - 7 * D && r.firstContactAt);
  const firstContact = week.map((r) => clockFor(r, now, db.demo.clockMode, sla(r.state)).firstContactMs ?? 0).sort((a, b) => a - b);
  const within = firstContact.filter((ms) => ms <= target).length;
  const median = firstContact.length ? firstContact[Math.floor((firstContact.length - 1) / 2)] : null;
  const today = db.referrals.filter((r) => r.receivedAt >= start && r.receivedAt <= now);

  const nowHour = hourOf(now);
  const fromHour = Math.max(0, Math.min(7, nowHour - 11));
  const byHour = Array.from({ length: nowHour - fromHour + 1 }, (_, i) => fromHour + i).map((h) => ({ label: hourLabel(h), n: today.filter((r) => hourOf(r.receivedAt) === h).length }));

  const simIds = db.live?.simUserIds ?? [];
  const teammates = simIds
    .map((id) => db.users.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map((u) => {
      const acts = db.audit.filter((a) => a.actorId === u.id && a.at >= start);
      return { user: u, today: acts.length, last: acts[0] };
    });

  return {
    receivedToday: today.length,
    waiting: clocks.filter((c) => c.state !== "stopped").length,
    dueSoon: clocks.filter((c) => c.state === "due_soon").length,
    overdue: clocks.filter((c) => c.state === "overdue").length,
    withinTarget: week.length ? within / week.length : null,
    contactedWeek: week.length,
    medianFirstContactH: median === null ? null : median / H,
    sendsToday: db.drafts.filter((x) => x.approvedAt >= start).length,
    repliesToday: db.touches.filter((t) => t.at >= start && t.note.startsWith("Reply from")).length,
    aiToday: db.ailog.filter((a) => a.at >= start && (a.result === "Generated" || a.result === "Approved and queued" || a.result === "Edited and approved")).length,
    paused: db.programs.filter((p) => p.capacity === "Waitlist" || p.capacity === "Closed"),
    pendingEvents: db.events.filter((e) => e.status === "Draft").length,
    byHour,
    teammates,
  };
}
