"use client";
import Link from "next/link";
import { Clock3, HeartHandshake } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { href } from "@/lib/access";
import { Badge } from "@/components/ui/badge";
import { Callout, PageHeader, Stat } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";

// Phase 3 preview (C20): foster parent recruitment reuses the same pipeline, clock and ranking ideas. Illustrative numbers.
const STAGES = [
  { name: "Inquiry", n: 120, drop: "" },
  { name: "First contact", n: 104, drop: "Wrong number or no answer after 3 tries" },
  { name: "Info session", n: 61, drop: "Couldn't attend; timing" },
  { name: "Application", n: 34, drop: "Decided to wait" },
  { name: "Training", n: 22, drop: "Schedule conflicts" },
  { name: "Home study", n: 15, drop: "Housing or household changes" },
  { name: "Licensed", n: 11, drop: "Paperwork delays" },
];

export default function FosterPipeline() {
  const db = useStore((s) => s.db);
  const max = STAGES[0].n;
  // Foster template weights community trust and event hosting over clinical referral volume (FR-202).
  const FOSTER: Record<string, { score: number; why: string }> = {
    "Faith / community": { score: 74, why: "Family ministries host events and are trusted messengers for foster care" },
    "Community nonprofit": { score: 68, why: "Already serves families with housing and resource needs; shares space for evenings" },
    "Early childhood": { score: 61, why: "Parent networks and family nights; good for kinship care awareness" },
  };
  const cohosts = db.orgs
    .filter((o) => FOSTER[o.type] && o.state === "NC")
    .map((o) => ({ o, fit: { score: FOSTER[o.type].score, reasons: [FOSTER[o.type].why] } }))
    .sort((a, b) => b.fit.score - a.fit.score)
    .slice(0, 3);

  return (
    <div>
      <PageHeader
        title="Foster Pipeline"
        description="Recruiting foster families is the same problem as referrals: interest arrives, people wait too long, and nobody knows where they drop off."
        meta={<Badge tone="hl">Phase 3 preview. Illustrative data.</Badge>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Inquiries, 90 days" value={STAGES[0].n} />
        <Stat label="Contacted within 24 hours" value="92%" tone="ok" sub="Same clock as referrals" />
        <Stat label="Licensed" value={STAGES[STAGES.length - 1].n} tone="teal" />
        <Stat label="Lost before the info session" value={43} tone="warn" sub="Biggest drop-off" />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <PanelHeader title="From inquiry to licensed" description="Each stage shows how many people are left and the most common reason others stopped." />
          <PanelBody>
            <ol className="space-y-2.5">
              {STAGES.map((s, i) => {
                const lost = i ? STAGES[i - 1].n - s.n : 0;
                return (
                  <li key={s.name} className="grid grid-cols-[8rem_1fr] items-center gap-3">
                    <span className="text-right text-sm">{s.name}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 rounded-r bg-s1" style={{ width: `${(s.n / max) * 100}%` }} />
                        <span className="text-sm font-medium tabular">{s.n}</span>
                      </div>
                      {lost ? <p className="mt-0.5 text-xs text-ink-3">{lost} stopped: {s.drop.toLowerCase()}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </PanelBody>
        </Panel>
        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Suggested info-night co-hosts" description="Same ranking engine as the Gatekeeper Finder, with foster weights." />
            <PanelBody className="space-y-3">
              {cohosts.map(({ o, fit }) => (
                <div key={o.id} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-tint text-teal"><HeartHandshake size={16} /></div>
                  <div className="min-w-0">
                    <Link href={href("/app/organization", { id: o.id })} className="text-sm font-medium hover:underline">{o.name}</Link>
                    <p className="text-xs text-ink-3">Fit {fit.score}. {fit.reasons[0]}</p>
                  </div>
                </div>
              ))}
            </PanelBody>
          </Panel>
          <Callout tone="teal" icon={<Clock3 size={16} className="text-teal" />} title="Why it's cheap to add">
            The pipeline, the 24-hour clock, the ranking and the dashboard are already built for referrals. Foster recruitment mostly needs new stage names and a form.
          </Callout>
        </div>
      </div>
    </div>
  );
}
