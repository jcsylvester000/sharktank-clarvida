import { describe, expect, it } from "vitest";
import { produce } from "immer";
import type { DB } from "@/lib/domain/types";
import { makeLiveSeed, SIM_IDS } from "./seed";
import { tick } from "./engine";
import { TRANSITIONS } from "@/lib/rules/status";
import { businessDueAt } from "@/lib/rules/clock";

const M = 60_000;
const H = 60 * M;
const D = 24 * H;
// A fixed real moment: Monday 12 Oct 2026, 13:00 UTC (9:00 Eastern).
const REAL = Date.UTC(2026, 9, 12, 13, 0, 0);

function run(db: DB, ms: number, stepMs = 10 * M): DB {
  const start = db.live!.lastTick;
  for (let t = start + stepMs; t <= start + ms; t += stepMs) db = produce(db, (d) => { tick(d, t); });
  return db;
}

describe("Live sandbox seed", () => {
  it("starts inside North Carolina business hours with simulated teammates and its own clock", () => {
    const db = makeLiveSeed(REAL);
    const nc = db.sla.find((s) => s.state === "NC")!;
    expect(businessDueAt(db.live!.startedAt, 0, nc)).toBe(db.live!.startedAt);
    expect(db.users.filter((u) => SIM_IDS.includes(u.id))).toHaveLength(4);
    expect(db.demo.clockMode).toBe("business");
    expect(db.demo.guideOn).toBe(false);
    expect(db.live!.clock.speed).toBeGreaterThan(1);
  });

  it("evening start moves to the next business morning", () => {
    const db = makeLiveSeed(Date.UTC(2026, 9, 12, 23, 30)); // 7:30 pm Eastern
    const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(db.live!.startedAt);
    expect(p.find((x) => x.type === "weekday")!.value).toBe("Tue");
    expect(Number(p.find((x) => x.type === "hour")!.value)).toBe(8);
  });
});

describe("Simulation engine", () => {
  const db0 = makeLiveSeed(REAL);
  const db = run(db0, 4 * D);
  const created = db.referrals.filter((r) => r.receivedAt >= db.live!.startedAt);

  it("brings in a realistic flow of referrals in both states", () => {
    expect(created.length).toBeGreaterThan(20);
    expect(created.length).toBeLessThan(120);
    expect(created.some((r) => r.state === "NC")).toBe(true);
    expect(created.some((r) => r.state === "CO")).toBe(true);
    expect(db.live!.totals.arrivals).toBe(created.length);
  });

  it("simulated coordinators work referrals through valid status changes only", () => {
    const worked = created.filter((r) => r.ownerId && SIM_IDS.includes(r.ownerId));
    expect(worked.length).toBeGreaterThan(5);
    expect(worked.some((r) => r.firstContactAt)).toBe(true);
    expect(created.some((r) => r.status === "Intake scheduled" || r.status === "Intake completed" || r.status === "Accepted")).toBe(true);
    for (const r of db.referrals) {
      for (const h of r.history) if (h.from && h.to in TRANSITIONS) expect(TRANSITIONS[h.from]).toContain(h.to);
    }
  });

  it("leaves part of the North Carolina queue for people, and escalates what nobody answers", () => {
    const leftNC = created.filter((r) => r.state === "NC" && db.live!.plans[r.id] === null && !r.ownerId);
    expect(leftNC.length).toBeGreaterThan(0);
    expect(db.referrals.some((r) => r.escalatedAt)).toBe(true);
  });

  it("runs outreach, AI, events and capacity through the audited services", () => {
    expect(db.live!.totals.aiDrafts).toBeGreaterThan(3);
    expect(db.drafts.some((x) => x.approvedBy === "u-sim-hannah")).toBe(true);
    expect(db.ailog.some((x) => x.userId === "u-sim-hannah" && x.feature === "AI02")).toBe(true);
    expect(db.audit.some((a) => a.actorId === "u-sim-noor" || a.actorId === "u-sim-diego")).toBe(true);
    expect(db.events.some((e) => e.status === "Draft")).toBe(true);
    expect(db.audit.some((a) => a.actorId === "u-sim-marcus" && a.action.startsWith("Capacity changed"))).toBe(true);
    const kinds = new Set(db.live!.feed.map((f) => f.kind));
    for (const k of ["referral", "intake", "ai"]) expect(kinds.has(k as never)).toBe(true);
  });

  it("feed never carries client details; the counts-only text never names a referral", () => {
    const names = db.referrals.map((r) => r.guardianFirstName.replace(/\s*\(.*\)$/, ""));
    const phones = db.referrals.map((r) => r.phone);
    for (const f of db.live!.feed) {
      for (const n of names) expect(f.text).not.toMatch(new RegExp(`\\b${n}\\b`));
      for (const p of phones) expect(f.text).not.toContain(p);
      expect(f.publicText).not.toMatch(/REF-/);
    }
    expect(db.live!.feed.length).toBeLessThanOrEqual(150);
  });

  it("is reproducible from the same seed", () => {
    const again = run(makeLiveSeed(REAL), 4 * D);
    expect(again.live!.totals).toEqual(db.live!.totals);
    expect(again.referrals.map((r) => r.status)).toEqual(db.referrals.map((r) => r.status));
  });

  it("steps back when a person takes a referral over", () => {
    let x = run(makeLiveSeed(REAL), 2 * H, 2 * M);
    const planned = Object.entries(x.live!.plans).find(([, p]) => p && p.steps.length > 1);
    expect(planned).toBeTruthy();
    const [id] = planned!;
    x = produce(x, (d) => { d.referrals.find((r) => r.id === id)!.ownerId = "u-dana"; });
    const before = x.referrals.find((r) => r.id === id)!.history.length;
    x = run(x, 2 * D);
    const r = x.referrals.find((rr) => rr.id === id)!;
    expect(x.live!.plans[id]).toBeNull();
    expect(r.history.slice(before).every((h) => !SIM_IDS.some((s) => h.by === x.users.find((u) => u.id === s)!.name))).toBe(true);
  });

  it("catches up in bounded chunks after a long jump", () => {
    const x = produce(makeLiveSeed(REAL), (d) => { tick(d, d.live!.lastTick + 10 * D); });
    expect(x.live!.lastTick).toBeLessThan(x.live!.startedAt + 10 * D);
    expect(x.live!.feed.length).toBeLessThanOrEqual(150);
  });
});
