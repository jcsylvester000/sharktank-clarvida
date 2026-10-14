// Attribution mart (C17): de-identified aggregates only. Seeded 90-day baseline (illustrative) + referrals made in the demo.
import type { DB, FunnelRow, Referral, SourceType } from "@/lib/domain/types";
import { businessElapsed } from "@/lib/rules/clock";
import { now as clockNow } from "@/lib/clock";

const H = 3_600_000;
const D = 24 * H;
const FINAL = new Set(["Closed", "Redirected", "Intake completed"]);

export interface Funnel {
  rows: FunnelRow[];
  totals: Omit<FunnelRow, "src">;
  connectionRate: number;
  closedRate: number;
  live: number; // referrals added during the demo
}

function liveReferrals(db: DB): Referral[] {
  return db.referrals.filter((r) => r.receivedAt >= db.seededAt - 1000 && r.receivedAt > db.seededAt);
}

export function funnel(db: DB, filter: { state?: string } = {}): Funnel {
  const rows = new Map<SourceType, FunnelRow>(db.funnel.map((r) => [r.src, { ...r }]));
  // Baseline rows are all NC + CO; a state filter scales them by share (illustrative split 70/30).
  if (filter.state) {
    const share = filter.state === "NC" ? 0.7 : 0.3;
    rows.forEach((r) => {
      r.refs = Math.round(r.refs * share);
      r.contacted = Math.round(r.contacted * share);
      r.scheduled = Math.round(r.scheduled * share);
      r.completed = Math.round(r.completed * share);
      r.closed = Math.round(r.closed * share);
    });
  }
  const live = liveReferrals(db).filter((r) => !filter.state || r.state === filter.state);
  for (const r of live) {
    const row = rows.get(r.srcType) ?? { src: r.srcType, refs: 0, contacted: 0, scheduled: 0, completed: 0, closed: 0 };
    row.refs += 1;
    if (r.firstContactAt) row.contacted += 1;
    if (r.status === "Intake scheduled" || r.status === "Intake completed") row.scheduled += 1;
    if (r.status === "Intake completed") row.completed += 1;
    if (FINAL.has(r.status)) row.closed += 1;
    rows.set(r.srcType, row);
  }
  const list = [...rows.values()].sort((a, b) => b.refs - a.refs);
  const totals = list.reduce((t, r) => ({ refs: t.refs + r.refs, contacted: t.contacted + r.contacted, scheduled: t.scheduled + r.scheduled, completed: t.completed + r.completed, closed: t.closed + r.closed }), { refs: 0, contacted: 0, scheduled: 0, completed: 0, closed: 0 });
  return { rows: list, totals, connectionRate: totals.refs ? totals.completed / totals.refs : 0, closedRate: totals.refs ? totals.closed / totals.refs : 0, live: live.length };
}

// Illustrative baseline of time to first contact (business hours), 90 days.
const BASELINE_HOURS = [0.6, 1.1, 1.4, 1.9, 2.2, 2.6, 2.9, 3.1, 3.4, 3.8, 4.0, 4.3, 4.6, 4.9, 5.1, 5.2, 5.2, 5.4, 5.7, 6.0, 6.3, 6.8, 7.1, 7.4, 7.9, 8.6, 9.4, 10.8, 12.5, 14.8, 16.2, 19.5];

export function speed(db: DB, filter: { state?: string } = {}) {
  const live = db.referrals
    .filter((r) => r.firstContactAt && (!filter.state || r.state === filter.state))
    .map((r) => {
      const sla = db.sla.find((s) => s.state === r.state);
      return (sla ? businessElapsed(r.receivedAt, r.firstContactAt!, sla) : r.firstContactAt! - r.receivedAt) / H;
    });
  const all = [...BASELINE_HOURS, ...live].sort((a, b) => a - b);
  const q = (p: number) => all[Math.min(all.length - 1, Math.floor(p * (all.length - 1)))];
  const buckets = [
    { label: "Under 2 h", n: all.filter((h) => h < 2).length },
    { label: "2–4 h", n: all.filter((h) => h >= 2 && h < 4).length },
    { label: "4–8 h", n: all.filter((h) => h >= 4 && h < 8).length },
    { label: "8–16 h", n: all.filter((h) => h >= 8 && h < 16).length },
    { label: "16 h or more", n: all.filter((h) => h >= 16).length },
  ];
  const now = clockNow();
  const breaches = 2 + db.referrals.filter((r) => r.escalatedAt && now - r.escalatedAt < 7 * D && (!filter.state || r.state === filter.state)).length;
  return { median: q(0.5), p90: q(0.9), withinTarget: all.filter((h) => h <= 8).length / all.length, buckets, breaches, n: all.length };
}

export function weekly(db: DB) {
  const pts = db.weekly.map((w) => ({ ...w }));
  const live = liveReferrals(db);
  if (pts.length) {
    pts[pts.length - 1].referred += live.length;
    pts[pts.length - 1].connected += live.filter((r) => r.status === "Intake completed").length;
  }
  return pts;
}
