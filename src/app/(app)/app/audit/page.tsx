"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Search } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useNow } from "@/lib/store/hooks";
import { audit } from "@/lib/services/core";
import { ROLE_LABEL } from "@/lib/access";
import { ago, fmtDateTime, plural } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import type { AuditEvent, Role } from "@/lib/domain/types";
import { ZoneBadge } from "@/components/domain/chips";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { Switch } from "@/components/ui/overlays";
import { Empty, PageHeader, Stat } from "@/components/ui/misc";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";

type Chip = "blocked" | "export" | "care" | "access" | "ai" | "config";
const CHIPS: { id: Chip; label: string; test: (e: AuditEvent) => boolean }[] = [
  { id: "blocked", label: "Blocked", test: (e) => e.category === "blocked" },
  { id: "export", label: "Exports", test: (e) => e.category === "export" },
  { id: "care", label: "Care Zone", test: (e) => e.zone === "Care" || e.category === "care" },
  { id: "access", label: "Access denied", test: (e) => e.category === "access" },
  { id: "ai", label: "AI calls", test: (e) => e.category === "ai" || /Co-Pilot|\bAI\b/.test(e.action) },
  { id: "config", label: "Settings changes", test: (e) => e.category === "config" },
];
const PAGE = 100;

function roleLabel(role: string): string {
  return (ROLE_LABEL as Record<string, string>)[role as Role] ?? (role === "partner" ? "External partner" : role);
}

export default function AuditLog() {
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const now = useNow(30_000);
  const [q, setQ] = useState("");
  const [chips, setChips] = useState<Chip[]>([]);
  const [group, setGroup] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return db.audit.filter((e) => {
      if (chips.length && !chips.some((c) => CHIPS.find((x) => x.id === c)!.test(e))) return false;
      if (!needle) return true;
      return [e.actorName, e.action, e.objectId ?? "", roleLabel(e.role)].some((s) => s.toLowerCase().includes(needle));
    });
  }, [db.audit, q, chips]);

  const sinceDemo = db.audit.filter((e) => e.at >= db.seededAt);
  const counts = {
    total: sinceDemo.length,
    blocked: sinceDemo.filter((e) => e.category === "blocked").length,
    care: sinceDemo.filter((e) => e.zone === "Care").length,
    exports: sinceDemo.filter((e) => e.category === "export").length,
  };

  const grouped = useMemo(() => {
    const m = new Map<string, AuditEvent[]>();
    rows.forEach((e) => m.set(e.actorName, [...(m.get(e.actorName) ?? []), e]));
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [rows]);

  const toggle = (c: Chip) => { setChips((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c])); setLimit(PAGE); };

  const exportCsv = () => {
    downloadCsv("audit-log.csv", ["Time (UTC)", "Who", "Role", "Action", "Object", "Zone", "Device"], rows.map((e) => [new Date(e.at).toISOString(), e.actorName, roleLabel(e.role), e.action, e.objectId ?? "", e.zone, e.device]));
    mutate((d) => audit(d, { action: `Exported audit log (${rows.length} rows)`, zone: "Both", category: "export" }));
    toast.success(`Exported ${plural(rows.length, "row")}. The export itself is now in the log.`);
  };

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Every sign-in, view, change, export, block and AI call, newest first. Append-only. No client details are ever written here: only who, what, which record ID and when."
        actions={<Button variant="secondary" size="sm" onClick={exportCsv}><Download size={14} /> Export CSV</Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Actions since demo start" value={counts.total} />
        <Stat label="Care Zone actions" value={counts.care} tone="care" />
        <Stat label="Blocked attempts" value={counts.blocked} tone={counts.blocked ? "crit" : undefined} sub="Client details stopped" />
        <Stat label="Exports" value={counts.exports} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <label htmlFor="audit-q" className="sr-only">Search the audit log</label>
          <Input id="audit-q" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Search by person, record or action" className="pl-8" />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
          {CHIPS.map((c) => {
            const on = chips.includes(c.id);
            return (
              <button key={c.id} type="button" aria-pressed={on} onClick={() => toggle(c.id)}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium", on ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:border-ink-3")}>
                {c.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto"><Switch id="audit-group" checked={group} onCheckedChange={setGroup} label="Group by person" /></div>
      </div>

      <div className="rounded-lg border border-line bg-surface" data-guide="audit">
        {rows.length === 0 ? (
          <Empty title="No matching actions" className="m-4">Clear a filter or change the search.</Empty>
        ) : group ? (
          <div className="divide-y divide-line-2">
            {grouped.map(([who, evs]) => (
              <details key={who} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span><span className="font-medium">{who}</span> <span className="text-sm text-ink-3">{roleLabel(evs[0].role)}</span></span>
                  <span className="flex items-center gap-2 text-sm text-ink-2">
                    {evs.some((e) => e.category === "blocked") ? <Badge tone="crit">Blocked</Badge> : null}
                    {plural(evs.length, "action")}, latest {ago(evs[0].at, now)}
                  </span>
                </summary>
                <ul className="mt-2 space-y-1 border-l-2 border-line-2 pl-3 text-sm">
                  {evs.slice(0, 25).map((e) => (
                    <li key={e.id} className="flex flex-wrap gap-x-2"><span className="w-20 shrink-0 text-ink-3">{ago(e.at, now)}</span><span>{e.action}</span>{e.objectId ? <span className="font-mono text-xs text-ink-3">{e.objectId}</span> : null}</li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        ) : (
          <>
            <Table>
              <THead><tr><TH>When</TH><TH>Who</TH><TH>Action</TH><TH>Record</TH><TH>Zone</TH><TH>Device</TH></tr></THead>
              <tbody>
                {rows.slice(0, limit).map((e) => (
                  <TR key={e.id} className={e.category === "blocked" ? "bg-crit-tint/40" : undefined}>
                    <TD className="whitespace-nowrap" title={fmtDateTime(e.at)}>{ago(e.at, now)}</TD>
                    <TD><span className="font-medium">{e.actorName}</span><span className="block text-xs text-ink-3">{roleLabel(e.role)}</span></TD>
                    <TD className="max-w-[28rem]">{e.action}</TD>
                    <TD className="font-mono text-xs">{e.objectId ?? "—"}</TD>
                    <TD><ZoneBadge zone={e.zone} compact /></TD>
                    <TD className="whitespace-nowrap text-xs text-ink-3">{e.device}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <div className="flex items-center justify-between border-t border-line-2 px-4 py-2.5 text-xs text-ink-3">
              <span>Showing {Math.min(limit, rows.length)} of {rows.length}. The prototype keeps the latest 500; production keeps six years.</span>
              {rows.length > limit ? <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>Show more</Button> : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
