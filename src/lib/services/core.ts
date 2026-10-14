// Core services that every other service uses: audit (BR26), notifications (BR27), session (BR22).
// They operate on an Immer draft inside store.mutate(), the same way a Laravel action would run in a transaction.
import type { Draft } from "immer";
import type { AuditEvent, DB, Notification, Role, User, Zone } from "@/lib/domain/types";
import { uid } from "@/lib/store/db";
import { now as clockNow } from "@/lib/clock";

export const AUDIT_CAP = 2000; // FT-140: capped at 2,000 entries

export const DEVICE = (() => {
  if (typeof navigator === "undefined") return "Browser (simulated)";
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : "Linux";
  return `${browser} on ${os} (simulated IP)`;
})();

// Live sandbox: the simulation acts as a simulated teammate without touching the viewer's session.
let actorOverride: User | null = null;
export const SYSTEM_ACTOR: User = { id: "system", name: "System (simulation)", initials: "SY", role: "admin", scope: ["ALL"], office: "Live sandbox", mfa: true, active: true };

/** Runs `fn` with every audit entry, note and status change attributed to `actor`. */
export function withActor<T>(actor: User, fn: () => T): T {
  const prev = actorOverride;
  actorOverride = actor;
  try {
    return fn();
  } finally {
    actorOverride = prev;
  }
}

export function currentUser(d: DB | Draft<DB>): User | undefined {
  if (actorOverride) return actorOverride;
  return d.session ? d.users.find((u) => u.id === d.session!.userId) : undefined;
}

export function audit(
  d: Draft<DB>,
  e: { action: string; objectId?: string; zone: Zone; category?: AuditEvent["category"]; actor?: "external"; as?: User },
) {
  const u = e.as ?? (e.actor === "external" ? undefined : currentUser(d));
  d.audit.unshift({
    id: uid("au"),
    at: clockNow(),
    actorId: u?.id ?? "external",
    actorName: u?.name ?? "Referring partner (no account)",
    role: u?.role ?? "partner",
    action: e.action,
    objectId: e.objectId,
    zone: e.zone,
    device: DEVICE,
    category: e.category,
  });
  if (d.audit.length > AUDIT_CAP) d.audit.length = AUDIT_CAP;
}

export function notify(d: Draft<DB>, n: { toRole?: Role; toUserId?: string; text: string; link: string; type?: Notification["type"] }) {
  const note: Notification = { id: uid("n"), at: clockNow(), readBy: [], ...n };
  d.notifications.unshift(note);
  if (d.notifications.length > 200) d.notifications.length = 200;
}

/** Starts a session for an account (after password + MFA, SSO + MFA, a remembered device or the guided demo). */
export function signIn(d: Draft<DB>, userId: string, method: NonNullable<DB["session"]>["method"] = "password", mfaSkipped = false) {
  const at = clockNow();
  const sessionId = uid("ss");
  d.session = { userId, since: at, sessionId, method, mfaSkipped };
  const acc = d.accounts?.[userId];
  if (acc) {
    if (acc.currentSignInAt) {
      acc.lastSignInAt = acc.currentSignInAt;
      acc.lastSignInFrom = "this browser";
    }
    acc.currentSignInAt = at;
    acc.sessions = acc.sessions.filter((s) => !s.current);
    acc.sessions.unshift({ id: sessionId, device: DEVICE.replace(" (simulated IP)", ""), place: "This browser", startedAt: at, lastSeenAt: at, current: true });
  }
  const how = method === "sso" ? "Clarvida SSO" : method === "guided" ? "guided demo" : method === "switch" ? "account switch (demo)" : "password";
  audit(d, { action: `Signed in (${how}${mfaSkipped ? ", remembered device" : method === "guided" || method === "switch" ? "" : " + MFA"})`, zone: "Identity", category: "sign-in" });
}

export function switchPersona(d: Draft<DB>, userId: string) {
  const from = currentUser(d);
  if (from) audit(d, { action: "Signed out (switch account)", zone: "Identity", category: "sign-in" });
  endCurrentSession(d);
  signIn(d, userId, "switch", true);
}

function endCurrentSession(d: Draft<DB>) {
  const s = d.session;
  if (!s) return;
  const acc = d.accounts?.[s.userId];
  if (acc) {
    const cur = acc.sessions.find((x) => x.id === s.sessionId || x.current);
    if (cur) { cur.current = false; cur.lastSeenAt = clockNow(); }
    acc.sessions = acc.sessions.slice(0, 6);
  }
}

export function signOut(d: Draft<DB>, reason: "manual" | "idle" = "manual") {
  audit(d, { action: reason === "idle" ? "Signed out automatically (idle)" : "Signed out", zone: "Identity", category: "sign-in" });
  endCurrentSession(d);
  d.session = null;
}

export function notificationsFor(db: DB, user: User | undefined): Notification[] {
  if (!user) return [];
  const prefs = db.accounts?.[user.id]?.prefs;
  return db.notifications.filter((n) => (n.toUserId === user.id || (!n.toUserId && n.toRole === user.role)) && (!n.type || !prefs || prefs[n.type] !== "off"));
}

/** Team activity line (FT-044). PHI-free by construction; scoped to the reader's states. */
export function activity(d: Draft<DB>, text: string, opts: { zone?: "Care" | "Outreach" | "Both"; link?: string; states?: string[] } = {}) {
  const u = currentUser(d);
  if (!u || !d.activity) return;
  d.activity.unshift({ id: uid("act"), at: clockNow(), actorId: u.id, text, states: opts.states ?? (u.scope.includes("ALL") ? ["ALL"] : [...u.scope]), link: opts.link, zone: opts.zone ?? "Outreach" });
  if (d.activity.length > 300) d.activity.length = 300;
}
