"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Flag, Pencil, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser } from "@/lib/store/hooks";
import { roi } from "@/lib/rules/roi";
import { funnel, speed } from "@/lib/services/analytics";
import { audit } from "@/lib/services/core";
import { makeSeed } from "@/lib/data/seed";
import { isPaused } from "@/lib/rules/outreach";
import { pct } from "@/lib/format";
import type { RoiAssumptions } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/field";
import { Dialog } from "@/components/ui/overlays";
import { PageHeader } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";

const H = 3_600_000;

interface SliderDef {
  key: keyof RoiAssumptions;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  hint: string;
  source: string; // where the default comes from (FT-126)
  oq?: string; // open question ID, shown only in Explain mode
}
const pctFmt = (v: number) => `${Math.round(v * 100)}%`;
const SLIDERS: { group: string; items: SliderDef[] }[] = [
  {
    group: "Families reaching intake",
    items: [
      { key: "referralsPerMonth", label: "Referrals per month", min: 20, max: 1000, step: 10, fmt: (v) => String(v), hint: "Across the pilot offices", source: "Placeholder until Clarvida baseline", oq: "OQ-03" },
      { key: "lostShare", label: "Share lost before first contact", min: 0, max: 0.8, step: 0.01, fmt: pctFmt, hint: "Families never reached today", source: "Placeholder until Clarvida baseline", oq: "OQ-03" },
      { key: "reduction", label: "Expected reduction in that loss", min: 0, max: 0.8, step: 0.01, fmt: pctFmt, hint: "From the clock, escalation and routing", source: "Assumption. Evidence on speed: 82% attend when booked same day vs 29% after 30 days (Pace et al., Ann Fam Med 2018)" },
      { key: "conversion", label: "Intake conversion of recovered referrals", min: 0, max: 1, step: 0.01, fmt: pctFmt, hint: "Of families reached, share who start", source: "Placeholder until Clarvida baseline" },
    ],
  },
  {
    group: "Ambassador time",
    items: [
      { key: "ambassadors", label: "Ambassadors in pilot", min: 1, max: 30, step: 1, fmt: (v) => String(v), hint: "NC and CO combined", source: "Placeholder until Clarvida confirms pilot staffing" },
      { key: "researchHours", label: "Research hours per ambassador per week", min: 0, max: 15, step: 0.5, fmt: (v) => `${v} h`, hint: "Finding who to visit and what to say", source: "Placeholder: ambassadors research referral sources by hand today (Referral & AI Problem Map, Oct 8 2026)" },
      { key: "researchReduction", label: "Research time reduction", min: 0, max: 0.8, step: 0.01, fmt: pctFmt, hint: "Measured in pilot interviews", source: "Assumption, measured in the pilot" },
    ],
  },
];

const PHASES = [
  { name: "R0: approvals start in week 0", detail: "BAA and vendor review, risk analysis, SSO, Legal sign-off on partner wording, baselines collected", from: 0, to: 8, tone: "bg-cv-navy" },
  { name: "R1: pilot MVP build", detail: "Referral loop, outreach tools, dashboards, link to the approved CRM", from: 6, to: 16, tone: "bg-teal" },
  { name: "90-day pilot", detail: "Gastonia NC and Colorado Springs CO, weekly KPI review; go/no-go at pilot week 13", from: 16, to: 29, tone: "bg-cv-logo" },
];
const WEEKS = 30;

export default function ImpactPilot() {
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const explain = db.demo.showBrdTags;
  const mutate = useStore((s) => s.mutate);
  const a = db.roi;
  const out = roi(a);
  const canEditAsk = me.role === "marketing" || me.role === "admin";
  const [askOpen, setAskOpen] = useState(false);

  // Judges may move the sliders (FT-165): their changes stay on their own device.
  const set = (key: keyof RoiAssumptions, v: number) => mutate((d) => { d.roi[key] = v; }, undefined, { allowReadOnly: true });
  const resetRoi = () => {
    const def = makeSeed(Date.now()).roi;
    mutate((d) => { d.roi = def; audit(d, { action: "Reset ROI assumptions to defaults", zone: "Outreach", category: "config" }); }, undefined, { allowReadOnly: true });
    toast.success("Assumptions reset to the illustrative defaults");
  };

  // Live scorecard values from the prototype's own data.
  const f = funnel(db);
  const sp = speed(db);
  const withNotice = db.referrals.filter((r) => r.notices.length);
  const tier1Fast = withNotice.filter((r) => r.notices[0].at - r.receivedAt <= H).length;
  // A send counts only if the program was already paused when it was approved (approval is blocked then, so this stays 0).
  const pausedSends = db.drafts.filter((d) => { const p = db.programs.find((x) => x.id === d.programId); return isPaused(p) && p!.capacityUpdatedAt < d.approvedAt; }).length;
  const aiApproved = db.ailog.filter((l) => l.feature === "AI02" && (l.result === "Approved and queued" || l.result === "Edited and approved")).length;

  const scorecard: [string, string, string, string, string][] = [
    ["Referrals with a known source", "Not captured (to confirm)", "100%", "Source fields on every form, kit and manual entry", "100%"],
    ["Median time to first contact", "To confirm in approvals phase", "1 business day or less (stretch: same day)", "Response clock in business hours", `${sp.median.toFixed(1)} h`],
    ["Referrer told within 1 hour", "None sent today", "90% or more", "Tier 1 notice time minus received time", withNotice.length ? pct(tier1Fast / withNotice.length) : "—"],
    ["Families reaching intake, by source", "To confirm in approvals phase", "Measured against baseline; no % promised", "Attribution mart, per source", pct(f.connectionRate)],
    ["Outreach sent to full programs", "Not tracked", "0", "Sends to programs on Waitlist or Closed", String(pausedSends)],
  ];

  return (
    <div>
      <PageHeader
        title="Impact and Pilot"
        description="What the pilot is worth at your assumptions, exactly what we will prove in 90 days, and what we are asking for."
        meta={<Badge tone="hl">Illustrative until Clarvida confirms its baselines</Badge>}
      />

      <Panel className="mb-5" data-guide="pilot">
        <PanelHeader
          title="What it could be worth"
          description="Move the sliders. Every default is an assumption to replace with Clarvida's own numbers."
          actions={<Button size="sm" variant="ghost" onClick={resetRoi}><RotateCcw size={14} /> Reset assumptions</Button>}
        />
        <PanelBody className="grid gap-8 lg:grid-cols-[1fr_minmax(280px,360px)]">
          <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
            {SLIDERS.map((g) => (
              <fieldset key={g.group} className="space-y-4">
                <legend className="mb-3 text-sm font-semibold text-ink">{g.group}</legend>
                {g.items.map((s) => (
                  <div key={s.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <label htmlFor={`roi-${s.key}`} className="text-sm text-ink">{s.label}</label>
                      <output htmlFor={`roi-${s.key}`} className="font-mono text-sm font-medium tabular text-ink">{s.fmt(a[s.key])}</output>
                    </div>
                    <input data-guide={s.key === "referralsPerMonth" ? "roi-slider" : undefined} id={`roi-${s.key}`} type="range" min={s.min} max={s.max} step={s.step} value={a[s.key]} onChange={(e) => set(s.key, Number(e.target.value))} className="mt-1.5 w-full accent-teal" aria-describedby={`roi-${s.key}-hint`} />
                    <p id={`roi-${s.key}-hint`} className="text-xs text-ink-3">{s.hint}</p>
                    <p className={`mt-0.5 text-[11px] ${s.source.startsWith("Placeholder") ? "font-semibold text-warn" : "text-teal-strong"}`}>{s.source}{explain && s.oq ? ` (${s.oq})` : ""}</p>
                  </div>
                ))}
              </fieldset>
            ))}
          </div>
          <div className="space-y-4 rounded-[28px] bg-cv-ice p-6">
            <div>
              <p className="num text-[3.25rem] leading-none text-cv-teal">+{Math.round(out.extraFamilies)}</p>
              <p className="mt-1.5 font-medium text-ink">more families reach intake each year</p>
              <p className="text-sm text-ink-2">Range {Math.round(out.extraFamiliesLow)} to {Math.round(out.extraFamiliesHigh)} if the assumptions are 40% off either way.</p>
            </div>
            <div className="border-t border-teal/20 pt-4">
              <p className="num text-[2rem] leading-none text-ink">~{Math.round(out.hoursSaved).toLocaleString("en-US")} h</p>
              <p className="mt-1.5 font-medium text-ink">ambassador research time saved per year</p>
              <p className="text-sm text-ink-2">Time moved from desk research to visits. Value is measured in the pilot, not assumed.</p>
            </div>
            <div className="space-y-1.5 rounded-md bg-surface p-3 font-mono text-[0.72rem] leading-relaxed text-ink-2">
              <p><span className="text-ink">Extra families</span> = {a.referralsPerMonth} × 12 × {pctFmt(a.lostShare)} × {pctFmt(a.reduction)} × {pctFmt(a.conversion)}</p>
              <p><span className="text-ink">Hours saved</span> = {a.ambassadors} × {a.researchHours} h × 52 × {pctFmt(a.researchReduction)}</p>
            </div>
          </div>
        </PanelBody>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <PanelHeader title="The 90-day pilot scorecard" description="Gastonia, NC and Colorado Springs, CO. Targets are goals, not guarantees; baselines are collected before go-live." />
          <PanelBody className="p-0">
            <Table>
              <THead><tr><TH>Measure</TH><TH>Baseline today</TH><TH>Pilot target</TH><TH>How it&apos;s measured</TH><TH className="text-right">In this demo</TH></tr></THead>
              <tbody>
                {scorecard.map(([m, base, target, how, live]) => (
                  <TR key={m}>
                    <TD className="font-medium">{m}</TD>
                    <TD className="text-ink-2">{base}</TD>
                    <TD>{target}</TD>
                    <TD className="text-ink-2">{how}</TD>
                    <TD className="text-right font-mono tabular">{live}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <p className="px-5 py-3 text-xs text-ink-3">Also tracked: zero improper disclosures, 100% human approval of AI drafts ({aiApproved} approved in this demo, none sent unreviewed), and 80% weekly use by pilot ambassadors.</p>
          </PanelBody>
        </Panel>

        <Panel className="overflow-hidden border-cv-amber ring-2 ring-cv-amber/40" data-guide="the-ask">
          <div className="bg-cv-navy px-5 py-5 text-white">
            <p className="text-sm text-white/80">We are asking for</p>
            <p className="mt-1 text-lg font-medium leading-snug">Funding for a 90-day pilot in North Carolina and Colorado on Clarvida&apos;s existing AWS, SSO and CRM, measured on source attribution, speed to first contact and referral-to-intake conversion.</p>
          </div>
          <PanelHeader
            title="The ask"
            actions={canEditAsk ? <Button size="sm" variant="ghost" onClick={() => setAskOpen(true)} aria-label="Edit the ask"><Pencil size={14} /></Button> : null}
          />
          <PanelBody className="space-y-4">
            <div>
              <p className="text-sm text-ink-2">Fund a 90-day pilot in two offices</p>
              <p className={`num mt-1 text-2xl ${db.ask === "To confirm with Clarvida" ? "text-ink-3" : "text-ink"}`}>{db.ask}</p>
              {db.ask === "To confirm with Clarvida" ? <p className="text-xs font-semibold text-warn">Placeholder until Clarvida confirms the amount{explain ? " (OQ-02)" : ""}</p> : null}
            </div>
            <ol className="space-y-3" aria-label="Pilot timeline">
              {PHASES.map((p) => (
                <li key={p.name}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-ink">{p.name}</span>
                    <span className="shrink-0 font-mono text-xs text-ink-3">Weeks {p.from}–{p.to}</span>
                  </div>
                  <div className="relative mt-1 h-2 rounded-full bg-sunken">
                    <div className={`absolute inset-y-0 rounded-full ${p.tone}`} style={{ left: `${(p.from / WEEKS) * 100}%`, width: `${((p.to - p.from) / WEEKS) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-ink-3">{p.detail}</p>
                </li>
              ))}
            </ol>
            <div className="flex items-start gap-2 rounded-md bg-hl-tint px-3 py-2.5 text-sm">
              <Flag size={16} className="mt-0.5 shrink-0 text-warn" />
              <p><span className="font-semibold text-ink">Go/no-go: pilot week 13.</span> <span className="text-ink-2">Scorecard against baseline, no open severity 1 or 2 issues, Compliance sign-off. Then R2 improvements and state-by-state rollout.</span></p>
            </div>
          </PanelBody>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel>
          <PanelHeader title="Runs on what Clarvida already has" />
          <PanelBody>
            <ul className="space-y-2 text-sm text-ink-2">
              <li><span className="font-semibold text-ink">Clarvida&apos;s AWS environment</span>, under its existing BAA, for the Care Zone</li>
              <li><span className="font-semibold text-ink">Clarvida single sign-on</span> with MFA for every account</li>
              <li><span className="font-semibold text-ink">The approved CRM</span> for business email to partner organizations</li>
              <li><span className="font-semibold text-ink">No new subprocessors</span>; AI runs on AWS Bedrock inside the same BAA, organization data only</li>
              <li><span className="font-semibold text-ink">Coexists with statewide platforms</span>: their referrals are tagged as a source, not replaced</li>
            </ul>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Readiness gates and who signs" />
          <PanelBody>
            <ul className="space-y-2 text-sm">
              {[["Business Transformation", "Scope, baselines and success measures", "Chief Transformation Officer"], ["Compliance and Legal", "Consent rules, partner wording, HIPAA and Part 2", "Compliance Officer, Legal"], ["Information Security", "BAA, vendor review, SSO, access and audit", "Information Security lead"]].map(([g, w, who]) => (
                <li key={g} className="rounded-xl bg-cv-ice px-3 py-2"><span className="block font-semibold">{g}</span><span className="block text-ink-2">{w}</span><span className="text-xs text-ink-3">Signs: {who}</span></li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Adoption plan" />
          <PanelBody>
            <ul className="space-y-2 text-sm text-ink-2">
              <li><span className="font-semibold text-ink">30-minute training</span> per role, built into the first-sign-in welcome</li>
              <li><span className="font-semibold text-ink">State champions</span> in Gastonia and Colorado Springs</li>
              <li><span className="font-semibold text-ink">80% weekly active use</span> by pilot ambassadors, reviewed every week</li>
              <li><span className="font-semibold text-ink">Owned by Clarvida Marketing</span>; intake and program managers own their workflows</li>
            </ul>
            <p className="mt-3 rounded-xl bg-hl-tint px-3 py-2 text-sm"><span className="font-semibold">Why it matters:</span> Clarvida aims to triple its impact to 180,000 clients a year by 2030 (Clarvida Press Kit, self-reported, accessed Oct 14, 2026). Referrals are the front door.</p>
          </PanelBody>
        </Panel>
      </div>
      <section className="mt-5 rounded-2xl border border-line bg-surface px-5 py-4 text-xs text-ink-3">
        <p className="font-semibold text-ink-2">Sources</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>Pace et al., &ldquo;Same-day scheduling and attendance at a first behavioral health visit,&rdquo; Annals of Family Medicine, 2018 (82% vs 29%).</li>
          <li>Clarvida Press Kit and clarvida.com, accessed Oct 14, 2026: 54,000 clients a year, 16 states, goal of 180,000 by 2030 (self-reported).</li>
          <li>Referral Co-Pilot BRD v1.0 (Oct 8, 2026): pilot KPIs and release plan. All other numbers on this page are synthetic or placeholders.</li>
        </ul>
      </section>

      <AskDialog open={askOpen} value={db.ask} onClose={() => setAskOpen(false)} onSave={(v) => {
        mutate((d) => { d.ask = v || "To confirm with Clarvida"; audit(d, { action: "Updated the funding ask", zone: "Outreach", category: "config" }); });
        toast.success("Ask updated");
      }} />
    </div>
  );
}

function AskDialog({ open, value, onClose, onSave }: { open: boolean; value: string; onClose: () => void; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const [was, setWas] = useState(open);
  if (open !== was) { setWas(open); if (open) setV(value); }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title="Edit the ask" description="Shown on this screen for the pitch close."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => { onSave(v.trim()); onClose(); }}>Save</Button></>}>
      <Label htmlFor="ask-amount">Ask</Label>
      <Input id="ask-amount" value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. $180,000 for a 90-day pilot" className="mt-1" />
    </Dialog>
  );
}
