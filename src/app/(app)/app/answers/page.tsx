"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { href, ROLE_LABEL } from "@/lib/access";
import { ACCOUNTS } from "@/lib/data/accounts";
import { signIn } from "@/lib/services/core";
import { switchMode } from "@/lib/mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";

interface QA { q: string; a: string; route: string; query?: Record<string, string>; as?: string | null; label: string }
const GROUPS: { title: string; items: QA[] }[] = [
  {
    title: "Referrals",
    items: [
      { q: "Where do referrals come from?", a: "From people who already work with a family: school counselors, county caseworkers, hospitals and crisis teams, doctors, Medicaid care managers, courts, community groups, and families themselves. Almost every Clarvida client starts with a referral.", route: "/app/sources", as: "u-maria", label: "Where Referrals Come From" },
      { q: "How does a referral start today, and what changes?", a: "Today it starts with a visit or partnership, then a flyer or one-pager. When the professional spots a need they use the website form (name, email, message) or call. Every flyer leads to the same form, so the source is lost. The Co-Pilot gives each partner its own coded link and QR, so the source is captured automatically.", route: "/app/sources", as: "u-maria", label: "How a referral starts" },
      { q: "How does a partner actually refer?", a: "They scan their QR code or open their link and fill a one-minute form. Their organization is filled in from the code. They get a reference number and no client data is ever shown back to them.", route: "/partner/refer", query: { code: "GCS-NC-2026" }, as: null, label: "Partner referral form" },
      { q: "What if someone phones, faxes or walks in?", a: "Intake types it in on the New referral screen and picks the source. It lands in the same queue with the same clock as an online referral.", route: "/app/referral/new", as: "u-dana", label: "New referral (phone / fax)" },
      { q: "How fast is the family contacted, and what if intake is late?", a: "The 1-business-day clock starts on arrival, in that state's business hours. When it runs out, the referral escalates to the intake supervisor by name.", route: "/app/intake", as: "u-ray", label: "Intake Queue (supervisor view)" },
      { q: "What does the person who referred see?", a: "Only plain status words (received, contacted, closed) with a reference number. Consent rules decide whether anything more can be shared; the consent simulator shows the difference between a school and a hospital.", route: "/app/referral", query: { id: "REF-NC-24811", panel: "consent" }, as: "u-dana", label: "Consent simulator" },
      { q: "How do we know which partners send families?", a: "Every referral carries its source, so the Impact Dashboard shows referrals and first contacts by partner, county and source type, and flags partners who have gone quiet.", route: "/app/impact", as: "u-alex", label: "Impact Dashboard" },
    ],
  },
  {
    title: "Outreach and field work",
    items: [
      { q: "How does an ambassador know who to visit?", a: "My Week ranks the week's actions: quiet partners, new high-fit organizations, relationship events and thank-you tasks. The Gatekeeper Finder explains every score.", route: "/app", as: "u-maria", label: "Maria's week" },
      { q: "How does field work and route planning work?", a: "The Map Explorer shows partners on OpenStreetMap with 5/10/25-mile rings and drive-time bands, plans a field-day route and records location-confirmed visit check-ins.", route: "/app/map", as: "u-maria", label: "Map Explorer" },
      { q: "What does the AI do, and what if it gets something wrong?", a: "It drafts briefs and emails from organization data only. The privacy guard blocks client details before anything reaches the model, and nothing is sent until a person approves it. Prompts are versioned and every call is logged.", route: "/app/organization", query: { id: "o1", tab: "outreach" }, as: "u-maria", label: "Brief, draft, approve" },
      { q: "How do partners stay engaged after the first visit?", a: "Nurture journeys send approved follow-ups and hand a warm partner back to the ambassador with talking points. Relationship events (mergers, new directors, Medicaid changes) turn into tasks.", route: "/app/nurture", as: "u-maria", label: "Nurture Journeys" },
      { q: "What happens when a program is full?", a: "The program manager marks it Waitlist or Closed on the Capacity Board. Outreach for that program pauses for every ambassador and intake is offered a warm redirect.", route: "/app/capacity", as: "u-priya", label: "Capacity Board" },
    ],
  },
  {
    title: "Teams, privacy and trust",
    items: [
      { q: "How are teams separated by city and state?", a: "Every record is tagged with state and county. Each person sees only their territory; directors and executives see roll-ups. Teams and Access shows exactly what any person can see.", route: "/app/teams", as: "u-chris", label: "Teams and Access" },
      { q: "Who can see client information?", a: "Only intake, intake supervisors and compliance. Marketing and leadership see counts, and counts under 11 are hidden. The Privacy X-ray shows the difference on one referral.", route: "/app/referral", query: { id: "REF-NC-24811", xray: "1" }, as: "u-sam", label: "Privacy X-ray" },
      { q: "Is everything logged?", a: "Yes: sign-ins, views, changes, exports, AI calls and blocked attempts, with who and when. Routing changes need a second administrator.", route: "/app/audit", as: "u-sam", label: "Audit Log" },
      { q: "What is real and what is simulated in this prototype?", a: "The rules are real code: sign-in, access by role and territory, clock, routing, escalation, consent, privacy guard, capacity pause, audit. The AI, email, database and single sign-on are simulated, and all people and data are made up.", route: "/app/trust", as: "u-chris", label: "Trust and Security" },
    ],
  },
  {
    title: "Results and scale",
    items: [
      { q: "How much staff time does it save?", a: "About 10.5 hours a week for each Brand Ambassador and 7.5 for each Intake Coordinator, in the expected case. Time and Value shows it per role, per state and company-wide, with a conservative setting.", route: "/app/value", as: "u-alex", label: "Time and Value" },
      { q: "What will the 90-day pilot prove?", a: "Known source on every referral, first contact within one business day, and referrers told within an hour, in Gastonia NC and Colorado Springs CO, with a go/no-go at week 13.", route: "/app/pilot", as: "u-alex", label: "Impact and Pilot" },
      { q: "Can we see it working with lots of referrals at once?", a: "The Live sandbox runs simulated teammates and arriving referrals in real time (from web forms, phone, fax and the statewide platform), separate from the demo data.", route: "/live", as: null, label: "Live sandbox" },
    ],
  },
];

export default function AnswersPage() {
  const router = useRouter();
  const mutate = useStore((s) => s.mutate);
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const n = q.trim().toLowerCase();
    return GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !n || (i.q + " " + i.a).toLowerCase().includes(n)) })).filter((g) => g.items.length);
  }, [q]);
  const name = (id?: string | null) => (id ? ACCOUNTS.find((a) => a.id === id) : undefined);

  const show = (i: QA) => {
    if (i.route === "/live") { switchMode("live", "/live/"); return; }
    (window as unknown as { __cvGuideNav?: number }).__cvGuideNav = Date.now();
    if (i.as) mutate((d) => { if (d.session?.userId !== i.as) signIn(d, i.as!, "guided", true); }, undefined, { allowReadOnly: true });
    router.push(href(i.route, i.query));
  };

  return (
    <div>
      <PageHeader
        title="Questions and Answers"
        description="Short answers to the questions judges and leaders ask, each with a 'Show me' button that opens the exact screen as the right person."
      />
      <div className="relative mb-5 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <Input aria-label="Search questions" placeholder="Search questions" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      <div className="space-y-5" data-guide="answers">
        {groups.map((g) => (
          <Panel key={g.title}>
            <PanelHeader title={g.title} />
            <PanelBody className="divide-y divide-line-2 py-0">
              {g.items.map((i) => {
                const who = name(i.as);
                return (
                  <details key={i.q} className="group py-3">
                    <summary className="cursor-pointer list-none font-medium text-ink marker:hidden">
                      <span className="inline-flex items-start gap-2"><ArrowRight size={16} className="mt-0.5 shrink-0 text-teal transition-transform group-open:rotate-90" />{i.q}</span>
                    </summary>
                    <div className="mt-2 pl-6">
                      <p className="text-sm text-ink-2">{i.a}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => show(i)}>Show me: {i.label}</Button>
                        <span className="text-xs text-ink-3">{who ? `Opens as ${who.name} (${ROLE_LABEL[who.role]})` : "Opens without signing in"}</span>
                      </div>
                    </div>
                  </details>
                );
              })}
            </PanelBody>
          </Panel>
        ))}
        {!groups.length ? <p className="text-sm text-ink-3">No question matches. Try another word.</p> : null}
      </div>
    </div>
  );
}
