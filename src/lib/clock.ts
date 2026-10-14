// One clock for the whole app. In the demo it is real time. In the Live sandbox it is simulated time:
// it can be paused, sped up (1x to 60x) or skipped to the next business morning. Every service, rule and
// page reads time through now(), so clocks, escalations and "time ago" all follow the simulation.
// UI-only timers (idle sign-out, presenter stopwatch, reveal countdown, rate limit) stay on real time.

export interface SimClock {
  anchorReal: number; // real ms when the clock was last set
  anchorSim: number; // simulated ms at that moment
  speed: number; // simulated ms per real ms
  paused: boolean;
}

let current: SimClock | null = null;
let pinned: number | null = null;

/** Called by the store whenever the data changes; null means real time (demo). */
export function setClock(c: SimClock | null | undefined) {
  current = c ?? null;
}

export function simNowFrom(c: SimClock, real: number = Date.now()): number {
  return c.paused ? c.anchorSim : c.anchorSim + (real - c.anchorReal) * c.speed;
}

export function now(): number {
  if (pinned !== null) return pinned;
  return current ? Math.floor(simNowFrom(current)) : Date.now();
}

/** Runs `fn` as if the time were `t`: the simulation stamps each event with the moment it happened,
 *  even when it catches up on several events at once. */
export function withTime<T>(t: number, fn: () => T): T {
  const prev = pinned;
  pinned = t;
  try {
    return fn();
  } finally {
    pinned = prev;
  }
}

export function isSimulated(): boolean {
  return current !== null;
}

/** A new clock that continues from the current simulated time with a different speed, pause state or jump. */
export function reanchor(c: SimClock, change: { speed?: number; paused?: boolean; jumpTo?: number }, real: number = Date.now()): SimClock {
  const sim = change.jumpTo ?? simNowFrom(c, real);
  return { anchorReal: real, anchorSim: Math.floor(sim), speed: change.speed ?? c.speed, paused: change.paused ?? c.paused };
}

export const SPEEDS = [1, 10, 30, 60] as const;
