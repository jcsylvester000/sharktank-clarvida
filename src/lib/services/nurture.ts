// Nurture journeys (FT-062, FT-063, Blueprint Screen 4). Automation does the early, repetitive outreach;
// a person approves the first message and takes over with a call when the relationship turns warm.
import type { Draft } from "immer";
import type { DB, NurtureEnrollment, NurtureStepKind } from "@/lib/domain/types";
import { NURTURE_TEMPLATES, makeSteps } from "@/lib/data/outreach";
import { isPaused } from "@/lib/rules/outreach";
import { activity, audit, currentUser, notify } from "./core";
import { uid } from "@/lib/store/db";
import { now as clockNow } from "@/lib/clock";

const D = 86_400_000;
export const WARM_THRESHOLD = 70;
export const SIGNAL_POINTS = { Opened: 8, Clicked: 10, Downloaded: 14, Registered: 30, Replied: 30 } as const;

export function warmScore(j: Pick<NurtureEnrollment, "signals">): number {
  return Math.min(100, j.signals.reduce((s, x) => s + SIGNAL_POINTS[x.kind], 0));
}

export function enroll(d: Draft<DB>, x: { orgId: string; template: NurtureEnrollment["template"]; programId: string }): { ok: boolean; reason?: string; id?: string } {
  const u = currentUser(d);
  const org = d.orgs.find((o) => o.id === x.orgId);
  const p = d.programs.find((q) => q.id === x.programId);
  if (!u || !org || !p) return { ok: false, reason: "Choose an organization and a program." };
  if (isPaused(p as DB["programs"][number])) return { ok: false, reason: `${p.name} is on ${p.capacity.toLowerCase()}: outreach for it is paused.` };
  if (d.nurture.some((j) => j.orgId === x.orgId && (j.status === "Active" || j.status === "Warm: call now"))) return { ok: false, reason: "This organization is already in a journey." };
  const at = clockNow();
  const steps = makeSteps(x.template, -1, at, "");
  steps[0].status = "Waiting for approval";
  const id = uid("nj");
  d.nurture.unshift({ id, orgId: x.orgId, ownerId: u.id, template: x.template, programId: x.programId, enrolledAt: at, steps, signals: [], warmScore: 0, status: "Active", firstApproved: false });
  audit(d, { action: `Enrolled in nurture journey (${x.template})`, objectId: x.orgId, zone: "Outreach" });
  activity(d, `${u.firstName ?? u.name} enrolled ${org.name.split(",")[0]} in a nurture journey`, { link: "/app/nurture/", states: [org.state] });
  return { ok: true, id };
}

function sendStep(d: Draft<DB>, j: Draft<NurtureEnrollment>, i: number, at: number) {
  const s = j.steps[i];
  const org = d.orgs.find((o) => o.id === j.orgId);
  const owner = d.users.find((u) => u.id === j.ownerId);
  const contact = org?.contacts.find((c) => !c.optOut);
  s.status = "Sent";
  s.sentAt = at;
  d.outbox.unshift({
    id: uid("mail"), at, type: "nurture", fromUserId: owner?.id, from: `${owner?.name ?? "Clarvida"} <${owner?.email ?? "outreach@clarvida.example"}>`, to: contact?.workEmail ?? `info@${(org?.name ?? "partner").split(/[ ,]/)[0].toLowerCase()}.example`,
    toName: contact ? `${contact.name}, ${org?.name}` : org?.name, subject: s.subject,
    body: `${s.kind} from the "${j.template}" journey, approved by ${s.approvedBy ?? j.steps[0].approvedBy ?? owner?.name}.\n\nBusiness email to a partner organization about Clarvida programs. No client information.\n\nClarvida, 513 Prince Edward Street, Suite 101, Fredericksburg, VA 22401. Unsubscribe: reply STOP.`,
    sentVia: "Queued in approved CRM (simulated)", relatedId: j.orgId, link: "/app/nurture/", linkLabel: "Open the journey", readBy: [],
  });
}

/** The first step needs a person's approval; later steps then run on schedule (AC-PF-24). */
export function approveFirstStep(d: Draft<DB>, id: string): string | null {
  const j = d.nurture.find((x) => x.id === id);
  const u = currentUser(d);
  if (!j || !u) return null;
  const p = d.programs.find((q) => q.id === j.programId);
  if (p && isPaused(p as DB["programs"][number])) return `${p.name} is on ${p.capacity.toLowerCase()}: outreach paused.`;
  j.steps[0].approvedBy = u.name;
  j.firstApproved = true;
  sendStep(d, j, 0, clockNow());
  j.steps.slice(1).forEach((s) => { if (s.status !== "Sent") s.status = "Scheduled"; });
  audit(d, { action: `Approved nurture step 1 (${j.steps[0].kind})`, objectId: j.orgId, zone: "Outreach", category: "ai" });
  return null;
}

const SIGNALS_FOR: Record<NurtureStepKind, NurtureEnrollment["signals"][number]["kind"][]> = {
  "Intro email": ["Opened", "Clicked"],
  Resource: ["Opened", "Downloaded"],
  "Webinar invite": ["Opened", "Registered"],
  "Check-in": ["Opened", "Replied"],
};

/** Demo control (JR-03.03): simulate `days` passing. Steps go out on schedule and engagement signals arrive. */
export function fastForward(d: Draft<DB>, id: string, days = 14): boolean {
  const j = d.nurture.find((x) => x.id === id);
  if (!j || !j.firstApproved || j.status !== "Active") return false;
  const p = d.programs.find((q) => q.id === j.programId);
  if (p && isPaused(p as DB["programs"][number])) return false;
  const now = clockNow();
  for (let i = 0; i < j.steps.length; i++) {
    const s = j.steps[i];
    if (s.status === "Sent" || s.day > days) continue;
    const at = now - (days - s.day) * D;
    sendStep(d, j, i, Math.min(now, at));
  }
  for (const s of j.steps.filter((x) => x.status === "Sent")) {
    for (const k of SIGNALS_FOR[s.kind]) {
      if (j.signals.some((g) => g.kind === k && g.step === s.kind)) continue;
      j.signals.push({ kind: k, step: s.kind, at: Math.min(now, (s.sentAt ?? now) + 6 * 3_600_000) });
      j.warmScore = warmScore(j);
      if (j.warmScore >= WARM_THRESHOLD) break;
    }
    if (j.warmScore >= WARM_THRESHOLD) break;
  }
  j.warmScore = warmScore(j);
  audit(d, { action: `Nurture journey fast-forwarded ${days} days (demo)`, objectId: j.orgId, zone: "Demo" });
  if (j.warmScore >= WARM_THRESHOLD) handOff(d, j);
  return true;
}

/** FT-063: warm signal → "Warm: call now" task and notification with talking points. Remaining steps stop. */
function handOff(d: Draft<DB>, j: Draft<NurtureEnrollment>) {
  const org = d.orgs.find((o) => o.id === j.orgId);
  j.status = "Warm: call now";
  j.handedOffAt = clockNow();
  j.steps.forEach((s) => { if (s.status === "Scheduled") s.status = "Skipped"; });
  d.tasks.push({ id: uid("t"), ownerId: j.ownerId, orgId: j.orgId, text: `Warm: call ${org?.name.split(",")[0] ?? "this partner"} now`, reason: "manual", minutes: 10, dueAt: clockNow() + 86_400_000, done: false, source: "plan" });
  notify(d, { toUserId: j.ownerId, type: "handoff", text: `Warm: call now. ${org?.name.split(",")[0]} opened, downloaded and registered (warm score ${j.warmScore}).`, link: "/app/nurture/" });
  audit(d, { action: `Warm handoff to owner (score ${j.warmScore})`, objectId: j.orgId, zone: "Outreach" });
}

export function setPaused(d: Draft<DB>, id: string, paused: boolean) {
  const j = d.nurture.find((x) => x.id === id);
  if (!j || j.status === "Completed" || j.status === "Warm: call now") return;
  j.status = paused ? "Paused" : "Active";
  audit(d, { action: paused ? "Paused nurture journey" : "Resumed nurture journey", objectId: j.orgId, zone: "Outreach" });
}

export function talkingPoints(org: { name: string; type: string }, j: Pick<NurtureEnrollment, "signals" | "template">, programLabel: string): string[] {
  const kinds = new Set(j.signals.map((s) => s.kind));
  return [
    `Thank them for ${kinds.has("Registered") ? "registering for the briefing" : "reading our updates"}; ask what their team is seeing right now.`,
    `${kinds.has("Downloaded") ? "They downloaded the referral guide: offer a coded partner link so referrals carry their source." : "Offer the one-page referral guide and a coded partner link."}`,
    `Share current openings for ${programLabel}; we respond to every family within 1 business day.`,
    "Suggest a 20-minute visit with their care team in the next two weeks.",
  ];
}

export { NURTURE_TEMPLATES };
