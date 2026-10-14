// Outreach Zone services (C07, C11–C16). No client data passes through these functions.
import type { Draft } from "immer";
import type { AIFeature, AILogEntry, Capacity, Contact, DB, OutreachDraft, PartnerKit, TouchType } from "@/lib/domain/types";
import { uid } from "@/lib/store/db";
import { audit, currentUser, notify } from "./core";
import { MODEL_ID } from "@/lib/ai/gateway";
import { fitScore } from "@/lib/rules/fitScore";
import { now as clockNow } from "@/lib/clock";

export function logAI(d: Draft<DB>, e: { feature: AIFeature; templateId: string; templateVersion: string; objectId: string; result: AILogEntry["result"]; blockedCategory?: string }) {
  const u = currentUser(d);
  d.ailog.unshift({ id: uid("ai"), at: clockNow(), userId: u?.id ?? "system", modelId: e.result === "Blocked" ? "—" : MODEL_ID, ...e });
  if (d.ailog.length > 300) d.ailog.length = 300;
  if (e.result === "Generated" || e.result === "Viewed") audit(d, { action: `Generated AI ${e.feature === "AI01" ? "brief" : e.feature === "AI02" ? "draft" : e.feature === "AI05" ? "event summary" : "output"} (${e.templateId} ${e.templateVersion})`, objectId: e.objectId, zone: "Outreach", category: "ai" });
}

/** PHI guard block (FR-101): logged, Compliance notified. The matched text is never stored. */
export function recordBlocked(d: Draft<DB>, e: { objectId: string; category: string; where: string; feature?: AIFeature }) {
  const org = d.orgs.find((o) => o.id === e.objectId);
  audit(d, { action: `Blocked: possible client details (${e.category}) in ${e.where}`, objectId: e.objectId, zone: "Outreach", category: "blocked" });
  if (e.feature) logAI(d, { feature: e.feature, templateId: "PT-email", templateVersion: "v2.1", objectId: e.objectId, result: "Blocked", blockedCategory: e.category });
  notify(d, { toRole: "compliance", text: `PHI guard blocked ${e.where}${org ? ` (${org.name})` : ""}`, link: "/app/ai-governance/" });
}

export function setTaskDone(d: Draft<DB>, taskId: string, done: boolean) {
  const t = d.tasks.find((x) => x.id === taskId);
  if (!t) return;
  t.done = done;
  t.doneAt = done ? clockNow() : undefined;
  audit(d, { action: done ? "Completed task" : "Reopened task", objectId: taskId, zone: "Outreach" });
}

export function logTouch(d: Draft<DB>, t: { orgId: string; type: TouchType; note: string }) {
  const u = currentUser(d);
  d.touches.unshift({ id: uid("tc"), byUserId: u?.id ?? "", at: clockNow(), ...t });
  const org = d.orgs.find((o) => o.id === t.orgId);
  if (org) {
    org.lastTouchAt = clockNow();
    if (org.stage === "New") org.stage = "Engaged";
  }
  audit(d, { action: `Logged ${t.type.toLowerCase()}`, objectId: t.orgId, zone: "Outreach" });
}

/** Weekly plan refresh (AU11): adds missing candidate actions from the rules; never duplicates an open task. */
export function refreshPlan(d: Draft<DB>, userId: string, now: number) {
  const owned = d.orgs.filter((o) => o.ownerId === userId);
  const open = d.tasks.filter((t) => t.ownerId === userId && !t.done);
  const has = (orgId: string) => open.some((t) => t.orgId === orgId);
  let added = 0;
  for (const o of owned) {
    if (has(o.id)) continue;
    const evt = d.events.some((e) => e.status === "Published" && e.orgIds.includes(o.id));
    const fit = fitScore(o as DB["orgs"][number], { family: "child", weights: d.gatekeeperWeights as DB["gatekeeperWeights"], programs: d.programs as DB["programs"], now });
    let reason: DB["tasks"][number]["reason"] | null = null;
    let text = "";
    if (evt) { reason = "event"; text = `Reconnect with ${o.name} after the recent change`; }
    else if (o.stage === "Quiet" || o.stage === "Dormant") { reason = "quiet"; text = `Re-open referrals with ${o.name}`; }
    else if (o.stage === "New" && fit.score >= 60 && !o.lastTouchAt) { reason = "new_high_fit"; text = `Introduce Clarvida to ${o.name}`; }
    if (reason) {
      d.tasks.push({ id: uid("t"), ownerId: userId, orgId: o.id, text, reason, minutes: reason === "new_high_fit" ? 5 : 10, dueAt: now + 3 * 86_400_000, done: false, source: "plan" });
      added++;
    }
  }
  audit(d, { action: `Refreshed weekly plan (${added} new)`, objectId: userId, zone: "Outreach" });
  return added;
}

export function addVisitTask(d: Draft<DB>, orgId: string, userId: string) {
  const o = d.orgs.find((x) => x.id === orgId);
  if (!o) return;
  d.tasks.push({ id: uid("t"), ownerId: userId, orgId, text: `Visit ${o.name}`, reason: "visit", minutes: 45, dueAt: clockNow() + 2 * 86_400_000, done: false, source: "route" });
  audit(d, { action: "Added visit to route", objectId: orgId, zone: "Outreach" });
}

export function approveDraft(d: Draft<DB>, x: Omit<OutreachDraft, "id" | "approvedBy" | "approvedAt" | "sendStatus" | "modelId" | "editedChars">) {
  const u = currentUser(d)!;
  const edited = x.finalText !== x.draftText;
  const editedChars = Math.abs(x.finalText.length - x.draftText.length) + (edited ? 1 : 0);
  d.drafts.unshift({ id: uid("od"), ...x, modelId: MODEL_ID, editedChars, approvedBy: u.id, approvedAt: clockNow(), sendStatus: "Queued in approved CRM (simulated)" });
  d.sendCounts[u.id] = (d.sendCounts[u.id] ?? 0) + 1;
  d.orgSendCounts[x.orgId] = (d.orgSendCounts[x.orgId] ?? 0) + 1;
  d.touches.unshift({ id: uid("tc"), orgId: x.orgId, byUserId: u.id, type: "Email", note: `Approved outreach: ${x.subject}`, at: clockNow() });
  const org = d.orgs.find((o) => o.id === x.orgId);
  if (org) org.lastTouchAt = clockNow();
  logAI(d, { feature: "AI02", templateId: x.templateId, templateVersion: x.templateVersion, objectId: x.orgId, result: edited ? "Edited and approved" : "Approved and queued" });
  audit(d, { action: `Approved and queued outreach email${edited ? " (edited)" : ""}`, objectId: x.orgId, zone: "Outreach", category: "ai" });
  // Complete matching open task for this org, if any.
  const t = d.tasks.find((tk) => tk.orgId === x.orgId && tk.ownerId === u.id && !tk.done && (tk.reason === "quiet" || tk.reason === "event" || tk.reason === "new_high_fit"));
  if (t) { t.done = true; t.doneAt = clockNow(); }
}

export function addContact(d: Draft<DB>, orgId: string, c: Omit<Contact, "id">) {
  const o = d.orgs.find((x) => x.id === orgId);
  if (!o) return;
  o.contacts.push({ id: uid("c"), ...c });
  audit(d, { action: "Added contact", objectId: orgId, zone: "Outreach" });
}

export function setOptOut(d: Draft<DB>, orgId: string, contactId: string, optOut: boolean) {
  const c = d.orgs.find((x) => x.id === orgId)?.contacts.find((x) => x.id === contactId);
  if (!c) return;
  c.optOut = optOut;
  audit(d, { action: optOut ? "Opted out contact (suppression list)" : "Removed contact opt-out", objectId: orgId, zone: "Outreach" });
}

export function reassignOrg(d: Draft<DB>, orgId: string, userId: string) {
  const o = d.orgs.find((x) => x.id === orgId);
  if (!o) return;
  const from = o.ownerId;
  o.ownerId = userId;
  d.tasks.filter((t) => t.orgId === orgId && !t.done).forEach((t) => { t.ownerId = userId; });
  notify(d, { toUserId: userId, text: `${o.name} is now yours (history kept)`, link: `/app/organization/?id=${orgId}` });
  audit(d, { action: `Reassigned organization owner from ${from} to ${userId}`, objectId: orgId, zone: "Outreach" });
}

/** Capacity change (C14). Waitlist/Closed pauses outreach and tells ambassadors in that state (AU07). */
export function setCapacity(d: Draft<DB>, programId: string, capacity: Capacity, note: string, reopen: string) {
  const p = d.programs.find((x) => x.id === programId);
  if (!p) return;
  const before = p.capacity;
  const u = currentUser(d);
  p.capacity = capacity;
  p.capacityNote = note;
  p.expectedReopen = reopen;
  p.capacityUpdatedAt = clockNow();
  p.capacityUpdatedBy = u?.id ?? p.capacityUpdatedBy;
  const pausedNow = capacity === "Waitlist" || capacity === "Closed";
  const pausedBefore = before === "Waitlist" || before === "Closed";
  if (pausedNow !== pausedBefore) {
    notify(d, {
      toRole: "ambassador",
      text: pausedNow ? `Outreach paused: ${p.partnerLabel} (${p.office}) is ${capacity}` : `Outreach resumed: ${p.partnerLabel} (${p.office}) is ${capacity}`,
      link: "/app/capacity/",
    });
  }
  audit(d, { action: `Capacity changed from ${before} to ${capacity}`, objectId: programId, zone: "Both" });
}

export function kitCodeFor(orgName: string, state: string, existing: string[], year = new Date().getFullYear()): string {
  const words = orgName.replace(/[(),.]/g, " ").split(/\s+/).filter((w) => /^[A-Z]/.test(w) && !["And", "The", "Of"].includes(w));
  let base = words.slice(0, 3).map((w) => w[0]).join("").toUpperCase() || "ORG";
  let code = `${base}-${state}-${year}`;
  let n = 2;
  while (existing.includes(code)) { code = `${base}${n}-${state}-${year}`; n++; }
  return code;
}

export function createKit(d: Draft<DB>, k: { orgId: string; programIds: string[]; language: "en" | "es" }): string {
  const org = d.orgs.find((o) => o.id === k.orgId)!;
  const existing = d.kits.find((x) => x.orgId === k.orgId);
  const u = currentUser(d);
  if (existing) {
    existing.programIds = k.programIds;
    existing.language = k.language;
    audit(d, { action: "Generated partner kit", objectId: existing.code, zone: "Outreach" });
    return existing.code;
  }
  const code = kitCodeFor(org.name, org.state, d.kits.map((x) => x.code));
  const kit: PartnerKit = { id: uid("kit"), code, orgId: k.orgId, state: org.state, programIds: k.programIds, language: k.language, scans: 0, referrals: 0, createdBy: u?.id ?? "", createdAt: clockNow() };
  d.kits.push(kit);
  audit(d, { action: "Generated partner kit", objectId: code, zone: "Outreach" });
  return code;
}
