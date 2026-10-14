// Per-account memory and profile (FT-007, FT-012, FT-014, FT-026, FT-151).
import type { Draft } from "immer";
import type { AccountState, DB, NotifChannel, NotifType, User } from "@/lib/domain/types";
import { blankAccount, seedAccounts } from "@/lib/data/accounts";
import { audit, currentUser } from "@/lib/services/core";
import { now as clockNow } from "@/lib/clock";

export function acct(d: Draft<DB>, userId: string): Draft<AccountState> {
  d.accounts ??= {};
  return (d.accounts[userId] ??= blankAccount());
}

export function readAccount(db: DB, userId: string | undefined): AccountState {
  return (userId && db.accounts?.[userId]) || blankAccount();
}

export function completeOnboarding(d: Draft<DB>, userId: string, prefs: Record<NotifType, NotifChannel>, mondayBriefing: boolean) {
  const a = acct(d, userId);
  const at = clockNow();
  a.prefs = { ...prefs };
  a.mondayBriefing = mondayBriefing;
  a.pledgeAt = at;
  a.onboardedAt = at;
  audit(d, { action: "Privacy pledge accepted", zone: "Identity", category: "sign-in" });
  audit(d, { action: "Welcome completed (role, territory and notification preferences confirmed)", zone: "Identity" });
}

export function replayWelcome(d: Draft<DB>, userId: string) {
  acct(d, userId).onboardedAt = null;
  audit(d, { action: "Welcome tour replayed", zone: "Identity" });
}

export function savePrefs(d: Draft<DB>, userId: string, prefs: Record<NotifType, NotifChannel>, mondayBriefing: boolean) {
  const a = acct(d, userId);
  a.prefs = { ...prefs };
  a.mondayBriefing = mondayBriefing;
  audit(d, { action: "Notification preferences saved", zone: "Identity" });
}

export function saveProfile(d: Draft<DB>, userId: string, patch: Partial<Pick<User, "phone" | "title">> & { language?: "en" | "es" }) {
  const u = d.users.find((x) => x.id === userId);
  if (!u) return;
  if (patch.phone !== undefined) u.phone = patch.phone;
  if (patch.title !== undefined) u.title = patch.title;
  if (patch.language) acct(d, userId).language = patch.language;
  audit(d, { action: "Profile updated", zone: "Identity" });
}

export function rememberPage(d: Draft<DB>, userId: string, path: string) {
  const a = acct(d, userId);
  a.lastPage = path;
  const cur = a.sessions.find((s) => s.current);
  if (cur) cur.lastSeenAt = clockNow();
}

export function saveFilter(d: Draft<DB>, userId: string, key: string, value: unknown) {
  acct(d, userId).filters[key] = value as never;
}

export function signOutOtherSessions(d: Draft<DB>, userId: string) {
  const a = acct(d, userId);
  const n = a.sessions.filter((s) => !s.current && !s.revoked).length;
  a.sessions = a.sessions.filter((s) => s.current);
  audit(d, { action: `Signed out ${n} other session${n === 1 ? "" : "s"}`, zone: "Identity", category: "sign-in" });
}

export function forgetDevice(d: Draft<DB>, userId: string, deviceId: string) {
  const a = acct(d, userId);
  a.devices = a.devices.filter((x) => x.deviceId !== deviceId);
  audit(d, { action: "Remembered device removed", zone: "Identity", category: "sign-in" });
}

/** FT-026 (second option): resets only this account's preferences and memory; keeps its password and the shared world. */
export function resetMyAccount(d: Draft<DB>, userId: string) {
  const seeded = seedAccounts(d.seededAt).accounts[userId] ?? blankAccount();
  const cur = d.accounts[userId];
  d.accounts[userId] = { ...seeded, sessions: cur?.sessions.filter((s) => s.current) ?? [], currentSignInAt: cur?.currentSignInAt ?? null };
  for (const n of d.notifications) {
    if (n.toUserId === userId) n.readBy = [];
  }
  for (const m of d.outbox) {
    if (m.toUserId === userId) m.readBy = m.readBy.filter((x) => x !== userId);
  }
  const me = currentUser(d);
  audit(d, { action: "Account preferences reset", zone: "Identity", as: me });
}

export function markNotificationsRead(d: Draft<DB>, userId: string, ids: string[]) {
  for (const n of d.notifications) {
    if (ids.includes(n.id) && !n.readBy.includes(userId)) n.readBy.push(userId);
  }
}

export function markMailRead(d: Draft<DB>, userId: string, id: string) {
  const m = d.outbox.find((x) => x.id === id);
  if (m && !m.readBy.includes(userId)) m.readBy.push(userId);
}
