// Starting data for the Live sandbox: the same synthetic world as the demo, plus four simulated teammates,
// a business-hours response clock and a simulated clock that starts at a working moment (Eastern time).
import type { DB, LiveState, User } from "@/lib/domain/types";
import { makeSeed } from "@/lib/data/seed";
import { businessDueAt } from "@/lib/rules/clock";

export const DEFAULT_SPEED = 30;

/** Simulated teammates. They act through the same services as people do, so every action is audited. */
export const SIM_USERS: User[] = [
  { id: "u-sim-noor", name: "Noor Haddad", initials: "NH", role: "intake", scope: ["NC"], office: "Gastonia, NC (simulated teammate)", mfa: true, active: true },
  { id: "u-sim-diego", name: "Diego Marquez", initials: "DM", role: "intake", scope: ["CO"], office: "Colorado Springs, CO (simulated teammate)", mfa: true, active: true },
  { id: "u-sim-hannah", name: "Hannah Cole", initials: "HC", role: "ambassador", scope: ["NC"], office: "Lincoln and Cleveland, NC (simulated teammate)", mfa: true, active: true },
  { id: "u-sim-marcus", name: "Marcus Webb", initials: "MW", role: "program_mgr", scope: ["NC", "CO"], office: "Programs (simulated teammate)", mfa: true, active: true },
];
export const SIM_IDS = SIM_USERS.map((u) => u.id);
export const isSimUser = (id: string | undefined) => Boolean(id && id.startsWith("u-sim-"));

/** Organizations the simulated ambassador looks after (the rest stay with Maria and Jon). */
const HANNAH_ORGS = ["o9", "o10", "o11", "o12", "o17", "o19"];

/** The first business moment at or after `t` in North Carolina (8:00–17:00 Eastern, weekdays). */
export function businessStart(t: number, db: Pick<DB, "sla">): number {
  const nc = db.sla.find((s) => s.state === "NC")!;
  const at = businessDueAt(t, 0, nc);
  // If the day is nearly over, start the next morning so people see a full day.
  const lateCut = businessDueAt(t, 0, { ...nc, endHour: nc.endHour - 1 });
  return lateCut === at ? at : businessDueAt(at + 60 * 60_000, 0, nc);
}

export function makeLiveSeed(real: number = Date.now()): DB {
  const probe = makeSeed(real);
  const start = businessStart(real, probe);
  const db = makeSeed(start);

  db.users.push(...SIM_USERS);
  const initials = ["B.", "K.", "L.", "P.", "S.", "W."];
  db.orgs.forEach((o, i) => {
    if (!HANNAH_ORGS.includes(o.id)) return;
    o.ownerId = "u-sim-hannah";
    if (!o.contacts.length) {
      const role = o.bestContactRole.split("/")[0].trim() || "Program coordinator";
      const last = ["Hale", "Ruiz", "Osei", "Grant", "Lowe", "Ford"][i % 6];
      o.contacts.push({ id: `c-${o.id}-live`, name: `${initials[i % 6]} ${last}`, role, workEmail: `${last.toLowerCase()}@partner.example`, source: "Sandbox contact (synthetic)", verifiedAt: start - 30 * 86_400_000, optOut: false });
    }
  });
  for (const t of db.tasks) {
    const o = db.orgs.find((x) => x.id === t.orgId);
    if (o && HANNAH_ORGS.includes(o.id)) t.ownerId = "u-sim-hannah";
  }
  db.demo = { ...db.demo, guideOn: false, step: 0, presenter: false, clockMode: "business", showBrdTags: false, lastPartnerRef: undefined, soundOn: false, idleMinutes: 60 };

  const plans: LiveState["plans"] = {};
  for (const r of db.referrals) plans[r.id] = null; // starting referrals are left for the people using the sandbox

  db.live = {
    clock: { anchorReal: real, anchorSim: start, speed: DEFAULT_SPEED, paused: false },
    startedAt: start,
    lastTick: start,
    rng: (real % 2_147_483_647) || 1,
    simUserIds: SIM_IDS,
    next: {},
    plans,
    feed: [
      {
        id: "lf-start",
        at: start,
        kind: "system",
        zone: "Both",
        text: "Live sandbox started. Simulated teammates: Noor and Diego (intake), Hannah (outreach), Marcus (programs).",
        publicText: "Live sandbox started. Simulated teammates: Noor and Diego (intake), Hannah (outreach), Marcus (programs).",
        actor: "System",
      },
    ],
    totals: { arrivals: 0, simActions: 0, aiDrafts: 0, replies: 0 },
  };
  return db;
}
