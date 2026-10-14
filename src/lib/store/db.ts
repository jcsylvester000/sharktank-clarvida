"use client";
// The prototype's "database": one versioned key in browser storage, seeded on first load, resettable,
// and synced live between windows on the same machine (BR34, BR35). Production replaces this with PostgreSQL.
import { create } from "zustand";
import { produce, type Draft } from "immer";
import type { DB } from "@/lib/domain/types";
import { makeSeed, SCHEMA_VERSION } from "@/lib/data/seed";
import { makeLiveSeed } from "@/lib/live/seed";
import { channelName, getMode, storageKey } from "@/lib/mode";
import { setClock } from "@/lib/clock";
import { toast } from "sonner";

const SESSION_KEY = "cv-session"; // per window, so two windows can show two personas side by side

const freshSeed = (): DB => (getMode() === "live" ? makeLiveSeed() : makeSeed());

export interface MutateOptions {
  /** Allow the write for a read-only account (Guest Judge): their own preferences, page-view audit, ROI sliders. */
  allowReadOnly?: boolean;
}

export interface SyncMessage {
  entity: string;
  id?: string;
  action: string;
  from?: string; // window id
}

type Listener = (m: SyncMessage) => void;

interface StoreState {
  db: DB;
  hydrated: boolean;
  memoryOnly: boolean;
  hydrate: () => void;
  mutate: (fn: (d: Draft<DB>) => void, sync?: Omit<SyncMessage, "from">, opts?: MutateOptions) => boolean;
  reset: () => void;
  reload: () => void;
}

const WINDOW_ID = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());
const listeners = new Set<Listener>();
let lastReadOnlyToast = 0;
let channel: BroadcastChannel | null = null;

function readSession(): DB["session"] {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as DB["session"]) : null;
  } catch {
    return null;
  }
}

function writeSession(s: DB["session"]) {
  try {
    if (s) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else window.sessionStorage.removeItem(SESSION_KEY);
  } catch { /* storage blocked */ }
}

function readStorage(): DB | null {
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DB;
    if (!parsed || parsed.version !== SCHEMA_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(db: DB): boolean {
  writeSession(db.session);
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify({ ...db, session: null }));
    return true;
  } catch {
    return false;
  }
}

function broadcast(m: SyncMessage) {
  try {
    channel?.postMessage(m);
  } catch {
    /* channel unavailable: storage event fallback still fires in other windows */
  }
}

export const useStore = create<StoreState>((set, get) => ({
  db: makeSeed(0), // placeholder until hydrate() runs in the browser
  hydrated: false,
  memoryOnly: false,

  hydrate: () => {
    if (get().hydrated) return;
    // Read this window's session first: a first load or a re-seed after a version bump must not sign the window out.
    const session = readSession();
    let db = readStorage();
    let memoryOnly = false;
    if (!db) {
      db = { ...freshSeed(), session };
      memoryOnly = !writeStorage(db);
    }
    db = { ...db, session };
    setClock(db.live?.clock);
    set({ db, hydrated: true, memoryOnly });

    if (typeof BroadcastChannel !== "undefined" && !channel) {
      channel = new BroadcastChannel(channelName());
      channel.onmessage = (e: MessageEvent<SyncMessage>) => {
        if (e.data?.from === WINDOW_ID) return;
        get().reload();
        listeners.forEach((l) => l(e.data));
      };
    }
    window.addEventListener("storage", (e) => {
      if (e.key !== storageKey()) return;
      if (channel) return; // BroadcastChannel already handled it
      get().reload();
      listeners.forEach((l) => l({ entity: "db", action: "changed" }));
    });
  },

  mutate: (fn, sync, opts) => {
    const cur = get().db;
    const me = cur.session ? cur.users.find((u) => u.id === cur.session!.userId) : undefined;
    if (me?.readOnly && !opts?.allowReadOnly) {
      const t = Date.now();
      if (t - lastReadOnlyToast > 3000) {
        lastReadOnlyToast = t;
        toast.info("Guest view is read-only", { description: "Judges can explore everything. Changes to shared data are switched off for this account." });
      }
      return false;
    }
    const next = produce(cur, fn);
    setClock(next.live?.clock);
    set({ db: next });
    const ok = writeStorage(next);
    if (!ok && !get().memoryOnly) set({ memoryOnly: true });
    broadcast({ entity: "db", action: "changed", ...sync, from: WINDOW_ID });
    return true;
  },

  reset: () => {
    const seed = freshSeed();
    setClock(seed.live?.clock);
    set({ db: seed });
    writeStorage(seed);
    broadcast({ entity: "db", action: "reset", from: WINDOW_ID });
  },

  reload: () => {
    const db = readStorage();
    if (db) {
      setClock(db.live?.clock);
      set({ db: { ...db, session: get().db.session } });
    }
  },
}));

/** Tells this window's listeners and every other window about an event (the Live sandbox engine uses it,
 *  because a window never hears its own broadcasts). */
export function announce(m: Omit<SyncMessage, "from">) {
  listeners.forEach((l) => l(m));
  broadcast({ ...m, from: WINDOW_ID });
}

/** Subscribe to changes made in other windows (used for live arrival toasts). */
export function onRemoteChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
