// Two separate worlds in one app (2026-10-12):
//  - "demo": the scripted pitch demo (guided steps, presenter, reset). Real time.
//  - "live": the Live sandbox. Its own data and sync channel, a simulated clock and a simulation engine
//    that keeps referrals, intake work, outreach and capacity moving while people explore.
// The mode is remembered per window (sessionStorage) with a browser-wide default (localStorage),
// so a partner window opened from the sandbox lands in the sandbox too.
export type AppMode = "demo" | "live";

const KEY = "cv-mode";

export function getMode(): AppMode {
  if (typeof window === "undefined") return "demo";
  try {
    const s = window.sessionStorage.getItem(KEY) ?? window.localStorage.getItem(KEY);
    return s === "live" ? "live" : "demo";
  } catch {
    return "demo";
  }
}

export function setMode(m: AppMode) {
  try {
    window.sessionStorage.setItem(KEY, m);
    window.localStorage.setItem(KEY, m);
  } catch { /* storage blocked: stays in demo */ }
}

/** Switches mode and reloads at `to`, so the store hydrates from the other world's data. */
export function switchMode(m: AppMode, to: string) {
  setMode(m);
  window.location.assign(to);
}

export const isLive = () => getMode() === "live";

export function storageKey(m: AppMode = getMode()): string {
  return m === "live" ? "cv-live-v3" : "cv-proto-v3";
}

export function channelName(m: AppMode = getMode()): string {
  return m === "live" ? "cv-live-sync" : "cv-sync";
}
