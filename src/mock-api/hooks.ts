"use client";
// useApi: a screen's GET. The app shell already shows a 150-600 ms skeleton on every navigation (the simulated
// page request); after that the data stays live: any change in this window or another window re-renders
// immediately (FT-021, FT-024). Reads always go through the scope filter (FT-009).
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store/db";
import type { DB, User } from "@/lib/domain/types";
import { latencyMs, wait } from "./http";
import { scoped } from "./scope";

export function useApi<T>(read: (db: DB, me: User) => T, deps: unknown[] = [], opts: { delay?: boolean } = {}): { data: T | undefined; loading: boolean } {
  const db = useStore((s) => s.db);
  const me = useMemo(() => (db.session ? db.users.find((u) => u.id === db.session!.userId) : undefined), [db]);
  const [ready, setReady] = useState(!opts.delay);
  useEffect(() => {
    if (!opts.delay) return;
    let alive = true;
    wait(latencyMs()).then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [opts.delay]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => (me ? read(scoped(db, me), me) : undefined), [db, me, ...deps]);
  return { data: ready ? data : undefined, loading: !ready };
}
