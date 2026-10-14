// The prototype's "pretend back end" (FT-021). Every screen built in v3 reads and writes through these
// async endpoints, which mirror the future REST API (e.g. POST /auth/password, GET /me/inbox) and add
// 150-600 ms of latency. Production swaps this folder for real HTTP calls to the Laravel API.
import { useStore, type MutateOptions } from "@/lib/store/db";
import type { Draft } from "immer";
import type { DB } from "@/lib/domain/types";

export interface ApiCall {
  at: number;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  ms: number;
  ok: boolean;
}

/** Last 50 simulated requests (for the "What is simulated" panel and QA). */
export const apiLog: ApiCall[] = [];

export function latencyMs(min = 150, max = 600): number {
  const guided = useStore.getState().db.demo.guideOn;
  // During the guided demo, stay at the fast end so page changes stay within 600 ms (NF-01).
  const hi = guided ? Math.min(max, 320) : max;
  return Math.round(min + Math.random() * (hi - min));
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A read: waits like the network would, then returns data computed from the current database. */
export async function get<T>(path: string, read: (db: DB) => T, ms = latencyMs()): Promise<T> {
  await wait(ms);
  const out = read(useStore.getState().db);
  log("GET", path, ms, true);
  return out;
}

/** A write: waits, then runs the change as one transaction and syncs other windows. */
export async function send<T>(method: "POST" | "PATCH" | "DELETE", path: string, write: (d: Draft<DB>) => T, opts?: MutateOptions & { ms?: number }): Promise<T> {
  const ms = opts?.ms ?? latencyMs();
  await wait(ms);
  let out!: T;
  const ok = useStore.getState().mutate((d) => { out = write(d); }, { entity: path.split("/")[1] ?? "db", action: method.toLowerCase() }, opts);
  log(method, path, ms, ok);
  if (!ok) throw new ReadOnlyError();
  return out;
}

export class ReadOnlyError extends Error {
  constructor() {
    super("This account is read-only.");
  }
}

function log(method: ApiCall["method"], path: string, ms: number, ok: boolean) {
  apiLog.unshift({ at: Date.now(), method, path, ms, ok });
  if (apiLog.length > 50) apiLog.length = 50;
}
