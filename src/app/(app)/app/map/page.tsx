"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpRight, CalendarPlus, Car, Layers, LocateFixed, MapPin, Route as RouteIcon, Trash2, X, Navigation } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { accessForUser, pageById } from "@/lib/access";
import { OFFICES, countyDemand, coverageGaps, driveMinutes, milesBetween, officeCapacity, orgPoint, orgPoints, planRoute, type LatLng } from "@/lib/geo";
import { fitScore } from "@/lib/rules/fitScore";
import { phiScan } from "@/lib/rules/phi";
import { suppress, isSuppressed } from "@/lib/rules/suppress";
import { addVisitTask, checkIn, CHECKIN_RADIUS_MI, recordBlocked, saveRoute } from "@/lib/services/outreach";
import type { Organization, OrgType, Stage } from "@/lib/domain/types";
import { CheckInDialog } from "@/components/map/check-in-dialog";
import { OsmMap, type MapBubble, type MapCircle, type MapLine, type MapMarker } from "@/components/map/osm-map";
import { CAPACITY_COLOR, Legend, STAGE_PIN, TYPE_GLYPH } from "@/components/map/map-style";
import { StageChip, CapacityChip } from "@/components/domain/chips";
import { PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Segmented, Select, Textarea, FieldError } from "@/components/ui/field";
import { Dialog, Switch, Tabs, TabList, Tab, TabPanel } from "@/components/ui/overlays";
import { ago } from "@/lib/format";
import { cn } from "@/components/ui/cn";

type LayerKey = "orgs" | "offices" | "visits" | "route" | "heat" | "gaps" | "capacity" | "drive";
const LAYER_LABEL: Record<LayerKey, string> = {
  orgs: "Organizations", offices: "Offices and programs", visits: "Visits this month", route: "Route", heat: "Referral heat by county", gaps: "Coverage gaps", capacity: "Need vs capacity", drive: "15 / 30-minute drive bands",
};
const D = 86_400_000;

/** PG-35 Map Explorer (FT-170..FT-180). OpenStreetMap streets with Clarvida's partner organizations, offices, rings, route, visits and aggregate demand. */
function MapExplorer() {
  const me = useCurrentUser()!;
  const params = useSearchParams();
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const now = useNow(60_000);
  const canAct = accessForUser(pageById("PG-35"), me) === "full" && (me.role === "ambassador" || me.role === "amb_lead");
  const offices = OFFICES.filter((o) => (me.scope.includes("ALL") || me.scope.includes(o.state)) && o.id !== "off-denver");
  const [officeId, setOfficeId] = useState(offices[0]?.id ?? "off-gastonia");
  const office = OFFICES.find((o) => o.id === officeId)!;
  const [radius, setRadius] = useState<"5" | "10" | "25">("10");
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ orgs: true, offices: true, visits: true, route: true, heat: false, gaps: false, capacity: false, drive: false });
  const [typeFilter, setTypeFilter] = useState<"" | OrgType>("");
  const [stageFilter, setStageFilter] = useState<"" | Stage>("");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("org"));
  const savedRoute = (db.accounts?.[me.id]?.filters.route as { orgIds: string[] } | undefined)?.orgIds ?? [];
  const [stops, setStops] = useState<string[]>(savedRoute);
  const [planned, setPlanned] = useState(savedRoute.length > 0);
  const [checkInOrg, setCheckInOrg] = useState<string | null>(null);
  const [tab, setTab] = useState(params.get("tab") ?? "explore");

  useEffect(() => {
    if (params.get("layer")) { const l = params.get("layer") as LayerKey; setLayers((x) => ({ ...x, [l]: true })); }
  }, [params]);

  const stateOrgs = useMemo(() => db.orgs.filter((o) => o.state === office.state), [db.orgs, office.state]);
  const fits = useMemo(() => new Map(stateOrgs.map((o) => [o.id, fitScore(o, { family: "child", weights: db.gatekeeperWeights, programs: db.programs, now })])), [stateOrgs, db.gatekeeperWeights, db.programs, now]);
  const visible = stateOrgs.filter((o) => o.distanceMiles <= Number(radius) && (!typeFilter || o.type === typeFilter) && (!stageFilter || o.stage === stageFilter));
  const selected = stateOrgs.find((o) => o.id === selectedId) ?? null;
  const route = useMemo(() => planRoute(office, stops.map((id) => ({ id, point: orgPoint(db.orgs.find((o) => o.id === id)!) })).filter((x) => x.point)), [stops, office, db.orgs]);
  const monthVisits = db.visits.filter((v) => now - v.at < 31 * D && stateOrgs.some((o) => o.id === v.orgId));
  const gaps = coverageGaps(db.orgs, office, 10);
  const demand = countyDemand(db).filter((c) => c.state === office.state && c.point);
  const cap = officeCapacity(db.programs, office);

  const markers: MapMarker[] = [];
  if (layers.orgs) {
    for (const o of visible) {
      const st = STAGE_PIN[o.stage];
      const routeIdx = planned && layers.route ? route.order.findIndex((x) => x.id === o.id) : -1;
      for (const p of orgPoints(o)) {
        markers.push({ id: o.id, lat: p.lat, lng: p.lng, label: `${p.label} · ${o.stage}`, glyph: TYPE_GLYPH[o.type], color: st.fill, ring: layers.gaps && gaps.some((g) => g.type === o.type) ? "#ffb81c" : st.ring, selected: o.id === selectedId, cluster: routeIdx < 0, order: routeIdx >= 0 && (p.key === o.id || p.key === `${o.id}-1`) ? routeIdx + 1 : undefined });
      }
    }
  }
  if (layers.offices || layers.capacity) {
    for (const of of offices) {
      const c = officeCapacity(db.programs, of);
      markers.push({ id: of.id, lat: of.lat, lng: of.lng, label: `${of.name}${layers.capacity ? ` · capacity: ${c.status}` : ""}`, shape: "office", color: layers.capacity ? CAPACITY_COLOR[c.status] : "#1d7fa3" });
    }
  }
  if (layers.visits) {
    for (const v of monthVisits) {
      const o = db.orgs.find((x) => x.id === v.orgId)!;
      const p = orgPoint(o);
      const u = db.users.find((x) => x.id === v.userId);
      markers.push({ id: `visit-${v.id}`, lat: p.lat + 0.0025, lng: p.lng + 0.003, label: `Visit: ${u?.firstName ?? ""} at ${o.name.split(",")[0]}, ${ago(v.at, now)}`, shape: "visit", color: "#03374a" });
    }
  }
  const circles: MapCircle[] = (["5", "10", "25"] as const).map((r) => ({ id: `ring-${r}`, lat: office.lat, lng: office.lng, radiusMi: Number(r), color: r === radius ? "#1d7fa3" : "#97d7f6", dashed: r !== radius, fill: r === radius ? 0.05 : 0, label: `${r} mi` }));
  if (layers.drive) {
    circles.push({ id: "drive15", lat: office.lat, lng: office.lng, radiusMi: 4.6, color: "#075e7e", dashed: true, label: "15 min" });
    circles.push({ id: "drive30", lat: office.lat, lng: office.lng, radiusMi: 10.4, color: "#075e7e", dashed: true, label: "30 min" });
  }
  if (layers.gaps) circles.push({ id: "gap-ring", lat: office.lat, lng: office.lng, radiusMi: 10, color: "#ffb81c", dashed: true, label: "Coverage check: 10 mi" });
  const lines: MapLine[] = planned && layers.route && route.order.length ? [{ id: "route", points: [office, ...route.order.map((x) => x.point), office], color: "#03374a", dashed: false }] : [];
  const maxN = Math.max(...demand.map((c) => c.n), 1);
  const bubbles: MapBubble[] = layers.heat || layers.capacity ? demand.map((c) => ({ id: c.key, lat: c.point.lat, lng: c.point.lng, radiusMi: 2 + 6 * (c.n / maxN), color: "#28a8e0", opacity: isSuppressed(c.n) ? 0.12 : 0.18 + 0.4 * (c.n / maxN), label: `${c.county} County: ${suppress(c.n)} referrals in 90 days` })) : [];

  const toggleStop = (id: string) => { setPlanned(false); setStops((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); };
  const onMarker = (id: string) => {
    if (id.startsWith("off-") || id.startsWith("visit-")) return;
    setSelectedId(id);
    setTab("explore");
  };

  return (
    <div>
      <PageHeader
        title="Map Explorer"
        description="Your territory on a real street map: the organizations that refer, how far they are, where you've been and where outreach should go next."
        meta={<Badge tone="outline">© OpenStreetMap contributors</Badge>}
        actions={
          offices.length > 1 ? (
            <Select aria-label="Office" value={officeId} onChange={(e) => { setOfficeId(e.target.value); setSelectedId(null); setStops([]); setPlanned(false); }} className="h-9 w-auto rounded-full">
              {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          ) : <Badge tone="teal">{office.name}</Badge>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface" data-guide="map">
          <div className="flex flex-wrap items-center gap-2 border-b border-line-2 px-3 py-2">
            <Segmented size="sm" label="Radius" value={radius} onChange={setRadius} options={[{ value: "5", label: "5 mi" }, { value: "10", label: "10 mi" }, { value: "25", label: "25 mi" }]} />
            <Select aria-label="Category" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as OrgType | "")} className="h-8 w-auto rounded-full text-xs">
              <option value="">All categories</option>
              {Array.from(new Set(stateOrgs.map((o) => o.type))).map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select aria-label="Stage" value={stageFilter} onChange={(e) => setStageFilter(e.target.value as Stage | "")} className="h-8 w-auto rounded-full text-xs">
              <option value="">All stages</option>
              {(Object.keys(STAGE_PIN) as Stage[]).map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <span className="ml-auto text-xs text-ink-3">{visible.length} organizations within {radius} miles</span>
          </div>
          <OsmMap
            center={office}
            zoom={radius === "25" ? 10 : radius === "10" ? 11 : 12}
            markers={markers}
            circles={circles}
            lines={lines}
            bubbles={bubbles}
            onMarkerClick={onMarker}
            focus={selected ? orgPoint(selected) : null}
            className="h-[62vh] min-h-[420px] w-full"
            ariaLabel={`Map of organizations around the ${office.name}`}
          />
          <div className="border-t border-line-2 px-4 py-3"><Legend layers={{ orgs: layers.orgs, offices: layers.offices, visits: layers.visits, heat: layers.heat, capacity: layers.capacity }} /></div>
        </div>

        <aside className="space-y-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabList>
              <Tab value="explore">Explore</Tab>
              <Tab value="route">Route{stops.length ? ` (${stops.length})` : ""}</Tab>
              <Tab value="layers">Layers</Tab>
            </TabList>
            <TabPanel value="explore" className="pt-4">
              {selected ? (
                <PoiCard org={selected} fit={fits.get(selected.id)?.score ?? 0} reasons={fits.get(selected.id)?.reasons ?? []} owner={db.users.find((u) => u.id === selected.ownerId)?.name} now={now} inRoute={stops.includes(selected.id)} canAct={canAct}
                  onClose={() => setSelectedId(null)} onRoute={() => toggleStop(selected.id)} onPlan={() => { mutate((d) => addVisitTask(d, selected.id, me.id)); toast.success("Added to your plan", { description: "A visit task is on your dashboard." }); }} onCheckIn={() => setCheckInOrg(selected.id)} />
              ) : (
                <div className="rounded-2xl border border-line bg-surface">
                  <p className="border-b border-line-2 px-4 py-3 text-sm font-semibold">Nearest organizations</p>
                  <ul className="max-h-[52vh] divide-y divide-line-2 overflow-y-auto">
                    {[...visible].sort((a, b) => (fits.get(b.id)?.score ?? 0) - (fits.get(a.id)?.score ?? 0)).map((o) => (
                      <li key={o.id}>
                        <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-canvas" onClick={() => setSelectedId(o.id)}>
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: STAGE_PIN[o.stage].fill }}>{TYPE_GLYPH[o.type]}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{o.name}</span>
                            <span className="block text-xs text-ink-3">Fit {fits.get(o.id)?.score} · {driveMinutes(o.distanceMiles)} min drive · {o.stage}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </TabPanel>
            <TabPanel value="route" className="pt-4">
              <RoutePanel
                stops={stops.map((id) => db.orgs.find((o) => o.id === id)!).filter(Boolean)}
                planned={planned}
                route={route}
                officeName={office.short}
                canAct={canAct}
                onRemove={(id) => toggleStop(id)}
                onPlan={() => { setPlanned(true); setLayers((l) => ({ ...l, route: true })); }}
                onSave={() => { mutate((d) => saveRoute(d, route.order.map((x) => x.id), route.minutes)); toast.success("Field day saved", { description: `A ${route.order.length}-stop task is on your dashboard.` }); }}
                onCheckIn={(id) => setCheckInOrg(id)}
                orderIds={route.order.map((x) => x.id)}
              />
            </TabPanel>
            <TabPanel value="layers" className="pt-4">
              <div className="space-y-3 rounded-2xl border border-line bg-surface p-4" data-guide="layers">
                <p className="flex items-center gap-2 text-sm font-semibold"><Layers size={16} className="text-teal" /> Map layers</p>
                {(Object.keys(LAYER_LABEL) as LayerKey[]).map((k) => (
                  <Switch key={k} checked={layers[k]} onCheckedChange={(v) => setLayers((l) => ({ ...l, [k]: v }))} label={LAYER_LABEL[k]} />
                ))}
              </div>
              {layers.gaps ? (
                <div className="mt-4 rounded-2xl border border-cv-amber bg-hl-tint p-4" data-guide="gaps">
                  <p className="text-sm font-semibold">Coverage gaps near {office.short}</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
                    {gaps.length === 0 ? <li>Every category has an engaged partner within 10 miles.</li> : gaps.map((g) => (
                      <li key={g.type}>No {g.type.toLowerCase()} engaged within 10 miles of {office.short}{g.nearest ? <>: start with <button className="link font-medium" onClick={() => { setSelectedId(g.nearest!.id); setTab("explore"); }}>{g.nearest.name}</button></> : "."}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {layers.capacity || layers.heat ? (
                <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
                  <p className="text-sm font-semibold">Need vs capacity</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {demand.map((c) => <li key={c.key} className="flex justify-between gap-3"><span>{c.county} County</span><span className="num">{suppress(c.n)} <span className="font-normal text-ink-3">referrals, 90 days</span></span></li>)}
                  </ul>
                  <p className="mt-3 text-xs font-semibold text-ink-2">{office.short} programs</p>
                  <ul className="mt-1 space-y-1">
                    {cap.programs.map((p) => <li key={p.id} className="flex items-center justify-between gap-2 text-sm"><span>{p.name}</span><CapacityChip capacity={p.capacity} /></li>)}
                  </ul>
                  <p className="mt-3 text-xs text-ink-3">Push outreach where demand is high and programs are open. Waitlisted programs pause outreach automatically.</p>
                </div>
              ) : null}
            </TabPanel>
          </Tabs>
        </aside>
      </div>
      <CheckInDialog orgId={checkInOrg} onClose={() => setCheckInOrg(null)} />
    </div>
  );
}

function PoiCard({ org, fit, reasons, owner, now, inRoute, canAct, onClose, onRoute, onPlan, onCheckIn }: { org: Organization; fit: number; reasons: string[]; owner?: string; now: number; inRoute: boolean; canAct: boolean; onClose: () => void; onRoute: () => void; onPlan: () => void; onCheckIn: () => void }) {
  const mins = driveMinutes(org.distanceMiles);
  return (
    <div className="rounded-2xl border border-line bg-surface" data-guide="poi-card">
      <div className="flex items-start justify-between gap-3 border-b border-line-2 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-3">{org.type} · {org.county} County</p>
          <p className="font-semibold leading-snug">{org.name}</p>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-ink-3 hover:bg-sunken" aria-label="Close"><X size={16} /></button>
      </div>
      <dl className="grid grid-cols-2 gap-3 px-4 py-3 text-sm">
        <div><dt className="text-xs text-ink-3">Fit score</dt><dd className="num text-2xl text-cv-teal">{fit}</dd></div>
        <div><dt className="text-xs text-ink-3">Drive from office</dt><dd className="num text-2xl text-cv-teal">{mins} <span className="text-sm font-medium">min</span></dd><dd className="text-xs text-ink-3">{org.distanceMiles} miles</dd></div>
        <div><dt className="text-xs text-ink-3">Stage</dt><dd><StageChip stage={org.stage} /></dd></div>
        <div><dt className="text-xs text-ink-3">Last touch</dt><dd className="font-medium">{org.lastTouchAt ? ago(org.lastTouchAt, now) : "Never"}</dd></div>
        <div className="col-span-2"><dt className="text-xs text-ink-3">Owner</dt><dd className="font-medium">{owner ?? "Unassigned"}</dd></div>
      </dl>
      {reasons.length ? <ul className="mx-4 mb-3 list-disc space-y-0.5 rounded-xl bg-cv-ice py-2 pl-7 pr-3 text-xs text-ink-2">{reasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}</ul> : null}
      <div className="flex flex-wrap gap-2 border-t border-line-2 px-4 py-3">
        <Link href={`/app/organization/?id=${org.id}`} className="inline-flex"><Button size="sm" variant="primary">Open profile <ArrowUpRight size={14} /></Button></Link>
        {canAct ? (
          <>
            <Button size="sm" variant="secondary" onClick={onPlan}><CalendarPlus size={14} /> Add to plan</Button>
            <Button size="sm" variant="secondary" onClick={onRoute}><RouteIcon size={14} /> {inRoute ? "Remove from route" : "Add to route"}</Button>
            <Button size="sm" variant="cta" chevron={false} onClick={onCheckIn} data-guide="check-in"><MapPin size={14} /> Check in here</Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function RoutePanel({ stops, planned, route, officeName, canAct, onRemove, onPlan, onSave, onCheckIn, orderIds }: { stops: Organization[]; planned: boolean; route: ReturnType<typeof planRoute>; officeName: string; canAct: boolean; onRemove: (id: string) => void; onPlan: () => void; onSave: () => void; onCheckIn: (id: string) => void; orderIds: string[] }) {
  const ordered = planned ? orderIds.map((id) => stops.find((s) => s.id === id)!).filter(Boolean) : stops;
  return (
    <div className="rounded-2xl border border-line bg-surface" data-guide="route">
      <div className="border-b border-line-2 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><Car size={16} className="text-teal" /> Field-day route</p>
        <p className="text-xs text-ink-3">Add organizations from the map, then order them into the shortest loop from the {officeName} office.</p>
      </div>
      {stops.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-2">No stops yet. Open an organization on the map and choose &quot;Add to route&quot;.</p>
      ) : (
        <ol className="divide-y divide-line-2">
          {ordered.map((o, i) => (
            <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cv-navy text-xs font-bold text-white">{planned ? i + 1 : "·"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{o.name}</span>
                <span className="text-xs text-ink-3">{o.distanceMiles} mi from office</span>
              </span>
              {canAct && planned ? <button className="rounded-full p-1.5 text-teal hover:bg-teal-tint" aria-label={`Check in at ${o.name}`} onClick={() => onCheckIn(o.id)}><MapPin size={15} /></button> : null}
              {canAct ? <button className="rounded-full p-1.5 text-ink-3 hover:bg-sunken" aria-label={`Remove ${o.name}`} onClick={() => onRemove(o.id)}><Trash2 size={15} /></button> : null}
            </li>
          ))}
        </ol>
      )}
      {stops.length ? (
        <div className="space-y-3 border-t border-line-2 px-4 py-3">
          {planned ? (
            <div className="flex items-center justify-between rounded-xl bg-cv-ice px-3 py-2">
              <span className="text-sm">Total drive time</span>
              <span className="num text-xl text-cv-teal" data-testid="route-minutes">{route.minutes} min</span>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={planned ? "secondary" : "primary"} onClick={onPlan} disabled={stops.length < 2}><Navigation size={14} /> Plan route</Button>
            {canAct && planned ? <Button size="sm" variant="cta" onClick={onSave}>Save as field day</Button> : null}
          </div>
          <p className="text-[11px] text-ink-3">Straight-line legs with an estimated in-town driving speed. Production uses a routing service on Clarvida&apos;s approved stack.</p>
        </div>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <MapExplorer />
    </Suspense>
  );
}
