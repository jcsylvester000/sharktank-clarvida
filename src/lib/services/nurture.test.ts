import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { makeSeed } from "@/lib/data/seed";
import type { DB } from "@/lib/domain/types";
import { approveFirstStep, enroll, fastForward } from "./nurture";
import { checkIn, setCapacity } from "./outreach";
import { driveMinutes, orgPoint, planRoute, OFFICES, milesBetween, coverageGaps } from "@/lib/geo";

const as = (db: DB, userId: string): DB => ({ ...db, session: { userId, since: Date.now() } });

describe("nurture journeys (FT-062, FT-063)", () => {
  it("needs approval for step 1, then turns warm and hands off with a task and notification", () => {
    let db = as(makeSeed(), "u-maria");
    let id = "";
    db = produce(db, (d) => { id = enroll(d, { orgId: "o5", template: "Clinic intro", programId: "p-nc-fct" }).id!; });
    expect(produce(db, (d) => { fastForward(d, id); }).nurture.find((j) => j.id === id)!.signals.length).toBe(0);
    db = produce(db, (d) => { approveFirstStep(d, id); fastForward(d, id, 14); });
    const j = db.nurture.find((x) => x.id === id)!;
    expect(j.warmScore).toBe(78);
    expect(j.status).toBe("Warm: call now");
    expect(db.tasks.some((t) => t.ownerId === "u-maria" && t.text.startsWith("Warm: call Kintegra"))).toBe(true);
    expect(db.notifications.some((n) => n.toUserId === "u-maria" && n.type === "handoff")).toBe(true);
    expect(db.outbox.filter((m) => m.type === "nurture" && m.relatedId === "o5").length).toBeGreaterThanOrEqual(3);
  });
  it("AC-PF-07: a waitlisted program cannot be promoted and pauses running journeys", () => {
    let db = as(makeSeed(), "u-maria");
    let res = { ok: true } as { ok: boolean };
    produce(db, (d) => { res = enroll(d, { orgId: "o5", template: "Clinic intro", programId: "p-nc-aba" }); });
    expect(res.ok).toBe(false);
    db = produce(as(db, "u-priya"), (d) => { setCapacity(d, "p-nc-fct", "Waitlist", "", "Jan 2027"); });
    expect(db.nurture.find((j) => j.id === "nj1")!.status).toBe("Paused");
    expect(db.notifications.some((n) => n.toUserId === "u-maria" && n.type === "capacity")).toBe(true);
    expect(db.notifications.some((n) => n.toUserId === "u-jon" && n.type === "capacity")).toBe(false);
  });
});

describe("maps (FT-173..FT-176)", () => {
  it("places organizations at their stored distance and estimates drive time", () => {
    const db = makeSeed();
    const dhhs = db.orgs.find((o) => o.id === "o1")!;
    expect(Math.abs(milesBetween(OFFICES[0], orgPoint(dhhs)) - 2)).toBeLessThan(0.05);
    expect(driveMinutes(2)).toBe(8);
  });
  it("orders a field-day route from the office", () => {
    const db = makeSeed();
    const stops = ["o5", "o1", "o11", "o6"].map((id) => ({ id, point: orgPoint(db.orgs.find((o) => o.id === id)!) }));
    const r = planRoute(OFFICES[0], stops);
    expect(r.order).toHaveLength(4);
    expect(["o1", "o6"]).toContain(r.order[0].id);
    expect(r.minutes).toBeGreaterThan(20);
  });
  it("check-in records a visit, a touch and a follow-up task", () => {
    const db = produce(as(makeSeed(), "u-maria"), (d) => { checkIn(d, { orgId: "o1", method: "demo", distanceMi: 0.05, outcome: "Met new care manager" }); });
    expect(db.visits[0].orgId).toBe("o1");
    expect(db.touches[0].type).toBe("Visit");
    expect(db.activity[0].text).toContain("checked in at Gaston County DHHS");
  });
  it("finds coverage gaps near Gastonia", () => {
    const gaps = coverageGaps(makeSeed().orgs, OFFICES[0], 10).map((g) => g.type);
    expect(gaps).toContain("Pediatrics");
  });
});
