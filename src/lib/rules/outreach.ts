import type { Contact, Organization, Program, RelationshipEvent, Stage, Task, TaskReason } from "@/lib/domain/types";
import { phiScan } from "./phi";

const D = 86_400_000;

// ---------- BR18 send compliance ----------
export interface SendCheck {
  id: "phi" | "footer" | "optout" | "cap" | "orgcap" | "capacity" | "verified";
  label: string;
  pass: boolean;
  warnOnly?: boolean;
  detail: string;
}

export const FOOTER_MARKER = "Unsubscribe";

export function sendChecks(input: {
  text: string;
  contact: Contact | undefined;
  program: Program | undefined;
  userSends: number;
  orgSends: number;
  cap: number;
  orgCap: number;
  now: number;
}): SendCheck[] {
  const phi = phiScan(input.text);
  const verifiedDays = input.contact?.verifiedAt ? Math.round((input.now - input.contact.verifiedAt) / D) : null;
  const paused = input.program ? input.program.capacity === "Waitlist" || input.program.capacity === "Closed" : false;
  return [
    { id: "phi", label: "No client details", pass: !phi.blocked, detail: phi.blocked ? `Blocked: possible client details (${phi.category}). Remove them to continue.` : "PHI scan found no client details." },
    { id: "footer", label: "Unsubscribe footer", pass: input.text.includes(FOOTER_MARKER), detail: input.text.includes(FOOTER_MARKER) ? "Sender, address and unsubscribe link present (CAN-SPAM)." : input.text.trim() ? "Put back the footer with the unsubscribe link." : "Added to every draft automatically." },
    { id: "optout", label: "Recipient has not opted out", pass: Boolean(input.contact) && !input.contact!.optOut, detail: !input.contact ? "Choose a recipient." : input.contact.optOut ? "This contact opted out. Choose another contact." : `${input.contact.name} can receive email.` },
    { id: "cap", label: "Your weekly send cap", pass: input.userSends < input.cap, detail: `Your sends this week: ${input.userSends} / ${input.cap}` },
    { id: "orgcap", label: "Organization weekly cap", pass: input.orgSends < input.orgCap, detail: `Emails to this organization this week: ${input.orgSends} / ${input.orgCap}` },
    { id: "capacity", label: "Program accepting referrals", pass: !paused, detail: paused ? `${input.program!.partnerLabel} is on ${input.program!.capacity}: outreach paused.` : input.program ? `${input.program.partnerLabel} is ${input.program.capacity}.` : "Choose a program." },
    { id: "verified", label: "Contact verified in the last 12 months", pass: verifiedDays !== null && verifiedDays <= 365, warnOnly: true, detail: verifiedDays === null ? "No verification date. Confirm the contact before sending." : `Verified ${verifiedDays} days ago.` },
  ];
}

export function canApprove(checks: SendCheck[]): boolean {
  return checks.every((c) => c.pass || c.warnOnly);
}

export function isPaused(p: Program | undefined | null): boolean {
  return Boolean(p && (p.capacity === "Waitlist" || p.capacity === "Closed"));
}

// ---------- BR20 relationship stage ----------
export function deriveStage(org: Organization, events: RelationshipEvent[], now: number): Stage {
  if (events.some((e) => e.status === "Published" && e.orgIds.includes(org.id) && now - Date.parse(e.date) < 60 * D)) return "At risk";
  const last = org.lastReferralAt;
  const hadHistory = org.monthly.slice(0, 3).reduce((a, b) => a + b, 0) >= 3;
  if (last && now - last <= 30 * D) return "Active";
  if (last && now - last > 90 * D) return "Dormant";
  if (last && now - last > 30 * D && hadHistory) return "Quiet";
  if (org.lastTouchAt && now - org.lastTouchAt <= 30 * D) return "Engaged";
  if (!last && !org.lastTouchAt) return "New";
  return last ? "Quiet" : "New";
}

export function sourceHealth(orgs: Organization[]) {
  return {
    active: orgs.filter((o) => o.stage === "Active" || o.stage === "Engaged").length,
    quiet: orgs.filter((o) => o.stage === "Quiet" || o.stage === "At risk").length,
    dormant: orgs.filter((o) => o.stage === "Dormant").length,
    fresh: orgs.filter((o) => o.stage === "New").length,
  };
}

// ---------- BR21 weekly plan ----------
const REASON_POINTS: Record<TaskReason, number> = { event: 40, quiet: 30, new_high_fit: 20, kit: 12, visit: 15, thank_you: 10, manual: 18 };

export function taskPriority(t: Task, org: Organization | undefined): number {
  let p = REASON_POINTS[t.reason];
  if (org?.stage === "At risk") p += 5;
  if (org?.stage === "Quiet") p += 3;
  return p;
}

export function weeklyPlan(tasks: Task[], orgs: Organization[], ownerId: string, limit = 6): Task[] {
  const byId = new Map(orgs.map((o) => [o.id, o]));
  return tasks
    .filter((t) => t.ownerId === ownerId && !t.done)
    .sort((a, b) => taskPriority(b, byId.get(b.orgId)) - taskPriority(a, byId.get(a.orgId)) || a.dueAt - b.dueAt)
    .slice(0, limit);
}

export const REASON_LABEL: Record<TaskReason, string> = {
  event: "Relationship reset",
  quiet: "Gone quiet",
  new_high_fit: "New, strong fit",
  kit: "Partner kit",
  visit: "Visit",
  thank_you: "Say thanks",
  manual: "Your task",
};
