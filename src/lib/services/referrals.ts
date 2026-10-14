// Referral services (C02–C06). Production: Laravel actions in the Care Zone.
import type { Draft } from "immer";
import type { Channel, ContactAttempt, DB, Referral, ReferralStatus, SourceType } from "@/lib/domain/types";
import { referralId } from "@/lib/rules/refs";
import { findDuplicate, routeReferral } from "@/lib/rules/routing";
import { canTransition, tier1Status } from "@/lib/rules/status";
import { clockFor } from "@/lib/rules/clock";
import { audit, currentUser, notify } from "./core";
import { now as clockNow } from "@/lib/clock";

export interface NewReferralInput {
  state: string;
  county: string;
  programId: string | null;
  channel: Channel;
  platform?: string;
  partnerCode?: string;
  referrerOrgId: string | null;
  referrerOrgName?: string;
  srcType: SourceType;
  referrerName?: string;
  referrerRole: string;
  referrerEmail?: string;
  referrerPhone?: string;
  age: number;
  coverage: string;
  language: Referral["language"];
  times: string[];
  guardianFirstName: string;
  phone: string;
  voicemailOk?: boolean;
  consentAgreement: boolean;
  signedRelease: boolean;
  receivedAt?: number;
}

/** Creates, routes, de-duplicates and announces a referral (BR01–BR04, BR17, FR-019, FR-062). Returns the new ID. */
export function createReferral(d: Draft<DB>, input: NewReferralInput, opts: { external: boolean }): string {
  const now = input.receivedAt ?? clockNow();
  const id = referralId(input.programId ? input.state : input.state || "XX", d.refSeq);
  d.refSeq += 1;
  const route = routeReferral({ state: input.state, county: input.county, programId: input.programId, age: input.age }, d.programs as DB["programs"]);
  const program = d.programs.find((p) => p.id === input.programId);
  const paused = Boolean(program && (program.capacity === "Waitlist" || program.capacity === "Closed"));
  const dupOf = findDuplicate({ phone: input.phone, programId: input.programId, receivedAt: now }, d.referrals as DB["referrals"]);
  const staff = currentUser(d);
  const by = opts.external ? "Partner portal" : staff?.name ?? "Intake";

  const r: Referral = {
    id,
    ...input,
    receivedAt: now,
    queue: route.queue,
    status: paused ? "Hold" : "New",
    statusReason: paused ? "Waitlist" : undefined,
    part2Consent: false,
    dupOf,
    attempts: [],
    history: [{ at: now, to: "Received", by, note: `Routed to ${route.queue}${route.triage ? ` (${route.reason})` : ""}` }],
    notices: [],
  };
  if (paused) r.history.push({ at: now, from: "New", to: "Hold", by: "System", note: `Waitlist: ${program!.partnerLabel} is on ${program!.capacity}` });
  r.notices.push({
    at: now,
    type: paused ? "On hold" : "Received",
    to: input.referrerEmail ?? "referrer",
    subject: `Your referral ${id} was received`,
    text: paused
      ? `Your referral ${id} was received. This program has a waitlist; we will call the family to discuss options.`
      : `Your referral ${id} was received. We will contact the family within 1 business day.`,
  });
  d.referrals.unshift(r);

  if (input.partnerCode) {
    const kit = d.kits.find((k) => k.code === input.partnerCode);
    if (kit) kit.referrals += 1;
  }
  if (opts.external) d.demo.lastPartnerRef = id;

  const label = d.routing.find((x) => x.queue === route.queue)?.queueLabel ?? route.queue;
  notify(d, { toRole: "intake", text: `New referral ${id} in ${label}`, link: `/app/referral/?id=${id}` });
  if (route.triage) notify(d, { toRole: "intake_sup", text: `${id} needs triage (${route.reason.toLowerCase()})`, link: "/app/intake/?queue=triage" });

  audit(d, {
    action: opts.external ? "Referral submitted via partner portal" : `Created referral (manual entry, ${input.channel})`,
    objectId: id,
    zone: "Care",
    category: "care",
    actor: opts.external ? "external" : undefined,
  });
  return id;
}

function getRef(d: Draft<DB>, id: string) {
  const r = d.referrals.find((x) => x.id === id);
  if (!r) throw new Error(`Referral ${id} not found`);
  return r;
}

function pushNotice(r: Draft<Referral>) {
  const t1 = tier1Status(r as Referral);
  if (r.notices.length && r.notices[r.notices.length - 1].type === t1) return; // nothing new to tell the referrer
  r.notices.push({ at: clockNow(), type: t1, to: r.referrerEmail ?? "referrer", subject: `Update on referral ${r.id}`, text: `Your referral ${r.id} was updated: ${t1}.` });
}

/** BR06: the first attempt stops the clock; the referrer is told "In outreach". */
export function logAttempt(d: Draft<DB>, id: string, method: ContactAttempt["method"], outcome: ContactAttempt["outcome"]) {
  const r = getRef(d, id);
  const by = currentUser(d)?.name ?? "Intake";
  const now = clockNow();
  r.attempts.push({ at: now, method, outcome, by });
  const first = !r.firstContactAt;
  if (first) r.firstContactAt = now;
  r.history.push({ at: now, to: "Contact attempt", by, note: `${method}: ${outcome}` });
  if (r.status === "New" && outcome === "Reached guardian") {
    r.history.push({ at: now, from: "New", to: "Contacted", by });
    r.status = "Contacted";
  }
  if (!r.ownerId) r.ownerId = currentUser(d)?.id;
  if (first || outcome === "Reached guardian") pushNotice(r);
  audit(d, { action: `Logged contact attempt (${method}: ${outcome})`, objectId: id, zone: "Care", category: "care" });
}

/** BR07/BR08: validated status change with reason; referrer told in Tier 1 words. */
export function setStatus(d: Draft<DB>, id: string, to: ReferralStatus, opts: { reason?: string; redirectTo?: string } = {}) {
  const r = getRef(d, id);
  if (!canTransition(r.status, to)) throw new Error(`Cannot move from ${r.status} to ${to}`);
  const by = currentUser(d)?.name ?? "Intake";
  const from = r.status;
  r.status = to;
  r.statusReason = opts.reason;
  if (opts.redirectTo) r.redirectTo = opts.redirectTo;
  if (!r.ownerId) r.ownerId = currentUser(d)?.id;
  r.history.push({ at: clockNow(), from, to, by, note: [opts.reason, opts.redirectTo && `to ${opts.redirectTo}`].filter(Boolean).join(" ") || undefined });
  if (to === "Accepted" || to === "Hold" || to === "Redirected" || to === "Closed" || to === "Intake scheduled" || to === "Intake completed") pushNotice(r);
  audit(d, { action: `Referral ${to.toLowerCase()}${opts.reason ? ` (${opts.reason})` : ""}`, objectId: id, zone: "Care", category: "care" });
}

export function assignOwner(d: Draft<DB>, id: string, userId: string) {
  const r = getRef(d, id);
  r.ownerId = userId;
  audit(d, { action: "Assigned referral owner", objectId: id, zone: "Care", category: "care" });
}

export function recordConsent(d: Draft<DB>, id: string, type: "signed_release" | "part2_consent") {
  const r = getRef(d, id);
  if (type === "signed_release") r.signedRelease = true;
  else r.part2Consent = true;
  r.history.push({ at: clockNow(), to: "Consent", by: currentUser(d)?.name ?? "Intake", note: type === "signed_release" ? "Signed release recorded" : "Part 2 consent recorded" });
  audit(d, { action: type === "signed_release" ? "Recorded signed release" : "Recorded Part 2 consent", objectId: id, zone: "Care", category: "care" });
}

export function logReveal(d: Draft<DB>, id: string, field: string) {
  audit(d, { action: `Revealed protected field (${field})`, objectId: id, zone: "Care", category: "care" });
}

export function routeFromTriage(d: Draft<DB>, id: string, programId: string) {
  const r = getRef(d, id);
  const p = d.programs.find((x) => x.id === programId);
  if (!p) return;
  r.programId = programId;
  r.queue = p.queue;
  if (r.county === "Not sure") r.county = p.counties[0];
  r.history.push({ at: clockNow(), to: "Routed", by: currentUser(d)?.name ?? "Supervisor", note: `Routed from triage to ${p.queue}` });
  audit(d, { action: `Routed from triage to ${p.queue}`, objectId: id, zone: "Care", category: "care" });
}

export function resolveDuplicate(d: Draft<DB>, id: string, decision: "keep" | "merge") {
  const r = getRef(d, id);
  const other = r.dupOf ? d.referrals.find((x) => x.id === r.dupOf) : undefined;
  if (decision === "merge" && other) {
    other.history.push({ at: clockNow(), to: "Routed", by: currentUser(d)?.name ?? "Intake", note: `Merged with ${r.id}; both referrers kept (${other.srcType}, ${r.srcType})` });
    r.history.push({ at: clockNow(), from: r.status, to: "Closed", by: currentUser(d)?.name ?? "Intake", note: `Duplicate of ${other.id}; referrer kept on ${other.id}` });
    r.status = "Closed";
    r.statusReason = "Duplicate";
  }
  r.dupOf = null;
  audit(d, { action: decision === "merge" ? `Merged duplicate into ${other?.id ?? "referral"}` : "Duplicate flag cleared (kept separate)", objectId: id, zone: "Care", category: "care" });
}

/** BR05: first breach escalates once to the intake supervisor. */
export function escalateOverdue(d: Draft<DB>, now: number): number {
  let n = 0;
  for (const r of d.referrals) {
    if (r.escalatedAt) continue;
    const c = clockFor(r as Referral, now, d.demo.clockMode, d.sla.find((s) => s.state === r.state) as DB["sla"][number] | undefined);
    if (c.state === "overdue") {
      r.escalatedAt = now;
      notify(d, { toRole: "intake_sup", text: `${r.id} is overdue: escalated to you`, link: `/app/referral/?id=${r.id}` });
      audit(d, { action: "Escalated overdue referral to supervisor", objectId: r.id, zone: "Care", category: "care" });
      n++;
    }
  }
  return n;
}

export function countKitScan(d: Draft<DB>, code: string) {
  const k = d.kits.find((x) => x.code === code);
  if (k) k.scans += 1;
}

/** Records scope (BR36): which referrals a user may see. */
export function referralsInScope(db: DB, userId: string | undefined): Referral[] {
  const u = db.users.find((x) => x.id === userId);
  if (!u) return [];
  if (u.scope.includes("ALL")) return db.referrals;
  return db.referrals.filter((r) => u.scope.includes(r.state) || (r.queue.startsWith("Triage") && u.scope.some((s) => r.queue.includes(s))));
}
