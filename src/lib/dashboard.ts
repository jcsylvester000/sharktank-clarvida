// Role-aware dashboard model (FT-040..FT-045, FT-128). One widget set, different content per role.
// Everything is computed from the (scoped) database, so actions anywhere in the demo change these numbers.
import type { AccountState, DB, Role, User } from "@/lib/domain/types";
import { clockFor } from "@/lib/rules/clock";
import { isPaused, sourceHealth, weeklyPlan } from "@/lib/rules/outreach";
import { suppress } from "@/lib/rules/suppress";
import { funnel, speed } from "@/lib/services/analytics";
import { notificationsFor } from "@/lib/services/core";

const H = 3_600_000;
const D = 24 * H;

export interface Kpi {
  id: string;
  label: string;
  value: string;
  sub?: string;
  trend?: { dir: "up" | "down" | "flat"; text: string; good: boolean };
  amber?: boolean; // the one amber KPI: time to first contact (AC-BR-06)
  link?: string;
}

export interface DashTask {
  id: string;
  text: string;
  why: string;
  link?: string;
  due?: number;
  kind: "task" | "derived";
}

export interface Alert {
  id: string;
  tone: "event" | "quiet" | "overdue" | "paused" | "approval" | "info";
  title: string;
  detail: string;
  link?: string;
  source?: string;
}

const trend = (cur: number, prev: number, goodWhenUp = true, unit = ""): Kpi["trend"] => {
  const diff = cur - prev;
  if (Math.abs(diff) < 0.0001) return { dir: "flat", text: "Same as last period", good: true };
  const dir = diff > 0 ? "up" : "down";
  const txt = `${diff > 0 ? "+" : "−"}${Math.abs(Number.isInteger(diff) ? diff : Number(diff.toFixed(1)))}${unit} vs last period`;
  return { dir, text: txt, good: goodWhenUp ? diff > 0 : diff < 0 };
};

function openReferrals(db: DB) {
  return db.referrals.filter((r) => r.status === "New");
}

function clocks(db: DB, now: number) {
  return openReferrals(db).map((r) => ({ r, c: clockFor(r, now, db.demo.clockMode, db.sla.find((s) => s.state === r.state)) }));
}

export function kpisFor(db: DB, me: User, now: number): Kpi[] {
  const owned = db.orgs.filter((o) => o.ownerId === me.id);
  const sp = speed(db, me.scope.includes("ALL") ? {} : { state: me.scope[0] });
  const medianText = `${sp.median.toFixed(1)} h`;
  switch (me.role as Role) {
    case "ambassador": {
      const h = sourceHealth(owned);
      const lastMonth = owned.reduce((s, o) => s + (o.monthly[5] ?? 0), 0);
      const prevMonth = owned.reduce((s, o) => s + (o.monthly[4] ?? 0), 0);
      const sends = db.sendCounts[me.id] ?? 0;
      return [
        { id: "k-active", label: "Active relationships", value: String(h.active), sub: `of ${owned.length} organizations`, trend: trend(h.active, Math.max(0, h.active - 1)), link: "/app/directory/" },
        { id: "k-refs", label: "Referrals from my partners", value: String(lastMonth), sub: "last 30 days", trend: trend(lastMonth, prevMonth) },
        { id: "k-quiet", label: "Sources gone quiet", value: String(h.quiet + h.dormant), sub: "need a call this week", trend: trend(h.quiet + h.dormant, h.quiet + h.dormant + 1, false), link: "/app/directory/" },
        { id: "k-sends", label: "Outreach this week", value: `${sends}/${db.sendCap}`, sub: "approved emails, weekly cap" },
      ];
    }
    case "amb_lead": {
      const team = db.users.filter((u) => u.role === "ambassador");
      const counties = new Set(db.orgs.map((o) => `${o.state}|${o.county}`));
      const covered = new Set(db.orgs.filter((o) => o.stage === "Active" || o.stage === "Engaged").map((o) => `${o.state}|${o.county}`));
      const atRisk = db.orgs.filter((o) => o.stage === "At risk" || o.stage === "Quiet" || o.stage === "Dormant").length;
      const sends = team.reduce((s, u) => s + (db.sendCounts[u.id] ?? 0), 0);
      const refs = db.orgs.reduce((s, o) => s + o.referrals90d, 0);
      return [
        { id: "k-cov", label: "Counties with an active partner", value: `${covered.size} of ${counties.size}`, sub: "NC and CO pilot", link: "/app/directory/" },
        { id: "k-risk", label: "Relationships to win back", value: String(atRisk), sub: "quiet, at risk or dormant", trend: trend(atRisk, atRisk + 2, false) },
        { id: "k-sends", label: "Team outreach this week", value: String(sends), sub: `${team.length} ambassadors, all approved by a person` },
        { id: "k-refs", label: "Referrals from partners", value: String(refs), sub: "last 90 days", trend: trend(refs, Math.round(refs * 0.86)) },
      ];
    }
    case "intake": {
      const cs = clocks(db, now);
      const mine = cs.length;
      return [
        { id: "k-open", label: "Waiting for first contact", value: String(mine), sub: "in your queues", link: "/app/intake/" },
        { id: "k-soon", label: "Due soon", value: String(cs.filter((x) => x.c.state === "due_soon").length), sub: "2 business hours or less" },
        { id: "k-over", label: "Overdue", value: String(cs.filter((x) => x.c.state === "overdue").length), sub: "past 1 business day" },
        { id: "k-speed", label: "Median time to first contact", value: medianText, sub: "target: within 1 business day", amber: true },
      ];
    }
    case "intake_sup": {
      const cs = clocks(db, now);
      const over = cs.filter((x) => x.c.state === "overdue").length;
      const coordinators = db.users.filter((u) => u.role === "intake" && u.scope.some((s) => me.scope.includes(s))).length || 1;
      return [
        { id: "k-ontime", label: "Contacted on time", value: `${Math.round(sp.withinTarget * 100)}%`, sub: "last 90 days", trend: trend(Math.round(sp.withinTarget * 100), Math.round(sp.withinTarget * 100) - 4, true, " pts") },
        { id: "k-over", label: "Overdue now", value: String(over), sub: over ? "escalated to you" : "none waiting", link: "/app/intake/" },
        { id: "k-load", label: "Open per coordinator", value: (cs.length / coordinators).toFixed(1), sub: `${cs.length} open, ${coordinators} coordinator${coordinators === 1 ? "" : "s"}` },
        { id: "k-speed", label: "Median time to first contact", value: medianText, sub: "business hours", amber: true },
      ];
    }
    case "program_mgr": {
      const ps = db.programs;
      const stale = ps.filter((p) => now - p.capacityUpdatedAt > 7 * D).length;
      const redirected = db.referrals.filter((r) => r.status === "Redirected" || (r.status === "Hold" && r.statusReason === "Waitlist")).length;
      return [
        { id: "k-open", label: "Programs open", value: String(ps.filter((p) => p.capacity === "Open").length), sub: `of ${ps.length} programs`, link: "/app/capacity/" },
        { id: "k-paused", label: "Outreach paused", value: String(ps.filter(isPaused).length), sub: "waitlist or closed" },
        { id: "k-stale", label: "Capacity to confirm", value: String(stale), sub: "not confirmed in 7 days", trend: trend(stale, stale + 1, false) },
        { id: "k-redirect", label: "Families waiting or redirected", value: String(redirected), sub: "told honestly, with timing" },
      ];
    }
    case "marketing":
    case "judge": {
      const f = funnel(db);
      return [
        { id: "k-known", label: "Referrals with a known source", value: "100%", sub: "today: 0% (name, email, message)", trend: { dir: "up", text: "+100 pts vs today's form", good: true } },
        { id: "k-refs", label: "Referrals, last 90 days", value: suppress(f.totals.refs), sub: "NC and CO pilot counties (synthetic)" },
        { id: "k-conn", label: "Successful connection rate", value: `${Math.round(f.connectionRate * 100)}%`, sub: "families who reached intake", trend: trend(Math.round(f.connectionRate * 100), Math.round(f.connectionRate * 100) - 3, true, " pts") },
        { id: "k-speed", label: "Median time to first contact", value: medianText, sub: "target: within 1 business day", amber: true },
      ];
    }
    case "compliance": {
      const today = db.audit.filter((a) => now - a.at < D).length;
      const blocked = db.audit.filter((a) => a.category === "blocked" && now - a.at < 7 * D).length;
      const denied = db.audit.filter((a) => a.category === "access" && now - a.at < 7 * D).length;
      const review = db.prompts.filter((p) => p.status !== "Approved").length;
      return [
        { id: "k-audit", label: "Actions recorded today", value: String(today), sub: "every sign-in, view and change", link: "/app/audit/" },
        { id: "k-blocked", label: "Client details blocked", value: String(blocked), sub: "PHI guard, last 7 days", link: "/app/ai-governance/" },
        { id: "k-denied", label: "Access denials", value: String(denied), sub: "locked pages, last 7 days" },
        { id: "k-prompts", label: "Prompts waiting for review", value: String(review), sub: "nothing ships unreviewed" },
      ];
    }
    case "admin": {
      const active = db.users.filter((u) => u.active && !u.id.startsWith("u-sim-")).length;
      const pending = db.pending.filter((p) => p.status === "Waiting for second approver").length;
      const locked = Object.values(db.credentials ?? {}).filter((c) => c.lockedUntil && c.lockedUntil > now).length;
      return [
        { id: "k-users", label: "Active accounts", value: String(active), sub: "SSO + MFA required", link: "/app/admin/" },
        { id: "k-pending", label: "Changes waiting for approval", value: String(pending), sub: "second approver required" },
        { id: "k-locked", label: "Locked accounts", value: String(locked), sub: "5 failed sign-ins locks for 5 minutes" },
        { id: "k-cap", label: "Weekly send cap", value: String(db.sendCap), sub: `per ambassador; ${db.orgSendCap} per organization` },
      ];
    }
    default:
      return [];
  }
}

/** FT-043: alerts relevant to this account. */
export function alertsFor(db: DB, me: User, now: number): Alert[] {
  const out: Alert[] = [];
  const role = me.role;
  const outreachRole = role === "ambassador" || role === "amb_lead" || role === "marketing";
  if (outreachRole || role === "judge") {
    const owned = role === "ambassador" ? db.orgs.filter((o) => o.ownerId === me.id) : db.orgs;
    for (const e of db.events.filter((x) => x.status === "Published" && now - Date.parse(x.date) < 60 * D)) {
      if (role === "ambassador" && !e.orgIds.some((id) => owned.some((o) => o.id === id))) continue;
      out.push({ id: `al-${e.id}`, tone: "event", title: e.title, detail: `${e.type}. ${role === "ambassador" ? "Your contacts may have changed: confirm them and share an updated program list." : "Affected organizations are marked at risk."}`, link: `/app/organization/?id=${e.orgIds[0]}`, source: e.sourceLabel });
    }
    if (role !== "judge") {
      for (const o of owned.filter((x) => x.stage === "Quiet" || x.stage === "Dormant").slice(0, 3)) {
        const days = o.lastReferralAt ? Math.floor((now - o.lastReferralAt) / D) : null;
        const avg = Math.round(o.monthly.slice(0, 4).reduce((s, n) => s + n, 0) / 4);
        out.push({ id: `al-q-${o.id}`, tone: "quiet", title: `${o.name} has gone quiet`, detail: days ? `Used to send about ${avg || 1} a month; none in ${days} days.` : "No referrals yet.", link: `/app/organization/?id=${o.id}` });
      }
    }
  }
  if (role !== "judge" && role !== "partner") {
    for (const p of db.programs.filter(isPaused)) {
      out.push({ id: `al-p-${p.id}`, tone: "paused", title: `${p.name} (${p.office}) is on ${p.capacity.toLowerCase()}`, detail: `Outreach for it is paused everywhere${p.expectedReopen ? `; expected to reopen ${p.expectedReopen}` : ""}.`, link: "/app/capacity/" });
    }
  }
  if (role === "intake" || role === "intake_sup") {
    for (const { r, c } of clocks(db, now).filter((x) => x.c.state === "overdue" || x.c.state === "due_soon")) {
      out.push({ id: `al-r-${r.id}`, tone: "overdue", title: c.state === "overdue" ? `${r.id} is overdue` : `${r.id} is due soon`, detail: c.state === "overdue" ? "Past the 1-business-day response target. Reassign or call now." : "About 2 business hours left to make first contact.", link: `/app/referral/?id=${r.id}` });
    }
  }
  if (role === "admin" || role === "amb_lead") {
    for (const p of db.pending.filter((x) => x.status === "Waiting for second approver")) {
      out.push({ id: `al-c-${p.id}`, tone: "approval", title: `${p.area}: waiting for a second approver`, detail: p.change, link: "/app/admin/" });
    }
  }
  if (role === "compliance") {
    const b = db.audit.find((a) => a.category === "blocked");
    if (b) out.push({ id: "al-blocked", tone: "info", title: "The PHI guard blocked client details", detail: `${b.actorName}: ${b.action}. Nothing reached the AI.`, link: "/app/audit/" });
  }
  if (role === "program_mgr") {
    for (const p of db.programs.filter((x) => now - x.capacityUpdatedAt > 7 * D)) {
      out.push({ id: `al-s-${p.id}`, tone: "info", title: `${p.name}: capacity not confirmed in ${Math.floor((now - p.capacityUpdatedAt) / D)} days`, detail: "Confirm it so ambassadors and intake trust the board.", link: "/app/capacity/" });
    }
  }
  return out.slice(0, 6);
}

/** FT-042: tasks for roles without an outreach plan, derived from live data. Completing one is remembered per account. */
export function roleTasks(db: DB, me: User, acc: AccountState, now: number): DashTask[] {
  const t: DashTask[] = [];
  const add = (x: DashTask) => { if (!acc.dismissed.includes(x.id) && !(acc.snoozed[x.id] > now)) t.push(x); };
  switch (me.role) {
    case "intake": {
      const cs = clocks(db, now).sort((a, b) => a.c.leftMs - b.c.leftMs);
      cs.slice(0, 5).forEach(({ r, c }) => add({ id: `tk-call-${r.id}`, kind: "derived", text: `Call the family for ${r.id}`, why: c.state === "overdue" ? "Overdue: past 1 business day" : c.state === "due_soon" ? "Due soon" : r.queue.startsWith("Triage") ? "Needs triage to a program" : "New referral, clock running", link: `/app/referral/?id=${r.id}` }));
      break;
    }
    case "intake_sup":
      clocks(db, now).filter((x) => x.c.state === "overdue").forEach(({ r }) => add({ id: `tk-re-${r.id}`, kind: "derived", text: `Reassign ${r.id}`, why: "Overdue and escalated to you", link: `/app/referral/?id=${r.id}` }));
      add({ id: "tk-sup-weekly", kind: "task", text: "Review this week's response times with the team", why: "Weekly team huddle", link: "/app/impact/", due: now + 2 * D });
      break;
    case "program_mgr":
      db.programs.filter((p) => now - p.capacityUpdatedAt > 7 * D).forEach((p) => add({ id: `tk-cap-${p.id}`, kind: "derived", text: `Confirm capacity for ${p.name}`, why: `Not confirmed in ${Math.floor((now - p.capacityUpdatedAt) / D)} days`, link: "/app/capacity/" }));
      db.programs.filter((p) => now - p.verifiedAt > 90 * D).forEach((p) => add({ id: `tk-ver-${p.id}`, kind: "derived", text: `Re-verify the catalog entry for ${p.name}`, why: "Over 90 days since verification", link: "/app/catalog/" }));
      break;
    case "marketing":
      add({ id: "tk-mk-baselines", kind: "task", text: "Add the 3 Clarvida baselines to the pilot scorecard", why: "Referrals per month, share reaching intake, time to first contact", link: "/app/pilot/", due: now + 1 * D });
      add({ id: "tk-mk-report", kind: "task", text: "Share last month's attribution report with leadership", why: "Which relationships produce clients", link: "/app/impact/", due: now + 3 * D });
      add({ id: "tk-mk-ideas", kind: "task", text: "Review webinar ideas for school counselors", why: "2 ideas waiting for approval", link: "/app/events/", due: now + 4 * D });
      break;
    case "compliance":
      db.audit.filter((a) => a.category === "blocked").slice(0, 2).forEach((a) => add({ id: `tk-bl-${a.id}`, kind: "derived", text: `Review blocked attempt by ${a.actorName}`, why: "PHI guard stopped client details", link: "/app/audit/" }));
      db.prompts.filter((p) => p.status !== "Approved").forEach((p) => add({ id: `tk-pr-${p.id}`, kind: "derived", text: `Review prompt "${p.name}" ${p.version}`, why: "Waiting for compliance review", link: "/app/ai-governance/" }));
      add({ id: "tk-co-q", kind: "task", text: "Quarterly audit-log review", why: "Due Friday", link: "/app/audit/", due: now + 3 * D });
      break;
    case "admin":
      db.pending.filter((p) => p.status === "Waiting for second approver").forEach((p) => add({ id: `tk-pd-${p.id}`, kind: "derived", text: `Follow up: ${p.change}`, why: "Waiting for a second approver", link: "/app/admin/" }));
      add({ id: "tk-ad-caps", kind: "task", text: "Review send caps before the pilot", why: "CAN-SPAM and partner goodwill", link: "/app/admin/", due: now + 5 * D });
      break;
    case "amb_lead":
      db.events.filter((e) => e.status === "Draft").forEach((e) => add({ id: `tk-ev-${e.id}`, kind: "derived", text: `Confirm and publish: ${e.title}`, why: "AI found a public update; a person confirms it", link: "/app/events/" }));
      db.pending.filter((p) => p.status === "Waiting for second approver").forEach((p) => add({ id: `tk-ap-${p.id}`, kind: "derived", text: `Second approval: ${p.change}`, why: "Routing changes need two people", link: "/app/admin/" }));
      break;
  }
  return t;
}

export function ambassadorPlan(db: DB, me: User) {
  return weeklyPlan(db.tasks, db.orgs, me.id);
}

export function activityFor(db: DB, me: User, limit = 8) {
  return db.activity.filter((a) => a.actorId !== me.id).slice(0, limit);
}

export function unreadCount(db: DB, me: User) {
  return notificationsFor(db, me).filter((n) => !n.readBy.includes(me.id)).length;
}

export function greeting(now: number, tz = "America/New_York"): string {
  const h = Number(new Date(now).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: tz }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function tzFor(me: User): string {
  return me.scope.length === 1 && me.scope[0] === "CO" ? "America/Denver" : "America/New_York";
}
