// Referrer notices and team activity for the referral loop (FT-044, FT-091, FT-094).
// Notices are PHI-free by construction: reference number, Tier 1 status words and next steps only.
import type { Draft } from "immer";
import type { DB, Referral, Tier1Status } from "@/lib/domain/types";
import { statusLink } from "@/lib/rules/status-link";
export { statusLink, statusToken, validToken } from "@/lib/rules/status-link";
import { uid } from "@/lib/store/db";
import { now as clockNow } from "@/lib/clock";

export function sourceName(db: DB | Draft<DB>, r: Pick<Referral, "referrerOrgId" | "referrerOrgName" | "srcType">): string {
  const org = r.referrerOrgId ? db.orgs.find((o) => o.id === r.referrerOrgId) : undefined;
  return org?.name.split(",")[0] ?? r.referrerOrgName ?? (r.srcType === "Family / self" ? "a family (self-referral)" : r.srcType.toLowerCase());
}

const BODY: Record<Tier1Status, (id: string, extra?: string) => { subject: string; body: string }> = {
  Received: (id) => ({ subject: `We received your referral ${id}`, body: `Thank you. Your referral ${id} was received and routed to the right Clarvida team. We will contact the family within 1 business day and let you know when we have.` }),
  "In outreach": (id) => ({ subject: `Update on referral ${id}: we're reaching out`, body: `Our team has started reaching out to the family for referral ${id}. We'll update you again once we connect.` }),
  Contacted: (id) => ({ subject: `Update on referral ${id}: family contacted`, body: `Good news: our team has contacted the family for referral ${id}. Thank you for connecting them with Clarvida.` }),
  "On hold": (id, extra) => ({ subject: `Update on referral ${id}: on a waitlist`, body: `The program chosen for referral ${id} has a waitlist${extra ? ` (expected to reopen ${extra})` : ""}. We are talking with the family about other options now, and we will tell you if anything changes.` }),
  Redirected: (id, extra) => ({ subject: `Update on referral ${id}: connected to another program`, body: `The program first chosen for referral ${id} is full, so we connected the family with ${extra ?? "another program that has openings"}. Being honest about wait times helps families get help sooner.` }),
  Closed: (id) => ({ subject: `Update on referral ${id}: closed`, body: `Referral ${id} is now closed. If the family needs support again, you can refer again any time.` }),
};

/** Writes a PHI-free referrer notice to the Demo Inbox (simulated email) with a signed status link. */
export function mailReferrer(d: Draft<DB>, r: Draft<Referral>, t1: Tier1Status, extra?: string) {
  if (!r.referrerEmail) return;
  const m = BODY[t1](r.id, extra);
  const user = d.users.find((u) => u.email?.toLowerCase() === r.referrerEmail!.toLowerCase());
  d.outbox.unshift({
    id: uid("mail"), at: clockNow(), type: "referrer-notice", toUserId: user?.id, to: r.referrerEmail, toName: r.referrerName ?? undefined,
    from: "Clarvida Referrals <referrals@clarvida.example>", subject: m.subject,
    body: `${m.body}\n\nFor privacy, this message never includes client details. Use the secure link to see the current status.`,
    sentVia: "Simulated email (Demo Inbox)", link: statusLink(r.id), linkLabel: "View referral status", relatedId: r.id, readBy: [],
  });
  if (d.outbox.length > 400) d.outbox.length = 400;
}

/** Team activity line written by the system on behalf of an actor (works for external partners too). */
export function careActivity(d: Draft<DB>, actorId: string, text: string, state: string, link = "/app/intake/") {
  d.activity?.unshift({ id: uid("act"), at: clockNow(), actorId, text, states: [state === "XX" ? "NC" : state], zone: "Care", link });
  if (d.activity && d.activity.length > 300) d.activity.length = 300;
}
