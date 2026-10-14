"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CirclePause, List, Map as MapIcon, ArrowUpRight, Database, Expand } from "lucide-react";
import { OsmMap, type MapMarker } from "@/components/map/osm-map";
import { STAGE_PIN, TYPE_GLYPH } from "@/components/map/map-style";
import { OFFICES, driveMinutes, orgPoint } from "@/lib/geo";
import { Switch } from "@/components/ui/overlays";
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
  const [view, setView] = useState<"list" | "map">("map");
  const [hidePaused, setHidePaused] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [types, setTypes] = useState<OrgType[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [radius, setRadius] = useState<"5" | "10" | "25">("10");
  const paused = isPaused(program);

  const rows: Row[] = useMemo(() => {
    const family = program?.family === "adult" ? "adult" : "child";
    return db.orgs
      .filter((o) => o.state === office.state)
      .map((o) => ({ org: o, fit: fitScore(o, { family, program, weights: db.gatekeeperWeights, programs: db.programs, now }) }))
      .sort((a, b) => b.fit.score - a.fit.score);
  }, [db.orgs, db.gatekeeperWeights, db.programs, office.state, program, now]);

  // FT-051: organizations whose referrals go only to paused programs are hidden when "Hide paused programs" is on.
  const pausedOnly = (o: Organization) => {
    const tied = ORG_PROGRAMS[o.type]?.map((code) => db.programs.find((p) => p.state === o.state && p.name.startsWith(code))).filter(Boolean) ?? [];
    return tied.length > 0 && tied.every((p) => isPaused(p!));
  };
  const filtered = rows.filter(({ org }) =>
    (types.length === 0 || types.includes(org.type)) &&
    (stages.length === 0 || stages.includes(org.stage)) &&
    org.distanceMiles <= Number(radius) &&
    (!hidePaused || !pausedOnly(org)));
  const hiddenPaused = rows.filter(({ org }) => org.distanceMiles <= Number(radius) && pausedOnly(org)).length;
  const officePoint = OFFICES.find((o) => o.locationId === officeId) ?? OFFICES[0];
  const markers: MapMarker[] = [
    ...filtered.map(({ org, fit }) => ({ id: org.id, ...orgPoint(org), label: `${org.name} · fit ${fit.score}`, glyph: TYPE_GLYPH[org.type], color: STAGE_PIN[org.stage].fill, ring: STAGE_PIN[org.stage].ring, selected: org.id === selectedId })),
    { ...officePoint, id: "office", label: officePoint.name, shape: "office" as const, color: "#1d7fa3" },
  ];
  const allTypes = Array.from(new Set(rows.map((r) => r.org.type)));

  const viewBreakdown = (orgId: string) => mutate((d) => audit(d, { action: "Viewed score breakdown", objectId: orgId, zone: "Outreach" }));
  const addRoute = (orgId: string) => { mutate((d) => addVisitTask(d, orgId, me.id)); toast.success("Visit added to your week"); };

  return (
    <div>
      <PageHeader
        title="Gatekeeper Finder"
        description="The institutions that control referrals near your office, ranked by fit. Every score explains itself; no black box."
        actions={<Segmented label="View" value={view} onChange={setView} options={[{ value: "map", label: <span className="inline-flex items-center gap-1.5"><MapIcon size={14} /> Map and list</span> }, { value: "list", label: <span className="inline-flex items-center gap-1.5"><List size={14} /> List only</span> }]} />}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4">
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
          <Segmented label="Radius" className="mt-1" value={radius} onChange={setRadius} options={[{ value: "5", label: "5 mi" }, { value: "10", label: "10 mi" }, { value: "25", label: "25 mi" }]} />
        </div>
        <FilterMenu label="Organization type" all={allTypes} value={types} onChange={setTypes} />
        <FilterMenu label="Relationship stage" all={STAGES} value={stages} onChange={setStages} />
        <div className="pb-2"><Switch checked={hidePaused} onCheckedChange={setHidePaused} label={`Hide paused programs${hiddenPaused ? ` (${hiddenPaused} hidden)` : ""}`} /></div>
        {(types.length || stages.length) ? <Button variant="link" size="sm" onClick={() => { setTypes([]); setStages([]); }}>Clear filters</Button> : null}
        <p className="ml-auto flex items-center gap-1.5 text-xs text-ink-3"><Database size={13} /> Public data: NPPES, NCES, IRS nonprofit file, state lists</p>
        <Link href={`/app/map/`} className="link inline-flex items-center gap-1 text-sm font-medium"><Expand size={14} /> Open in Map Explorer</Link>
      </div>

      {paused && program ? (
        <Callout tone="neutral" className="mb-4 border-cv-amber bg-hl-tint" icon={<CirclePause size={18} className="text-warn" />} title={`${program.name} is on ${program.capacity}: outreach paused`}
          action={<Link href={href("/app/capacity")} className="link text-sm font-medium">Capacity Board</Link>}>
          Updated {Math.round((now - program.capacityUpdatedAt) / 86_400_000)} days ago by {db.users.find((u) => u.id === program.capacityUpdatedBy)?.name}. You can still view the list; drafts are turned off until it reopens.
        </Callout>
      ) : null}

      <div data-guide="finder">
        {filtered.length === 0 ? (
          <Empty title="No organizations match these filters">Widen the radius or clear the filters.</Empty>
        ) : (
          <div className={cn(view === "map" && "grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]")}>
          {view === "map" ? (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface xl:sticky xl:top-[120px] xl:self-start">
              <OsmMap center={officePoint} zoom={radius === "25" ? 10 : radius === "10" ? 11 : 12} markers={markers}
                circles={[{ id: "ring", lat: officePoint.lat, lng: officePoint.lng, radiusMi: Number(radius), color: "#1d7fa3", fill: 0.05, label: `${radius} mi` }]}
                onMarkerClick={(id) => { if (id !== "office") { setSelectedId(id); document.getElementById(`row-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }); } }}
                focus={selectedId ? orgPoint(db.orgs.find((o) => o.id === selectedId)!) : null}
                className="h-[420px] w-full xl:h-[560px]" ariaLabel={`Map of ranked organizations around ${office.name}`} />
              <p className="border-t border-line-2 px-3 py-2 text-[11px] text-ink-3">Pins coloured by relationship stage; amber is the selected organization. Locations illustrative. © OpenStreetMap contributors.</p>
            </div>
          ) : null}
          <div className="rounded-2xl border border-line bg-surface">
            <Table>
              <THead>
                <tr>
                  <TH className="w-10 text-right">#</TH>
                  <TH>Organization</TH>
                  <TH>Fit</TH>
                  <TH className="min-w-[18rem]">Why</TH>
                  <TH>Stage</TH>
                  <TH className="text-right">Drive</TH>
                  <TH className={cn(view === "map" && "hidden")}>Sources</TH>
                  <TH />
                </tr>
              </THead>
              <tbody>
                {filtered.map(({ org, fit }, i) => (
                  <TR key={org.id} id={`row-${org.id}`} onClick={() => setSelectedId(org.id)} className={cn("cursor-pointer", org.id === selectedId && "bg-hl-tint")}>
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
                    <TD className="text-right tabular whitespace-nowrap">{driveMinutes(org.distanceMiles)} min<span className="block text-xs text-ink-3">{org.distanceMiles} mi</span></TD>
                    <TD className={cn(view === "map" && "hidden")}><div className="flex max-w-[12rem] flex-wrap gap-1">{org.sources.map((s) => <Badge key={s} tone="outline" className="text-[0.7rem]">{s}</Badge>)}</div></TD>
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
          </div>
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

/** Program each organization type mostly refers to (used only for "Hide paused programs"). */
const ORG_PROGRAMS: Partial<Record<OrgType, string[]>> = {
  Pediatrics: ["ABA"],
};
