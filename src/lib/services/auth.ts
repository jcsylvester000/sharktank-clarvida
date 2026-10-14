// Account security rules (FT-001..FT-014). They run against the browser database the same way a
// Laravel auth action would run in a transaction. The real product uses Clarvida SSO with MFA.
import type { Draft } from "immer";
import type { DB, User } from "@/lib/domain/types";
import { hashPassword, randomToken, verifyMfa } from "@/lib/auth/crypto";
import { blankAccount } from "@/lib/data/accounts";
import { audit, notify, signIn } from "@/lib/services/core";
import { uid } from "@/lib/store/db";
import { now as clockNow } from "@/lib/clock";

export const MAX_FAILED = 5;
export const LOCK_MS = 5 * 60_000;
export const RESET_TTL_MS = 15 * 60_000;
export const DEVICE_TTL_MS = 30 * 24 * 3_600_000;

export const GENERIC_FAIL = "Email or password is incorrect.";
export const DISABLED_MSG = "Your account is disabled. Contact your administrator.";

export type PasswordResult =
  | { ok: true; userId: string; needsMfa: boolean }
  | { ok: false; reason: "invalid" | "locked" | "disabled"; message: string; lockedUntil?: number };

export function findByEmail(db: DB | Draft<DB>, email: string): User | undefined {
  const e = email.trim().toLowerCase();
  return db.users.find((u) => u.email?.toLowerCase() === e);
}

export function isDeviceRemembered(db: DB | Draft<DB>, userId: string, deviceId: string | null, at = clockNow()): boolean {
  if (!deviceId) return false;
  return Boolean(db.accounts?.[userId]?.devices.some((x) => x.deviceId === deviceId && x.expiresAt > at));
}

/** FT-001 + FT-005: checks a password, counts failures and locks after 5. Messages never reveal whether an email exists. */
export function checkPassword(d: Draft<DB>, email: string, password: string, deviceId: string | null): PasswordResult {
  const at = clockNow();
  const u = findByEmail(d, email);
  if (!u) {
    audit(d, { action: "Sign-in failed (unknown account)", zone: "Identity", category: "sign-in", actor: "external" });
    return { ok: false, reason: "invalid", message: GENERIC_FAIL };
  }
  const cred = d.credentials[u.id];
  if (cred.lockedUntil && cred.lockedUntil > at) {
    return { ok: false, reason: "locked", message: "This account is locked after too many attempts.", lockedUntil: cred.lockedUntil };
  }
  if (hashPassword(cred.salt, password) !== cred.hash) {
    cred.failed += 1;
    if (cred.failed >= MAX_FAILED) {
      cred.lockedUntil = at + LOCK_MS;
      cred.failed = 0;
      audit(d, { action: "Account locked for 5 minutes (5 failed sign-ins)", zone: "Identity", category: "sign-in", as: u as User });
      notify(d, { toRole: "admin", type: "system", text: `${u.name}'s account was locked after 5 failed sign-ins`, link: "/app/audit/" });
      return { ok: false, reason: "locked", message: "This account is locked after too many attempts.", lockedUntil: cred.lockedUntil };
    }
    audit(d, { action: "Sign-in failed (wrong password)", zone: "Identity", category: "sign-in", as: u as User });
    return { ok: false, reason: "invalid", message: GENERIC_FAIL };
  }
  if (!u.active) {
    audit(d, { action: "Sign-in blocked (account disabled)", zone: "Identity", category: "sign-in", as: u as User });
    return { ok: false, reason: "disabled", message: DISABLED_MSG };
  }
  cred.failed = 0;
  cred.lockedUntil = null;
  audit(d, { action: "Password accepted, MFA requested", zone: "Identity", category: "sign-in", as: u as User });
  return { ok: true, userId: u.id, needsMfa: !isDeviceRemembered(d, u.id, deviceId, at) };
}

/** FT-003 + FT-004: verifies the 6-digit code; optionally remembers this browser for 30 days. */
export function completeMfa(d: Draft<DB>, userId: string, code: string, opts: { remember: boolean; deviceId: string | null; deviceLabel: string; method: "password" | "sso" }): boolean {
  const at = clockNow();
  const u = d.users.find((x) => x.id === userId);
  if (!u) return false;
  if (!verifyMfa(userId, code, Date.now())) {
    audit(d, { action: "MFA code rejected", zone: "Identity", category: "sign-in", as: u as User });
    return false;
  }
  if (!u.active) return false;
  const acc = (d.accounts[userId] ??= blankAccount());
  if (opts.remember && opts.deviceId) {
    acc.devices = acc.devices.filter((x) => x.deviceId !== opts.deviceId);
    acc.devices.unshift({ deviceId: opts.deviceId, label: opts.deviceLabel, addedAt: at, expiresAt: at + DEVICE_TTL_MS });
  }
  signIn(d, userId, opts.method, false);
  return true;
}

/** Remembered device: password (or SSO choice) is enough. */
export function completeWithoutMfa(d: Draft<DB>, userId: string, method: "password" | "sso") {
  signIn(d, userId, method, true);
}

/** FT-006: always answers the same way; when the account exists, a one-time link goes to the Demo Inbox. */
export function requestReset(d: Draft<DB>, email: string): string | null {
  const u = findByEmail(d, email);
  if (!u) {
    audit(d, { action: "Password reset requested (unknown address)", zone: "Identity", category: "sign-in", actor: "external" });
    return null;
  }
  const token = randomToken(20);
  const at = clockNow();
  d.resetTokens = d.resetTokens.filter((t) => t.userId !== u.id || t.usedAt);
  d.resetTokens.push({ token, userId: u.id, expiresAt: at + RESET_TTL_MS, usedAt: null });
  const link = `/login/forgot/?token=${token}`;
  d.outbox.unshift({
    id: uid("mail"), at, type: "password-reset", toUserId: u.id, to: u.email!, toName: u.name,
    from: "Clarvida Account Security <no-reply@clarvida.example>", subject: "Reset your Clarvida Referral Co-Pilot password",
    body: `Hi ${u.firstName ?? u.name},\n\nWe received a request to reset your password. Use the secure link below within 15 minutes. If you did not ask for this, you can ignore this email; your password will not change.`,
    sentVia: "Simulated email (Demo Inbox)", link, linkLabel: "Set a new password", readBy: [],
  });
  audit(d, { action: "Password reset link sent to Demo Inbox", zone: "Identity", category: "sign-in", as: u as User });
  return token;
}

export type TokenState = { ok: true; userId: string } | { ok: false; reason: "missing" | "expired" | "used" };
export function checkToken(db: DB | Draft<DB>, token: string | null): TokenState {
  if (!token) return { ok: false, reason: "missing" };
  const t = db.resetTokens.find((x) => x.token === token);
  if (!t) return { ok: false, reason: "missing" };
  if (t.usedAt) return { ok: false, reason: "used" };
  if (t.expiresAt < clockNow()) return { ok: false, reason: "expired" };
  return { ok: true, userId: t.userId };
}

export function passwordProblems(pw: string, email?: string): string[] {
  const out: string[] = [];
  if (pw.length < 12) out.push("Use at least 12 characters.");
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) out.push("Mix upper and lower case letters.");
  if (!/\d/.test(pw)) out.push("Add a number.");
  if (email && pw.toLowerCase().includes(email.split("@")[0].toLowerCase())) out.push("Don't use your email address.");
  return out;
}

export function strength(pw: string): 0 | 1 | 2 | 3 | 4 {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s) as 0 | 1 | 2 | 3 | 4;
}

export function setPassword(d: Draft<DB>, userId: string, pw: string, via: "reset" | "settings") {
  const cred = d.credentials[userId];
  const u = d.users.find((x) => x.id === userId);
  if (!cred || !u) return;
  cred.salt = `cv3-${userId}-${randomToken(8)}`;
  cred.hash = hashPassword(cred.salt, pw);
  cred.changedAt = clockNow();
  cred.failed = 0;
  cred.lockedUntil = null;
  audit(d, { action: via === "reset" ? "Password changed (reset link)" : "Password changed (settings)", zone: "Identity", category: "sign-in", as: u as User });
  d.outbox.unshift({
    id: uid("mail"), at: clockNow(), type: "security", toUserId: u.id, to: u.email!, toName: u.name,
    from: "Clarvida Account Security <no-reply@clarvida.example>", subject: "Your password was changed",
    body: "The password for your Clarvida Referral Co-Pilot account was just changed. If this wasn't you, contact your administrator.", sentVia: "Simulated email (Demo Inbox)", readBy: [],
  });
}

export function resetWithToken(d: Draft<DB>, token: string, pw: string): boolean {
  const st = checkToken(d, token);
  if (!st.ok) return false;
  setPassword(d, st.userId, pw, "reset");
  const t = d.resetTokens.find((x) => x.token === token);
  if (t) t.usedAt = clockNow();
  return true;
}

export function verifyCurrentPassword(db: DB | Draft<DB>, userId: string, pw: string): boolean {
  const c = db.credentials[userId];
  return Boolean(c) && hashPassword(c.salt, pw) === c.hash;
}
