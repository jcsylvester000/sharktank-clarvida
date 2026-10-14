import { now as clockNow } from "@/lib/clock";
const D = 86_400_000;

export function ago(t: number | null | undefined, now = clockNow()): string {
  if (!t) return "never";
  const s = (now - t) / 1000;
  if (s < 0) {
    const f = -s;
    if (f < 3600) return `in ${Math.max(1, Math.round(f / 60))} min`;
    if (f < 86400) return `in ${Math.round(f / 3600)} h`;
    return `in ${Math.round(f / 86400)} days`;
  }
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function daysSince(t: number | null | undefined, now = clockNow()): number | null {
  return t ? Math.floor((now - t) / D) : null;
}

export function fmtDate(t: number | string | null | undefined): string {
  if (!t) return "—";
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtShortDate(t: number | string | null | undefined): string {
  if (!t) return "—";
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtTime(t: number | null | undefined, tz?: string): string {
  if (!t) return "—";
  return new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
}

export function fmtDateTime(t: number | null | undefined): string {
  if (!t) return "—";
  return `${fmtShortDate(t)}, ${fmtTime(t)}`;
}

export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function maskPhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  return `(${digits.slice(0, 3)}) •••-••${digits.slice(-2)}`;
}

export function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}
