import type { Referral, ReferralStatus, Tier1Status } from "@/lib/domain/types";

/** BR07 status state machine. */
export const TRANSITIONS: Record<ReferralStatus, ReferralStatus[]> = {
  New: ["Contacted", "Accepted", "Hold", "Redirected", "Closed"],
  Contacted: ["Accepted", "Intake scheduled", "Hold", "Redirected", "Closed"],
  Accepted: ["Contacted", "Intake scheduled", "Hold", "Redirected", "Closed"],
  Hold: ["Contacted", "Accepted", "Redirected", "Closed"],
  "Intake scheduled": ["Intake completed", "Closed"],
  "Intake completed": ["Closed"],
  Redirected: [],
  Closed: [],
};

export function canTransition(from: ReferralStatus, to: ReferralStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** BR08 reasons. */
export const HOLD_REASONS = ["Waitlist", "Awaiting information", "Eligibility check"] as const;
export const CLOSE_REASONS = ["Unable to contact", "Declined", "Not eligible", "Duplicate", "Served elsewhere"] as const;
export const REASON_REQUIRED: Partial<Record<ReferralStatus, "hold" | "close" | "redirect">> = { Hold: "hold", Closed: "close", Redirected: "redirect" };

/** BR09: suggest closing as unable to contact after N attempts without reaching the guardian. */
export function suggestUnableToContact(r: Pick<Referral, "attempts" | "status">, n = 3): boolean {
  if (r.status === "Closed" || r.status === "Redirected") return false;
  const failed = r.attempts.filter((a) => a.outcome !== "Reached guardian");
  return failed.length >= n && !r.attempts.some((a) => a.outcome === "Reached guardian");
}

/** BR10 Tier 1 status: coarse words that are always safe to share with a referrer. */
export function tier1Status(r: Pick<Referral, "status" | "attempts">): Tier1Status {
  switch (r.status) {
    case "Hold": return "On hold";
    case "Redirected": return "Redirected";
    case "Closed": return "Closed";
    case "New":
      return r.attempts.length ? "In outreach" : "Received";
    default:
      // FT-091 Tier 1 words: received, contacted, closed (plus honest hold / redirect).
      return r.attempts.some((a) => a.outcome === "Reached guardian") || r.status !== "Accepted" ? "Contacted" : "In outreach";
  }
}

/** Journey steps used by the tracker on the referral and status pages (E09). */
export type JourneyStep = "Received" | "Contacted" | "Intake scheduled" | "Intake completed";
export const JOURNEY: JourneyStep[] = ["Received", "Contacted", "Intake scheduled", "Intake completed"];
export const TIER2_STEPS: JourneyStep[] = ["Intake scheduled", "Intake completed"];

export function journeyReached(r: Referral): Record<JourneyStep, number | null> {
  const at = (to: string) => r.history.find((h) => h.to === to)?.at ?? null;
  const contacted = r.firstContactAt ?? at("Contacted");
  return {
    Received: r.receivedAt,
    Contacted: contacted,
    "Intake scheduled": at("Intake scheduled") ?? (r.status === "Intake completed" ? at("Intake completed") : null),
    "Intake completed": at("Intake completed"),
  };
}

/** One status vocabulary for chips everywhere (Q07). */
export function statusLabel(s: ReferralStatus): string {
  return s === "Hold" ? "On hold" : s === "New" ? "New" : s;
}
