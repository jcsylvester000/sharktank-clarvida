import type { Program, Referral, RoutingRule } from "@/lib/domain/types";

const D = 86_400_000;

export interface RouteInput {
  state: string;
  county: string;
  programId: string | null;
  age: number;
}

/** BR01 smart routing: program serves the county (and age fits) → program queue; otherwise state triage. */
export function routeReferral(input: RouteInput, programs: Program[]): { queue: string; triage: boolean; reason: string } {
  const triage = (reason: string) => ({ queue: `Triage (${input.state || "state"})`, triage: true, reason });
  if (!input.programId) return triage("Program not chosen");
  const p = programs.find((x) => x.id === input.programId);
  if (!p) return triage("Program not found");
  if (p.state !== input.state) return triage("Program is in a different state");
  if (!p.counties.map((c) => c.toLowerCase()).includes(String(input.county).toLowerCase())) return triage("Program does not serve this county");
  if (Number.isFinite(input.age) && (input.age < p.ageMin || input.age > p.ageMax)) return triage("Age is outside the program's range");
  return { queue: p.queue, triage: false, reason: "Matched program and county" };
}

/** BR02 duplicate check: same phone and same program within 30 days. */
export function findDuplicate(
  candidate: { id?: string; phone: string; programId: string | null; receivedAt: number },
  referrals: Referral[],
): string | null {
  const norm = (s: string) => s.replace(/\D/g, "");
  const phone = norm(candidate.phone);
  if (!phone) return null;
  const cutoff = candidate.receivedAt - 30 * D;
  const hit = referrals
    .filter((r) => r.id !== candidate.id && norm(r.phone) === phone && r.receivedAt >= cutoff)
    .filter((r) => (candidate.programId ? r.programId === candidate.programId : true))
    .sort((a, b) => b.receivedAt - a.receivedAt)[0];
  return hit ? hit.id : null;
}

export function queueLabel(queue: string, routing: RoutingRule[]): string {
  if (queue.startsWith("Triage")) return queue.replace("Triage", "State triage");
  return routing.find((r) => r.queue === queue)?.queueLabel ?? queue;
}

/** BR37 program matcher ("Help me choose"). */
export function matchPrograms(
  input: { state: string; county: string; age: number; concern: string },
  programs: Program[],
): Program[] {
  const concernFamily: Record<string, (p: Program) => boolean> = {
    "Family stress or conflict": (p) => /family|in-home/i.test(p.partnerLabel),
    "School behavior or attendance": (p) => /in-home|family|counsel/i.test(p.partnerLabel),
    "Foster care or kinship care": (p) => /foster/i.test(p.partnerLabel),
    "Development or communication": (p) => /developmental/i.test(p.partnerLabel),
    "Substance use (teen)": (p) => /adolescent/i.test(p.partnerLabel),
    "Adult mental health support": (p) => /adult/i.test(p.partnerLabel),
    "Not sure": () => true,
  };
  const fit = concernFamily[input.concern] ?? (() => true);
  const order = { Open: 0, Limited: 1, Waitlist: 2, Closed: 3 } as const;
  return programs
    .filter((p) => p.state === input.state && p.counties.includes(input.county))
    .filter((p) => !Number.isFinite(input.age) || (input.age >= p.ageMin && input.age <= p.ageMax))
    .filter(fit)
    .sort((a, b) => order[a.capacity] - order[b.capacity]);
}
