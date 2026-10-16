"use client";
import { useMemo, useState } from "react";
import { Calculator, Clock3, Info, RotateCcw } from "lucide-react";
import {
  CONSERVATIVE_FACTOR, ECON_ROLES, LOADED_MULTIPLIER, LOADED_SOURCE, MILEAGE_RATE, WEEKS_PER_YEAR,
  compact, defaultNational, defaultPerState, loadedRate, oldHours, savedHours, usd, valueForCompany, valuePerUser, type Headcount,
} from "@/lib/rules/economics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Segmented } from "@/components/ui/field";
import { Callout, PageHeader, Stat } from "@/components/ui/misc";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/overlays";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";

const staff = ECON_ROLES.filter((r) => r.level > 0);

export default function ValuePage() {
  const [tab, setTab] = useState("time");
  const [states, setStates] = useState(16);
  const [mode, setMode] = useState<"expected" | "conservative">("expected");
  const [perState, setPerState] = useState<Headcount>(defaultPerState);
  const [national, setNational] = useState<Headcount>(defaultNational);
  const [roleKey, setRoleKey] = useState("ambassador");
  const factor = mode === "conservative" ? CONSERVATIVE_FACTOR : 1;

  const company = useMemo(() => valueForCompany(states, perState, national, factor), [states, perState, national, factor]);
  const role = staff.find((r) => r.key === roleKey) ?? staff[0];
  const reset = () => { setStates(16); setPerState(defaultPerState()); setNational(defaultNational()); setMode("expected"); };
  const setHead = (which: "state" | "national", key: string, v: string) => {
    const n = Math.max(0, Math.min(99, Math.round(Number(v) || 0)));
    (which === "state" ? setPerState : setNational)((h) => ({ ...h, [key]: n }));
  };

  return (
    <div>
      <PageHeader
        title="Time and Value"
        description="Hours and dollars of staff time the Co-Pilot saves compared with the old way (Google searches, cold calls, drive-and-knock visits, spreadsheets, phone tag), per person, per state and company-wide."
        meta={<Badge tone="lightsky" icon={<Calculator size={12} />}>Live model</Badge>}
        actions={<Button variant="secondary" size="sm" onClick={reset}><RotateCcw size={14} /> Reset</Button>}
      />

      <div className="mb-5 flex flex-wrap items-end gap-5 rounded-lg border border-line bg-surface px-4 py-3">
        <div className="min-w-[220px] flex-1">
          <Label htmlFor="states">States live: <span className="tabular font-semibold text-ink">{states}</span></Label>
          <input id="states" type="range" min={1} max={18} step={1} value={states} onChange={(e) => setStates(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-teal)]" />
        </div>
        <Segmented label="Estimate" value={mode} onChange={setMode} options={[{ value: "expected", label: "Expected" }, { value: "conservative", label: "Conservative (50%)" }]} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Hours saved per year" value={Math.round(company.hours).toLocaleString("en-US")} sub={`${company.people} users in ${states} state${states > 1 ? "s" : ""}`} tone="teal" />
        <Stat label="Dollars saved per year" value={compact(company.dollars)} sub="Staff time at loaded cost, plus mileage" tone="ok" />
        <Stat label="Saved per state per year" value={compact(company.perState.dollars)} sub={`${company.perState.people} people per state`} />
        <Stat label="Full-time equivalents" value={Math.round(company.hours / (WEEKS_PER_YEAR * 40))} sub="Hours saved ÷ one person's working year" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabList className="mb-4">
          <Tab value="time">Time saved</Tab>
          <Tab value="team">Team sizes</Tab>
        </TabList>

        <TabPanel value="time">
          <div className="grid gap-5 xl:grid-cols-[1fr_1.15fr]">
            <Panel>
              <PanelHeader title="Saved per person, per year" description={`Hours saved x ${WEEKS_PER_YEAR} weeks x loaded hourly cost (median wage x ${LOADED_MULTIPLIER.toFixed(2)}).`} />
              <PanelBody className="px-0 py-0">
                <Table label="Value per user by role">
                  <THead><tr><TH>Role</TH><TH className="text-right">Hours / week</TH><TH className="text-right">Hours / year</TH><TH className="text-right">$ / year</TH></tr></THead>
                  <tbody>
                    {staff.map((r) => {
                      const v = valuePerUser(r, factor);
                      return (
                        <TR key={r.key} className={r.key === roleKey ? "bg-sunken" : undefined}>
                          <TD><button type="button" className="text-left font-medium text-teal-strong hover:underline" onClick={() => setRoleKey(r.key)}>{r.label.split(" (")[0]}</button></TD>
                          <TD className="text-right tabular">{(savedHours(r) * factor).toFixed(1)}</TD>
                          <TD className="text-right tabular">{Math.round(v.hours)}</TD>
                          <TD className="text-right tabular font-medium">{usd(v.dollars)}</TD>
                        </TR>
                      );
                    })}
                  </tbody>
                </Table>
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title={`${role.label.split(" (")[0]}: old way vs Co-Pilot`} description={`${role.wageSource}: ${usd(role.wage, 2)}/h, loaded ${usd(loadedRate(role), 2)}/h.`} />
              <PanelBody className="px-0 py-0">
                <Table label="Tasks, old way versus Co-Pilot">
                  <THead><tr><TH>Task</TH><TH className="text-right">Old h/wk</TH><TH className="text-right">With h/wk</TH><TH>What does the work</TH></tr></THead>
                  <tbody>
                    {role.tasks.map((t) => (
                      <TR key={t.label}>
                        <TD>{t.label}</TD>
                        <TD className="text-right tabular">{t.oldHrs}</TD>
                        <TD className="text-right tabular">{t.newHrs}</TD>
                        <TD className="text-ink-2">{t.how}</TD>
                      </TR>
                    ))}
                    <TR><TD className="font-semibold">Total</TD><TD className="text-right tabular font-semibold">{oldHours(role)}</TD><TD className="text-right tabular font-semibold">{oldHours(role) - savedHours(role)}</TD><TD className="text-ink-2">{role.milesSavedPerWeek ? `Also ${role.milesSavedPerWeek} fewer miles a week at ${MILEAGE_RATE * 100} cents (IRS 2026)` : ""}</TD></TR>
                  </tbody>
                </Table>
              </PanelBody>
            </Panel>
          </div>
          <Callout className="mt-5" icon={<Info size={18} className="text-ink-3" />} title="How to read these numbers">
            Wages are US medians (BLS OEWS, May 2025). Loaded cost uses {LOADED_SOURCE}. Weekly task hours are our estimates for the pilot to measure; replace them with Clarvida&apos;s time study. Not counted: extra families reached because referrals are answered faster (see Impact and Pilot), which is usually worth more than the time saved.
          </Callout>
        </TabPanel>

        <TabPanel value="team">
          <Panel>
            <PanelHeader title="People per state and company-wide" description="Change the team sizes; every number on this page updates." />
            <PanelBody className="px-0 py-0">
              <Table label="Team sizes">
                <THead><tr><TH>Role</TH><TH>Level</TH><TH>Seat</TH><TH className="text-right">Per state</TH><TH className="text-right">Company-wide</TH><TH className="text-right">Total in {states} states</TH></tr></THead>
                <tbody>
                  {staff.map((r) => (
                    <TR key={r.key}>
                      <TD className="font-medium">{r.label.split(" (")[0]}</TD>
                      <TD className="tabular">L{r.level} · {r.where}</TD>
                      <TD>{r.seat === "full" ? "Full" : "View"}</TD>
                      <TD className="text-right"><Input aria-label={`${r.label} per state`} type="number" min={0} max={99} value={perState[r.key] ?? 0} onChange={(e) => setHead("state", r.key, e.target.value)} className="ml-auto h-9 w-20 text-right" /></TD>
                      <TD className="text-right"><Input aria-label={`${r.label} company-wide`} type="number" min={0} max={99} value={national[r.key] ?? 0} onChange={(e) => setHead("national", r.key, e.target.value)} className="ml-auto h-9 w-20 text-right" /></TD>
                      <TD className="text-right tabular">{(perState[r.key] ?? 0) * states + (national[r.key] ?? 0)}</TD>
                    </TR>
                  ))}
                  <TR><TD className="font-semibold">Total users</TD><TD /><TD /><TD className="text-right tabular font-semibold">{company.perState.people}</TD><TD className="text-right tabular font-semibold">{company.national.people}</TD><TD className="text-right tabular font-semibold">{company.people}</TD></TR>
                </tbody>
              </Table>
            </PanelBody>
          </Panel>
        </TabPanel>

      </Tabs>
    </div>
  );
}

