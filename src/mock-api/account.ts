// /me/* endpoints (simulated): the signed-in account's own profile, preferences and memory.
import { send } from "./http";
import * as S from "@/lib/services/account";
import { setPassword, verifyCurrentPassword, passwordProblems } from "@/lib/services/auth";
import type { NotifChannel, NotifType } from "@/lib/domain/types";
import { useStore } from "@/lib/store/db";

const own = { allowReadOnly: true };
const me = () => useStore.getState().db.session?.userId ?? "";

export const completeWelcome = (prefs: Record<NotifType, NotifChannel>, monday: boolean) => send("POST", "/me/onboarding", (d) => S.completeOnboarding(d, me(), prefs, monday), own);
export const replayWelcome = () => send("POST", "/me/onboarding/replay", (d) => S.replayWelcome(d, me()), own);
export const savePreferences = (prefs: Record<NotifType, NotifChannel>, monday: boolean) => send("PATCH", "/me/preferences", (d) => S.savePrefs(d, me(), prefs, monday), own);
export const saveProfile = (patch: { phone?: string; title?: string; language?: "en" | "es" }) => send("PATCH", "/me/profile", (d) => S.saveProfile(d, me(), patch), own);
export const signOutOthers = () => send("POST", "/me/sessions/revoke-others", (d) => S.signOutOtherSessions(d, me()), own);
export const forgetDevice = (deviceId: string) => send("DELETE", `/me/devices/${deviceId}`, (d) => S.forgetDevice(d, me(), deviceId), own);
export const resetMyAccount = () => send("POST", "/me/reset", (d) => S.resetMyAccount(d, me()), own);
export const markRead = (ids: string[]) => send("POST", "/me/notifications/read", (d) => S.markNotificationsRead(d, me(), ids), { ...own, ms: 120 });
export const markMailRead = (id: string) => send("POST", `/me/inbox/${id}/read`, (d) => S.markMailRead(d, me(), id), { ...own, ms: 100 });

export async function changePassword(current: string, next: string): Promise<{ ok: boolean; message?: string }> {
  const db = useStore.getState().db;
  const u = db.users.find((x) => x.id === me());
  if (!u) return { ok: false, message: "Please sign in again." };
  if (!verifyCurrentPassword(db, u.id, current)) return { ok: false, message: "Your current password is incorrect." };
  const probs = passwordProblems(next, u.email);
  if (probs.length) return { ok: false, message: probs[0] };
  await send("POST", "/me/password", (d) => setPassword(d, u.id, next, "settings"), own);
  return { ok: true };
}
