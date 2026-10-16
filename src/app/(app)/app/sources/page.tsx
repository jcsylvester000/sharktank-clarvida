"use client";
import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowDown, ArrowRight, Baby, ClipboardPlus, Eye, FileText, Footprints, Globe, Handshake, HandHeart, Hospital, House, Phone, PhoneCall, Printer, QrCode, Scale, School, Send, Stethoscope,
} from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser } from "@/lib/store/hooks";
import { scoped } from "@/mock-api/scope";
import { accessForUser, href, pageById } from "@/lib/access";
import { ORG_TO_SRC } from "@/lib/domain/source";
import type { SourceType } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Callout, PageHeader } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";

type Icon = React.ComponentType<{ size?: number; className?: string }>;

const SOURCES: { type: SourceType; label: string; who: string; example: string; icon: Icon }[] = [
  { type: "School", label: "Schools", who: "School counselors, student services, social workers", example: "A counselor notices a student withdrawing after a family crisis.", icon: School },
  { type: "Child welfare", label: "Child welfare", who: "County DSS / DHHS caseworkers", example: "A caseworker needs in-home support or a foster placement for a child.", icon: Baby },
  { type: "Hospital / clinician", label: "Hospitals and crisis teams", who: "ER staff, discharge planners, crisis services", example: "A teen is discharged after a crisis and needs follow-up care this week.", icon: Hospital },
  { type: "Primary care", label: "Doctors", who: "Pediatricians, primary care, public health", example: "A pediatrician screens a child for anxiety and needs a therapist.", icon: Stethoscope },
  { type: "Health plan care manager", label: "Health plans", who: "Medicaid plan care managers", example: "A care manager looks for an in-network provider with openings.", icon: ClipboardPlus },
  { type: "Court / legal", label: "Courts and justice", who: "Juvenile court counselors, child advocacy centers", example: "A court counselor orders an assessment for a young person.", icon: Scale },
  { type: "Community / faith", label: "Community groups", who: "Nonprofits, churches, early-childhood programs", example: "A pastor connects a struggling family with services.", icon: HandHeart },
  { type: "Family / self", label: "Families", who: "Parents, guardians, adults referring themselves", example: "A parent finds Clarvida online or hears about it from a friend.", icon: House },
];

const CHAIN: { title: string; text: string; icon: Icon; hl?: boolean }[] = [
  { title: "Outreach visit or partnership", text: "An ambassador visit, a school district agreement or a county contract.", icon: Handshake },
  { title: "One-pager or flyer", text: "“How to refer” sheets, school and partner one-pagers, FAQs, some with a QR code.", icon: FileText, hl: true },
  { title: "A professional spots a need", text: "Counselor, caseworker, doctor or discharge planner.", icon: Eye },
  { title: "Web form or phone", text: "Today’s website form asks for name, email and a message. Pennsylvania also has a phone line.", icon: Send },
  { title: "Intake calls the family", text: "Pennsylvania flyers promise contact “within 1 business day.”", icon: PhoneCall },
];

const LIFECYCLE: { status: string; meaning: string; referrer: string }[] = [
  { status: "New", meaning: "Arrived, routed to an office queue; the 1-business-day clock is running", referrer: "Received" },
  { status: "Contacted", meaning: "Intake reached the family (or logged attempts)", referrer: "Contacted" },
  { status: "Accepted / Hold / Redirected", meaning: "Fits a program; waiting for an opening; or warmly passed to another provider", referrer: "In outreach / On hold / Redirected" },
  { status: "Intake scheduled / completed", meaning: "First appointment booked, then held", referrer: "Contacted" },
  { status: "Closed", meaning: "Services started, or the referral ended with a reason", referrer: "Closed" },
];

export default function SourcesPage() {
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const view = useMemo(() => scoped(db, me), [db, me]);
  const orgsByType = useMemo(() => {
    const m = new Map<SourceType, string[]>();
    for (const o of view.orgs) {
      const t = ORG_TO_SRC[o.type];
      if (!t) continue;
      m.set(t, [...(m.get(t) ?? []), o.name]);
    }
    return m;
  }, [view.orgs]);
  const can = (id: string) => accessForUser(pageById(id), me) !== "none";
  const lk = (id: string, route: string, label: string, query?: Record<string, string>) =>
    can(id) ? <Link className="font-medium text-teal-strong hover:underline" href={href(route, query)}>{label}</Link> : <span className="text-ink-3">{label} (intake only)</span>;

  const CHANNELS: { icon: Icon; name: string; who: string; how: string; where: React.ReactNode; isNew?: boolean }[] = [
    { icon: QrCode, name: "Partner link or QR code", who: "Any partner with a kit", how: "One-minute branded form. The partner's organization is filled in from the code, so the source is captured automatically.", where: <>{lk("PG-13", "/app/kits", "Partner Kits and QR")} · <Link className="font-medium text-teal-strong hover:underline" href={href("/partner/refer", { code: "GCS-NC-2026" })}>Open the partner form</Link></>, isNew: true },
    { icon: Phone, name: "Phone", who: "Partners and families", how: "Intake types it in while on the call and picks the source from a list.", where: lk("PG-16", "/app/referral/new", "New referral (phone / fax)") },
    { icon: Printer, name: "Fax and email", who: "Hospitals, courts, schools with their own forms", how: "Intake types it in from the fax or email and records the sender as the source.", where: lk("PG-16", "/app/referral/new", "New referral (phone / fax)") },
    { icon: Globe, name: "Statewide referral platform", who: "Agencies already using e.g. NCCARE360 (NC)", how: "Arrives through an integration in production; shown in the Live sandbox as ‘Statewide platform’.", where: <Link className="font-medium text-teal-strong hover:underline" href="/live/">Live sandbox</Link> },
    { icon: Footprints, name: "Walk-in", who: "Families at a Clarvida office", how: "Front desk or intake enters it; source is ‘Family / self’ or whoever sent them.", where: lk("PG-16", "/app/referral/new", "New referral (phone / fax)") },
  ];

  return (
    <div>
      <PageHeader
        title="Where Referrals Come From"
        description="Who sends families to Clarvida, why, how a referral starts today, and how every channel ends up in one Co-Pilot queue with its source."
        meta={<Badge tone="lightsky">Start here</Badge>}
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]" data-guide="referral-basics">
        <Callout tone="teal" title="What a referral is">
          Someone who already works with a person (a school counselor, a caseworker, a doctor) decides that this child, family or adult needs Clarvida, and passes them on. Almost every client starts this way.
        </Callout>
        <Callout tone="care" title="Why referrals matter">
          Clarvida&apos;s services are mostly Medicaid-funded and people usually reach them because a professional spots the need. Referrals are the front door: about 54,000 clients a year today, with a goal of 180,000 a year by 2030 (Clarvida, self-reported).
        </Callout>
      </div>

      <Panel className="mb-5" data-guide="referral-sources">
        <PanelHeader title="1. Who refers" description="Eight kinds of referral sources. Counts are partner organizations in your territory in this prototype's data." />
        <PanelBody>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {SOURCES.map((s) => {
              const orgs = orgsByType.get(s.type) ?? [];
              const I = s.icon;
              return (
                <div key={s.type} className="rounded-lg border border-line px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal text-white"><I size={18} /></span>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{s.label}</p>
                      <p className="text-xs text-ink-3">{s.type === "Family / self" ? "No partner organization" : `${orgs.length} partner ${orgs.length === 1 ? "organization" : "organizations"}`}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-ink-2">{s.who}</p>
                  <p className="mt-1 text-sm italic text-ink-2">{s.example}</p>
                  {orgs.length ? <p className="mt-1.5 truncate text-xs text-ink-3" title={orgs.join(", ")}>e.g. {orgs.slice(0, 2).join("; ")}</p> : null}
                </div>
              );
            })}
          </div>
        </PanelBody>
      </Panel>

      <Panel className="mb-5" data-guide="referral-start">
        <PanelHeader title="2. How a referral starts today" description="From Clarvida's own website and Pennsylvania referral flyers (accessed Oct 17, 2026)." />
        <PanelBody>
          <ol className="grid gap-3 md:grid-cols-5">
            {CHAIN.map((c, i) => {
              const I = c.icon;
              return (
                <li key={c.title} className={cn("relative rounded-lg border px-3.5 py-3", c.hl ? "border-hl bg-hl-tint" : "border-line bg-teal-tint")}>
                  <div className="flex items-center justify-between">
                    <span className={cn("grid size-8 place-items-center rounded-full", c.hl ? "bg-hl text-cv-navy" : "bg-teal text-white")}><I size={16} /></span>
                    <span className="font-display text-lg font-semibold text-teal-strong">{i + 1}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-ink">{c.title}</p>
                  <p className="mt-1 text-sm text-ink-2">{c.text}</p>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-line px-4 py-3 text-sm">
              <p className="font-semibold text-ink">The gap today</p>
              <p className="mt-1 text-ink-2">Every flyer and QR code leads to the same generic form, so nobody records which school or caseworker sent the family, and the referrer rarely hears back.</p>
            </div>
            <div className="rounded-lg bg-cv-navy px-4 py-3 text-sm text-white">
              <p className="font-semibold text-cv-amber">With the Co-Pilot</p>
              <p className="mt-1 text-white/90">The same flyers carry each partner&apos;s own coded link and QR code, so the source is captured automatically, and the 1-business-day promise becomes a tracked clock with escalation.</p>
            </div>
          </div>
        </PanelBody>
      </Panel>

      <Panel className="mb-5" data-guide="referral-channels">
        <PanelHeader title="3. How a referral gets into the Co-Pilot" description="Five ways in, one queue out. Whatever the channel, the referral carries its source." />
        <PanelBody className="px-0 py-0">
          <Table label="Referral channels">
            <THead><tr><TH>Channel</TH><TH>Who uses it</TH><TH>How it enters</TH><TH>Where in the app</TH></tr></THead>
            <tbody>
              {CHANNELS.map((c) => {
                const I = c.icon;
                return (
                  <TR key={c.name}>
                    <TD><span className="inline-flex items-center gap-2 font-medium text-ink"><I size={16} className="text-teal" /> {c.name}</span>{c.isNew ? <Badge tone="hl" className="ml-2">New</Badge> : null}</TD>
                    <TD className="text-ink-2">{c.who}</TD>
                    <TD className="text-ink-2">{c.how}</TD>
                    <TD>{c.where}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </PanelBody>
        <div className="flex flex-col items-center gap-2 border-t border-line-2 px-5 py-4 text-sm sm:flex-row sm:justify-center">
          <span className="rounded-full bg-cv-navy px-3 py-1.5 font-semibold text-white">One intake queue: source tagged · right office and program · 1-business-day clock</span>
          <ArrowRight size={16} className="hidden text-ink-3 sm:block" /><ArrowDown size={16} className="text-ink-3 sm:hidden" />
          <span className="rounded-full bg-teal-tint px-3 py-1.5 font-semibold text-ink">Family called · referrer told · partner credited</span>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Panel data-guide="referral-lifecycle">
          <PanelHeader title="4. What happens to a referral" description="What intake works with, and the plain words the referrer sees (no client details)." />
          <PanelBody className="px-0 py-0">
            <Table label="Referral lifecycle">
              <THead><tr><TH>Status</TH><TH>What it means</TH><TH>Referrer sees</TH></tr></THead>
              <tbody>
                {LIFECYCLE.map((l) => (
                  <TR key={l.status}><TD className="font-medium">{l.status}</TD><TD className="text-ink-2">{l.meaning}</TD><TD><Badge tone="outline">{l.referrer}</Badge></TD></TR>
                ))}
              </tbody>
            </Table>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="5. Where the ambassador fits" />
          <PanelBody>
            <p className="text-sm text-ink-2"><span className="font-semibold text-ink">Ambassadors don&apos;t make referrals.</span> They win and keep the people who do:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
              <li>find the right partners: {lk("PG-07", "/app/finder", "Gatekeeper Finder")}, {lk("PG-35", "/app/map", "Map Explorer")}</li>
              <li>brief and reach them: Organization pages, AI draft with approval</li>
              <li>hand over a kit with the partner&apos;s own link: {lk("PG-13", "/app/kits", "Partner Kits and QR")}</li>
              <li>keep them warm: {lk("PG-10", "/app/nurture", "Nurture Journeys")}, {lk("PG-12", "/app/events", "Relationship Events")}</li>
              <li>see who is sending families and who went quiet: {lk("PG-19", "/app/impact", "Impact Dashboard")}, {lk("PG-08", "/app/directory", "Partner Directory")}</li>
            </ul>
          </PanelBody>
        </Panel>
      </div>
      <p className="mt-4 text-xs text-ink-3">Clarvida facts from clarvida.com (Refer a Client page; Clarvida of Pennsylvania Resources and “How to Refer” flyers), accessed Oct 17, 2026. Partners, organizations and referrals in this prototype are synthetic.</p>
    </div>
  );
}
