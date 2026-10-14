"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CirclePause, List, Map as MapIcon, Route, ArrowUpRight, Database } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { href } from "@/lib/access";
import { fitScore, fitBand, type FitResult } from "@/lib/rules/fitScore";
import { isPaused } from "@/lib/rules/outreach";
import { audit } from "@/lib/services/core";
import { addVisitTask } from "@/lib/services/outreach";
import type { Organization, OrgType, Stage } from "@/lib/domain/types";
import { StageChip } from "@/components/domain/chips";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, PageHeader, Empty } from "@/components/ui/misc";
import { Label, Segmented, Select } from "@/components/ui/field";
import { Popover } from "@/components/ui/overlays";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";

type Row = { org: Organization; fit: FitResult };
const STAGES: Stage[] = ["At risk", "Quiet", "Dormant", "New", "Engaged", "Active"];
const STAGE_FILL: Record<Stage, string> = { "At risk": "var(--color-crit)", Quiet: "var(--color-warn)", Dormant: "#b45d4f", New: "var(--color-ink-3)", Engaged: "var(--color-teal)", Active: "var(--color-ok)" };

export default function Finder() {
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const now = useNow(60_000);
  const states = me.scope.includes("ALL") ? ["NC", "CO"] : me.scope;
  const offices = db.locations.filter((l) => states.includes(l.state) && l.id !== "loc-denver");
  const [officeId, setOfficeId] = useState(offices[0]?.id ?? "loc-gastonia");
  const office = db.locations.find((l) => l.id === officeId)!;
  const officePrograms = db.programs.filter((p) => p.state === office.state && p.office === office.name.split(",")[0]);
  const [programId, setProgramId] = useState(officePrograms.find((p) => p.name === "Foster Care")?.id ?? officePrograms[0]?.id ?? "");
  const program = db.programs.find((p) => p.id === programId);
  const [view, setView] = useState<"list" | "map">("list");
  const [types, setTypes] = useState<OrgType[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [radius, setRadius] = useState<"10" | "25" | "all">("25");
  const paused = isPaused(program);

  const rows: Row[] = useMemo(() => {
    const family = program?.family === "adult" ? "adult" : "child";
    return db.orgs
      .filter((o) => o.state === office.state)
      .map((o) => ({ org: o, fit: fitScore(o, { family, program, weights: db.gatekeeperWeights, programs: db.programs, now }) }))
      .sort((a, b) => b.fit.score - a.fit.score);
  }, [db.orgs, db.gatekeeperWeights, db.programs, office.state, program, now]);

  const filtered = rows.filter(({ org }) =>
    (types.length === 0 || types.includes(org.type)) &&
    (stages.length === 0 || stages.includes(org.stage)) &&
    (radius === "all" || org.distanceMiles <= Number(radius)));
  const allTypes = Array.from(new Set(rows.map((r) => r.org.type)));

  const viewBreakdown = (orgId: string) => mutate((d) => audit(d, { action: "Viewed score breakdown", objectId: orgId, zone: "Outreach" }));
  const addRoute = (orgId: string) => { mutate((d) => addVisitTask(d, orgId, me.id)); toast.success("Visit added to your week"); };

  return (
    <div>
      <PageHeader
        title="Gatekeeper Finder"
        description="The institutions that control referrals near your office, ranked by fit. Every score explains itself; no black box."
        actions={<Segmented label="View" value={view} onChange={setView} options={[{ value: "list", label: <span className="inline-flex items-center gap-1.5"><List size={14} /> List</span> }, { value: "map", label: <span className="inline-flex items-center gap-1.5"><MapIcon size={14} /> Map</span> }]} />}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4">
        <div>
          <Label htmlFor="office">Office</Label>
          <Select id="office" value={officeId} onChange={(e) => { setOfficeId(e.target.value); const loc = db.locations.find((l) => l.id === e.target.value)!; const first = db.programs.find((p) => p.state === loc.state && p.office === loc.name.split(",")[0]); setProgramId(first?.id ?? ""); }} className="mt-1 w-56">
            {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="program">Program</Label>
          <Select id="program" value={programId} onChange={(e) => setProgramId(e.target.value)} className="mt-1 w-72">
            {officePrograms.map((p) => <option key={p.id} value={p.id}>{p.name}{isPaused(p) ? ` (${p.capacity}: paused)` : ""}</option>)}
          </Select>
        </div>
        <div>
          <p className="text-sm font-medium">Radius</p>
          <Segmented label="Radius" className="mt-1" value={radius} onChange={setRadius} options={[{ value: "10", label: "10 mi" }, { value: "25", label: "25 mi" }, { value: "all", label: "All" }]} />
        </div>
        <FilterMenu label="Organization type" all={allTypes} value={types} onChange={setTypes} />
        <FilterMenu label="Relationship stage" all={STAGES} value={stages} onChange={setStages} />
        {(types.length || stages.length) ? <Button variant="link" size="sm" onClick={() => { setTypes([]); setStages([]); }}>Clear filters</Button> : null}
        <p className="ml-auto flex items-center gap-1.5 text-xs text-ink-3"><Database size={13} /> Public data: NPPES, NCES, IRS nonprofit file, state lists</p>
      </div>

      {paused && program ? (
        <Callout tone="crit" className="mb-4" icon={<CirclePause size={18} className="text-crit" />} title={`${program.name} is on ${program.capacity}: outreach paused`}
          action={<Link href={href("/app/capacity")} className="text-sm font-medium text-crit hover:underline">Capacity Board</Link>}>
          Updated {Math.round((now - program.capacityUpdatedAt) / 86_400_000)} days ago by {db.users.find((u) => u.id === program.capacityUpdatedBy)?.name}. You can still view the list; drafts are turned off until it reopens.
        </Callout>
      ) : null}

      <div data-guide="finder">
        {filtered.length === 0 ? (
          <Empty title="No organizations match these filters">Widen the radius or clear the filters.</Empty>
        ) : view === "list" ? (
          <div className="rounded-lg border border-line bg-surface">
            <Table>
              <THead>
                <tr>
                  <TH className="w-10 text-right">#</TH>
                  <TH>Organization</TH>
                  <TH>Fit</TH>
                  <TH className="min-w-[18rem]">Why</TH>
                  <TH>Stage</TH>
                  <TH className="text-right">Distance</TH>
                  <TH>Sources</TH>
                  <TH />
                </tr>
              </THead>
              <tbody>
                {filtered.map(({ org, fit }, i) => (
                  <TR key={org.id}>
                    <TD className="text-right text-ink-3 tabular">{i + 1}</TD>
                    <TD>
                      <Link href={href("/app/organization", { id: org.id })} className="font-medium hover:underline">{org.name}</Link>
                      <span className="block text-xs text-ink-3">{org.type}, {org.county} County</span>
                    </TD>
                    <TD><ScoreBadge fit={fit} onOpen={() => viewBreakdown(org.id)} /></TD>
                    <TD>
                      <p className="text-sm">{fit.reasons[0]}</p>
                      {fit.reasons.length > 1 ? (
                        <details className="mt-0.5 text-xs text-ink-2">
                          <summary className="cursor-pointer text-teal">Why ({fit.reasons.length - 1} more)</summary>
                          <ul className="mt-1 list-disc pl-4">{fit.reasons.slice(1).map((r) => <li key={r}>{r}</li>)}</ul>
                        </details>
                      ) : null}
                    </TD>
                    <TD><StageChip stage={org.stage} /></TD>
                    <TD className="text-right tabular whitespace-nowrap">{org.distanceMiles} mi</TD>
                    <TD><div className="flex max-w-[12rem] flex-wrap gap-1">{org.sources.map((s) => <Badge key={s} tone="outline" className="text-[0.7rem]">{s}</Badge>)}</div></TD>
                    <TD className="whitespace-nowrap">
                      {paused ? (
                        <span className="text-xs text-ink-3">Outreach paused</span>
                      ) : (
                        <Link href={href("/app/organization", { id: org.id, tab: "outreach", program: programId })} className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">Brief and draft <ArrowUpRight size={14} /></Link>
                      )}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        ) : (
          <TerritoryMap rows={filtered} officeName={office.name} paused={paused} programId={programId} onRoute={addRoute} onBreakdown={viewBreakdown} />
        )}
      </div>
    </div>
  );
}

function ScoreBadge({ fit, onOpen }: { fit: FitResult; onOpen: () => void }) {
  const band = fitBand(fit.score);
  return (
    <Popover
      align="start"
      trigger={
        <button onClick={onOpen} className={cn("inline-flex h-8 min-w-10 items-center justify-center rounded-md px-2 font-mono text-sm font-semibold tabular", band === "high" ? "bg-teal text-white" : band === "medium" ? "bg-teal-tint text-teal-strong" : "bg-sunken text-ink-2")} aria-label={`Fit score ${fit.score}. Show breakdown`}>
          {fit.score}
        </button>
      }
    >
      <p className="text-sm font-semibold">How this score is built</p>
      <dl className="mt-2 space-y-1 text-sm">
        {([["Organization type for this program", fit.parts.template], ["Distance from the office", fit.parts.distance], ["Referrals in the last 90 days", fit.parts.history], ["Relationship stage", fit.parts.stage], ["Program capacity", fit.parts.capacity]] as const).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4"><dt className="text-ink-2">{k}</dt><dd className="font-mono tabular">+{v}</dd></div>
        ))}
        <div className="flex justify-between gap-4 border-t border-line-2 pt-1 font-semibold"><dt>Fit score (max 99)</dt><dd className="font-mono tabular">{fit.score}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-ink-3">A transparent formula, not AI. Weights come from the state and program gatekeeper template.</p>
    </Popover>
  );
}

function FilterMenu<T extends string>({ label, all, value, onChange }: { label: string; all: T[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <Popover
        align="start"
        trigger={<Button variant="secondary" className="mt-1 h-10">{value.length ? `${value.length} selected` : "Any"}</Button>}
        className="w-72"
      >
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {all.map((t) => (
            <li key={t}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-canvas">
                <input type="checkbox" className="h-4 w-4 accent-teal" checked={value.includes(t)} onChange={(e) => onChange(e.target.checked ? [...value, t] : value.filter((x) => x !== t))} />
                {t}
              </label>
            </li>
          ))}
        </ul>
      </Popover>
    </div>
  );
}

/** Schematic territory map (E08): organizations by bearing and distance, no map tiles or network needed. */
function TerritoryMap({ rows, officeName, paused, programId, onRoute, onBreakdown }: { rows: Row[]; officeName: string; paused: boolean; programId: string; onRoute: (id: string) => void; onBreakdown: (id: string) => void }) {
  const W = 880, H = 600, cx = W / 2, cy = H / 2;
  const R = (miles: number) => 30 + 50 * Math.sqrt(miles); // compressed scale so nearby partners don't overlap
  const [sel, setSel] = useState<string | null>(null);
  const pos = (o: Organization) => {
    const r = R(o.distanceMiles);
    const a = ((o.bearing - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const selected = rows.find((r) => r.org.id === sel);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Territory map around ${officeName}`}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="var(--color-line-2)" strokeWidth="1" /></pattern>
          </defs>
          <rect width={W} height={H} fill="url(#grid)" />
          {/* schematic county boundary and highway, synthetic */}
          <path d={`M${cx - 300} ${cy - 210} L${cx + 260} ${cy - 240} L${cx + 330} ${cy + 180} L${cx - 220} ${cy + 250} Z`} fill="var(--color-teal-tint)" fillOpacity="0.35" stroke="var(--color-teal)" strokeOpacity="0.35" strokeDasharray="6 6" />
          <path d={`M0 ${cy + 40} C ${cx - 200} ${cy + 10}, ${cx + 120} ${cy - 60}, ${W} ${cy - 90}`} fill="none" stroke="var(--color-line)" strokeWidth="6" />
          <text x={W - 80} y={cy - 100} fontSize="12" fill="var(--color-ink-3)">I-85</text>
          {[10, 25].map((m) => (
            <g key={m}>
              <circle cx={cx} cy={cy} r={R(m)} fill="none" stroke="var(--color-ink-3)" strokeOpacity="0.5" strokeDasharray="4 6" />
              <text x={cx + 6} y={cy - R(m) - 6} fontSize="12" fill="var(--color-ink-3)">{m} miles</text>
            </g>
          ))}
          {rows.map(({ org, fit }) => {
            const p = pos(org);
            const r = 6 + (fit.score / 99) * 10;
            const on = sel === org.id;
            return (
              <g key={org.id} transform={`translate(${p.x} ${p.y})`} tabIndex={0} role="button" aria-label={`${org.name}, fit ${fit.score}, ${org.stage}`} className="cursor-pointer focus:outline-none"
                onClick={() => setSel(org.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSel(org.id); }}>
                <circle r={r + (on ? 6 : 0)} fill={STAGE_FILL[org.stage]} fillOpacity={on ? 0.25 : 0} />
                <circle r={r} fill={STAGE_FILL[org.stage]} fillOpacity="0.9" stroke="white" strokeWidth="2" />
                {on || fit.score >= 72 ? <text y={r + 13} textAnchor="middle" fontSize="11" fontWeight={on ? 600 : 400} fill="var(--color-ink)" stroke="white" strokeWidth="3" paintOrder="stroke" className="pointer-events-none">{org.name.split(",")[0].slice(0, 28)}</text> : null}
              </g>
            );
          })}
          <g transform={`translate(${cx} ${cy})`}>
            <rect x="-9" y="-9" width="18" height="18" rx="3" fill="var(--color-ink)" />
            <text y="26" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--color-ink)">Clarvida {officeName.split(",")[0]}</text>
          </g>
        </svg>
        <div className="flex flex-wrap items-center gap-3 border-t border-line-2 px-4 py-2.5 text-xs text-ink-2">
          {STAGES.map((s) => <span key={s} className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: STAGE_FILL[s] }} /> {s}</span>)}
          <span className="ml-auto">Larger pin = higher fit. Distance scale is compressed near the office. Organizations only; client addresses never appear on any map.</span>
        </div>
      </div>
      <aside className="rounded-lg border border-line bg-surface p-4">
        {selected ? (
          <div>
            <p className="font-medium">{selected.org.name}</p>
            <p className="text-xs text-ink-3">{selected.org.type}, {selected.org.distanceMiles} miles</p>
            <div className="mt-3 flex items-center gap-2"><ScoreBadge fit={selected.fit} onOpen={() => onBreakdown(selected.org.id)} /><StageChip stage={selected.org.stage} /></div>
            <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-ink-2">{selected.fit.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            <div className="mt-4 flex flex-col gap-2">
              {!paused ? <Link href={href("/app/organization", { id: selected.org.id, tab: "outreach", program: programId })} className="inline-flex h-9 items-center justify-center rounded-md bg-teal px-3 text-sm font-medium text-white hover:bg-teal-strong">Brief and draft</Link> : null}
              <Button variant="secondary" size="sm" onClick={() => onRoute(selected.org.id)}><Route size={14} /> Add to this week's route</Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-ink-2">
            <p className="font-medium text-ink">Select a pin</p>
            <p className="mt-1">Red and amber pins are relationships at risk or gone quiet. Start with the ones closest to the office.</p>
            <ul className="mt-3 space-y-1.5">
              {rows.filter((r) => r.org.stage === "At risk" || r.org.stage === "Quiet").slice(0, 4).map((r) => (
                <li key={r.org.id}><button onClick={() => setSel(r.org.id)} className="text-left text-teal hover:underline">{r.org.name}</button></li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
