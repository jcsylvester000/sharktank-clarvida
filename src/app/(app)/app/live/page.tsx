"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FastForward, Lock } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser } from "@/lib/store/hooks";
import { accessFor, href, PAGES, ROLE_LABEL } from "@/lib/access";
import { fmtSimClock, liveStats } from "@/lib/live/stats";
import type { LiveFeedKind } from "@/lib/domain/types";
import { pct } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, PageHeader, Stat } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/field";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { Histogram, ViewToggle } from "@/components/charts/charts";
import { LiveFeedList } from "@/components/live/live-feed";
import { SpeedControl, useLiveClock } from "@/components/live/live-controls";

type Filter = "all" | "referrals" | "outreach" | "programs";
const FILTER_KINDS: Record<Filter, LiveFeedKind[] | null> = {
  all: null,
  referrals: ["referral", "intake"],
  outreach: ["outreach", "ai", "event"],
  programs: ["capacity", "system"],
};

/** Where a person can step into the running simulation, by role. */
const STEP_IN: { pageId: string; text: (n: ReturnType<typeof liveStats>) => string }[] = [
  { pageId: "PG-14", text: (n) => `Intake Queue: ${n.waiting} referral${n.waiting === 1 ? "" : "s"} waiting for first contact, ${n.overdue} overdue. Anything you touch, the simulated coordinator leaves to you.` },
  { pageId: "PG-06", text: () => "My Week: the Co-Pilot keeps preparing briefs and drafts. Nothing is sent until you approve it." },
  { pageId: "PG-12", text: (n) => `Relationship Events: ${n.pendingEvents} public update${n.pendingEvents === 1 ? "" : "s"} found by the AI, waiting for an Ambassador Lead to confirm.` },
  { pageId: "PG-17", text: (n) => `Capacity Board: ${n.paused.length} program${n.paused.length === 1 ? "" : "s"} on waitlist. Change one and watch outreach pause or resume.` },
  { pageId: "PG-19", text: () => "Impact Dashboard: attribution and Ask the Co-Pilot update as referrals arrive." },
  { pageId: "PG-22", text: () => "Audit Log: every simulated action is recorded with the teammate who did it." },
  { pageId: "PG-23", text: () => "AI Governance: every simulated AI call is logged with its template and result." },
];

export default function LiveOperations() {
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const c = useLiveClock();
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<"chart" | "table">("chart");
  const s = useMemo(() => liveStats(db, c.t), [db, c.t]);
  const live = db.live;
  if (!live) return null;
  const clock = fmtSimClock(c.t);
  const kinds = FILTER_KINDS[filter];
  const items = (kinds ? live.feed.filter((f) => kinds.includes(f.kind)) : live.feed).slice(0, 60);
  const steps = STEP_IN.map((x) => ({ ...x, page: PAGES.find((p) => p.id === x.pageId)! })).map((x) => ({ ...x, access: accessFor(x.page, me.role) }));
  const mine = steps.filter((x) => x.access !== "none");
  const others = steps.filter((x) => x.access === "none");

  return (
    <div>
      <PageHeader
        meta={<><Badge tone="teal">Live sandbox</Badge><Badge tone="outline">Aggregate counts only</Badge></>}
        title="Live Operations"
        description="The Co-Pilot running on its own. Partners refer, simulated teammates answer, AI drafts outreach for people to approve, programs fill up. Every action goes through the same rules, AI guard and audit log a person's would."
        actions={<SpeedControl />}
      />

      <section className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-line bg-surface px-5 py-4" aria-label="Simulated time">
        <div>
          <p className="text-xs font-medium text-ink-3">Simulated time (Eastern)</p>
          <p className="font-display text-2xl font-semibold tabular">{clock.day} · {clock.time}</p>
        </div>
        <div className="min-w-[min(100%,18rem)] flex-1 text-sm text-ink-2">
          {c.paused ? "Paused. Nothing moves until you resume." : c.open ? `Business hours. Response clocks are running at ${c.speed}x.` : `After hours. Response clocks wait for 8:00 am; a few web referrals still arrive overnight.`}
          <span className="block text-xs text-ink-3">
            Since the sandbox started: {live.totals.arrivals} referrals arrived, {live.totals.simActions} intake actions by teammates, {live.totals.aiDrafts} AI-drafted emails approved, {live.totals.replies} partner replies.
          </span>
        </div>
        {!c.open && !c.paused ? (
          <Button variant="secondary" size="sm" onClick={c.skipToMorning}><FastForward size={14} /> Skip to 8:00 am</Button>
        ) : null}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Referrals received today" value={s.receivedToday} sub="All sources, both states" />
        <Stat label="Waiting for first contact" value={s.waiting} sub={`${s.dueSoon} due within 2 business hours`} tone={s.dueSoon ? "warn" : undefined} />
        <Stat label="Overdue now" value={s.overdue} sub="Escalated to the intake supervisor" tone={s.overdue ? "crit" : "ok"} />
        <Stat label="Answered within 1 business day" value={s.withinTarget === null ? "—" : pct(s.withinTarget)} sub={`Last 7 days, ${s.contactedWeek} contacted`} tone="teal" />
        <Stat label="Median time to first contact" value={s.medianFirstContactH === null ? "—" : `${s.medianFirstContactH.toFixed(1)} h`} sub="Business hours. Target 8 h" />
        <Stat label="Outreach emails approved today" value={s.sendsToday} sub="AI-drafted, approved by a person" />
        <Stat label="Partner replies today" value={s.repliesToday} sub="Simulated inbox" />
        <Stat label="Programs on waitlist" value={s.paused.length} sub={s.paused.length ? `Outreach paused: ${s.paused.map((p) => p.name).slice(0, 2).join(", ")}${s.paused.length > 2 ? "…" : ""}` : "Outreach open for all programs"} tone={s.paused.length ? "warn" : "ok"} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_26rem]">
        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Referrals by hour today" description="When referrals arrive, by simulated hour (Eastern)." actions={<ViewToggle value={view} onChange={setView} />} />
            <PanelBody>
              {view === "chart" ? (
                <Histogram buckets={s.byHour} label="Referrals received by hour today" />
              ) : (
                <Table>
                  <THead><tr><TH>Hour</TH><TH className="text-right">Referrals</TH></tr></THead>
                  <tbody>{s.byHour.map((b) => <TR key={b.label}><TD>{b.label}</TD><TD className="text-right tabular">{b.n}</TD></TR>)}</tbody>
                </Table>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Simulated teammates" description="They act through the same services as people, so their work shows on every page and in the audit log. Disable one in Administration and they stop." />
            <PanelBody className="grid gap-3 sm:grid-cols-2">
              {s.teammates.map(({ user, today, last }) => (
                <div key={user.id} className="rounded-md border border-line-2 px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sunken text-[11px] font-semibold">{user.initials}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{user.name}{user.active ? null : <span className="ml-1.5 text-xs text-crit">(disabled)</span>}</p>
                      <p className="text-xs text-ink-3">{ROLE_LABEL[user.role]}, {user.scope.join(" and ")}</p>
                    </div>
                    <span className="ml-auto font-display text-xl font-semibold tabular" aria-label={`${today} actions today`}>{today}</span>
                  </div>
                  <p className="mt-2 truncate text-xs text-ink-2" title={last?.action}>{last ? `Last: ${last.action}` : "No actions yet today"}</p>
                </div>
              ))}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Step in" description={`Where you, as ${ROLE_LABEL[me.role]}, can act on what is happening.`} />
            <ul className="divide-y divide-line-2">
              {mine.map((x) => (
                <li key={x.pageId}>
                  <Link href={href(x.page.route)} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas">
                    <span className="min-w-0 flex-1 text-sm"><span className="font-medium">{x.page.title}</span><span className="block text-ink-2">{x.text(s).replace(/^[^:]+:\s/, "")}</span></span>
                    <ArrowRight size={16} className="shrink-0 text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
            {others.length ? (
              <p className="flex items-center gap-1.5 border-t border-line-2 px-5 py-3 text-xs text-ink-3">
                <Lock size={12} /> Other roles can also step into: {others.map((x) => x.page.title).join(", ")}. Switch persona from the top right.
              </p>
            ) : null}
          </Panel>
        </div>

        <Panel className="xl:sticky xl:top-20 xl:self-start">
          <PanelHeader title="Live activity" description={["intake", "intake_sup", "compliance"].includes(me.role) ? "Care Zone lines show referral IDs for your role. Never client names or phone numbers." : "Care Zone activity shows as counts only for your role."} />
          <div className="border-b border-line-2 px-4 py-2.5">
            <Segmented<Filter>
              size="sm"
              label="Filter activity"
              value={filter}
              onChange={setFilter}
              options={[{ value: "all", label: "All" }, { value: "referrals", label: "Referrals" }, { value: "outreach", label: "Outreach & AI" }, { value: "programs", label: "Programs" }]}
            />
          </div>
          <div className="max-h-[44rem] overflow-y-auto" aria-live="polite">
            <LiveFeedList items={items} role={me.role} now={c.t} />
          </div>
        </Panel>
      </div>

      <Callout className="mt-5" title="What is simulated">
        Partners, families and the four teammates are invented; the AI is a deterministic simulated model. Timing follows each state&apos;s business hours. The data lives in this browser only and is separate from the pitch demo: starting the sandbox over never touches the demo.
      </Callout>
    </div>
  );
}
