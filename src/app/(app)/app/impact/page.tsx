"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, EyeOff, Info, Radio } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { funnel, speed, weekly } from "@/lib/services/analytics";
import { audit } from "@/lib/services/core";
import { suppress, isSuppressed } from "@/lib/rules/suppress";
import { sourceHealth } from "@/lib/rules/outreach";
import { href } from "@/lib/access";
import { pct, plural } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { FlowChart, GroupedBars, Histogram, Legend, SERIES, Sparkline, TrendLines, ViewToggle } from "@/components/charts/charts";
import { ScanEye } from "lucide-react";
import { Switch } from "@/components/ui/overlays";
import { AskPanel } from "@/components/insights/ask-panel";
import { StageChip } from "@/components/domain/chips";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/field";
import { Callout, PageHeader, Stat } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";

const D = 86_400_000;
type Mode = "today" | "with";
type StateFilter = "ALL" | "NC" | "CO";

export default function ImpactDashboard() {
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const now = useNow(30_000);
  const [mode, setMode] = useState<Mode>("with");
  const [st, setSt] = useState<StateFilter>(me.scope.includes("ALL") ? "ALL" : (me.scope[0] as StateFilter));
  const [barView, setBarView] = useState<"chart" | "table">("chart");
  const [trendView, setTrendView] = useState<"chart" | "table">("chart");
  const [flowView, setFlowView] = useState<"chart" | "table">("chart");
  const [xray, setXray] = useState(false);
  const state = st === "ALL" ? undefined : st;

  const f = useMemo(() => funnel(db, { state }), [db, state]);
  const sp = useMemo(() => speed(db, { state }), [db, state]);
  const wk = useMemo(() => weekly(db), [db]);
  const orgs = db.orgs.filter((o) => !state || o.state === state);
  const health = sourceHealth(orgs);
  const quietOrgs = orgs.filter((o) => ["Quiet", "At risk", "Dormant"].includes(o.stage)).sort((a, b) => (a.lastReferralAt ?? 0) - (b.lastReferralAt ?? 0));
  const today = mode === "today";

  const exportCsv = () => {
    const rows = f.rows.map((r) => [r.src, suppress(r.refs), suppress(r.contacted), suppress(r.scheduled), suppress(r.completed), r.refs >= 11 ? pct(r.completed / r.refs) : "—"]);
    downloadCsv(`impact-by-source-${st.toLowerCase()}-90d.csv`, ["Source type", "Referred", "First contact", "Intake scheduled", "Reached intake", "Connection rate"], rows);
    mutate((d) => audit(d, { action: `Exported impact summary (CSV, ${rows.length} rows, counts under 11 suppressed)`, zone: "Outreach", category: "export" }));
    toast.success("Exported. The export is in the audit log.");
  };

  return (
    <div>
      <PageHeader
        title="Impact Dashboard"
        description="Which relationships produce clients, how fast families are reached, and which partners went quiet. Totals only: no client is ever identifiable here."
        meta={<><Badge tone="outline">Last 90 days</Badge>{f.live ? <Badge tone="hl" icon={<Radio size={12} />}>Includes {plural(f.live, "referral")} made in this demo</Badge> : null}</>}
        actions={
          <>
            <Segmented label="State" size="sm" value={st} onChange={setSt} options={[{ value: "ALL", label: "NC + CO" }, { value: "NC", label: "NC" }, { value: "CO", label: "CO" }]} />
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={today}><Download size={14} /> Export CSV</Button>
          </>
        }
      />

      <div data-guide="impact" className="mb-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label="Compare" value={mode} onChange={setMode} options={[{ value: "today", label: "Today" }, { value: "with", label: "With the Co-Pilot" }]} />
          <div className="rounded-full border border-line bg-surface px-3 py-1" data-guide="impact-xray"><Switch checked={xray} onCheckedChange={(v) => { setXray(v); if (v) mutate((d) => audit(d, { action: "Privacy X-ray turned on (Impact Dashboard)", zone: "Outreach" }), undefined, { allowReadOnly: true }); }} label={<span className="inline-flex items-center gap-1.5 text-sm font-medium"><ScanEye size={15} /> Privacy X-ray</span>} /></div>
          <p className="text-sm text-ink-2">{today ? "What marketing can see today: referrals arrive as a name, an email and a message." : "Every referral carries its source, so outcomes trace back to the relationship that produced them."}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Referrals" value={f.totals.refs} sub="Last 90 days" />
          <Stat label="With a known source" value={today ? "0%" : "100%"} tone={today ? "warn" : "teal"} sub={today ? "Not captured" : "Captured on every form"} />
          <Stat label="Reached intake" value={today ? "?" : pct(f.connectionRate)} tone={today ? undefined : "teal"} sub={today ? "Can't be traced to a source" : `${f.totals.completed} of ${f.totals.refs} families`} />
          <Stat label="Median time to first contact" value={today ? "?" : `${sp.median.toFixed(1)} h`} sub={today ? "Not measured" : "Business hours. Target 8 h"} className={today ? undefined : "border-cv-amber bg-[#fffaf0] ring-1 ring-cv-amber/60"} />
          <Stat label="Partners gone quiet" value={today ? "?" : health.quiet + health.dormant} tone={today ? undefined : health.quiet + health.dormant ? "warn" : "teal"} sub={today ? "Noticed months later, if ever" : "On ambassador plans this week"} />
        </div>
      </div>

      {xray ? (
        <div className="mb-5 grid gap-4 rounded-2xl border-2 border-dashed border-teal bg-surface p-5 md:grid-cols-3">
          <div><p className="font-semibold">What this page is made of</p><p className="mt-1 text-sm text-ink-2">Counts and status codes only (data class C1, aggregate). Built from a de-identified attribution mart, refreshed nightly in production and instantly in this demo.</p></div>
          <div><p className="font-semibold">What never reaches it</p><p className="mt-1 text-sm text-ink-2">Names, phone numbers, ages, coverage, notes and referral records stay in the Care Zone. Marketing sees one referral as &ldquo;+1 from a school&rdquo;.</p></div>
          <div><p className="font-semibold">Small counts are hidden</p><p className="mt-1 text-sm text-ink-2">Any count from 1 to 10 shows as &ldquo;&lt;11&rdquo;, so no family can be identified. Exports follow the same rule and are logged.</p></div>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Panel>
            <PanelHeader
              title={today ? "Referrals by source" : "Referred vs reached intake, by source"}
              description={today ? "Without source capture, every referral looks the same." : "Hover a source for detail. Dashed bars are counts of 1–10, shown as <11 to protect privacy."}
              actions={today ? null : <ViewToggle value={barView} onChange={setBarView} />}
            />
            <PanelBody>
              {today ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-right text-sm">Source unknown</span>
                    <div className="h-3 flex-1 rounded-r bg-ink-3/50" />
                    <span className="text-sm tabular text-ink-2">{f.totals.refs}</span>
                  </div>
                  <Callout tone="warn" icon={<EyeOff size={16} className="text-warn" />} title="We can't tell which partners send families, or whether they were reached.">
                    So ambassadors visit by habit, quiet partners go unnoticed, and the budget can't follow results.
                  </Callout>
                </div>
              ) : barView === "chart" ? (
                <div className="space-y-3">
                  <Legend items={[{ label: "Referred", color: SERIES.a }, { label: "Reached intake", color: SERIES.b }]} />
                  <GroupedBars
                    aName="Referred"
                    bName="Reached intake"
                    rows={f.rows.map((r) => ({ label: r.src, a: r.refs, b: r.completed, aText: suppress(r.refs), bText: suppress(r.completed), aSuppressed: isSuppressed(r.refs), bSuppressed: isSuppressed(r.completed), note: r.refs >= 11 ? `Connection rate ${pct(r.completed / r.refs)}` : "Too few to show a rate" }))}
                  />
                </div>
              ) : (
                <Table>
                  <THead><tr><TH>Source type</TH><TH className="text-right">Referred</TH><TH className="text-right">First contact</TH><TH className="text-right">Intake scheduled</TH><TH className="text-right">Reached intake</TH><TH className="text-right">Rate</TH></tr></THead>
                  <tbody>
                    {f.rows.map((r) => (
                      <TR key={r.src}>
                        <TD>{r.src}</TD>
                        <TD className="text-right tabular">{suppress(r.refs)}</TD>
                        <TD className="text-right tabular">{suppress(r.contacted)}</TD>
                        <TD className="text-right tabular">{suppress(r.scheduled)}</TD>
                        <TD className="text-right tabular">{suppress(r.completed)}</TD>
                        <TD className="text-right tabular">{r.refs >= 11 ? pct(r.completed / r.refs) : "—"}</TD>
                      </TR>
                    ))}
                    <TR className="font-semibold">
                      <TD>All sources</TD>
                      <TD className="text-right tabular">{f.totals.refs}</TD>
                      <TD className="text-right tabular">{f.totals.contacted}</TD>
                      <TD className="text-right tabular">{f.totals.scheduled}</TD>
                      <TD className="text-right tabular">{f.totals.completed}</TD>
                      <TD className="text-right tabular">{pct(f.connectionRate)}</TD>
                    </TR>
                  </tbody>
                </Table>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Weekly referrals and families reaching intake" description={state ? "Weekly trend is shown for both states combined." : "Last 12 weeks, both states."} actions={today ? null : <ViewToggle value={trendView} onChange={setTrendView} />} />
            <PanelBody>
              {today ? (
                <p className="py-8 text-center text-sm text-ink-3">Not measured today. Intake outcomes aren't linked back to referrals.</p>
              ) : trendView === "chart" ? (
                <div className="space-y-2">
                  <Legend items={[{ label: "Referred", color: SERIES.a }, { label: "Reached intake", color: SERIES.b }]} />
                  <TrendLines labels={wk.map((w) => w.week)} a={wk.map((w) => w.referred)} b={wk.map((w) => w.connected)} aName="Referred" bName="Reached intake" />
                </div>
              ) : (
                <Table>
                  <THead><tr><TH>Week of</TH><TH className="text-right">Referred</TH><TH className="text-right">Reached intake</TH></tr></THead>
                  <tbody>{wk.map((w) => <TR key={w.week}><TD>{w.week}</TD><TD className="text-right tabular">{suppress(w.referred)}</TD><TD className="text-right tabular">{suppress(w.connected)}</TD></TR>)}</tbody>
                </Table>
              )}
            </PanelBody>
          </Panel>

          {!today ? (
            <Panel data-guide="flow">
              <PanelHeader title="From source to intake" description="Where families come from, how many we reached, and how many reached intake. Counts under 11 show as <11." actions={<ViewToggle value={flowView} onChange={setFlowView} />} />
              <PanelBody>
                {flowView === "chart" ? (
                  <FlowChart rows={f.rows.map((r) => ({ label: r.src, refs: r.refs, contacted: r.contacted, completed: r.completed }))} fmt={suppress} />
                ) : (
                  <Table>
                    <THead><tr><TH>Source type</TH><TH className="text-right">Referred</TH><TH className="text-right">First contact</TH><TH className="text-right">Reached intake</TH></tr></THead>
                    <tbody>{f.rows.map((r) => <TR key={r.src}><TD>{r.src}</TD><TD className="text-right tabular">{suppress(r.refs)}</TD><TD className="text-right tabular">{suppress(r.contacted)}</TD><TD className="text-right tabular">{suppress(r.completed)}</TD></TR>)}</tbody>
                  </Table>
                )}
              </PanelBody>
            </Panel>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            <Panel>
              <PanelHeader title="Time to first contact" description={today ? undefined : `Median ${sp.median.toFixed(1)} h, slowest tenth ${sp.p90.toFixed(1)} h. ${pct(sp.withinTarget)} inside target.`} />
              <PanelBody>
                {today ? (
                  <p className="py-8 text-center text-sm text-ink-3">Not measured today. Nobody knows how long a family waits.</p>
                ) : (
                  <>
                    <Histogram buckets={sp.buckets} markerAfter={2} markerLabel="Target: 1 business day" color="var(--color-cv-amber)" />
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3"><Info size={12} /> {sp.breaches} missed the target this week; each was escalated automatically.</p>
                  </>
                )}
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title="Source health" description="Partner organizations by relationship stage." />
              <PanelBody className="space-y-3">
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[["Active", health.active, "text-teal-strong"], ["Quiet", health.quiet, "text-warn"], ["Dormant", health.dormant, "text-ink-2"], ["New", health.fresh, "text-cv-teal"]].map(([l, n, c]) => (
                    <div key={l as string} className="rounded-md bg-canvas px-1 py-2">
                      <div className={`num text-xl ${c}`}>{today ? "?" : n}</div>
                      <div className="text-xs text-ink-2">{l}</div>
                    </div>
                  ))}
                </div>
                {!today ? (
                  <ul className="divide-y divide-line-2">
                    {quietOrgs.slice(0, 4).map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                        <span className="min-w-0">
                          <Link href={href("/app/organization", { id: o.id })} className="block truncate text-ink hover:text-teal-strong hover:underline">{o.name}</Link>
                          <span className="text-xs text-ink-3">{quietLine(o, now)}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Sparkline values={o.monthly} label={`${o.name}: referrals by month, last 6 months`} />
                          <StageChip stage={o.stage} />
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </PanelBody>
            </Panel>
          </div>
        </div>

        <div className="xl:sticky xl:top-20 xl:self-start">
          {today ? (
            <Panel><PanelHeader title="Ask the Co-Pilot" /><PanelBody><p className="text-sm text-ink-2">Not possible today: without source data there is nothing reliable to ask. Switch to With the Co-Pilot.</p></PanelBody></Panel>
          ) : (
            <AskPanel />
          )}
        </div>
      </div>
      <p className="mt-5 text-xs text-ink-3">The 90-day history is illustrative synthetic data; live referrals made during this demo are added on top. Production reads a de-identified attribution mart refreshed nightly from the Care Zone (counts and status codes only).</p>
    </div>
  );
}

/** FT-123: "used to send 4 a month; none since August". */
function quietLine(o: { monthly: number[]; lastReferralAt: number | null }, now: number): string {
  const avg = Math.round(o.monthly.slice(0, 4).reduce((a, b) => a + b, 0) / 4);
  if (!o.lastReferralAt) return "No referrals yet";
  const month = new Date(o.lastReferralAt).toLocaleDateString("en-US", { month: "long" });
  const days = Math.floor((now - o.lastReferralAt) / 86_400_000);
  return avg ? `Used to send about ${avg} a month; none since ${month} (${days} days)` : `Last referral ${days} days ago`;
}
