import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { makeSeed } from "@/lib/data/seed";
import type { DB } from "@/lib/domain/types";
import { canDecide, decideChange, publishEvent, suggestOrgs } from "./admin";

const as = (db: DB, userId: string): DB => ({ ...db, session: { userId, since: Date.now() } });

describe("Administration and events", () => {
  it("BR24: the proposer cannot approve their own change; a second admin can", () => {
    const db = makeSeed(Date.now());
    const chg = db.pending[0];
    expect(canDecide(chg, "u-chris")).toBe(false);
    expect(canDecide(chg, "u-lena")).toBe(true);
    const blocked = produce(as(db, "u-chris"), (d) => { decideChange(d, chg.id, true); });
    expect(blocked.pending[0].status).toBe("Waiting for second approver");
    const ok = produce(as(db, "u-lena"), (d) => { decideChange(d, chg.id, true); });
    expect(ok.pending[0].status).toBe("Approved");
    expect(ok.routing.find((r) => r.id === "rt2")!.counties).toContain("Cleveland");
  });

  it("publishing an event creates tasks for owners and marks orgs at risk", () => {
    const db = as(makeSeed(Date.now()), "u-lena");
    const ev = db.events.find((e) => e.status === "Draft")!;
    const orgs = suggestOrgs(db, ev).slice(0, 2);
    let res = { tasks: 0, people: 0 };
    const next = produce(db, (d) => { res = publishEvent(d, ev.id, "Summary", orgs); });
    expect(next.events.find((e) => e.id === ev.id)!.status).toBe("Published");
    expect(res.people).toBeGreaterThan(0);
    expect(orgs.every((id) => next.orgs.find((o) => o.id === id)!.stage === "At risk")).toBe(true);
  });
});
