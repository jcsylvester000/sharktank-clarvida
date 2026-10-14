// Live sandbox simulation engine. One browser tab runs it (see live-runner.tsx); every other tab just sees the data change.
// It never writes data directly where a service exists: referrals, contact attempts, status changes, AI drafts,
// capacity and events all go through the same services people use, as simulated teammates, so the rules,
// clocks, notifications and audit log behave exactly as they would for a real team.
// Randomness is seeded (live.rng), so a run can be replayed in tests.
import type { Draft } from "immer";
import type { DB, LiveFeedItem, Organization, PlanStep, Program, Referral, ReferralPlan, SourceType, User } from "@/lib/domain/types";
import { uid } from "@/lib/store/db";
import { withTime } from "@/lib/clock";
import { businessDueAt } from "@/lib/rules/clock";
import { canTransition } from "@/lib/rules/status";
import { isPaused } from "@/lib/rules/outreach";
import { queueLabel } from "@/lib/rules/routing";
import { generateEmail, TEMPLATES } from "@/lib/ai/gateway";
import { SYSTEM_ACTOR, audit, notify, withActor } from "@/lib/services/core";
import { createReferral, escalateOverdue, logAttempt, routeFromTriage, setStatus, countKitScan } from "@/lib/services/referrals";
import { approveDraft, logAI, setCapacity } from "@/lib/services/outreach";
import { createEvent } from "@/lib/services/admin";

const M = 60_000;
const H = 60 * M;
const D = 24 * H;
const MAX_EVENTS_PER_TICK = 80;
const FEED_CAP = 150;

// ---------------------------------------------------------------- seeded randomness
function rand(d: Draft<DB>): number {
  // mulberry32
  let t = (d.live!.rng = (d.live!.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}
const chance = (d: Draft<DB>, p: number) => rand(d) < p;
const between = (d: Draft<DB>, a: number, b: number) => a + rand(d) * (b - a);
const int = (d: Draft<DB>, a: number, b: number) => Math.floor(between(d, a, b + 1));
function pick<T>(d: Draft<DB>, xs: readonly T[]): T {
  return xs[Math.floor(rand(d) * xs.length)];
}
function weighted<T>(d: Draft<DB>, xs: readonly T[], w: (x: T) => number): T | undefined {
  const total = xs.reduce((s, x) => s + Math.max(0, w(x)), 0);
  if (total <= 0) return undefined;
  let r = rand(d) * total;
  for (const x of xs) {
    r -= Math.max(0, w(x));
    if (r <= 0) return x;
  }
  return xs[xs.length - 1];
}
/** Exponential waiting time with the given mean. */
const expo = (d: Draft<DB>, mean: number) => -Math.log(1 - rand(d)) * mean;

// ---------------------------------------------------------------- time helpers
function sla(d: Draft<DB> | DB, state: string) {
  return (d.sla.find((s) => s.state === state) ?? d.sla[0]) as DB["sla"][number];
}
const inBusiness = (d: Draft<DB> | DB, state: string, t: number) => businessDueAt(t, 0, sla(d, state)) === t;
/** `ms` of business time after `t` in a state. */
const bizAfter = (d: Draft<DB> | DB, state: string, t: number, ms: number) => businessDueAt(t, ms, sla(d, state));

// ---------------------------------------------------------------- people
// Disabled accounts (Administration) stop working, simulated or not.
const user = (d: Draft<DB>, id: string) => d.users.find((u) => u.id === id && u.active) as User | undefined;
const first = (name: string) => name.split(" ")[0];
const INTAKE_BY_STATE: Record<string, string> = { NC: "u-sim-noor", CO: "u-sim-diego" };
const HUMAN_AMBASSADORS: Record<string, string> = { NC: "u-maria", CO: "u-jon" };

// ---------------------------------------------------------------- synthetic vocabulary (all invented)
const GUARDIANS = ["Blake", "Cameron", "Dakota", "Elliot", "Finley", "Harper", "Jesse", "Kendall", "Logan", "Micah", "Parker", "Reese", "Sage", "Tatum", "Emery", "Hayden"];
const TIMES = ["Weekday mornings", "Weekday afternoons", "After 3:30 pm", "Evenings"];
const GENERIC_REFERRER: Record<SourceType, string[]> = {
  School: ["School counselor", "School social worker", "School psychologist"],
  "Child welfare": ["Caseworker", "CPS investigator", "Foster care worker"],
  "Hospital / clinician": ["ED social worker", "Discharge planner", "Pediatric nurse"],
  "Health plan care manager": ["Care manager", "Care coordinator"],
  "Court / legal": ["Court counselor", "Guardian ad litem volunteer"],
  "Primary care": ["Behavioral health consultant", "Pediatrician"],
  "Community / faith": ["Youth pastor", "Program coordinator"],
  "Family / self": ["Parent", "Grandparent", "Guardian"],
  Other: ["Head Start family advocate", "Community health worker"],
};
const SRC_FOR_TYPE: Record<Organization["type"], SourceType> = {
  "Child welfare": "Child welfare",
  "Health plan care managers": "Health plan care manager",
  "School district": "School",
  Hospital: "Hospital / clinician",
  "Primary care": "Primary care",
  "Juvenile justice": "Court / legal",
  "Child advocacy": "Court / legal",
  Pediatrics: "Primary care",
  "Crisis services": "Hospital / clinician",
  "Faith / community": "Community / faith",
  "Early childhood": "Other",
  "Community nonprofit": "Community / faith",
  "Public health": "Other",
};
const STAGE_WEIGHT: Record<Organization["stage"], number> = { Active: 3, Engaged: 2, "At risk": 1.5, New: 1, Quiet: 0.5, Dormant: 0.25 };
const REPLIES = [
  "Thanks, we'd welcome a short visit to our team meeting.",
  "Could you send the referral link for our staff newsletter?",
  "We have two families in mind; is the program taking new referrals?",
  "Please add our new coordinator to your contact list.",
  "Can you join our next provider meeting?",
];
const EVENTS: Record<string, { type: string; title: string; sourceLabel: string; counties: string[] }[]> = {
  NC: [
    { type: "Leadership change", title: "Gaston County Schools names a new director of student services", sourceLabel: "District news release (synthetic)", counties: ["Gaston"] },
    { type: "Program change", title: "Regional hospital opens a pediatric behavioral health observation unit", sourceLabel: "Hospital newsroom (synthetic)", counties: ["Gaston"] },
    { type: "Policy change", title: "County DSS moves to a new intake hotline number", sourceLabel: "County website (synthetic)", counties: ["Gaston", "Lincoln"] },
    { type: "Funding", title: "Lincoln County awards a youth mental health grant to local nonprofits", sourceLabel: "County commission minutes (synthetic)", counties: ["Lincoln"] },
  ],
  CO: [
    { type: "Leadership change", title: "El Paso County DHS appoints a new child welfare division manager", sourceLabel: "County news release (synthetic)", counties: ["El Paso"] },
    { type: "Program change", title: "School District 11 expands school-based therapy to middle schools", sourceLabel: "District board notes (synthetic)", counties: ["El Paso"] },
  ],
};
const CAPACITY_NOTES: Record<Program["capacity"], string> = {
  Open: "Openings available this week",
  Limited: "Limited openings; expect a short wait",
  Waitlist: "Full; families are placed on a waitlist",
  Closed: "Not accepting new referrals",
};

// ---------------------------------------------------------------- feed
function feed(d: Draft<DB>, at: number, item: Omit<LiveFeedItem, "id" | "at">) {
  d.live!.feed.unshift({ id: uid("lf"), at, ...item });
  if (d.live!.feed.length > FEED_CAP) d.live!.feed.length = FEED_CAP;
}

// ---------------------------------------------------------------- generators
type Gen = "arrival-NC" | "arrival-CO" | "ai-send" | "reply" | "ai-task" | "event" | "capacity" | "quiet" | "week";
const GENS: Gen[] = ["arrival-NC", "arrival-CO", "ai-send", "reply", "ai-task", "event", "capacity", "quiet", "week"];

/** When each generator fires next, from time t. Business-hours work waits for business hours. */
function schedule(d: Draft<DB>, g: Gen, t: number): number {
  switch (g) {
    case "arrival-NC":
    case "arrival-CO": {
      const st = g === "arrival-NC" ? "NC" : "CO";
      const mean = st === "NC" ? 32 * M : 55 * M;
      // Off-hours referrals still trickle in (web form, platform), about 1 in 12 of the daytime rate.
      return t + expo(d, inBusiness(d, st, t) ? mean : mean * 12);
    }
    case "ai-send": return bizAfter(d, "NC", t, expo(d, 80 * M));
    case "reply": return bizAfter(d, "NC", t, expo(d, 140 * M));
    case "ai-task": return bizAfter(d, "NC", t, expo(d, 3.5 * H));
    case "event": return bizAfter(d, "NC", t, expo(d, 14 * H));
    case "capacity": return bizAfter(d, "NC", t, expo(d, 9 * H));
    case "quiet": return t + 6 * H;
    case "week": return t + 7 * D;
  }
}

function runGen(d: Draft<DB>, g: Gen, t: number, created: string[]) {
  switch (g) {
    case "arrival-NC": return arrival(d, "NC", t, created);
    case "arrival-CO": return arrival(d, "CO", t, created);
    case "ai-send": return aiSend(d, t);
    case "reply": return partnerReply(d, t);
    case "ai-task": return aiTask(d, t);
    case "event": return eventDraft(d, t);
    case "capacity": return capacityChange(d, t);
    case "quiet": return quietCheck(d, t);
    case "week": {
      d.sendCounts = {};
      d.orgSendCounts = {};
      feed(d, t, { kind: "system", zone: "Outreach", text: "New week: outreach send counts reset.", publicText: "New week: outreach send counts reset.", actor: "System" });
      return;
    }
  }
}

// ---------------------------------------------------------------- referrals arrive
function arrival(d: Draft<DB>, state: string, t: number, created: string[]) {
  const orgs = d.orgs.filter((o) => o.state === state) as Organization[];
  const self = chance(d, 0.1);
  const org = self ? undefined : weighted(d, orgs, (o) => (o.referrals90d + 1) * STAGE_WEIGHT[o.stage]);
  const srcType: SourceType = org ? SRC_FOR_TYPE[org.type] : "Family / self";
  const county = org?.county ?? pick(d, Array.from(new Set(d.programs.filter((p) => p.state === state).flatMap((p) => p.counties))));
  const progs = d.programs.filter((p) => p.state === state && p.counties.includes(county)) as Program[];
  const triage = chance(d, 0.07) || progs.length === 0;
  // Schools, child welfare, courts and pediatric practices refer children; adult programs mostly come from clinicians and families.
  const childSource = ["School", "Child welfare", "Court / legal"].includes(srcType) || org?.type === "Pediatrics" || org?.type === "Early childhood";
  const familyFit = (p: Program) => (p.family === "adult" ? (childSource ? 0.03 : 0.6) : 1);
  const program = triage ? undefined : weighted(d, progs, (p) => ({ Open: 3, Limited: 2, Waitlist: 1, Closed: 0.2 })[p.capacity] * familyFit(p));
  const age = program
    ? program.family === "adult" ? int(d, Math.max(18, program.ageMin), Math.min(64, program.ageMax)) : int(d, Math.max(3, program.ageMin), Math.min(17, program.ageMax))
    : int(d, 5, 16);

  const kit = org ? d.kits.find((k) => k.orgId === org.id) : undefined;
  const web = kit ? chance(d, 0.6) : chance(d, 0.45);
  const channel: Referral["channel"] = web ? "Web form" : self ? pick(d, ["Phone", "Walk-in"] as const) : pick(d, ["Phone", "Phone", "Fax", "Statewide platform"] as const);
  const contact = org && org.contacts.length && chance(d, 0.7) ? pick(d, org.contacts) : undefined;
  const recent = d.referrals.find((r) => r.state === state && t - r.receivedAt < 3 * D && r.programId === program?.id);
  const dup = Boolean(recent && chance(d, 0.04));
  const phone = dup ? recent!.phone : `(555) 010-${int(d, 1000, 1999)}`;

  const input = {
    state,
    county,
    programId: program?.id ?? null,
    channel,
    platform: channel === "Statewide platform" ? (state === "NC" ? "NCCARE360" : "Colorado statewide platform (to confirm)") : undefined,
    partnerCode: web && kit ? kit.code : undefined,
    referrerOrgId: org?.id ?? null,
    srcType,
    referrerName: contact?.name,
    referrerRole: contact?.role ?? pick(d, GENERIC_REFERRER[srcType]),
    referrerEmail: contact?.workEmail,
    referrerPhone: contact ? contact.workPhone : srcType === "Family / self" ? undefined : `(555) 010-${int(d, 2000, 2999)}`,
    age,
    coverage: weighted(d, ["Medicaid", "Private insurance", "Uninsured", "Not sure", "Medicare"], (c) => (({ Medicaid: 70, "Private insurance": 13, Uninsured: 7, "Not sure": 7, Medicare: age >= 18 ? 3 : 0 }) as Record<string, number>)[c])!,
    language: weighted(d, ["English", "Español", "Other"] as const, (l) => (({ English: 80, Español: 17, Other: 3 }) as Record<string, number>)[l])!,
    times: [pick(d, TIMES)],
    guardianFirstName: `${pick(d, GUARDIANS)} (synthetic)`,
    phone,
    voicemailOk: chance(d, 0.7),
    consentAgreement: true,
    signedRelease: chance(d, 0.2),
    receivedAt: t,
  };

  const external = channel === "Web form";
  if (input.partnerCode) countKitScan(d, input.partnerCode);
  const intake = user(d, INTAKE_BY_STATE[state]) ?? SYSTEM_ACTOR;
  const id = external ? createReferral(d, input, { external: true }) : withActor(intake, () => createReferral(d, input, { external: false }));

  if (org) {
    const o = d.orgs.find((x) => x.id === org.id)!;
    o.referrals90d += 1;
    o.lastReferralAt = t;
    o.monthly[o.monthly.length - 1] += 1;
    if (o.stage === "Quiet" || o.stage === "Dormant") o.stage = "Active";
    else if (o.stage === "New") o.stage = "Engaged";
  }
  const r = d.referrals.find((x) => x.id === id)! as Referral;
  d.live!.totals.arrivals += 1;
  created.push(id);
  const where = queueLabel(r.queue, d.routing as DB["routing"]);
  const from = `${srcType}${org ? ` (${org.name})` : ""}`;
  feed(d, t, {
    kind: "referral",
    zone: "Care",
    text: `New referral ${id} from ${from} by ${channel.toLowerCase()} → ${where}${r.status === "Hold" ? " (program on waitlist: placed on hold)" : ""}${r.dupOf ? ` · possible duplicate of ${r.dupOf}` : ""}`,
    publicText: `+1 referral from ${from}, ${county} County`,
    link: `/app/referral/?id=${id}`,
    actor: external ? "Partner portal" : intake.name,
  });
  d.live!.plans[id] = makePlan(d, r);
}

// ---------------------------------------------------------------- what a simulated coordinator will do
function makePlan(d: Draft<DB>, r: Referral): ReferralPlan | null {
  const owner = INTAKE_BY_STATE[r.state];
  if (!owner) return null;
  if (r.dupOf) return null; // duplicates are left for people to resolve
  // In North Carolina about half the queue is left for the people using the sandbox (Dana, Ray).
  if (r.state === "NC" && !chance(d, 0.5)) return null;
  const st = r.state;
  const steps: PlanStep[] = [];
  let t = r.receivedAt;
  if (!r.programId) {
    const prog = d.programs.find((p) => p.state === st && p.counties.includes(r.county) && r.age >= p.ageMin && r.age <= p.ageMax);
    if (!prog) return null;
    t = bizAfter(d, st, t, between(d, 20, 90) * M);
    steps.push({ at: t, op: "route", arg: prog.id });
  }
  // First contact: most within 2.5 business hours, some later, about 1 in 10 past the 8-hour target.
  const roll = rand(d);
  const firstDelay = roll < 0.7 ? between(d, 15, 150) * M : roll < 0.9 ? between(d, 2.5, 6) * H : between(d, 8.3, 11) * H;
  t = bizAfter(d, st, r.receivedAt, firstDelay);
  let reached = false;
  for (let i = 0; i < 3; i++) {
    const ok = chance(d, [0.6, 0.65, 0.7][i]);
    steps.push({ at: t, op: "attempt", arg: ok ? "Reached guardian" : chance(d, 0.6) ? "Left voicemail" : "No answer" });
    if (ok) { reached = true; break; }
    t = bizAfter(d, st, t, between(d, 1.5, 5) * H);
  }
  if (!reached) {
    steps.push({ at: bizAfter(d, st, t, between(d, 0.5, 2) * H), op: "close", arg: "Unable to contact" });
    return { owner, steps };
  }
  if (r.status === "Hold") {
    // Waitlisted at arrival: some families choose another provider while they wait.
    if (chance(d, 0.3)) steps.push({ at: bizAfter(d, st, t, between(d, 1, 3) * 8 * H), op: "close", arg: "Served elsewhere" });
    return { owner, steps };
  }
  t = bizAfter(d, st, t, between(d, 20, 120) * M);
  const decide = rand(d);
  if (decide < 0.76) steps.push({ at: t, op: "accept" });
  else if (decide < 0.86) {
    steps.push({ at: t, op: "hold", arg: pick(d, ["Eligibility check", "Awaiting information"]) });
    t = bizAfter(d, st, t, between(d, 1, 2) * 8 * H);
    steps.push({ at: t, op: "accept" });
  } else if (decide < 0.94) {
    steps.push({ at: t, op: "redirect", arg: "Community provider closer to home (external)" });
    return { owner, steps };
  } else {
    steps.push({ at: t, op: "close", arg: "Declined" });
    return { owner, steps };
  }
  t = bizAfter(d, st, t, between(d, 4, 16) * H);
  steps.push({ at: t, op: "schedule" });
  t = bizAfter(d, st, t, between(d, 1, 4) * 8 * H);
  steps.push({ at: t, op: chance(d, 0.82) ? "complete" : "close", arg: "Declined" });
  return { owner, steps };
}

const TERMINAL: Referral["status"][] = ["Closed", "Redirected", "Intake completed"];

function runStep(d: Draft<DB>, id: string, plan: ReferralPlan, step: PlanStep) {
  const r = d.referrals.find((x) => x.id === id);
  if (!r || TERMINAL.includes(r.status as Referral["status"])) { d.live!.plans[id] = null; return; }
  // A person took the referral over: the simulated teammate steps back.
  if (r.ownerId && r.ownerId !== plan.owner) { d.live!.plans[id] = null; return; }
  const actor = user(d, plan.owner);
  if (!actor) { d.live!.plans[id] = null; return; }
  const who = first(actor.name);
  let text = "";
  let publicText = "";
  withActor(actor, () => {
    switch (step.op) {
      case "route": {
        routeFromTriage(d, id, step.arg!);
        text = `${who} routed ${id} from triage`;
        publicText = "Intake routed a referral from triage";
        break;
      }
      case "attempt": {
        const outcome = step.arg as "Reached guardian" | "Left voicemail" | "No answer";
        const firstTime = !r.firstContactAt;
        logAttempt(d, id, "Phone", outcome);
        text = `${who} called the family on ${id}: ${outcome.toLowerCase()}${firstTime ? " (clock stopped)" : ""}`;
        publicText = firstTime ? "Intake made first contact on a referral" : "Intake logged a contact attempt";
        break;
      }
      default: {
        const to = ({ accept: "Accepted", hold: "Hold", redirect: "Redirected", close: "Closed", schedule: "Intake scheduled", complete: "Intake completed" } as const)[step.op];
        if (!canTransition(r.status, to)) return;
        setStatus(d, id, to, step.op === "redirect" ? { reason: "Better fit elsewhere", redirectTo: step.arg } : step.op === "hold" || step.op === "close" ? { reason: step.arg } : {});
        text = `${who} moved ${id} to ${to.toLowerCase()}${step.arg && step.op !== "complete" ? ` (${step.arg})` : ""}`;
        publicText = to === "Intake completed" ? "A referral reached a completed intake" : to === "Intake scheduled" ? "An intake was scheduled" : `A referral was ${to.toLowerCase()}`;
      }
    }
  });
  if (!text) return;
  d.live!.totals.simActions += 1;
  feed(d, step.at, { kind: "intake", zone: "Care", text, publicText, link: `/app/referral/?id=${id}`, actor: actor.name });
}

// ---------------------------------------------------------------- outreach
function aiSend(d: Draft<DB>, t: number) {
  const hannah = user(d, "u-sim-hannah");
  if (!hannah || (d.sendCounts[hannah.id] ?? 0) >= d.sendCap) return;
  const owned = (d.orgs.filter((o) => o.ownerId === hannah.id && (d.orgSendCounts[o.id] ?? 0) < d.orgSendCap && o.contacts.some((c) => !c.optOut)) as Organization[])
    .sort((a, b) => (a.lastTouchAt ?? 0) - (b.lastTouchAt ?? 0));
  const org = owned[0];
  if (!org) return;
  const program = d.programs.find((p) => p.state === org.state && p.counties.includes(org.county) && !isPaused(p as Program)) as Program | undefined;
  if (!program) return;
  const contact = org.contacts.find((c) => !c.optOut)!;
  const email = generateEmail(org, contact, program, hannah, d.events as DB["events"]);
  const edited = chance(d, 0.3);
  withActor(hannah, () => {
    logAI(d, { feature: "AI02", templateId: TEMPLATES.email.id, templateVersion: TEMPLATES.email.version, objectId: org.id, result: "Generated" });
    approveDraft(d, {
      orgId: org.id, contactId: contact.id, programId: program.id, templateId: TEMPLATES.email.id, templateVersion: TEMPLATES.email.version,
      subject: email.subject, draftText: email.body, finalText: edited ? `${email.body}\n\nI can stop by your office next week if that helps.` : email.body,
    });
  });
  d.live!.totals.aiDrafts += 1;
  const line = `Hannah approved an AI-drafted email to ${contact.role} at ${org.name}${edited ? " (edited first)" : ""}; queued (simulated send)`;
  feed(d, t, { kind: "ai", zone: "Outreach", text: line, publicText: line, link: `/app/organization/?id=${org.id}&tab=history`, actor: hannah.name });
}

function partnerReply(d: Draft<DB>, t: number) {
  const candidates = d.drafts.filter((x) => t - x.approvedAt < 5 * D && t - x.approvedAt > 30 * M && !d.touches.some((tc) => tc.orgId === x.orgId && tc.at > x.approvedAt && tc.note.startsWith("Reply from")));
  if (!candidates.length) return;
  const draft = pick(d, candidates);
  const org = d.orgs.find((o) => o.id === draft.orgId);
  const contact = org?.contacts.find((c) => c.id === draft.contactId);
  if (!org || !contact) return;
  const said = pick(d, REPLIES);
  d.touches.unshift({ id: uid("tc"), orgId: org.id, byUserId: org.ownerId, type: "Email", note: `Reply from ${contact.name} (${contact.role}): "${said}"`, at: t });
  org.lastTouchAt = t;
  if (org.stage === "New" || org.stage === "Quiet" || org.stage === "Dormant" || org.stage === "At risk") org.stage = "Engaged";
  notify(d, { toUserId: org.ownerId, text: `${contact.name} at ${org.name} replied`, link: `/app/organization/?id=${org.id}&tab=history` });
  withActor(SYSTEM_ACTOR, () => audit(d, { action: "Partner reply received (simulated inbox)", objectId: org.id, zone: "Outreach" }));
  if (!(user(d, org.ownerId)?.id ?? "").startsWith("u-sim-")) {
    d.tasks.push({ id: uid("t"), ownerId: org.ownerId, orgId: org.id, text: `Answer ${contact.name} at ${org.name}: "${said}"`, reason: "thank_you", minutes: 5, dueAt: t + 2 * D, done: false, source: "plan" });
  }
  d.live!.totals.replies += 1;
  const line = `${contact.name} (${org.name}) replied to outreach: "${said}"`;
  feed(d, t, { kind: "outreach", zone: "Outreach", text: line, publicText: line, link: `/app/organization/?id=${org.id}&tab=history`, actor: contact.name });
}

/** AI prepares a brief and a draft for a person's next best relationship move; the person still approves. */
function aiTask(d: Draft<DB>, t: number) {
  const state = chance(d, 0.7) ? "NC" : "CO";
  const ownerId = HUMAN_AMBASSADORS[state];
  const open = new Set(d.tasks.filter((x) => !x.done && x.ownerId === ownerId).map((x) => x.orgId));
  const orgs = d.orgs.filter((o) => o.ownerId === ownerId && !open.has(o.id) && (o.stage === "Quiet" || o.stage === "At risk" || o.stage === "New" || o.stage === "Dormant")) as Organization[];
  const org = orgs.sort((a, b) => b.referrals90d - a.referrals90d)[0];
  if (!org) return;
  const reason = org.stage === "New" ? "new_high_fit" : "quiet";
  d.tasks.push({ id: uid("t"), ownerId, orgId: org.id, text: `AI draft ready: ${reason === "new_high_fit" ? "introduce Clarvida to" : "re-open referrals with"} ${org.name}`, reason, minutes: 5, dueAt: t + 2 * D, done: false, source: "plan" });
  withActor(SYSTEM_ACTOR, () => logAI(d, { feature: "AI01", templateId: TEMPLATES.brief.id, templateVersion: TEMPLATES.brief.version, objectId: org.id, result: "Generated" }));
  const owner = user(d, ownerId);
  notify(d, { toUserId: ownerId, text: `AI prepared a brief and draft for ${org.name}. Review before anything is sent.`, link: `/app/organization/?id=${org.id}&tab=outreach` });
  const line = `AI prepared a brief and draft for ${owner ? first(owner.name) : "an ambassador"}: ${org.name} (${org.stage.toLowerCase()}). Waiting for a person to approve.`;
  feed(d, t, { kind: "ai", zone: "Outreach", text: line, publicText: line, link: `/app/organization/?id=${org.id}&tab=outreach`, actor: "Co-Pilot (simulated model)" });
}

function eventDraft(d: Draft<DB>, t: number) {
  const state = chance(d, 0.7) ? "NC" : "CO";
  const used = new Set(d.events.map((e) => e.title));
  const e = EVENTS[state].find((x) => !used.has(x.title));
  if (!e) return;
  const id = withActor(SYSTEM_ACTOR, () =>
    createEvent(d, { state, date: new Date(t).toISOString().slice(0, 10), type: e.type, title: e.title, sourceUrl: "https://example.org/synthetic-source", sourceLabel: e.sourceLabel, counties: e.counties }),
  );
  withActor(SYSTEM_ACTOR, () => logAI(d, { feature: "AI05", templateId: TEMPLATES.event.id, templateVersion: TEMPLATES.event.version, objectId: id, result: "Generated" }));
  notify(d, { toRole: "amb_lead", text: `New public update to review: ${e.title}`, link: "/app/events/" });
  const line = `AI spotted a public update: "${e.title}". An Ambassador Lead must confirm it before it creates tasks.`;
  feed(d, t, { kind: "event", zone: "Outreach", text: line, publicText: line, link: "/app/events/", actor: "Co-Pilot (simulated model)" });
}

function capacityChange(d: Draft<DB>, t: number) {
  const marcus = user(d, "u-sim-marcus");
  if (!marcus) return;
  const p = pick(d, d.programs) as Program;
  const next: Program["capacity"] =
    p.capacity === "Open" ? "Limited"
    : p.capacity === "Limited" ? (chance(d, 0.35) ? "Waitlist" : "Open")
    : p.capacity === "Waitlist" ? (chance(d, 0.7) ? "Limited" : "Waitlist")
    : "Limited";
  if (next === p.capacity) return;
  const before = p.capacity;
  const reopen = next === "Waitlist" ? new Date(t + int(d, 14, 45) * D).toISOString().slice(0, 10) : "";
  withActor(marcus, () => setCapacity(d, p.id, next, CAPACITY_NOTES[next], reopen));
  const paused = next === "Waitlist";
  const wasPaused = before === "Waitlist" || before === "Closed";
  const line = `Marcus set ${p.name} (${p.office}) to ${next}${paused && !wasPaused ? ": outreach for it paused automatically" : !paused && wasPaused ? ": outreach resumed" : ""}`;
  feed(d, t, { kind: "capacity", zone: "Both", text: line, publicText: line, link: "/app/capacity/", actor: marcus.name });
}

function quietCheck(d: Draft<DB>, t: number) {
  for (const o of d.orgs) {
    if (o.stage !== "Active" && o.stage !== "Engaged") continue;
    const lastRef = o.lastReferralAt ?? 0;
    const lastTouch = o.lastTouchAt ?? 0;
    if (t - lastRef > 30 * D && t - lastTouch > 21 * D) {
      o.stage = "Quiet";
      const line = `${o.name} went quiet: no referrals in 30 days and no contact in 3 weeks`;
      feed(d, t, { kind: "outreach", zone: "Outreach", text: line, publicText: line, link: `/app/organization/?id=${o.id}`, actor: "System" });
    }
  }
}

// ---------------------------------------------------------------- the tick
export interface TickResult {
  created: string[];
  events: number;
}

/** Advances the simulation to `simNow`, running every due event in time order (at most 80 per call). */
export function tick(d: Draft<DB>, simNow: number): TickResult {
  const L = d.live;
  const created: string[] = [];
  if (!L) return { created, events: 0 };
  // Warm start: a new sandbox shows activity within minutes instead of waiting for the first random event.
  const WARM: Partial<Record<Gen, [number, number]>> = { "arrival-NC": [2, 6], "ai-send": [8, 18], "ai-task": [15, 35], event: [40, 80], capacity: [60, 140] };
  for (const g of GENS) {
    if (L.next[g] !== undefined) continue;
    const w = L.lastTick === L.startedAt ? WARM[g] : undefined;
    L.next[g] = w ? L.lastTick + between(d, w[0], w[1]) * M : schedule(d, g, L.lastTick);
  }

  // Referrals entered by people (partner form, New referral) get a plan the first time the engine sees them.
  for (const r of d.referrals) {
    if (r.id in L.plans) continue;
    L.plans[r.id] = r.receivedAt >= L.startedAt ? withTime(r.receivedAt, () => makePlan(d, r as Referral)) : null;
    if (r.receivedAt >= L.startedAt) {
      feed(d, r.receivedAt, { kind: "referral", zone: "Care", text: `New referral ${r.id} entered by a person (${r.channel.toLowerCase()}, ${r.srcType})`, publicText: `+1 referral from ${r.srcType}, ${r.county} County`, link: `/app/referral/?id=${r.id}`, actor: "Person in the sandbox" });
    }
  }

  let events = 0;
  let lastAt = L.lastTick;
  while (events < MAX_EVENTS_PER_TICK) {
    let at = Infinity;
    let run: (() => void) | null = null;
    for (const g of GENS) {
      const due = L.next[g];
      if (due <= simNow && due < at) {
        at = due;
        run = () => {
          withTime(due, () => runGen(d, g, due, created));
          L.next[g] = schedule(d, g, due);
        };
      }
    }
    for (const [id, plan] of Object.entries(L.plans)) {
      const step = plan?.steps[0];
      if (step && step.at <= simNow && step.at < at) {
        at = step.at;
        run = () => {
          const p = L.plans[id];
          if (!p) return;
          p.steps.shift();
          withTime(step.at, () => runStep(d, id, p as ReferralPlan, step));
          if (L.plans[id] && L.plans[id]!.steps.length === 0) L.plans[id] = null;
        };
      }
    }
    if (!run) break;
    run();
    lastAt = Math.max(lastAt, at);
    events++;
  }
  const capped = events >= MAX_EVENTS_PER_TICK;

  // Overdue referrals escalate to the supervisor (BR05), whether or not anyone has the queue open.
  const before = new Set(d.referrals.filter((r) => r.escalatedAt).map((r) => r.id));
  withActor(SYSTEM_ACTOR, () => withTime(simNow, () => escalateOverdue(d, simNow)));
  for (const r of d.referrals) {
    if (r.escalatedAt && !before.has(r.id)) {
      feed(d, simNow, { kind: "intake", zone: "Care", text: `${r.id} passed the 1-business-day target: escalated to the intake supervisor`, publicText: "A referral passed the response target and was escalated", link: `/app/referral/?id=${r.id}`, actor: "System" });
      events++;
    }
  }

  // Finished plans are dropped so the state stays small.
  for (const [id, plan] of Object.entries(L.plans)) if (plan && plan.steps.length === 0) L.plans[id] = null;
  L.lastTick = capped ? lastAt : Math.max(L.lastTick, simNow);
  return { created, events };
}

/** The earliest simulated time anything is due; the runner skips writing until then. */
export function nextDue(db: DB): number {
  const L = db.live;
  if (!L) return Infinity;
  let at = Infinity;
  for (const g of GENS) at = Math.min(at, L.next[g] ?? -Infinity);
  for (const plan of Object.values(L.plans)) if (plan?.steps[0]) at = Math.min(at, plan.steps[0].at);
  for (const r of db.referrals) if (!(r.id in L.plans)) return -Infinity;
  return at;
}
