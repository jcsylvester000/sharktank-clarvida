import { describe, expect, it } from "vitest";
import { makeSeed, PHI_TEST_STRINGS } from "@/lib/data/seed";
import { phiScan } from "./phi";
import { suppress } from "./suppress";
import { roi } from "./roi";
import { referralId } from "./refs";
import { findDuplicate, matchPrograms, routeReferral } from "./routing";
import { businessElapsed, clockFor, hms } from "./clock";
import { canTransition, suggestUnableToContact, tier1Status } from "./status";
import { disclosure } from "./disclosure";
import { fitScore } from "./fitScore";
import { canApprove, sendChecks, weeklyPlan } from "./outreach";
import { shouldRefuse } from "./ask";

const NOW = Date.UTC(2026, 9, 21, 14, 0, 0); // Wed Oct 21 2026, 10:00 ET
const db = makeSeed(NOW);
const H = 3_600_000;

describe("BR13 PHI guard", () => {
  it("blocks all ten seeded test strings", () => {
    for (const s of PHI_TEST_STRINGS) expect(phiScan(s).blocked, s).toBe(true);
  });
  it("allows ordinary outreach text", () => {
    expect(phiScan("Hi T. Alvarez, I'd love to share our updated program list for Gaston County.").blocked).toBe(false);
    expect(phiScan("Thanks for the referrals this month. Unsubscribe").blocked).toBe(false);
  });
  it("reports a category, never the value", () => {
    expect(phiScan("DOB 04/12/2014").category).toBe("Date of birth");
  });
});

describe("BR19 / BR30 / BR03", () => {
  it("suppresses 1–10", () => {
    expect(suppress(0)).toBe("0");
    expect(suppress(7)).toBe("<11");
    expect(suppress(11)).toBe("11");
  });
  it("ROI defaults give about 97 families and 468 hours", () => {
    const r = roi(db.roi);
    expect(Math.round(r.extraFamilies)).toBe(97);
    expect(Math.round(r.hoursSaved)).toBe(468);
  });
  it("reference ids", () => {
    expect(referralId("NC", 24817)).toBe("REF-NC-24817");
    expect(referralId(undefined, 1)).toBe("REF-XX-1");
  });
});

describe("BR01 routing / BR02 duplicates / BR37 matcher", () => {
  it("routes Gaston + Intensive In-Home + age 12", () => {
    expect(routeReferral({ state: "NC", county: "Gaston", programId: "p-nc-iih", age: 12 }, db.programs).queue).toBe("NC-Gastonia-Child");
  });
  it("sends unknown county or program to triage", () => {
    expect(routeReferral({ state: "NC", county: "Not sure", programId: "p-nc-iih", age: 12 }, db.programs).triage).toBe(true);
    expect(routeReferral({ state: "NC", county: "Gaston", programId: null, age: 12 }, db.programs).triage).toBe(true);
    expect(routeReferral({ state: "NC", county: "Gaston", programId: "p-nc-sud", age: 8 }, db.programs).triage).toBe(true);
  });
  it("flags same phone + program within 30 days", () => {
    expect(findDuplicate({ phone: "(555) 010-0388", programId: "p-nc-iih", receivedAt: NOW }, db.referrals)).toBe("REF-NC-24814");
    expect(findDuplicate({ phone: "(555) 010-0388", programId: "p-nc-fc", receivedAt: NOW }, db.referrals)).toBeNull();
  });
  it("matches programs for a 12-year-old in Gaston", () => {
    const m = matchPrograms({ state: "NC", county: "Gaston", age: 12, concern: "Family stress or conflict" }, db.programs);
    expect(m[0].capacity).toBe("Open");
    expect(m.some((p) => p.id === "p-nc-iih")).toBe(true);
  });
});

describe("BR04–BR06 response clock", () => {
  const r = db.referrals.find((x) => x.id === "REF-NC-24806")!;
  it("demo mode: 9.5 h old referral is overdue", () => {
    const c = clockFor(r, NOW, "demo", db.sla[0]);
    expect(c.state).toBe("overdue");
    expect(hms(c.leftMs)).toBe("−1:30:00");
  });
  it("demo mode: new referral starts at 8:00:00", () => {
    const fresh = { ...r, receivedAt: NOW, history: [] };
    expect(hms(clockFor(fresh, NOW, "demo", db.sla[0]).leftMs)).toBe("8:00:00");
  });
  it("business mode skips nights and weekends", () => {
    const fri4pm = Date.UTC(2026, 9, 16, 20, 0, 0); // Fri 4 pm ET
    const mon10am = Date.UTC(2026, 9, 19, 14, 0, 0); // Mon 10 am ET
    expect(businessElapsed(fri4pm, mon10am, db.sla[0]) / H).toBe(3);
  });
  it("stops at first contact", () => {
    const done = db.referrals.find((x) => x.id === "REF-NC-24799")!;
    expect(clockFor(done, NOW, "demo", db.sla[0]).state).toBe("stopped");
  });
});

describe("BR07–BR11 status and disclosure", () => {
  it("state machine", () => {
    expect(canTransition("New", "Accepted")).toBe(true);
    expect(canTransition("New", "Intake completed")).toBe(false);
    expect(canTransition("Closed", "New")).toBe(false);
  });
  it("tier 1 words", () => {
    expect(tier1Status({ status: "New", attempts: [] })).toBe("Received");
    expect(tier1Status({ status: "Hold", attempts: [] })).toBe("On hold");
    expect(tier1Status({ status: "Accepted", attempts: [{ at: 1, method: "Phone", outcome: "Reached guardian", by: "x" }] })).toBe("Contacted");
  });
  it("unable to contact after 3 failed attempts", () => {
    const a = { at: 1, method: "Phone" as const, outcome: "No answer" as const, by: "x" };
    expect(suggestUnableToContact({ status: "New", attempts: [a, a, a] })).toBe(true);
    expect(suggestUnableToContact({ status: "New", attempts: [a, a] })).toBe(false);
  });
  it("tier 2 rules", () => {
    expect(disclosure({ srcType: "School", signedRelease: false, part2Program: false, part2Consent: false }).tier2).toBe(false);
    expect(disclosure({ srcType: "Hospital / clinician", signedRelease: false, part2Program: false, part2Consent: false }).tier2).toBe(true);
    expect(disclosure({ srcType: "Hospital / clinician", signedRelease: true, part2Program: true, part2Consent: false }).tier2).toBe(false);
    expect(disclosure({ srcType: "School", signedRelease: true, part2Program: false, part2Consent: false }).tier2).toBe(true);
  });
});

describe("BR14 fit score / BR18 send checks / BR21 plan / BR31 refusal", () => {
  it("score parts add up and cap at 99", () => {
    for (const o of db.orgs) {
      const f = fitScore(o, { family: "child", weights: db.gatekeeperWeights, programs: db.programs, now: NOW });
      const sum = Object.values(f.parts).reduce((a, b) => a + b, 0);
      expect(f.score).toBe(Math.min(99, sum));
      expect(f.reasons.length).toBeGreaterThanOrEqual(1);
      expect(f.reasons.length).toBeLessThanOrEqual(4);
    }
  });
  it("15 NC organizations rank for Gastonia", () => {
    expect(db.orgs.filter((o) => o.state === "NC").length).toBe(15);
  });
  it("paused program blocks approval", () => {
    const aba = db.programs.find((p) => p.id === "p-nc-aba")!;
    const contact = db.orgs[0].contacts[0];
    const checks = sendChecks({ text: "Hello. Unsubscribe", contact, program: aba, userSends: 18, orgSends: 0, cap: 25, orgCap: 3, now: NOW });
    expect(canApprove(checks)).toBe(false);
    const fct = db.programs.find((p) => p.id === "p-nc-fct")!;
    expect(canApprove(sendChecks({ text: "Hello. Unsubscribe", contact, program: fct, userSends: 18, orgSends: 0, cap: 25, orgCap: 3, now: NOW }))).toBe(true);
    expect(canApprove(sendChecks({ text: "Hello. Unsubscribe", contact, program: fct, userSends: 25, orgSends: 0, cap: 25, orgCap: 3, now: NOW }))).toBe(false);
  });
  it("Maria's plan has 6 actions led by the Vaya Partners reset", () => {
    const plan = weeklyPlan(db.tasks, db.orgs, "u-maria");
    expect(plan.length).toBe(6);
    expect(plan[0].orgId).toBe("o2");
  });
  it("refuses client-level questions", () => {
    expect(shouldRefuse("What is REF-NC-24811's phone?")).toBe(true);
    expect(shouldRefuse("Tell me about Jordan", ["Jordan"])).toBe(true);
    expect(shouldRefuse("Which schools in Gaston went quiet this quarter?")).toBe(false);
  });
});
