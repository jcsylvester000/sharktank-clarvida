import { describe, expect, it } from "vitest";
import { ECON_ROLES, valueForCompany, valuePerUser } from "./economics";
import { POSITIONS, STATES, visibleTo } from "@/lib/data/org";
import { makeSeed } from "@/lib/data/seed";

describe("time-saved model", () => {
  it("ambassador saves 10.5 h a week", () => {
    const amb = ECON_ROLES.find((r) => r.key === "ambassador")!;
    const v = valuePerUser(amb);
    expect(v.hours).toBe(504);
    expect(Math.round(v.dollars)).toBe(18820);
    expect(valuePerUser(amb, 0.5).dollars).toBeCloseTo(v.dollars / 2, 6);
  });
  it("company value scales by state", () => {
    const c = valueForCompany(16);
    expect(c.people).toBe(16 * 13 + 12);
    expect(Math.round(c.dollars)).toBe(2663836);
  });
});

describe("team segregation", () => {
  const db = makeSeed(Date.now());
  const see = (id: string) => visibleTo(db, POSITIONS.find((p) => p.id === id)!);
  it("covers Clarvida's 16 listed states", () => expect(STATES).toHaveLength(16));
  it("an ambassador never receives client records and sees only her counties", () => {
    const v = see("p-maria");
    expect(v.clientRecords).toBe(false);
    expect(v.orgs.every((o) => ["Gaston", "Lincoln", "Cleveland"].includes(o.county))).toBe(true);
  });
  it("Charlotte and Colorado ambassadors see none of Maria's organizations", () => {
    const maria = new Set(see("p-maria").orgs.map((o) => o.id));
    expect(see("p-kim").orgs.some((o) => maria.has(o.id))).toBe(false);
    expect(see("p-jon").orgs.some((o) => maria.has(o.id))).toBe(false);
  });
  it("intake sees client records only in its state; compliance sees all", () => {
    expect(see("p-ray").referrals.every((r) => r.state === "NC" || r.state === "XX")).toBe(true);
    expect(see("p-sam").referrals.length).toBe(db.referrals.length);
    expect(see("p-alex").clientRecords).toBe(false);
  });
  it("a partner sees only its own organization's referrals", () => {
    expect(see("p-jordan").referrals.every((r) => r.referrerOrgId === "o3")).toBe(true);
  });
});
