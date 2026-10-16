"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Bell, BookOpen, Bot, Building2, Building, ChartColumnBig, Gauge, HeartHandshake, Inbox, Lock, Megaphone, Menu, PhoneIncoming, QrCode, Radar, Rocket, ScrollText,
  Settings, ShieldCheck, LogOut, Presentation, RotateCcw, Check, X, Activity, LayoutDashboard, Mail, UserCog, FileText, Eye, Timer, Map as MapIcon, Sprout, Lightbulb, Network, Calculator, Route, MessageCircleQuestion,
} from "lucide-react";
import { LiveControls } from "@/components/live/live-controls";
import { isSimUser } from "@/lib/live/seed";
import { useStore, onRemoteChange } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { MODULES, PAGES, ROLE_LABEL, accessForUser, href, landingFor, pageForPath, rolesThatCanOpen, DASHBOARD_NAME, type PageDef } from "@/lib/access";
import { audit, notificationsFor } from "@/lib/services/core";
import { rememberPage } from "@/lib/services/account";
import { escalateOverdue } from "@/lib/services/referrals";
import { clockFor } from "@/lib/rules/clock";
import { auth, account } from "@/mock-api";
import { latencyMs } from "@/mock-api/http";
import { ZoneBadge } from "@/components/domain/chips";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverClose, Switch, Dialog } from "@/components/ui/overlays";
import { cn } from "@/components/ui/cn";
import { ago } from "@/lib/format";
import { useGuide } from "./guide-bar";
import { GlobalSearch } from "./global-search";
import { switchPersona } from "@/lib/services/core";
import { Avatar, Logo, PageSkeleton, SyntheticNotice } from "@/components/brand/brand";
import type { Role, User } from "@/lib/domain/types";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  LayoutDashboard, Radar, Building2, Building, Megaphone, QrCode, Inbox, FileText, PhoneIncoming, Gauge, BookOpen, ChartColumnBig, Rocket, HeartHandshake, ScrollText, Bot, ShieldCheck, Settings, Activity, Bell, Mail, UserCog, Map: MapIcon, Sprout, Lightbulb, Network, Calculator, Route, MessageCircleQuestion,
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const user = useCurrentUser();
  const session = useStore((s) => s.db.session);
  const onboarded = useStore((s) => (user ? Boolean(s.db.accounts?.[user.id]?.onboardedAt) : true));
  const mutate = useStore((s) => s.mutate);
  const page = pageForPath(pathname);
  const live = useStore((s) => Boolean(s.db.live));
  const [mobileOpen, setMobileOpen] = useState(false);

  // Session guard (AC-FR-18: after sign-out, Back never shows app pages).
  useEffect(() => {
    if (!user) router.replace("/");
    else if (!onboarded && (session?.method === "password" || session?.method === "sso")) router.replace("/welcome/");
  }, [user, onboarded, session?.method, router]);

  // Simulated page request: a short skeleton on every navigation (FT-021, AC-FR-15).
  const routeKey = `${pathname}?${search.toString()}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setLoadedKey(routeKey), latencyMs(100, 220));
    return () => clearTimeout(t);
  }, [routeKey]);

  // Audit page views and denials; remember the last page per account (FT-014).
  const lastLogged = useRef<string>("");
  const access = page && user ? accessForUser(page, user) : "full";
  useEffect(() => {
    if (!user || !page) return;
    const key = `${user.id}:${routeKey}:${access}`;
    if (lastLogged.current === key) return;
    lastLogged.current = key;
    mutate((d) => {
      const guideNav = typeof window !== "undefined" ? (window as unknown as { __cvGuideNav?: number }).__cvGuideNav ?? 0 : 0;
      if (access === "none" && Date.now() - guideNav < 2500) return;
      if (access === "none") audit(d, { action: `Access denied: ${page.title}`, objectId: page.id, zone: page.zone, category: "access" });
      else {
        audit(d, { action: `Viewed ${page.title}`, objectId: search.get("id") ?? page.id, zone: page.zone, category: page.zone === "Care" ? "care" : undefined });
        rememberPage(d, user.id, routeKey);
      }
    }, undefined, { allowReadOnly: true });
  }, [user, page, access, mutate, routeKey, search]);

  // FT-087: clock check on load and every minute; the first breach escalates once to the intake supervisor.
  useEffect(() => {
    if (!user || user.readOnly || live) return;
    const check = () => {
      const st = useStore.getState();
      const t = Date.now();
      const due = st.db.referrals.some((r) => !r.escalatedAt && r.status === "New" && clockFor(r, t, st.db.demo.clockMode, st.db.sla.find((x) => x.state === r.state)).state === "overdue");
      if (due) st.mutate((d) => { escalateOverdue(d, t); }, { entity: "referral", action: "escalated" }, { allowReadOnly: true });
    };
    check();
    const i = setInterval(check, 60_000);
    return () => clearInterval(i);
  }, [user, live]);

  // Live arrival toasts for intake roles.
  useEffect(() => {
    return onRemoteChange((m) => {
      if (m.entity === "referral" && m.action === "created" && user && (user.role === "intake" || user.role === "intake_sup")) {
        toast.success(`New referral ${m.id}`, { description: "Clock started. Open the Intake Queue to act on it." });
      }
    });
  }, [user]);

  if (!user) return null;
  const ready = loadedKey === routeKey;

  return (
    <div className="min-h-screen">
      <TopBar user={user} onMenu={() => setMobileOpen(true)} live={live} />
      <div className="lg:grid lg:grid-cols-[248px_1fr]">
        <Sidebar user={user} current={page} live={live} className="hidden lg:flex" />
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-cv-ink/40" onClick={() => setMobileOpen(false)} />
            <Sidebar user={user} current={page} live={live} className="relative z-10 flex h-full w-72 shadow-xl" onNavigate={() => setMobileOpen(false)} mobile />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-col">
          <ContextBar page={page} user={user} live={live} />
          <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {page?.liveOnly && !live ? <LiveOnly /> : page && access === "none" ? <AccessRestricted page={page} user={user} /> : ready ? <div key={user?.id ?? "anon"} className="contents">{children}</div> : <PageSkeleton />}
          </main>
          <IdleGuard />
        </div>
      </div>
    </div>
  );
}

function navItems(user: User, live: boolean) {
  return PAGES.filter((p) => p.inMenu !== false && p.id !== "PG-06" && (!p.liveOnly || live) && accessForUser(p, user) !== "none");
}

function Sidebar({ user, current, live, className, onNavigate, mobile }: { user: User; current?: PageDef; live: boolean; className?: string; onNavigate?: () => void; mobile?: boolean }) {
  const items = navItems(user, live);
  const isActive = (p: PageDef) => current?.id === p.id || (p.id === "PG-08" && current?.id === "PG-09") || (p.id === "PG-14" && current?.id === "PG-15");
  return (
    <aside className={cn("top-[64px] h-[calc(100vh-64px)] flex-col border-r border-line bg-surface lg:sticky", mobile && "top-0 h-full", className)} aria-label="Main navigation">
      {mobile ? (
        <div className="flex h-16 items-center bg-teal px-5">
          <Logo variant="white" width={140} />
        </div>
      ) : null}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-4">
        <Link
          href={href(landingFor(user.role, live))}
          onClick={onNavigate}
          className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium", current?.id === "PG-06" ? "bg-teal-tint text-teal-strong" : "text-ink-2 hover:bg-sunken hover:text-ink")}
          aria-current={current?.id === "PG-06" ? "page" : undefined}
        >
          <LayoutDashboard size={17} className={current?.id === "PG-06" ? "text-teal" : ""} />
          <span className="flex-1 leading-tight">
            {live ? "Live Operations" : "My dashboard"}
            {!live ? <span className="block text-[11px] font-normal text-ink-3">{DASHBOARD_NAME[user.role]}</span> : null}
          </span>
        </Link>
        {MODULES.map((m) => {
          const list = items.filter((p) => p.module === m);
          if (!list.length) return null;
          return (
            <div key={m} className="mt-4">
              <p className="px-3 pb-1 text-xs font-semibold text-ink-3">{m}</p>
              <ul>
                {list.map((p) => {
                  const Icon = ICONS[p.icon] ?? Building2;
                  const active = isActive(p);
                  const view = accessForUser(p, user) === "read";
                  return (
                    <li key={p.id}>
                      <Link
                        href={href(p.route)}
                        onClick={onNavigate}
                        className={cn("flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm", active ? "bg-teal-tint font-semibold text-teal-strong" : "text-ink-2 hover:bg-sunken hover:text-ink")}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon size={16} className={cn(active ? (p.zone === "Care" ? "text-care" : "text-teal") : "text-ink-3")} />
                        <span className="flex-1 truncate">{p.title}</span>
                        {view ? <Eye size={13} className="text-ink-3" aria-label="View only" /> : null}
                        {p.zone === "Care" ? <Lock size={12} className="text-care" aria-label="Care Zone: client data" /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-line-2 px-5 py-3">
        <SyntheticNotice live={live} />
      </div>
    </aside>
  );
}

function TopBar({ user, onMenu, live }: { user: User; onMenu: () => void; live: boolean }) {
  return (
    <header className="no-print sticky top-0 z-40 bg-teal text-white">
      <div className="flex h-16 items-center gap-1 px-2 sm:gap-3 sm:px-5">
        <button className="rounded-full p-2 hover:bg-white/15 lg:hidden" onClick={onMenu} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <Link href={href(landingFor(user.role, live))} className="shrink-0 rounded-md" aria-label="Clarvida Referral Co-Pilot, go to my dashboard">
          <Logo variant="white" width={140} />
        </Link>
        <span className="hidden border-l border-white/30 pl-3 text-sm font-medium text-white md:inline">Referral Co-Pilot</span>
        <div className="flex-1" />
        {live ? <LiveControls /> : <DemoMenu />}
        {/* Phones keep the logo at its 140 px minimum, so search lives in the menu there. */}
        <div className="hidden sm:block"><GlobalSearch user={user} /></div>
        <InboxButton user={user} />
        <NotificationsBell user={user} />
        <AccountMenu user={user} />
      </div>
    </header>
  );
}

/** Second row: where am I (zone), my scope, the synthetic-data notice, and IDs only in Explain mode. */
function ContextBar({ page, user, live }: { page?: PageDef; user: User; live: boolean }) {
  const explain = useStore((s) => s.db.demo.showBrdTags);
  return (
    <div className="no-print border-b border-line bg-cv-ice">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-2 px-4 py-1.5 sm:px-6 lg:px-8">
        {page ? <ZoneBadge zone={page.zone} compact /> : null}
        <Badge tone="outline" className="hidden sm:inline-flex">
          {user.scope.includes("ALL") ? "All states" : user.scope.join(" and ")}
        </Badge>
        {user.readOnly ? <Badge tone="hl" icon={<Eye size={12} />}>Read-only guest</Badge> : null}
        {explain && page ? <Badge tone="outline" className="hidden font-mono text-[0.7rem] md:inline-flex">{page.id} · {page.brd}</Badge> : null}
        <div className="flex-1" />
        <SyntheticNotice live={live} className="hidden sm:block" />
      </div>
    </div>
  );
}

function InboxButton({ user }: { user: User }) {
  const unread = useStore((s) => s.db.outbox?.filter((m) => m.toUserId === user.id && !m.readBy.includes(user.id)).length ?? 0);
  if (user.role === "partner") return null;
  return (
    <Link href="/app/inbox/" className="relative rounded-full p-2 hover:bg-white/15" aria-label={`Demo Inbox, ${unread} unread`}>
      <Mail size={19} />
      {unread ? <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-cv-amber px-1 text-center text-[10px] font-bold leading-4 text-cv-ink">{unread > 9 ? "9+" : unread}</span> : null}
    </Link>
  );
}

function NotificationsBell({ user }: { user: User }) {
  const db = useStore((s) => s.db);
  const router = useRouter();
  const now = useNow(30_000);
  const list = useMemo(() => notificationsFor(db, user).slice(0, 8), [db, user]);
  const unread = notificationsFor(db, user).filter((n) => !n.readBy.includes(user.id)).length;
  if (user.role === "partner") return null;
  return (
    <Popover
      trigger={
        <button className="relative rounded-full p-2 hover:bg-white/15" aria-label={`Notifications, ${unread} unread`}>
          <Bell size={19} />
          {unread ? <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-cv-amber px-1 text-center text-[10px] font-bold leading-4 text-cv-ink">{unread > 9 ? "9+" : unread}</span> : null}
        </button>
      }
      className="w-[min(24rem,calc(100vw-1.5rem))] p-0"
    >
      <div className="flex items-center justify-between border-b border-line-2 px-4 py-2.5">
        <p className="text-sm font-semibold">Notifications</p>
        <button className="text-xs font-medium text-cv-link hover:underline disabled:text-ink-3 disabled:no-underline" disabled={!unread} onClick={() => account.markRead(notificationsFor(db, user).map((n) => n.id))}>
          Mark all read
        </button>
      </div>
      <ul className="max-h-96 overflow-y-auto" aria-live="polite">
        {list.length === 0 ? <li className="px-4 py-6 text-center text-sm text-ink-3">You&apos;re all caught up.</li> : null}
        {list.map((n) => {
          const isUnread = !n.readBy.includes(user.id);
          return (
            <li key={n.id}>
              <PopoverClose asChild>
                <button
                  className="flex w-full items-start gap-2 border-b border-line-2 px-4 py-2.5 text-left hover:bg-canvas"
                  onClick={() => {
                    void account.markRead([n.id]);
                    router.push(n.link);
                  }}
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", isUnread ? "bg-cv-amber" : "bg-transparent")} aria-hidden />
                  <span>
                    <span className={cn("block text-sm", isUnread ? "font-semibold text-ink" : "text-ink-2")}>{n.text}</span>
                    <span className="text-xs text-ink-3">{ago(n.at, now)}</span>
                  </span>
                </button>
              </PopoverClose>
            </li>
          );
        })}
      </ul>
      <div className="p-2">
        <PopoverClose asChild>
          <Link href="/app/notifications/" className="block rounded-lg px-2 py-2 text-center text-sm font-medium text-cv-link hover:bg-canvas">See all notifications</Link>
        </PopoverClose>
      </div>
    </Popover>
  );
}

function AccountMenu({ user }: { user: User }) {
  const users = useStore((s) => s.db.users);
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  return (
    <Popover
      trigger={
        <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 hover:bg-white/15 sm:pr-3" aria-label="Account menu">
          <Avatar initials={user.initials} tone={user.avatarTone === "teal" ? "navy" : user.avatarTone} size={34} className="ring-2 ring-white/60" />
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-semibold">{user.name}</span>
            <span className="block text-xs text-white">{ROLE_LABEL[user.role]}</span>
          </span>
        </button>
      }
      className="w-[min(20rem,calc(100vw-1.5rem))] p-0"
    >
      <div className="flex items-center gap-3 border-b border-line-2 px-4 py-3">
        <Avatar initials={user.initials} tone={user.avatarTone} size={40} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-ink-3">{ROLE_LABEL[user.role]}</p>
          <p className="truncate text-xs text-ink-3">{user.email}</p>
        </div>
      </div>
      {switching ? (
        <div>
          <p className="px-4 pb-1 pt-3 text-xs font-semibold text-ink-3">Switch account (demo)</p>
          <ul className="max-h-[50vh] overflow-y-auto pb-1">
            {users.filter((u) => u.active && !isSimUser(u.id)).map((u) => (
              <li key={u.id}>
                <PopoverClose asChild>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-canvas"
                    onClick={async () => {
                      if (u.id === user.id) return;
                      await auth.switchAccount(u.id);
                      router.push(href(landingFor(u.role, false)));
                      toast.success(`Signed in as ${u.name}`);
                    }}
                  >
                    <Avatar initials={u.initials} tone={u.avatarTone} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{u.name}</span>
                      <span className="block truncate text-xs text-ink-3">{ROLE_LABEL[u.role]}</span>
                    </span>
                    {u.id === user.id ? <Check size={16} className="text-teal" /> : null}
                  </button>
                </PopoverClose>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="py-1 text-sm">
          <li>
            <PopoverClose asChild>
              <Link href="/app/settings/" className="flex items-center gap-2.5 px-4 py-2 hover:bg-canvas"><UserCog size={16} className="text-ink-3" /> Profile and Settings</Link>
            </PopoverClose>
          </li>
          {user.role !== "partner" ? (
            <>
              <li>
                <PopoverClose asChild>
                  <Link href="/app/inbox/" className="flex items-center gap-2.5 px-4 py-2 hover:bg-canvas"><Mail size={16} className="text-ink-3" /> Demo Inbox</Link>
                </PopoverClose>
              </li>
              <li>
                <PopoverClose asChild>
                  <Link href="/app/notifications/" className="flex items-center gap-2.5 px-4 py-2 hover:bg-canvas"><Bell size={16} className="text-ink-3" /> Notifications</Link>
                </PopoverClose>
              </li>
            </>
          ) : null}
          <li className="border-t border-line-2 px-4 pb-1 pt-2.5">
            {/* AC-FR-24: two clicks to switch (menu, then a face). The full list with roles is one step further. */}
            <p className="mb-1.5 flex items-center justify-between text-xs font-semibold text-ink-3">
              Switch account (demo)
              <button className="link text-xs font-medium" onClick={() => setSwitching(true)}>Show names</button>
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              {users.filter((u) => u.active && !isSimUser(u.id) && u.id !== user.id).map((u) => (
                <PopoverClose asChild key={u.id}>
                  <button
                    title={`${u.name}, ${ROLE_LABEL[u.role]}`}
                    aria-label={`Switch to ${u.name}, ${ROLE_LABEL[u.role]}`}
                    className="rounded-full focus-visible:outline-2 focus-visible:outline-teal"
                    onClick={async () => {
                      await auth.switchAccount(u.id);
                      router.push(href(landingFor(u.role, false)));
                      toast.success(`Signed in as ${u.name}`);
                    }}
                  >
                    <Avatar initials={u.initials} tone={u.avatarTone} size={34} />
                  </button>
                </PopoverClose>
              ))}
            </div>
          </li>
        </ul>
      )}
      <div className="border-t border-line-2 p-2">
        <PopoverClose asChild>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-ink-2 hover:bg-canvas"
            onClick={async () => {
              await auth.signOutNow();
              router.replace("/?signedout=1");
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </PopoverClose>
      </div>
    </Popover>
  );
}

/** FT-164 Scenario launcher: sign in as the right person on the right page for a 'what happens when...' moment. */
const SCENARIOS: { label: string; hint: string; userId: string; route: string; query?: Record<string, string> }[] = [
  { label: "A referral arrives by phone", hint: "Dana types it in and picks the source; it joins the same queue and clock.", userId: "u-dana", route: "/app/referral/new" },
  { label: "Who sees what", hint: "Pick any person and see exactly what reaches their screen.", userId: "u-chris", route: "/app/teams" },
  { label: "A referral goes overdue", hint: "Ray sees the escalation and can reassign it.", userId: "u-ray", route: "/app/referral", query: { id: "REF-NC-24806" } },
  { label: "A program is full", hint: "ABA is on waitlist: outreach for it is paused everywhere.", userId: "u-priya", route: "/app/capacity" },
  { label: "Someone pastes client details", hint: "Try it in Maria's draft: the guard blocks it and logs it.", userId: "u-maria", route: "/app/organization", query: { id: "o1", tab: "outreach" } },
];

function DemoMenu() {
  const demo = useStore((s) => s.db.demo);
  const mutate = useStore((s) => s.mutate);
  const reset = useStore((s) => s.reset);
  const router = useRouter();
  const { go } = useGuide();
  const [confirm, setConfirm] = useState(false);
  const sys = { allowReadOnly: true };
  return (
    <>
      <Popover
        trigger={
          <button className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/40 px-2.5 text-sm sm:px-3 font-semibold hover:bg-white/15" aria-label="Demo controls">
            <Presentation size={16} /> <span className="hidden sm:inline">Demo</span>
          </button>
        }
        className="w-80"
      >
        <p className="mb-2 text-sm font-semibold">Demo controls</p>
        <div className="space-y-3">
          <Button variant="cta" className="w-full justify-center" onClick={() => (demo.guideOn ? go(demo.step) : go(0, "pitch"))}>
            {demo.guideOn ? `Resume ${demo.tour === "journey" ? "referral tour" : "guided demo"} (step ${demo.step + 1})` : "Start the guided demo"}
          </Button>
          <Button variant="secondary" className="w-full justify-center" onClick={() => go(0, "journey")}>
            Follow one referral through every account
          </Button>
          <Button variant="secondary" className="w-full justify-center" onClick={() => window.open("/presenter/", "speaker", "width=560,height=820")}>
            Open presenter notes window
          </Button>
          <PopoverClose asChild>
            <Button variant="secondary" className="w-full justify-center" onClick={() => router.push(href("/app/answers"))}>
              Questions and Answers (judges' Q&amp;A)
            </Button>
          </PopoverClose>
          <Switch checked={demo.presenter} onCheckedChange={(v) => mutate((d) => { d.demo.presenter = v; if (v) d.demo.showBrdTags = false; }, undefined, sys)} label="Presenter mode (larger type, arrow keys)" />
          <Switch checked={demo.showBrdTags} onCheckedChange={(v) => mutate((d) => { d.demo.showBrdTags = v; }, undefined, sys)} label="Explain mode (show page and feature IDs)" />
          <div>
            <p className="mb-1 text-xs font-medium text-ink-2">Response clock</p>
            <div className="flex gap-1">
              {(["demo", "business"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => mutate((d) => { d.demo.clockMode = m; }, undefined, sys)}
                  className={cn("flex-1 rounded-full border px-2 py-1.5 text-xs font-medium", demo.clockMode === m ? "border-teal bg-teal-tint text-teal-strong" : "border-line text-ink-2")}
                >
                  {m === "demo" ? "Demo: continuous" : "Business hours"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-ink-2">Scenarios: one click to set the scene</p>
            <div className="grid gap-1">
              {SCENARIOS.map((sc) => (
                <PopoverClose asChild key={sc.label}>
                  <button
                    className="rounded-md border border-line px-2.5 py-1.5 text-left text-sm hover:bg-canvas"
                    onClick={() => {
                      mutate((d) => { d.demo.guideOn = false; if (d.session?.userId !== sc.userId) switchPersona(d, sc.userId); }, undefined, sys);
                      router.push(href(sc.route, sc.query));
                      toast.info(sc.label, { description: sc.hint });
                    }}
                  >
                    <span className="font-medium">{sc.label}</span>
                    <span className="block text-xs text-ink-2">{sc.hint}</span>
                  </button>
                </PopoverClose>
              ))}
            </div>
          </div>
          <Button variant="secondary" size="sm" className="w-full justify-center" onClick={() => window.dispatchEvent(new Event("cv-idle-test"))}>
            <Timer size={15} /> Idle test (show the sign-out warning)
          </Button>
          <Button variant="danger" className="w-full justify-center" onClick={() => setConfirm(true)}>
            <RotateCcw size={15} /> Reset demo world
          </Button>
        </div>
      </Popover>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Reset the demo world?"
        description="Every page and account goes back to its starting state. Referrals, approvals and audit entries made during the demo are cleared, and everyone is signed out."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                reset();
                setConfirm(false);
                toast.success("Demo world restored");
                router.push("/");
              }}
            >
              Reset demo world
            </Button>
          </>
        }
      />
    </>
  );
}

function LiveOnly() {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-line bg-surface px-6 py-10 text-center">
      <h1 className="text-xl">Part of the Live sandbox</h1>
      <p className="mt-2 text-sm text-ink-2">Live Operations shows the simulation running on its own. The pitch demo keeps its own scripted data.</p>
      <a href="/live/" className="mt-5 inline-flex h-10 items-center rounded-full bg-teal px-5 text-sm font-semibold text-white hover:bg-teal-strong">Open the Live sandbox</a>
    </div>
  );
}

function AccessRestricted({ page, user }: { page: PageDef; user: User }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-line bg-surface px-6 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sunken">
        <Lock size={22} className="text-ink-2" />
      </div>
      <h1 className="mt-4 text-xl">Access restricted</h1>
      <p className="mt-2 text-sm text-ink-2">
        {page.title} is for: {rolesThatCanOpen(page)}. You are signed in as {ROLE_LABEL[user.role as Role]}.
      </p>
      <p className="mt-1 text-xs text-ink-3">This attempt was recorded in the audit log.</p>
      <Link href={href(landingFor(user.role, false))} className="mt-5 inline-flex h-10 items-center rounded-full bg-teal px-5 text-sm font-semibold text-white hover:bg-teal-strong">
        Go to my dashboard
      </Link>
    </div>
  );
}

/** Automatic sign-out after inactivity (FT-010). Paused while the guided demo or presenter mode is on. "Idle test" shows the warning at once. */
function IdleGuard() {
  const demo = useStore((s) => s.db.demo);
  const mutate = useStore((s) => s.mutate);
  const router = useRouter();
  const [warnLeft, setWarnLeft] = useState<number | null>(null);
  const last = useRef(Date.now());
  const forced = useRef<number | null>(null);
  const paused = demo.guideOn || demo.presenter;

  useEffect(() => {
    const bump = () => { last.current = Date.now(); };
    const evs = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    // Idle test: jump to 20 seconds before automatic sign-out.
    // The warning is forced on a fixed 20-second deadline, so the click that triggered it doesn't count as activity.
    const test = () => { forced.current = Date.now() + 20_000; setWarnLeft(20); };
    window.addEventListener("cv-idle-test", test);
    return () => { evs.forEach((e) => window.removeEventListener(e, bump)); window.removeEventListener("cv-idle-test", test); };
  }, [demo.idleMinutes]);

  useEffect(() => {
    if (paused) { setWarnLeft(null); return; }
    const limit = demo.idleMinutes * 60_000;
    const t = setInterval(() => {
      const idle = Date.now() - last.current;
      const left = forced.current ? Math.ceil((forced.current - Date.now()) / 1000) : Math.ceil((limit - idle) / 1000);
      if (left <= 0) {
        clearInterval(t);
        void auth.signOutNow("idle").then(() => router.replace("/?idle=1"));
      } else if (left <= 60) setWarnLeft(left);
      else setWarnLeft(null);
    }, 1000);
    return () => clearInterval(t);
  }, [paused, demo.idleMinutes, router]);

  return (
    <Dialog
      open={warnLeft !== null}
      onOpenChange={(o) => { if (!o) { forced.current = null; last.current = Date.now(); setWarnLeft(null); } }}
      title="Are you still there?"
      description={`For your security, you'll be signed out in ${warnLeft ?? 0} seconds.`}
      footer={
        <>
          <Button variant="secondary" onClick={() => { void auth.signOutNow().then(() => router.replace("/")); }}>
            <X size={15} /> Sign out now
          </Button>
          <Button onClick={() => { forced.current = null; last.current = Date.now(); setWarnLeft(null); mutate((d) => audit(d, { action: "Session extended", zone: "Identity", category: "sign-in" }), undefined, { allowReadOnly: true }); }}>
            Stay signed in
          </Button>
        </>
      }
    />
  );
}
