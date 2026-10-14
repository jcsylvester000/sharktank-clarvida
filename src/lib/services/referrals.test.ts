import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { makeSeed } from "@/lib/data/seed";
import { createReferral, escalateOverdue, logAttempt, setStatus, type NewReferralInput } from "./referrals";
import { tier1Status } from "@/lib/rules/status";

const base: NewReferralInput = {
  state: "NC", county: "Gaston", programId: "p-nc-iih", channel: "Web form", partnerCode: "GCS-NC-2026", referrerOrgId: "o3", srcType: "School",
  referrerName: "J. Carter", referrerRole: "Lead School Counselor", referrerEmail: "j.carter@schools.example", age: 12, coverage: "Medicaid", language: "English",
  times: [], guardianFirstName: "Morgan", phone: "(555) 010-0142", consentAgreement: true, signedRelease: false,
};

describe("referral services", () => {
  it("creates, routes, notifies and audits a portal referral", () => {
    let id = "";
    const db = produce(makeSeed(), (d) => { id = createReferral(d, base, { external: true }); });
    const r = db.referrals.find((x) => x.id === id)!;
    expect(id).toBe("REF-NC-24818");
    expect(r.queue).toBe("NC-Gastonia-Child");
    expect(r.status).toBe("New");
    expect(r.notices[0].type).toBe("Received");
    expect(db.refSeq).toBe(24819);
    expect(db.demo.lastPartnerRef).toBe(id);
    expect(db.kits.find((k) => k.code === "GCS-NC-2026")!.referrals).toBe(7);
    expect(db.audit[0].action).toBe("Referral submitted via partner portal");
    expect(db.audit[0].actorId).toBe("external");
    expect(db.notifications[0].text).toContain(id);
    // No client data in notices, notifications or audit (BR26, BR27)
    const blob = JSON.stringify([r.notices, db.notifications, db.audit]);
    expect(blob).not.toContain("Morgan");
    expect(blob).not.toContain("010-0142");
  });

  it("puts referrals to a waitlisted program on hold (BR17)", () => {
    let id = "";
    const db = produce(makeSeed(), (d) => { id = createReferral(d, { ...base, programId: "p-nc-aba", age: 5 }, { external: true }); });
    const r = db.referrals.find((x) => x.id === id)!;
    expect(r.status).toBe("Hold");
    expect(tier1Status(r)).toBe("On hold");
  });

  it("first attempt stops the clock and status flows", () => {
    let id = "";
    let db = produce(makeSeed(), (d) => { d.session = { userId: "u-dana", since: 0 }; id = createReferral(d, base, { external: true }); });
    db = produce(db, (d) => { logAttempt(d, id, "Phone", "Reached guardian"); setStatus(d, id, "Accepted"); });
    const r = db.referrals.find((x) => x.id === id)!;
    expect(r.firstContactAt).toBeTruthy();
    expect(r.status).toBe("Accepted");
    expect(tier1Status(r)).toBe("Contacted");
    expect(() => produce(db, (d) => setStatus(d, id, "Intake completed"))).toThrow();
  });

  it("escalates overdue referrals once", () => {
    const seed = makeSeed();
    const now = Date.now();
    const a = produce(seed, (d) => { escalateOverdue(d, now); });
    const escalated = a.referrals.filter((r) => r.escalatedAt).map((r) => r.id);
    expect(escalated).toContain("REF-NC-24806");
    let again = 0;
    produce(a, (d) => { again = escalateOverdue(d, now + 1000); });
    expect(again).toBe(0);
  });

  it("FT-094: referrer notices go to the Demo Inbox with a signed link and no client details", () => {
    let id = "";
    let db = produce(makeSeed(), (d) => { id = createReferral(d, { ...base, referrerEmail: "jordan.carter@gcs.example" }, { external: true }); });
    const mail = db.outbox.find((m) => m.relatedId === id)!;
    expect(mail.type).toBe("referrer-notice");
    expect(mail.toUserId).toBe("u-jordan");
    expect(mail.link).toMatch(/token=[0-9a-f]{16}/);
    db = produce(db, (d) => { d.session = { userId: "u-dana", since: 0 }; logAttempt(d, id, "Phone", "Reached guardian"); });
    const mails = db.outbox.filter((m) => m.relatedId === id);
    expect(mails[0].subject).toContain("family contacted");
    const blob = JSON.stringify(mails) + JSON.stringify(db.activity.slice(0, 3));
    for (const s of ["Morgan", "010-0142", "age 12"]) expect(blob).not.toContain(s);
    expect(db.activity[0].text).toContain("Dana made first contact");
  });

  it("FT-087: an overdue referral escalates to the named supervisor with a notification and email", () => {
    const seed = makeSeed();
    const db = produce(seed, (d) => { d.referrals.forEach((r) => { if (r.id === "REF-NC-24811") { r.receivedAt -= 3 * 3_600_000; r.escalatedAt = undefined; } }); escalateOverdue(d, Date.now()); });
    expect(db.notifications.some((n) => n.toUserId === "u-ray" && n.type === "escalation" && n.text.includes("REF-NC-24811"))).toBe(true);
    expect(db.outbox.some((m) => m.toUserId === "u-ray" && m.type === "escalation")).toBe(true);
  });
});
