"use client";
import { useMemo, useState } from "react";
import { ChevronRight, Eye, EyeOff, Lock, Network, ShieldCheck, Users } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { LEVEL_NAMES, POSITIONS, REGIONS, STATES, officeTeam, visibleTo, type Position } from "@/lib/data/org";
import { ECON_ROLES, defaultNational, defaultPerState, valueForCompany } from "@/lib/rules/economics";
import { Badge } from "@/components/ui/badge";
import { Label, Select } from "@/components/ui/field";
import { Callout, PageHeader, Stat } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";

const SEAT_LABEL = { full: "Full seat", view: "View seat", free: "Free" } as const;

export default function TeamsPage() {
  const db = useStore((s) => s.db);
  const [posId, setPosId] = useState("p-maria");
  const pos = POSITIONS.find((p) => p.id === posId) ?? POSITIONS[1];
  const vis = useMemo(() => visibleTo(db, pos), [db, pos]);
  const matrix = useMemo(() => POSITIONS.map((p) => ({ p, v: visibleTo(db, p) })), [db]);
  const offices = STATES.reduce((n, s) => n + s.offices.length, 0);
  const people = valueForCompany(STATES.length).people;
  const levels = [...new Set(ECON_ROLES.map((r) => r.level))].sort((a, b) => a - b);

  return (
    <div>
      <PageHeader
        title="Teams and Access"
        description="How Clarvida's people are organized from a city office up to national leadership, and exactly which data each level can see. The same scoping rules run behind every screen in this prototype."
        meta={<Badge tone="lightsky" icon={<Network size={12} />}>Backend view</Badge>}
      />
      <Callout tone="teal" className="mb-5" icon={<ShieldCheck size={18} className="text-teal" />} title="What is real here and what is illustrative">
        The 16 states are the ones Clarvida lists on clarvida.com (accessed Oct 16, 2026). Regions, office cities, team sizes and names outside the pilot are illustrative. The visibility results below are computed live from this prototype&apos;s data with the same filter the screens use; city-level narrowing is the production rule and is shown here before it is switched on for the demo accounts.
      </Callout>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="States" value={STATES.length} sub="2 in the pilot: NC and CO" tone="teal" />
        <Stat label="Regions" value={REGIONS.length} sub={REGIONS.map((r) => r.name).join(", ")} />
        <Stat label="City offices" value={offices} sub="Illustrative outside the pilot" />
        <Stat label="Co-Pilot users" value={people} sub="Default team sizes; partners free and unlimited" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Panel>
          <PanelHeader title="The hierarchy, bottom up" description="Who uses the Co-Pilot at each level, where they sit and what they can see." />
          <PanelBody className="space-y-3">
            {levels.map((lv) => (
              <div key={lv} className="rounded-lg border border-line px-4 py-3" data-level={lv}>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone={lv === 0 ? "outline" : lv >= 5 ? "charcoal" : "teal"}>Level {lv}</Badge>
                  <span className="text-sm font-semibold text-ink">{LEVEL_NAMES[lv]}</span>
                </div>
                {ECON_ROLES.filter((r) => r.level === lv).map((r) => (
                  <div key={r.key} className="mt-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{r.label}</span>
                      <span className="text-xs text-ink-3">{r.where}{r.perState ? ` · ${r.perState} per state` : r.national ? ` · ${r.national} company-wide` : ""}</span>
                      <Badge tone={r.seat === "full" ? "sky" : r.seat === "view" ? "neutral" : "outline"}>{SEAT_LABEL[r.seat]}</Badge>
                    </div>
                    <p className="mt-0.5 text-ink-2">{r.sees}</p>
                  </div>
                ))}
              </div>
            ))}
          </PanelBody>
        </Panel>

        <div className="space-y-5">
          <Panel data-guide="teams-preview">
            <PanelHeader title="See what someone sees" description="Pick a person. The prototype applies the real access rules and shows what reaches their screen." />
            <PanelBody>
              <Label htmlFor="who">Person</Label>
              <Select id="who" value={posId} onChange={(e) => setPosId(e.target.value)} className="mt-1 w-full">
                {POSITIONS.map((p) => (
                  <option key={p.id} value={p.id}>{`L${p.level} · ${p.title}: ${p.person} (${p.where})`}</option>
                ))}
              </Select>
              <p className="mt-2 text-sm text-ink-2">{pos.note}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="States" value={vis.states.length} />
                <Stat label="Offices" value={vis.offices.length} />
                <Stat label="Organizations" value={vis.orgs.length} sub={pos.role === "partner" ? "Their own only" : !vis.outreach ? "No Outreach pages" : vis.hiddenOrgs ? `${vis.hiddenOrgs} hidden` : "All"} />
                <Stat label="Client referrals" value={pos.role === "partner" ? vis.referrals.length : vis.clientRecords ? vis.referrals.length : 0} sub={pos.role === "partner" ? "Status words only" : vis.clientRecords ? "Care Zone" : "Outreach role: none"} tone={vis.clientRecords && pos.role !== "partner" ? "care" : undefined} />
                <Stat label="Open tasks" value={vis.tasks.length} />
                <Stat label="People below" value={vis.team.length} />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink"><Eye size={14} className="text-teal" /> Organizations they see</p>
                  {vis.orgs.length ? (
                    <ul className="space-y-1 text-sm text-ink-2">
                      {vis.orgs.slice(0, 6).map((o) => <li key={o.id} className="truncate">{o.name} <span className="text-ink-3">({o.county}, {o.state})</span></li>)}
                      {vis.orgs.length > 6 ? <li className="text-ink-3">and {vis.orgs.length - 6} more</li> : null}
                    </ul>
                  ) : <p className="text-sm text-ink-3">None in the pilot data.</p>}
                </div>
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink"><Users size={14} className="text-teal" /> People below them</p>
                  {vis.team.length ? (
                    <ul className="space-y-1 text-sm text-ink-2">
                      {vis.team.slice(0, 8).map((t) => <li key={t.id} className="truncate">{t.person} <span className="text-ink-3">· {t.title}, {t.where}</span></li>)}
                    </ul>
                  ) : <p className="text-sm text-ink-3">Nobody reports to this level.</p>}
                </div>
              </div>
              {vis.hiddenOrgs || vis.hiddenReferrals ? (
                <p className="mt-4 flex items-start gap-1.5 text-sm text-ink-2"><EyeOff size={14} className="mt-0.5 shrink-0 text-ink-3" />
                  Hidden from this person: {vis.hiddenOrgs} organizations and {vis.hiddenReferrals} referrals outside their territory{pos.role !== "partner" && !vis.clientRecords ? ", and every client record (Outreach roles never receive client data)" : ""}.
                </p>
              ) : null}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="How teams are kept apart" />
            <PanelBody>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
                <li><span className="font-medium text-ink">Territory.</span> Every record carries a state and county. The data layer drops anything outside a person&apos;s territory before a screen gets it, so a screen cannot leak it.</li>
                <li><span className="font-medium text-ink">Zone.</span> Client records (Care Zone) go only to intake, intake supervisors and compliance. Outreach roles, directors and executives get counts.</li>
                <li><span className="font-medium text-ink">Roll-up, not drill-down.</span> Directors, regional VPs and executives see all their offices side by side as aggregates; counts under 11 are hidden.</li>
                <li><span className="font-medium text-ink">Partners.</span> A referral partner only ever sees their own organization&apos;s referrals, as status words.</li>
                <li><span className="font-medium text-ink">Everyone&apos;s data.</span> Administrators manage every user and team; compliance can open any record for audit. Both actions are written to the audit log.</li>
              </ol>
            </PanelBody>
          </Panel>
        </div>
      </div>

      <Panel className="mt-5">
        <PanelHeader title="Visibility matrix" description="Every position in the pilot, computed from the same rules. Read across a row to see one person; read down a column to compare levels." />
        <PanelBody className="px-0 py-0">
          <Table label="Visibility by position">
            <THead><tr><TH>Level</TH><TH>Position</TH><TH>Where</TH><TH className="text-right">States</TH><TH className="text-right">Offices</TH><TH className="text-right">Organizations</TH><TH className="text-right">Client referrals</TH><TH className="text-right">People below</TH></tr></THead>
            <tbody>
              {matrix.map(({ p, v }) => (
                <TR key={p.id} className={cn(p.id === pos.id && "bg-sunken")}>
                  <TD className="tabular">L{p.level}</TD>
                  <TD><button type="button" className="text-left font-medium text-teal-strong hover:underline" onClick={() => setPosId(p.id)}>{p.title}</button><div className="text-xs text-ink-3">{p.person}</div></TD>
                  <TD className="text-ink-2">{p.where}</TD>
                  <TD className="text-right tabular">{v.states.length}</TD>
                  <TD className="text-right tabular">{v.offices.length}</TD>
                  <TD className="text-right tabular">{v.outreach || p.role === "partner" ? v.orgs.length : <span className="text-ink-3">n/a</span>}</TD>
                  <TD className="text-right tabular">{p.role === "partner" ? `${v.referrals.length} (status)` : v.clientRecords ? v.referrals.length : <span className="inline-flex items-center gap-1 text-ink-3"><Lock size={12} /> none</span>}</TD>
                  <TD className="text-right tabular">{v.team.length}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </PanelBody>
      </Panel>

      <Panel className="mt-5">
        <PanelHeader title="Company structure" description="National, then region, state and city office. Open a region to see its states and offices." />
        <PanelBody className="space-y-3">
          {REGIONS.map((r) => (
            <details key={r.id} className="rounded-lg border border-line" open={r.id === "east"}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <ChevronRight size={14} className="text-ink-3" />
                <span className="font-semibold text-ink">{r.name} region</span>
                <span className="text-ink-3">Regional VP: {r.vp} · {r.states.length} states</span>
              </summary>
              <div className="grid gap-3 border-t border-line-2 px-4 py-3 md:grid-cols-2 xl:grid-cols-3">
                {STATES.filter((s) => s.region === r.id).map((s) => (
                  <div key={s.code} className={cn("rounded-md border px-3 py-2.5", s.pilot ? "border-teal/40 bg-teal-tint" : "border-line")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink">{s.name}</span>
                      {s.pilot ? <Badge tone="teal">Pilot</Badge> : null}
                    </div>
                    {s.director ? <p className="text-xs text-ink-3">State Director: {s.director}</p> : null}
                    <ul className="mt-1.5 space-y-1 text-sm text-ink-2">
                      {s.offices.map((o) => {
                        const t = officeTeam(o);
                        return <li key={o.id}>{o.city} office <span className="text-ink-3">· {t.ambassadors} {t.ambassadors === 1 ? "ambassador" : "ambassadors"}, {t.intake} intake, {t.programs} {t.programs === 1 ? "program manager" : "program managers"}</span></li>;
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          ))}
          <p className="text-xs text-ink-3">Default team sizes: {Object.entries(defaultPerState()).filter(([, n]) => n).map(([k, n]) => `${ECON_ROLES.find((r) => r.key === k)!.label.split(" (")[0]} x ${n}`).join(", ")} per state; {Object.entries(defaultNational()).filter(([, n]) => n).map(([k, n]) => `${ECON_ROLES.find((r) => r.key === k)!.label.split(" (")[0]} x ${n}`).join(", ")} company-wide. Each state's team is split across its city offices.</p>
        </PanelBody>
      </Panel>
    </div>
  );
}
