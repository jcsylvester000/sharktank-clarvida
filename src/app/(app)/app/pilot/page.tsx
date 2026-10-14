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
}
const pctFmt = (v: number) => `${Math.round(v * 100)}%`;
const SLIDERS: { group: string; items: SliderDef[] }[] = [
  {
    group: "Families reaching intake",
    items: [
      { key: "referralsPerMonth", label: "Referrals per month", min: 20, max: 1000, step: 10, fmt: (v) => String(v), hint: "Across the pilot offices" },
      { key: "lostShare", label: "Share lost before first contact", min: 0, max: 0.8, step: 0.01, fmt: pctFmt, hint: "Families never reached today" },
      { key: "reduction", label: "Expected reduction in that loss", min: 0, max: 0.8, step: 0.01, fmt: pctFmt, hint: "From the clock, escalation and routing" },
      { key: "conversion", label: "Intake conversion of recovered referrals", min: 0, max: 1, step: 0.01, fmt: pctFmt, hint: "Of families reached, share who start" },
    ],
  },
  {
    group: "Ambassador time",
    items: [
      { key: "ambassadors", label: "Ambassadors in pilot", min: 1, max: 30, step: 1, fmt: (v) => String(v), hint: "NC and CO combined" },
      { key: "researchHours", label: "Research hours per ambassador per week", min: 0, max: 15, step: 0.5, fmt: (v) => `${v} h`, hint: "Finding who to visit and what to say" },
      { key: "researchReduction", label: "Research time reduction", min: 0, max: 0.8, step: 0.01, fmt: pctFmt, hint: "Measured in pilot interviews" },
    ],
  },
];

const PHASES = [
  { name: "Approvals and foundations", detail: "BAA and vendor review, risk analysis, SSO, Legal sign-off on partner wording, baselines collected", from: 0, to: 8, tone: "bg-ink-3/60" },
  { name: "Pilot build", detail: "Core referral loop, outreach tools, dashboards, CRM link", from: 4, to: 12, tone: "bg-teal" },
  { name: "90-day pilot", detail: "Gastonia NC and Colorado Springs CO, weekly KPI review", from: 12, to: 25, tone: "bg-s1" },
];
const WEEKS = 26;

export default function ImpactPilot() {
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const a = db.roi;
  const out = roi(a);
  const canEditAsk = me.role === "marketing" || me.role === "admin";
  const [askOpen, setAskOpen] = useState(false);

  const set = (key: keyof RoiAssumptions, v: number) => mutate((d) => { d.roi[key] = v; });
  const resetRoi = () => {
    const def = makeSeed(Date.now()).roi;
    mutate((d) => { d.roi = def; audit(d, { action: "Reset ROI assumptions to defaults", zone: "Outreach", category: "config" }); });
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
                    <input id={`roi-${s.key}`} type="range" min={s.min} max={s.max} step={s.step} value={a[s.key]} onChange={(e) => set(s.key, Number(e.target.value))} className="mt-1.5 w-full accent-teal" aria-describedby={`roi-${s.key}-hint`} />
                    <p id={`roi-${s.key}-hint`} className="text-xs text-ink-3">{s.hint}</p>
                  </div>
                ))}
              </fieldset>
            ))}
          </div>
          <div className="space-y-4 rounded-lg bg-teal-tint/60 p-5">
            <div>
              <p className="font-display text-[3.25rem] font-semibold leading-none tabular text-teal-strong">+{Math.round(out.extraFamilies)}</p>
              <p className="mt-1.5 font-medium text-ink">more families reach intake each year</p>
              <p className="text-sm text-ink-2">Range {Math.round(out.extraFamiliesLow)} to {Math.round(out.extraFamiliesHigh)} if the assumptions are 40% off either way.</p>
            </div>
            <div className="border-t border-teal/20 pt-4">
              <p className="font-display text-[2rem] font-semibold leading-none tabular text-ink">~{Math.round(out.hoursSaved).toLocaleString("en-US")} h</p>
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
              <THead><tr><TH>Measure</TH><TH>Baseline today</TH><TH>Pilot target</TH><TH>How it's measured</TH><TH className="text-right">In this demo</TH></tr></THead>
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

        <Panel className="border-teal/40">
          <PanelHeader
            title="The ask"
            actions={canEditAsk ? <Button size="sm" variant="ghost" onClick={() => setAskOpen(true)} aria-label="Edit the ask"><Pencil size={14} /></Button> : null}
          />
          <PanelBody className="space-y-4">
            <div>
              <p className="text-sm text-ink-2">Fund a 90-day pilot in two offices</p>
              <p className={`mt-1 font-display text-2xl font-semibold ${db.ask === "To confirm with Clarvida" ? "text-ink-3" : "text-ink"}`}>{db.ask}</p>
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
              <p><span className="font-semibold text-ink">Go/no-go review: week 25.</span> <span className="text-ink-2">Scorecard against baseline, no open severity 1 or 2 issues, Compliance sign-off.</span></p>
            </div>
          </PanelBody>
        </Panel>
      </div>

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
