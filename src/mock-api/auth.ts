// /auth/* endpoints (simulated). Mirrors the production identity flow: password or SSO, then MFA.
import { get, send } from "./http";
import * as A from "@/lib/services/auth";
import { signOut, switchPersona } from "@/lib/services/core";
import type { DB } from "@/lib/domain/types";

const PENDING = "cv-pending-auth";
const DEVICE = "cv-device-id";

export interface PendingAuth { userId: string; method: "password" | "sso"; at: number }

export function deviceId(): string | null {
  try {
    let id = window.localStorage.getItem(DEVICE);
    if (!id) {
      id = `dev-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(DEVICE, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function deviceLabel(): string {
  if (typeof navigator === "undefined") return "This browser";
  const ua = navigator.userAgent;
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : "Linux";
  return `${b} on ${os}`;
}

export function getPending(): PendingAuth | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING);
    const p = raw ? (JSON.parse(raw) as PendingAuth) : null;
    return p && Date.now() - p.at < 10 * 60_000 ? p : null;
  } catch {
    return null;
  }
}
function setPending(p: PendingAuth | null) {
  try {
    if (p) window.sessionStorage.setItem(PENDING, JSON.stringify(p));
    else window.sessionStorage.removeItem(PENDING);
  } catch { /* storage blocked */ }
}

/** POST /auth/password */
export async function passwordSignIn(email: string, password: string): Promise<A.PasswordResult & { signedIn?: boolean }> {
  const dev = deviceId();
  const res = await send("POST", "/auth/password", (d) => {
    const r = A.checkPassword(d, email, password, dev);
    if (r.ok && !r.needsMfa) A.completeWithoutMfa(d, r.userId, "password");
    return r;
  }, { allowReadOnly: true });
  if (res.ok && res.needsMfa) setPending({ userId: res.userId, method: "password", at: Date.now() });
  return { ...res, signedIn: res.ok && !res.needsMfa };
}

/** POST /auth/sso (simulated Clarvida SSO: the account chooser has already identified the user) */
export async function ssoSignIn(userId: string): Promise<{ ok: boolean; needsMfa: boolean; message?: string }> {
  const dev = deviceId();
  return send("POST", "/auth/sso", (d) => {
    const u = d.users.find((x) => x.id === userId);
    if (!u || !u.active) return { ok: false, needsMfa: false, message: A.DISABLED_MSG };
    if (A.isDeviceRemembered(d, userId, dev)) {
      A.completeWithoutMfa(d, userId, "sso");
      return { ok: true, needsMfa: false };
    }
    setPending({ userId, method: "sso", at: Date.now() });
    return { ok: true, needsMfa: true };
  }, { allowReadOnly: true, ms: 700 });
}

/** POST /auth/mfa */
export async function verifyMfaCode(code: string, remember: boolean): Promise<{ ok: boolean; userId?: string; message?: string }> {
  const p = getPending();
  if (!p) return { ok: false, message: "Your sign-in timed out. Please start again." };
  const ok = await send("POST", "/auth/mfa", (d) => A.completeMfa(d, p.userId, code, { remember, deviceId: deviceId(), deviceLabel: deviceLabel(), method: p.method }), { allowReadOnly: true });
  if (ok) setPending(null);
  return ok ? { ok, userId: p.userId } : { ok, message: "That code didn't match. Check the Demo Authenticator and try the current code." };
}

export function cancelPending() {
  setPending(null);
}

/** POST /auth/forgot: always the same answer (never reveals whether an account exists). */
export async function requestPasswordReset(email: string): Promise<void> {
  await send("POST", "/auth/forgot", (d) => { A.requestReset(d, email); }, { allowReadOnly: true });
}

/** GET /auth/reset/:token */
export function tokenState(token: string | null) {
  return get(`/auth/reset/${token ?? ""}`, (db: DB) => A.checkToken(db, token), 200);
}

/** POST /auth/reset */
export async function resetPassword(token: string, password: string): Promise<boolean> {
  return send("POST", "/auth/reset", (d) => A.resetWithToken(d, token, password), { allowReadOnly: true });
}

/** POST /auth/sign-out */
export async function signOutNow(reason: "manual" | "idle" = "manual") {
  await send("POST", "/auth/sign-out", (d) => signOut(d, reason), { allowReadOnly: true, ms: 120 });
}

/** POST /auth/switch (demo convenience: the presenter changes account in 2 clicks, FT-011) */
export async function switchAccount(userId: string) {
  await send("POST", "/auth/switch", (d) => switchPersona(d, userId), { allowReadOnly: true, ms: 250 });
}
