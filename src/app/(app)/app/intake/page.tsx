"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, Radio, Volume2, VolumeX, Route as RouteIcon, PhoneIncoming } from "lucide-react";
import { useStore, onRemoteChange } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { clockFor } from "@/lib/rules/clock";
import { queueLabel } from "@/lib/rules/routing";
import { escalateOverdue, referralsInScope, routeFromTriage } from "@/lib/services/referrals";
import { href, accessForUser, pageById } from "@/lib/access";
import { ClockCell } from "@/components/domain/clock";
import { StatusChip } from "@/components/domain/chips";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/field";
import { Dialog } from "@/components/ui/overlays";
import { PageHeader, Stat, Empty } from "@/components/ui/misc";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";
import type { Referral } from "@/lib/domain/types";
import { now as clockNow } from "@/lib/clock";

type Filter = "all" | "waiting" | "due_soon" | "overdue" | "hold";
const H = 3_600_000;

function Queue() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const now = useNow(1000);
  const readOnly = accessForUser(pageById("PG-14"), user) === "read";
  const [filter, setFilter] = useState<Filter>("all");
  const [queue, setQueue] = useState<string>(params.get("queue") === "triage" ? "triage" : "mine");
  const [arrived, setArrived] = useState<string[]>([]);
  const [focusIdx, setFocusIdx] = useState(-1);
  const [routing, setRouting] = useState<Referral | null>(null);
  const [routeTo, setRouteTo] = useState("");
  const rowsRef = useRef<HTMLTableSectionElement>(null);

  const scoped = useMemo(() => referralsInScope(db, user.id), [db, user.id]);
  const queues = useMemo(() => Array.from(new Set(scoped.map((r) => r.queue))).sort(), [scoped]);

  // Live arrivals (E01): highlight for 10 seconds, optional chime.
  useEffect(() => {
    return onRemoteChange((m) => {
      if (m.entity === "referral" && m.action === "created" && m.id) {
        setArrived((a) => [...a, m.id!]);
        setTimeout(() => setArrived((a) => a.filter((x) => x !== m.id)), 10_000);
        if (useStore.getState().db.demo.soundOn) chime();
      }
    });
  }, []);

  // Guided demo: the partner form is usually sent from another window before this page opens,
  // so the latest partner referral is also highlighted on arrival if it came in within 5 minutes.
  useEffect(() => {
    const st = useStore.getState().db;
    const id = st.demo.lastPartnerRef;
    const r = id ? st.referrals.find((x) => x.id === id) : undefined;
    if (!id || !r || r.firstContactAt || clockNow() - r.receivedAt > 5 * 60_000) return;
    setArrived((a) => (a.includes(id) ? a : [...a, id]));
    const t = setTimeout(() => setArrived((a) => a.filter((x) => x !== id)), 20_000);
    return () => clearTimeout(t);
  }, []);

  // Overdue escalation (BR05): checked every 20 seconds.
  useEffect(() => {
    const tick = () => {
      const state = useStore.getState().db;
      const t = clockNow();
      const needs = state.referrals.some((r) => !r.escalatedAt && clockFor(r, t, state.demo.clockMode, state.sla.find((s) => s.state === r.state)).state === "overdue");
      if (needs) mutate((d) => { escalateOverdue(d, t); });
    };
    tick();
    const i = setInterval(tick, 20_000);
    return () => clearInterval(i);
  }, [mutate]);

  const rows = useMemo(() => {
    const withClock = scoped
      .filter((r) => (queue === "mine" ? true : queue === "triage" ? r.queue.startsWith("Triage") : r.queue === queue))
      .map((r) => ({ r, c: clockFor(r, now, db.demo.clockMode, db.sla.find((s) => s.state === r.state)) }));
    const filtered = withClock.filter(({ r, c }) =>
      filter === "all" ? r.status !== "Closed" && r.status !== "Redirected" && r.status !== "Intake completed" :
      filter === "waiting" ? c.state !== "stopped" :
      filter === "due_soon" ? c.state === "due_soon" :
      filter === "overdue" ? c.state === "overdue" :
      r.status === "Hold");
    return filtered.sort((a, b) => {
      const an = arrived.includes(a.r.id) ? 0 : 1, bn = arrived.includes(b.r.id) ? 0 : 1;
      if (an !== bn) return an - bn;
      const aw = a.c.state === "stopped" ? 1 : 0, bw = b.c.state === "stopped" ? 1 : 0;
      if (aw !== bw) return aw - bw;
      if (!aw) return a.c.leftMs - b.c.leftMs;
      return b.r.receivedAt - a.r.receivedAt;
    });
  }, [scoped, queue, filter, now, db.demo.clockMode, db.sla, arrived]);

  const counts = useMemo(() => {
    const all = scoped.map((r) => clockFor(r, now, db.demo.clockMode, db.sla.find((s) => s.state === r.state)));
    return {
      waiting: all.filter((c) => c.state !== "stopped").length,
      dueSoon: all.filter((c) => c.state === "due_soon").length,
      overdue: all.filter((c) => c.state === "overdue").length,
      hold: scoped.filter((r) => r.status === "Hold").length,
    };
  }, [scoped, now, db.demo.clockMode, db.sla]);

  // Keyboard navigation: J/K to move, Enter to open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "j") setFocusIdx((i) => Math.min(rows.length - 1, i + 1));
      if (e.key === "k") setFocusIdx((i) => Math.max(0, i - 1));
      if (e.key === "Enter" && focusIdx >= 0 && rows[focusIdx]) router.push(href("/app/referral", { id: rows[focusIdx].r.id }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, focusIdx, router]);

  useEffect(() => {
    if (focusIdx < 0) return;
    (rowsRef.current?.querySelectorAll("tr")[focusIdx] as HTMLElement | undefined)?.focus();
  }, [focusIdx]);

  const orgName = (r: Referral) => (r.referrerOrgId ? db.orgs.find((o) => o.id === r.referrerOrgId)?.name : r.referrerOrgName) ?? "—";
  const prog = (id: string | null) => db.programs.find((p) => p.id === id);
  const userName = (id?: string) => db.users.find((u) => u.id === id)?.name ?? "Unassigned";
  const partnerUrl = typeof window !== "undefined" ? `${window.location.origin}/partner/refer/?code=GCS-NC-2026` : "";

  return (
    <div>
      <PageHeader
        title="Intake Queue"
        description="Every referral in your queues, most urgent first. The clock counts down from one business day."
        meta={<Badge tone="care" icon={<Radio size={12} />}>Live: new referrals appear here within a second</Badge>}
        actions={
          <>
            <Button variant="ghost" size="icon" aria-label={db.demo.soundOn ? "Turn arrival chime off" : "Turn arrival chime on"} onClick={() => mutate((d) => { d.demo.soundOn = !d.demo.soundOn; })}>
              {db.demo.soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.open(partnerUrl, "partner", "width=520,height=900")}>
              <Copy size={14} /> Open partner form in a new window
            </Button>
            {!readOnly ? (
              <Link href={href("/app/referral/new")} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-care px-3 text-[0.8125rem] font-medium text-white hover:bg-care-strong">
                <PhoneIncoming size={14} /> New phone or fax referral
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Waiting for first contact" value={counts.waiting} onClick={() => setFilter(filter === "waiting" ? "all" : "waiting")} active={filter === "waiting"} />
        <Stat label="Due soon" value={counts.dueSoon} tone={counts.dueSoon ? "warn" : undefined} sub="2 business hours or less" onClick={() => setFilter(filter === "due_soon" ? "all" : "due_soon")} active={filter === "due_soon"} />
        <Stat label="Overdue, escalated" value={counts.overdue} tone={counts.overdue ? "crit" : undefined} sub="Supervisor notified" onClick={() => setFilter(filter === "overdue" ? "all" : "overdue")} active={filter === "overdue"} />
        <Stat label="On hold" value={counts.hold} sub="Waitlist or awaiting information" onClick={() => setFilter(filter === "hold" ? "all" : "hold")} active={filter === "hold"} />
      </div>

      <div className="rounded-lg border border-line bg-surface" data-guide="queue">
        <div className="flex flex-wrap items-center gap-3 border-b border-line-2 px-4 py-3">
          <Label htmlFor="q" className="sr-only">Queue</Label>
          <Select id="q" value={queue} onChange={(e) => setQueue(e.target.value)} className="h-9 w-auto min-w-64">
            <option value="mine">All my queues</option>
            {queues.map((q) => <option key={q} value={q.startsWith("Triage") ? "triage" : q}>{queueLabel(q, db.routing)}</option>)}
          </Select>
          {filter !== "all" ? <Button variant="link" size="sm" onClick={() => setFilter("all")}>Clear filter</Button> : null}
          <p className="ml-auto text-xs text-ink-3">Keyboard: J and K to move, Enter to open</p>
        </div>
        {rows.length === 0 ? (
          <Empty title="No referrals match" className="m-4">Change the queue or clear the filter.</Empty>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Reference</TH>
                <TH className="min-w-[11rem]">Program</TH>
                <TH>Source</TH>
                <TH className="hidden text-right 2xl:table-cell">Age</TH>
                <TH>Response clock</TH>
                <TH>Status</TH>
                <TH>Owner</TH>
              </tr>
            </THead>
            <tbody ref={rowsRef}>
              {rows.map(({ r }, i) => {
                const p = prog(r.programId);
                const isNew = arrived.includes(r.id);
                return (
                  <TR
                    key={r.id}
                    tabIndex={0}
                    onClick={() => router.push(href("/app/referral", { id: r.id }))}
                    onKeyDown={(e) => { if (e.key === "Enter") router.push(href("/app/referral", { id: r.id })); }}
                    className={cn("cursor-pointer focus:bg-teal-tint/50 focus:outline-none", isNew && "arrive", i === focusIdx && "bg-teal-tint/40")}
                  >
                    <TD>
                      <span className="font-mono text-[0.85rem] font-medium">{r.id}</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {isNew ? <Badge tone="hl">Just arrived</Badge> : null}
                        {r.dupOf ? <Badge tone="warn" className="whitespace-normal">Possible duplicate of {r.dupOf}</Badge> : null}
                        {r.escalatedAt && r.status === "New" && !r.firstContactAt ? <Badge tone="crit">Escalated</Badge> : null}
                      </div>
                    </TD>
                    <TD>
                      {p ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{p.name}</span>
                          {p.part2 ? <Badge tone="care">Part 2</Badge> : null}
                        </span>
                      ) : (
                        <span className="text-ink-3">Not chosen</span>
                      )}
                    </TD>
                    <TD>
                      <span>{r.srcType}</span>
                      <span className="block max-w-[12rem] truncate text-xs text-ink-3" title={orgName(r)}>{orgName(r)}</span>
                      <span className="block text-xs text-ink-3">{r.channel}</span>
                    </TD>
                    <TD className="hidden text-right tabular whitespace-nowrap 2xl:table-cell">{Math.max(0, Math.floor((now - r.receivedAt) / H))} h</TD>
                    <TD className="whitespace-nowrap"><ClockCell referral={r} now={now} /></TD>
                    <TD>
                      <StatusChip status={r.status} />
                      {r.queue.startsWith("Triage") && !readOnly && user.role === "intake_sup" ? (
                        <Button size="sm" variant="secondary" className="mt-1.5" onClick={(e) => { e.stopPropagation(); setRouting(r); setRouteTo(""); }}>
                          <RouteIcon size={13} /> Route
                        </Button>
                      ) : null}
                    </TD>
                    <TD className="whitespace-nowrap text-ink-2">{userName(r.ownerId)}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>

      <Dialog
        open={Boolean(routing)}
        onOpenChange={(o) => !o && setRouting(null)}
        title={`Route ${routing?.id ?? ""}`}
        description="This referral had no matching routing rule. Choose the program and queue that should own it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRouting(null)}>Cancel</Button>
            <Button disabled={!routeTo} onClick={() => { const id = routing!.id; mutate((d) => routeFromTriage(d, id, routeTo)); setRouting(null); }}>Route referral</Button>
          </>
        }
      >
        <Label htmlFor="routeTo">Program</Label>
        <Select id="routeTo" value={routeTo} onChange={(e) => setRouteTo(e.target.value)} className="mt-1">
          <option value="">Choose a program</option>
          {db.programs.filter((p) => user.scope.includes("ALL") || user.scope.includes(p.state)).map((p) => (
            <option key={p.id} value={p.id}>{p.name}, {p.office} ({p.capacity})</option>
          ))}
        </Select>
      </Dialog>
    </div>
  );
}

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.5);
  } catch { /* audio unavailable */ }
}

export default function Page() {
  return (
    <Suspense>
      <Queue />
    </Suspense>
  );
}
