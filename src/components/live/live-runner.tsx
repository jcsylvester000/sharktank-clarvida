"use client";
// Runs the simulation engine in exactly one tab (Web Locks), so several open windows never double the activity.
// Other tabs only see the data change through the normal live sync.
import { useEffect } from "react";
import { announce, useStore } from "@/lib/store/db";
import { now, reanchor } from "@/lib/clock";
import { nextDue, tick, type TickResult } from "@/lib/live/engine";
import { clockFor } from "@/lib/rules/clock";

const HEARTBEAT = "cv-live-heartbeat";
const LOCK = "cv-live-engine";

function beat() {
  try { window.localStorage.setItem(HEARTBEAT, String(Date.now())); } catch { /* ignore */ }
}
function lastBeat(): number {
  try { return Number(window.localStorage.getItem(HEARTBEAT) ?? 0); } catch { return 0; }
}

export function LiveRunner() {
  const live = useStore((s) => Boolean(s.db.live));

  useEffect(() => {
    if (!live) return;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let release: (() => void) | undefined;
    let lastEscCheck = 0;

    const start = () => {
      // Nobody had the sandbox open for a while: carry on from where it stopped instead of jumping ahead.
      const st = useStore.getState();
      if (Date.now() - lastBeat() > 5000 && st.db.live) {
        st.mutate((d) => { d.live!.clock = reanchor(d.live!.clock, { jumpTo: d.live!.lastTick }); });
      }
      beat();
      timer = setInterval(() => {
        beat();
        const s = useStore.getState();
        const db = s.db;
        if (!db.live || db.live.clock.paused) return;
        const t = now();
        let due = t >= nextDue(db);
        if (!due && Date.now() - lastEscCheck > 3000) {
          lastEscCheck = Date.now();
          due = db.referrals.some((r) => !r.escalatedAt && clockFor(r, t, db.demo.clockMode, db.sla.find((x) => x.state === r.state)).state === "overdue");
        }
        if (!due) return;
        let res: TickResult = { created: [], events: 0 };
        s.mutate((d) => { res = tick(d, t); });
        for (const id of res.created) announce({ entity: "referral", action: "created", id });
      }, 1000);
    };

    if (typeof navigator !== "undefined" && "locks" in navigator && navigator.locks) {
      navigator.locks
        .request(LOCK, () => new Promise<void>((resolve) => {
          release = resolve;
          if (stopped) resolve();
          else start();
        }))
        .catch(() => { /* lock unavailable: another tab runs the engine */ });
    } else if (Date.now() - lastBeat() > 3000) {
      start(); // very old browsers: run here if no other tab is beating
    }

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      release?.();
    };
  }, [live]);

  return null;
}
