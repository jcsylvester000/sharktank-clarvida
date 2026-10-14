"use client";
import { useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, ArrowUpRight, BellRing, CalendarClock, CircleCheck, Clock3, CornerDownRight, Eye, Megaphone, PauseCircle, TrendingDown, TrendingUp, Minus, History } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { useApi } from "@/mock-api";
import { DASHBOARD_NAME, ROLE_LABEL, href } from "@/lib/access";
import { activityFor, alertsFor, greeting, kpisFor, roleTasks, tzFor, type Alert, type DashTask, type Kpi } from "@/lib/dashboard";
import { readAccount } from "@/lib/services/account";
import { ago, fmtShortDate } from "@/lib/format";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, PageSkeleton, SunCircle, SunState, HOPEFUL_LINE } from "@/components/brand/brand";
import { AmbassadorWeek } from "@/components/dashboard/ambassador-week";
import { cn } from "@/components/ui/cn";
import type { Role, User } from "@/lib/domain/types";

const QUICK: Record<Role, { label: string; to: string }[]> = {
  ambassador: [{ label: "Find gatekeepers", to: "/app/finder" }, { label: "Map Explorer", to: "/app/map" }, { label: "Nurture Journeys", to: "/app/nurture" }, { label: "Partner kits and QR", to: "/app/kits" }],
  amb_lead: [{ label: "Map Explorer: coverage", to: "/app/map" }, { label: "Partner Directory", to: "/app/directory" }, { label: "Relationship Events", to: "/app/events" }],
  intake: [{ label: "Open the Intake Queue", to: "/app/intake" }, { label: "Enter a phone or fax referral", to: "/app/referral/new" }, { label: "Capacity Board", to: "/app/capacity" }],
  intake_sup: [{ label: "Open the Intake Queue", to: "/app/intake" }, { label: "Response times", to: "/app/impact" }, { label: "Capacity Board", to: "/app/capacity" }],
  program_mgr: [{ label: "Update capacity", to: "/app/capacity" }, { label: "Program Catalog", to: "/app/catalog" }],
  marketing: [{ label: "Impact Dashboard", to: "/app/impact" }, { label: "Impact and Pilot", to: "/app/pilot" }, { label: "Partner kits", to: "/app/kits" }],
  compliance: [{ label: "Audit Log", to: "/app/audit" }, { label: "AI Governance", to: "/app/ai-governance" }, { label: "Trust and Security", to: "/app/trust" }],
  admin: [{ label: "Administration", to: "/app/admin" }, { label: "Audit Log", to: "/app/audit" }, { label: "AI Governance", to: "/app/ai-governance" }],
  partner: [],
  judge: [{ label: "Impact and Pilot: the ask", to: "/app/pilot" }, { label: "Impact Dashboard", to: "/app/impact" }, { label: "Trust and Security", to: "/app/trust" }],
};

export default function Dashboard() {
  const me = useCurrentUser()!;
  const now = useNow(30_000);
  const { data } = useApi((db, u) => ({
    kpis: kpisFor(db, u, now),
    alerts: alertsFor(db, u, now),
    tasks: roleTasks(db, u, readAccount(db, u.id), now),
    activity: activityFor(db, u),
    users: db.users,
  }), [now]);
  if (!data) return <PageSkeleton />;

  const isAmb = me.role === "ambassador" || me.role === "amb_lead";
  return (
    <div className="space-y-6">
      <Greeting me={me} now={now} />
      <KpiRow kpis={data.kpis} />
      {isAmb ? (
        <>
          {data.alerts.length ? <AlertsPanel alerts={data.alerts} compact /> : null}
          {me.role === "amb_lead" && data.tasks.length ? <TasksPanel me={me} tasks={data.tasks} /> : null}
          <AmbassadorWeek lead={me.role === "amb_lead"} />
          <ActivityPanel items={data.activity} users={data.users} now={now} />
        </>
      ) : me.role === "judge" ? (
        <JudgeOverview alerts={data.alerts} activity={data.activity} users={data.users} now={now} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <TasksPanel me={me} tasks={data.tasks} />
            <AlertsPanel alerts={data.alerts} />
          </div>
          <div className="space-y-5">
            <QuickActions role={me.role} />
            <ActivityPanel items={data.activity} users={data.users} now={now} />
          </div>
        </div>
      )}
    </div>
  );
}

function Greeting({ me, now }: { me: User; now: number }) {
  const acc = useStore((s) => readAccount(s.db, me.id));
  const tz = tzFor(me);
  const date = new Date(now).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz });
  const counties = me.counties?.length ? `${me.counties.length} ${me.counties.length === 1 ? "county" : "counties"}` : me.territory;
  const resume = acc.lastPage && !acc.lastPage.startsWith("/app?") && acc.lastPage !== "/app/?" ? acc.lastPage : null;
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-panel)] bg-cv-ice px-6 py-6 sm:px-9 sm:py-7" data-guide="dashboard">
      <SunCircle size={170} className="absolute -right-10 -top-14 hidden opacity-80 sm:block" />
      <span aria-hidden className="absolute -bottom-16 right-24 hidden h-40 w-40 rounded-tl-[160px] bg-cv-skylight/50 md:block" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <p className="text-sm font-medium text-teal-strong">{DASHBOARD_NAME[me.role]} · {date}</p>
          <h1 className="mt-1 text-[1.9rem] leading-tight text-cv-teal sm:text-[2.2rem]">
            {greeting(now, tz)}, {me.firstName ?? me.name}.
          </h1>
          <p className="mt-1.5 text-[1.02rem] text-ink-2">
            {me.role === "judge" ? "Thank you for judging. Here is the whole Referral Co-Pilot at a glance." : `${me.office}, ${counties}.`}
          </p>
          <p className="mt-2 inline-flex flex-wrap items-center gap-x-2 text-sm text-ink-3">
            <History size={14} aria-hidden /> Last signed in {acc.lastSignInAt ? ago(acc.lastSignInAt, now) : "today"} from {acc.lastSignInFrom ?? "this browser"}
            {me.readOnly ? <Badge tone="hl" icon={<Eye size={12} />} className="ml-1">Read-only guest</Badge> : null}
          </p>
        </div>
        {resume && resume.split("?")[0] !== "/app/" ? (
          <Link href={resume} className="relative inline-flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-cv-link shadow-sm hover:text-cv-deep">
            Continue where you left off <ArrowRight size={15} />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function KpiRow({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" data-guide="kpis">
      {kpis.map((k) => {
        const T = k.trend?.dir === "up" ? TrendingUp : k.trend?.dir === "down" ? TrendingDown : Minus;
        const body = (
          <>
            <p className="text-sm font-medium text-ink-2">{k.label}</p>
            <p className={cn("num mt-1.5 text-[2rem] leading-none", k.amber ? "text-cv-ink" : "text-cv-teal")}>{k.value}</p>
            {k.sub ? <p className="mt-1.5 text-xs text-ink-3">{k.sub}</p> : null}
            {k.trend ? (
              <p className={cn("mt-2 inline-flex items-center gap-1 text-xs font-medium", k.trend.good ? "text-teal-strong" : "text-warn")}>
                <T size={13} aria-hidden /> {k.trend.text}
              </p>
            ) : null}
          </>
        );
        const cls = cn("block rounded-2xl border bg-surface px-5 py-4", k.amber ? "border-cv-amber bg-[#fffaf0] ring-1 ring-cv-amber/60" : "border-line");
        return k.link ? (
          <Link key={k.id} href={k.link} className={cn(cls, "hover:border-teal")}>{body}</Link>
        ) : (
          <div key={k.id} className={cls}>{body}</div>
        );
      })}
    </div>
  );
}

const ALERT_ICON: Record<Alert["tone"], React.ComponentType<{ size?: number; className?: string }>> = {
  event: Megaphone, quiet: Clock3, overdue: AlertTriangle, paused: PauseCircle, approval: CornerDownRight, info: BellRing,
};

function AlertsPanel({ alerts, compact }: { alerts: Alert[]; compact?: boolean }) {
  return (
    <Panel data-guide="alerts">
      <PanelHeader title="Alerts" description={compact ? undefined : "What changed that you should know about."} />
      {alerts.length === 0 ? (
        <SunState compact title="Nothing needs your attention right now.">{HOPEFUL_LINE}</SunState>
      ) : (
        <ul className={cn("divide-y divide-line-2", compact && "grid divide-y-0 md:grid-cols-2")}>
          {alerts.map((a) => {
            const I = ALERT_ICON[a.tone];
            return (
              <li key={a.id} className={cn(compact && "border-b border-line-2 md:odd:border-r")}>
                <Link href={a.link ?? "#"} className="flex gap-3 px-5 py-3.5 hover:bg-canvas">
                  <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", a.tone === "overdue" || a.tone === "event" ? "bg-hl-tint text-warn" : "bg-teal-tint text-teal-strong")}>
                    <I size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{a.title}</span>
                    <span className="block text-sm text-ink-2">{a.detail}</span>
                    {a.source ? <span className="mt-0.5 block text-xs text-ink-3">Source: {a.source}</span> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function TasksPanel({ me, tasks }: { me: User; tasks: DashTask[] }) {
  const mutate = useStore((s) => s.mutate);
  const complete = (t: DashTask) => {
    mutate((d) => { d.accounts[me.id].dismissed.push(t.id); }, undefined, { allowReadOnly: true });
    toast.success("Task completed", { action: { label: "Undo", onClick: () => mutate((d) => { d.accounts[me.id].dismissed = d.accounts[me.id].dismissed.filter((x) => x !== t.id); }, undefined, { allowReadOnly: true }) }, duration: 5000 });
  };
  const snooze = (t: DashTask) => {
    mutate((d) => { d.accounts[me.id].snoozed[t.id] = Date.now() + 86_400_000; }, undefined, { allowReadOnly: true });
    toast("Snoozed until tomorrow", { action: { label: "Undo", onClick: () => mutate((d) => { delete d.accounts[me.id].snoozed[t.id]; }, undefined, { allowReadOnly: true }) }, duration: 5000 });
  };
  return (
    <Panel data-guide="tasks">
      <PanelHeader title="My tasks" description={`${tasks.length} open. Created from referrals, approvals and changes in your area.`} />
      {tasks.length === 0 ? (
        <SunState compact title="You're all caught up.">{HOPEFUL_LINE}</SunState>
      ) : (
        <ul className="divide-y divide-line-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-3 px-5 py-3">
              <button onClick={() => complete(t)} className="mt-0.5 rounded-full text-ink-3 hover:text-teal" aria-label={`Complete: ${t.text}`}>
                <CircleCheck size={20} />
              </button>
              <div className="min-w-0 flex-1">
                {t.link ? <Link href={t.link} className="text-sm font-semibold text-ink hover:text-cv-link">{t.text}</Link> : <p className="text-sm font-semibold">{t.text}</p>}
                <p className="text-sm text-ink-2">{t.why}{t.due ? ` · due ${fmtShortDate(t.due)}` : ""}</p>
              </div>
              <button onClick={() => snooze(t)} className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-ink-3 hover:bg-sunken hover:text-ink" aria-label={`Snooze: ${t.text}`}>
                <CalendarClock size={14} /> Snooze
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function QuickActions({ role }: { role: Role }) {
  const q = QUICK[role];
  if (!q.length) return null;
  return (
    <Panel>
      <PanelHeader title="Quick actions" />
      <ul className="p-2">
        {q.map((x) => (
          <li key={x.to}>
            <Link href={href(x.to)} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-cv-link hover:bg-canvas">
              {x.label} <ArrowUpRight size={15} />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ActivityPanel({ items, users, now }: { items: { id: string; at: number; actorId: string; text: string; link?: string }[]; users: User[]; now: number }) {
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  return (
    <Panel data-guide="activity">
      <PanelHeader title="Recent team activity" description="Live from your teammates. Never includes client details." />
      {items.length === 0 ? (
        <SunState compact title="Quiet so far today." />
      ) : (
        <ul className="divide-y divide-line-2">
          {items.map((a) => {
            const u = byId.get(a.actorId);
            const inner = (
              <>
                <Avatar initials={u?.initials ?? "··"} tone={u?.avatarTone} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">{a.text}</span>
                  <span className="text-xs text-ink-3">{ago(a.at, now)}{u ? ` · ${ROLE_LABEL[u.role]}` : ""}</span>
                </span>
              </>
            );
            return (
              <li key={a.id}>
                {a.link ? <Link href={a.link} className="flex items-start gap-3 px-5 py-2.5 hover:bg-canvas">{inner}</Link> : <div className="flex items-start gap-3 px-5 py-2.5">{inner}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function JudgeOverview({ alerts, activity, users, now }: { alerts: Alert[]; activity: { id: string; at: number; actorId: string; text: string; link?: string }[]; users: User[]; now: number }) {
  const steps = [
    { n: "1", t: "Find and brief the right partners", d: "Ambassadors see which institutions actually refer, on a real map, with AI drafts a person approves." },
    { n: "2", t: "Every referral carries its source", d: "Partners refer in a minute through a coded link or QR. No trackers on the form." },
    { n: "3", t: "Contact within 1 business day", d: "Referrals route to the right team instantly with a response clock and escalation." },
    { n: "4", t: "Referrers hear back, safely", d: "Status updates without client details, within consent rules." },
    { n: "5", t: "Leadership sees what works", d: "Which relationships produce clients, in aggregate only." },
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <Panel>
          <PanelHeader title="The closed loop in five steps" description="What the Referral Co-Pilot changes for Clarvida, families and referral partners." />
          <ol className="divide-y divide-line-2">
            {steps.map((s) => (
              <li key={s.n} className="flex gap-4 px-5 py-3.5">
                <span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-tint text-teal-strong">{s.n}</span>
                <span>
                  <span className="block text-sm font-semibold">{s.t}</span>
                  <span className="block text-sm text-ink-2">{s.d}</span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>
        <AlertsPanel alerts={alerts} />
      </div>
      <div className="space-y-5">
        <Panel className="overflow-hidden">
          <div className="bg-cv-navy px-5 py-5 text-white">
            <p className="text-sm text-white/80">The ask</p>
            <p className="mt-1 text-lg font-medium leading-snug">A 90-day pilot in North Carolina and Colorado on Clarvida&apos;s existing AWS, SSO and CRM.</p>
          </div>
          <div className="px-5 py-4">
            <Link href="/app/pilot/" className="inline-flex"><Button variant="cta">See the pilot plan and the ask</Button></Link>
            <p className="mt-3 text-xs text-ink-3">You can move the ROI sliders. Everything else is read-only for guests, and anything you change stays on your device.</p>
          </div>
        </Panel>
        <QuickActions role="judge" />
        <ActivityPanel items={activity} users={users} now={now} />
      </div>
    </div>
  );
}
