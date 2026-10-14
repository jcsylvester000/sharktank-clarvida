// Relationship events (C13), program catalog (C15) and administration (C23). Production: Laravel actions.
import type { Draft } from "immer";
import type { DB, PendingChange, RelationshipEvent } from "@/lib/domain/types";
import { audit, currentUser, notify } from "./core";
import { uid } from "@/lib/store/db";
import { now as clockNow } from "@/lib/clock";

const D = 86_400_000;

// ---------------------------------------------------------------- Relationship events
export function createEvent(d: Draft<DB>, e: Pick<RelationshipEvent, "state" | "date" | "type" | "title" | "sourceUrl" | "sourceLabel" | "counties">): string {
  const id = uid("ev");
  d.events.unshift({ id, ...e, summary: "", orgIds: [], status: "Draft", confirmedBy: "" });
  audit(d, { action: `Added relationship event from a public source: ${e.title}`, objectId: id, zone: "Outreach" });
  return id;
}

/** Orgs likely affected: same state and a listed county. The analyst confirms the list. */
export function suggestOrgs(db: DB, e: Pick<RelationshipEvent, "state" | "counties">): string[] {
  return db.orgs.filter((o) => o.state === e.state && e.counties.includes(o.county)).map((o) => o.id);
}

/** Publishing turns the event into work: affected orgs go At risk, owners get a task and a notification (FR-130–132). */
export function publishEvent(d: Draft<DB>, id: string, summary: string, orgIds: string[], now = clockNow()): { tasks: number; people: number } {
  const e = d.events.find((x) => x.id === id);
  if (!e) return { tasks: 0, people: 0 };
  const me = currentUser(d);
  e.summary = summary;
  e.orgIds = orgIds;
  e.status = "Published";
  e.confirmedBy = me?.name ?? "";
  let tasks = 0;
  const people = new Set<string>();
  for (const oid of orgIds) {
    const o = d.orgs.find((x) => x.id === oid);
    if (!o) continue;
    o.stage = "At risk";
    const open = d.tasks.some((t) => t.orgId === oid && !t.done && t.reason === "event");
    if (!open) {
      d.tasks.push({ id: uid("t"), ownerId: o.ownerId, orgId: oid, text: `Reconnect with ${o.name} after: ${e.title}`, reason: "event", minutes: 10, dueAt: now + 3 * D, done: false, source: "event" });
      tasks++;
    }
    people.add(o.ownerId);
  }
  people.forEach((uidOwner) => notify(d, { toUserId: uidOwner, text: `Relationship reset: ${e.title}`, link: "/app/home/" }));
  audit(d, { action: `Published relationship event (${orgIds.length} organizations, ${tasks} tasks)`, objectId: id, zone: "Outreach" });
  return { tasks, people: people.size };
}

// ---------------------------------------------------------------- Program catalog
export function verifyProgram(d: Draft<DB>, programId: string) {
  const p = d.programs.find((x) => x.id === programId);
  if (!p) return;
  p.verifiedAt = clockNow();
  audit(d, { action: `Verified program details: ${p.name} (${p.office})`, objectId: programId, zone: "Outreach", category: "config" });
}

export function updateProgramCopy(d: Draft<DB>, programId: string, partnerLabel: string, description: string) {
  const p = d.programs.find((x) => x.id === programId);
  if (!p) return;
  p.partnerLabel = partnerLabel;
  p.description = description;
  p.verifiedAt = clockNow();
  audit(d, { action: `Edited partner-facing program text: ${p.name}`, objectId: programId, zone: "Outreach", category: "config" });
}

// ---------------------------------------------------------------- Administration
export function setUserActive(d: Draft<DB>, userId: string, active: boolean) {
  const u = d.users.find((x) => x.id === userId);
  if (!u) return;
  u.active = active;
  audit(d, { action: `${active ? "Enabled" : "Disabled"} user ${u.name}`, objectId: userId, zone: "Identity", category: "config" });
}

export function proposeChange(d: Draft<DB>, c: Pick<PendingChange, "area" | "change" | "payload">): string {
  const me = currentUser(d);
  const id = uid("chg");
  d.pending.unshift({ id, ...c, proposedBy: me?.id ?? "", proposedAt: clockNow(), status: "Waiting for second approver" });
  audit(d, { action: `Proposed change (${c.area}): ${c.change}`, objectId: id, zone: "Both", category: "config" });
  d.users.filter((u) => u.role === "admin" && u.id !== me?.id && u.active).forEach((u) => notify(d, { toUserId: u.id, text: `Change waiting for your approval: ${c.change}`, link: "/app/admin/?tab=routing" }));
  return id;
}

/** BR24 second approver: the person who proposed a change can never approve it. */
export function canDecide(change: PendingChange, userId: string | undefined): boolean {
  return Boolean(userId) && change.status === "Waiting for second approver" && change.proposedBy !== userId;
}

export function decideChange(d: Draft<DB>, id: string, approve: boolean): boolean {
  const c = d.pending.find((x) => x.id === id);
  const me = currentUser(d);
  if (!c || !canDecide(c as PendingChange, me?.id)) return false;
  c.status = approve ? "Approved" : "Rejected";
  c.decidedBy = me!.id;
  c.decidedAt = clockNow();
  if (approve && c.payload?.kind === "routing") {
    const p = c.payload;
    const rule = d.routing.find((r) => r.id === p.ruleId);
    if (rule) rule.counties = [...p.counties];
  }
  if (approve && c.payload?.kind === "sla") {
    const p = c.payload;
    const sla = d.sla.find((s) => s.state === p.state);
    if (sla) sla.targetHours = p.targetHours;
  }
  audit(d, { action: `${approve ? "Approved" : "Rejected"} change (${c.area}): ${c.change}`, objectId: id, zone: "Both", category: "config" });
  notify(d, { toUserId: c.proposedBy, text: `Your change was ${approve ? "approved and applied" : "rejected"}: ${c.change}`, link: "/app/admin/?tab=routing" });
  return true;
}

export function setCaps(d: Draft<DB>, sendCap: number, orgSendCap: number) {
  d.sendCap = sendCap;
  d.orgSendCap = orgSendCap;
  audit(d, { action: `Set send limits: ${sendCap} per ambassador per week, ${orgSendCap} per organization per week`, zone: "Outreach", category: "config" });
}
