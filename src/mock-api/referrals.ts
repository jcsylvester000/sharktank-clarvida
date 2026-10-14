// /referrals endpoints (simulated). Mirrors the future Care Zone API (POST /referrals, POST /referrals/:id/attempts ...).
import { send } from "./http";
import * as R from "@/lib/services/referrals";
import type { ContactAttempt, ReferralStatus } from "@/lib/domain/types";

/** POST /referrals (public partner form). Kept at the fast end so the live handoff lands in under a second (AC-PF-04). */
export function submitReferral(input: R.NewReferralInput, opts: { external: boolean }) {
  return send("POST", "/referrals", (d) => R.createReferral(d, input, opts), { allowReadOnly: true, ms: 180 + Math.round(Math.random() * 120) });
}
export const logAttempt = (id: string, method: ContactAttempt["method"], outcome: ContactAttempt["outcome"]) =>
  send("POST", `/referrals/${id}/attempts`, (d) => R.logAttempt(d, id, method, outcome), { ms: 220 });
export const setStatus = (id: string, to: ReferralStatus, o: { reason?: string; redirectTo?: string } = {}) =>
  send("PATCH", `/referrals/${id}/status`, (d) => R.setStatus(d, id, to, o), { ms: 220 });
export const assignOwner = (id: string, userId: string) => send("PATCH", `/referrals/${id}/owner`, (d) => R.assignOwner(d, id, userId), { ms: 200 });
