// Simulated AI gateway (C10). Same shape as the production Bedrock gateway:
// allowed inputs only → PHI guard → approved template version → output → log.
// Deterministic: the same inputs always give the same words, so rehearsals match the pitch.
import type { Contact, Organization, Program, RelationshipEvent, Task, User } from "@/lib/domain/types";
import { phiScan } from "@/lib/rules/phi";
import type { FitResult } from "@/lib/rules/fitScore";
import { FOOTER_MARKER } from "@/lib/rules/outreach";

export const MODEL_ID = "Simulated model (production: AWS Bedrock)";
export const TEMPLATES = {
  brief: { id: "PT-brief", version: "v1.3" },
  email: { id: "PT-email", version: "v2.1" },
  points: { id: "PT-points", version: "v1.0" },
  plan: { id: "PT-plan", version: "v1.0" },
  event: { id: "PT-event", version: "v0.9" },
  ask: { id: "PT-ask", version: "v1.0" },
} as const;

export interface GuardResult {
  ok: boolean;
  category?: string;
}

/** Runs before every AI call: only organization/program/event text may enter, and it must pass the PHI guard. */
export function guardInputs(...texts: (string | undefined)[]): GuardResult {
  for (const t of texts) {
    const r = phiScan(t);
    if (r.blocked) return { ok: false, category: r.category };
  }
  return { ok: true };
}

const D = 86_400_000;
const daysAgo = (t: number | null, now: number) => (t ? Math.round((now - t) / D) : null);

export interface Brief {
  summary: string;
  whyItMatters: string[];
  bestContact: string;
  talkingPoints: string[];
  sources: string[];
}

export function generateBrief(org: Organization, programs: Program[], events: RelationshipEvent[], fit: FitResult, now: number): Brief {
  const matching = programs.filter((p) => p.state === org.state && p.counties.includes(org.county) && p.capacity !== "Closed");
  const open = matching.filter((p) => p.capacity === "Open" || p.capacity === "Limited");
  const evts = events.filter((e) => e.status === "Published" && e.orgIds.includes(org.id));
  const quiet = daysAgo(org.lastReferralAt, now);
  const why: string[] = [];
  why.push(fit.reasons[0] ?? `${org.type} organizations refer families to programs like ours.`);
  if (evts[0]) why.push(`${evts[0].title} (${new Date(evts[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}). Contacts and processes may have changed.`);
  if (org.stage === "Quiet" && quiet) why.push(`Referrals have stopped: the last one was ${quiet} days ago, after ${org.monthly.slice(0, 3).reduce((a, b) => a + b, 0)} in the three months before.`);
  else if (org.referrals90d >= 10) why.push(`An active partner: ${org.referrals90d} referrals in the last 90 days.`);
  else if (!org.lastTouchAt) why.push("No relationship on record yet, so a first introduction matters.");
  if (open.length) why.push(`${open.length} matching ${open.length === 1 ? "program is" : "programs are"} accepting referrals in ${org.county} County: ${open.map((p) => p.partnerLabel).join(", ")}.`);

  const points: string[] = [];
  if (evts[0]) points.push("Ask who now handles child and family care management after the change, and confirm the best referral contact.");
  if (open[0]) points.push(`Share that ${open[0].partnerLabel} in ${open[0].office} is ${open[0].capacity === "Open" ? "accepting referrals now" : "taking a limited number of referrals"}.`);
  points.push("Explain the new partner link: referrals take a minute and the family is contacted within 1 business day.");
  points.push("Tell them they will get a status update on every referral, with no client details.");
  if (org.stage === "Quiet") points.push("Ask what changed since referrals slowed, and what would make referring easier.");

  return {
    summary: org.summary,
    whyItMatters: why.slice(0, 4),
    bestContact: org.bestContactRole,
    talkingPoints: points.slice(0, 5),
    sources: ["Organization record", ...org.sources, ...(open.length ? ["Program catalog"] : []), ...evts.map((e) => e.sourceLabel)],
  };
}

export interface EmailDraft {
  subject: string;
  body: string;
}

/** Template bank keyed by relationship stage × program; filled only from organization and program data (AI02). */
export function generateEmail(org: Organization, contact: Contact | undefined, program: Program, sender: User, events: RelationshipEvent[]): EmailDraft {
  const name = contact ? contact.name : "there";
  const evt = events.find((e) => e.status === "Published" && e.orgIds.includes(org.id));
  const label = program.partnerLabel.toLowerCase();
  const opening: Record<Organization["stage"], string> = {
    New: `I'm ${sender.name.split(" ")[0]}, the Brand Ambassador for Clarvida's ${program.office} office. I'd like to introduce our ${label} program and make referring families to us as simple as possible.`,
    Engaged: `Thank you for making time to connect recently. I wanted to follow up with an update on our ${label} program in ${program.office}.`,
    Active: `Thank you for the families your team has referred to Clarvida this season. I wanted to share a quick update on our ${label} program.`,
    Quiet: `It's been a little while since we last worked together, and I wanted to check in. We've made referring to our ${label} program in ${program.office} quicker, and I'd value your team's feedback.`,
    "At risk": evt
      ? `With the recent change (${evt.title}), I wanted to make sure your team still has the right contacts for referrals to Clarvida, and to share what has stayed the same.`
      : `I wanted to make sure your team still has the right contacts for referrals to Clarvida.`,
    Dormant: `We haven't connected in some time, and I'd like to reintroduce Clarvida's ${label} program in ${program.office}.`,
  };
  const capLine =
    program.capacity === "Open" ? `${program.partnerLabel} is accepting referrals now for ages ${program.ageMin} to ${program.ageMax} in ${program.counties.join(", ")} ${program.counties.length > 1 ? "counties" : "County"}.` :
    `${program.partnerLabel} has a limited number of openings this month for ages ${program.ageMin} to ${program.ageMax}.`;
  const body = [
    `Hi ${name},`,
    "",
    opening[org.stage],
    "",
    capLine,
    "Referring takes about a minute through your organization's partner link. We contact the family within 1 business day, and you get a status update on every referral, with no client details.",
    "",
    "Would a 15-minute call next week work to walk your team through it?",
    "",
    "Thank you,",
    `${sender.name}`,
    `Brand Ambassador, Clarvida ${program.office}`,
    "",
    "—",
    `Clarvida, ${program.office} office. You received this because you work with families in ${org.county} County. ${FOOTER_MARKER} or update your preferences at any time.`,
  ].join("\n");
  const subject =
    org.stage === "At risk" ? `Keeping referrals simple after recent changes` :
    org.stage === "Quiet" || org.stage === "Dormant" ? `Checking in: ${program.partnerLabel} in ${program.office}` :
    org.stage === "Active" ? `Thank you, and an update on ${program.partnerLabel}` :
    `Partnering on ${label} in ${org.county} County`;
  return { subject, body };
}

export function planReason(task: Task, org: Organization | undefined, events: RelationshipEvent[], now: number): string {
  if (!org) return task.text;
  const quiet = daysAgo(org.lastReferralAt, now);
  switch (task.reason) {
    case "event": {
      const e = events.find((x) => x.orgIds.includes(org.id) && x.status === "Published");
      return e ? `${e.type} on ${new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}: confirm who now handles referrals.` : "A recent change affects this partner: confirm contacts.";
    }
    case "quiet":
      return quiet ? `Quiet for ${quiet} days: call, then send the updated program list.` : "Referrals have slowed: check in.";
    case "new_high_fit":
      return `Strong fit (${org.type.toLowerCase()}, ${org.distanceMiles} miles away) with no relationship yet.`;
    case "kit":
      return "Active partner without a printed kit: send the coded link and QR.";
    case "visit":
      return "In-person visits keep active partners referring.";
    case "thank_you":
      return `${org.referrals90d} referrals in 90 days: a short thank-you keeps the relationship warm.`;
    default:
      return task.text;
  }
}

export function eventSummary(e: RelationshipEvent): string {
  if (e.summary) return e.summary;
  const why: Record<string, string> = {
    "Staff change": "A new person in this role may not know Clarvida or how to refer. Introduce yourself, share the partner kit and confirm who sends referrals now.",
    "Health plan merger": "Care management teams and contacts may have changed. Confirm referral contacts and share an updated program list.",
    "Rate change": "Partner capacity and wait times may shift. Check in with care coordination leads about what families are waiting for.",
    "Policy change": "Referral rules or eligibility may change. Ask partners what they need from us and update the program list if needed.",
    "New program": "A new service may overlap with or complement ours. Learn how it refers and where families could be redirected.",
    "Closure": "Families served there will need somewhere to go. Reach out early with current openings.",
  };
  return `${e.title}. ${why[e.type] ?? "Ambassadors who work with affected organizations should confirm their contacts and share the current program list."} Source: ${e.sourceLabel}.`;
}
