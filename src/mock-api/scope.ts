// State and program scoping (FT-009), applied in the data layer so a screen can never show records outside
// the signed-in account's territory. Leadership roles ("ALL") see every state; Care Zone records are only
// ever returned to Care roles.
import type { DB, User } from "@/lib/domain/types";

export function inScope(user: Pick<User, "scope">, state: string | undefined): boolean {
  if (user.scope.includes("ALL")) return true;
  if (!state) return false;
  return user.scope.includes(state) || state === "*";
}

const CARE_ROLES = new Set(["intake", "intake_sup", "compliance"]);
export const canSeeCare = (user: Pick<User, "role">) => CARE_ROLES.has(user.role);

/** A read-only view of the database limited to what this account may see. */
export function scoped(db: DB, user: User): DB {
  const s = (x: { state: string }) => inScope(user, x.state);
  const partnerOrg = user.role === "partner" ? user.orgId : undefined;
  return {
    ...db,
    orgs: db.orgs.filter(s),
    programs: db.programs.filter(s),
    events: db.events.filter(s),
    kits: db.kits.filter(s),
    tasks: db.tasks.filter((t) => {
      const o = db.orgs.find((x) => x.id === t.orgId);
      return !o || s(o);
    }),
    referrals: partnerOrg ? db.referrals.filter((r) => r.referrerOrgId === partnerOrg) : canSeeCare(user) ? db.referrals.filter((r) => inScope(user, r.state) || (r.state === "XX" && user.scope.includes("NC"))) : [],
    activity: db.activity.filter((a) => a.states.includes("ALL") || user.scope.includes("ALL") || a.states.some((st) => user.scope.includes(st))),
  };
}
