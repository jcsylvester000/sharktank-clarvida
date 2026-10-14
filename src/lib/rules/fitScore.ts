import type { DB, Organization, Program, ProgramFamily, Stage } from "@/lib/domain/types";

const D = 86_400_000;
const STAGE_POINTS: Record<Stage, number> = { "At risk": 20, Quiet: 18, Dormant: 16, Engaged: 14, Active: 12, New: 10 };

export interface FitResult {
  score: number;
  reasons: string[];
  parts: { template: number; distance: number; history: number; stage: number; capacity: number };
  paused: boolean;
}

/** BR14 explainable fit score (0–99): template weight + distance + history + stage + capacity. */
export function fitScore(
  org: Organization,
  opts: { family: ProgramFamily; program?: Program | null; weights: DB["gatekeeperWeights"]; programs: Program[]; now: number },
): FitResult {
  const tpl = opts.weights[`${org.state}|${opts.family}`] ?? opts.weights[`${org.state}|child`] ?? {};
  const template = tpl[org.type] ?? 6;
  const distance = Math.max(0, Math.round(20 - 3 * org.distanceMiles));
  const history = Math.min(20, org.referrals90d);
  const stage = STAGE_POINTS[org.stage] ?? 8;

  let capacity: number;
  let paused = false;
  if (opts.program) {
    const c = opts.program.capacity;
    paused = c === "Waitlist" || c === "Closed";
    capacity = c === "Open" ? 10 : c === "Limited" ? 6 : 0;
  } else {
    const fam = opts.programs.filter((p) => p.state === org.state && (p.family === opts.family || p.family === "all"));
    capacity = fam.some((p) => p.capacity === "Open") ? 10 : fam.some((p) => p.capacity === "Limited") ? 6 : 2;
  }

  const score = Math.min(99, template + distance + history + stage + capacity);

  const reasons: string[] = [];
  if (template >= 24) reasons.push(`${org.type} organizations control most referrals for this program in ${org.state}`);
  else if (template >= 14) reasons.push(`${org.type} is a regular referral source for this program`);
  else reasons.push("Community partner that builds trust and awareness");
  if (org.stage === "At risk") reasons.push("Relationship reset: a recent event affects this organization");
  if (org.stage === "Quiet" && org.lastReferralAt) reasons.push(`Referrals stopped: last one ${Math.round((opts.now - org.lastReferralAt) / D)} days ago`);
  if (org.stage === "Dormant") reasons.push("No referrals in over 90 days");
  if (org.referrals90d >= 10) reasons.push(`${org.referrals90d} referrals in the last 90 days`);
  if (!org.lastTouchAt) reasons.push("No relationship on record yet");
  if (org.distanceMiles <= 3) reasons.push(`Within ${org.distanceMiles} miles of the office`);

  return { score, reasons: reasons.slice(0, 4), parts: { template, distance, history, stage, capacity }, paused };
}

export function fitBand(score: number): "high" | "medium" | "low" {
  return score >= 75 ? "high" : score >= 55 ? "medium" : "low";
}
