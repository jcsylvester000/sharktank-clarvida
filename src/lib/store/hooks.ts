"use client";
import { useEffect, useState } from "react";
import { useStore } from "./db";
import { now as clockNow } from "@/lib/clock";
import type { DB, User } from "@/lib/domain/types";

export function useDB<T>(selector: (db: DB) => T): T {
  return useStore((s) => selector(s.db));
}

export function useMutate() {
  return useStore((s) => s.mutate);
}

export function useHydrated(): boolean {
  return useStore((s) => s.hydrated);
}

export function useCurrentUser(): User | undefined {
  return useStore((s) => (s.db.session ? s.db.users.find((u) => u.id === s.db.session!.userId) : undefined));
}

/** Re-renders every `ms` milliseconds (clocks, "time ago"). Returns the app clock (simulated in the Live sandbox,
 *  where pages refresh at least every 2 seconds because simulated time runs faster). */
export function useNow(ms = 1000): number {
  const live = useStore((s) => Boolean(s.db.live));
  const [now, setNow] = useState(() => clockNow());
  const every = live ? Math.min(ms, 2000) : ms;
  useEffect(() => {
    setNow(clockNow());
    const t = setInterval(() => setNow(clockNow()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}
