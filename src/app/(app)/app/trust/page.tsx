"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ArrowRight, Eye, KeyRound, Lock, ScrollText, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser } from "@/lib/store/hooks";
import { href, accessForUser, pageById } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Tip } from "@/components/ui/overlays";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";

const OUTREACH = [
  ["Gatekeeper Finder", "Ranks organizations from public data and referral counts. Never sees a client."],
  ["Organization briefs (AI)", "Summaries built from organization data only; client details are blocked before the model."],
  ["Outreach drafts (AI)", "Drafts to organizations. A named person approves every message; sends go through the approved CRM."],
  ["Partner kits", "Coded links and QR codes so each referral carries its source."],
  ["Relationship events", "News that affects a partner (mergers, staff changes) turned into tasks."],
  ["Impact Dashboard", "Totals by source and state. Counts of 1–10 show as <11."],
  ["Ask the Co-Pilot", "Answers from aggregate tables; refuses questions about people."],
];
const CARE = [
  ["Partner referral form", "No trackers, analytics or third-party scripts. Strict content security policy."],
  ["Intake queue", "Routed by state, county and age. Only intake roles can open it."],
  ["Referral record", "Field-level encryption in production. Every reveal of a phone number is logged."],
  ["Response clock", "One business day target with automatic escalation."],
  ["Disclosure rules", "Tier 1 status for every referrer; Tier 2 detail only with a treatment relationship or signed release; Part 2 locks it."],
  ["Referrer status page", "Signed, expiring link. Shows status words only."],
];

const CLASSES: [string, string, string, string][] = [
  ["C0", "Public", "Organization names, addresses, public program descriptions", "Finder, Organization, Partner kits, Catalog"],
  ["C1", "Internal", "Aggregates, capacity status, audit entries, AI logs", "Impact, Capacity Board, Audit Log, AI Governance"],
  ["C2", "Confidential", "Partner contact names and business emails, relationship notes", "Organization contacts, Partner Directory"],
  ["C3", "PHI", "Guardian first name, phone, child's age, program, status", "Intake Queue, Referral (Care Zone only)"],
  ["C4", "Sensitive PHI", "Substance use (42 CFR Part 2) program referrals, concerns", "Referral with Part 2 lock (Care Zone only)"],
];

interface Control { id: string; control: string; basis: string; demo: string; prod: string; see?: { label: string; route: string; query?: Record<string, string> } }
const CONTROLS: Control[] = [
  { id: "SEC-01", control: "Business Associate Agreements with every vendor that touches client data", basis: "45 CFR 164.308(b), 164.314", demo: "Vendor register below", prod: "Signed BAAs before go-live", see: { label: "Register", route: "#vendors" } },
  { id: "SEC-02", control: "Risk analysis before go-live and every year", basis: "45 CFR 164.308(a)(1)", demo: "Not shown", prod: "Risk register kept by Compliance" },
  { id: "SEC-03", control: "Two zones; no third-party scripts where client data is entered", basis: "OCR tracking guidance", demo: "Purple Care Zone pages; partner form loads no trackers", prod: "Separate databases, CSP enforced", see: { label: "Partner form", route: "/partner/refer", query: { code: "GCS-NC-2026" } } },
  { id: "SEC-04", control: "Role-based access, least privilege, automatic sign-out", basis: "45 CFR 164.312(a)", demo: "Switch persona: pages lock by role; idle sign-out", prod: "SSO roles, row-level security, emergency access", see: { label: "Intake Queue", route: "/app/intake" } },
  { id: "SEC-05", control: "Append-only audit trail, reviewed regularly", basis: "45 CFR 164.312(b), 164.316", demo: "Every action in this demo is logged", prod: "Immutable store, six-year retention", see: { label: "Audit Log", route: "/app/audit" } },
  { id: "SEC-06", control: "Integrity: validation and recoverable data", basis: "45 CFR 164.312(c)", demo: "Form validation; reset restores a known state", prod: "Checksums, point-in-time recovery" },
  { id: "SEC-07", control: "Single sign-on with MFA; signed expiring links for referrers", basis: "45 CFR 164.312(d)", demo: "Simulated sign-in; status link by reference", prod: "Clarvida SSO with MFA", see: { label: "Sign-in", route: "/sign-in" } },
  { id: "SEC-08", control: "Encryption in transit and at rest, plus field-level encryption", basis: "45 CFR 164.312(a)(2)(iv), (e)", demo: "Masked phone until revealed (logged)", prod: "TLS 1.2+, AWS KMS, encrypted fields" },
  { id: "SEC-09", control: "42 CFR Part 2 handling for substance use referrals", basis: "42 CFR Part 2", demo: "Part 2 program locks Tier 2 detail", prod: "Flag, consent and breach handling", see: { label: "Consent simulator", route: "/app/referral", query: { id: "REF-NC-24813", panel: "consent" } } },
  { id: "SEC-10", control: "Minimum necessary: each role sees only the fields it needs", basis: "45 CFR 164.502(b)", demo: "Privacy X-ray shows who sees each field", prod: "Field-level views per role", see: { label: "Privacy X-ray", route: "/app/referral", query: { id: "REF-NC-24811", xray: "1" } } },
  { id: "SEC-11", control: "CAN-SPAM for partner email; no automated texts, robocalls or AI voice", basis: "CAN-SPAM, TCPA, FCC 2024 ruling", demo: "Unsubscribe footer, send caps, opt-outs", prod: "Sends through the approved CRM", see: { label: "Outreach", route: "/app/organization", query: { id: "o1", tab: "outreach" } } },
  { id: "SEC-12", control: "No AI communication with patients or families", basis: "State AI laws (CA, IL, CO)", demo: "AI only drafts to organizations", prod: "Policy and template review", see: { label: "AI Governance", route: "/app/ai-governance" } },
  { id: "SEC-13", control: "No incentives tied to referral volume", basis: "Anti-Kickback Statute; state laws", demo: "No rewards or gifts in any workflow", prod: "Policy review by Legal" },
  { id: "SEC-14", control: "Vulnerability management and penetration testing", basis: "Proposed HIPAA Security Rule (2025)", demo: "Not shown", prod: "Dependency scans, monthly patching, annual pen test" },
  { id: "SEC-15", control: "Incident response and breach notification plan", basis: "45 CFR 164.308(a)(6), 164.400–414", demo: "Blocked attempts notify Compliance", prod: "Tested yearly" },
  { id: "SEC-16", control: "Staff trained on the tool's privacy rules before access", basis: "45 CFR 164.308(a)(5)", demo: "Not shown", prod: "Training gate on first sign-in" },
  { id: "SEC-17", control: "Synthetic data outside production", basis: "HHS de-identification guidance", demo: "Every name here is marked synthetic", prod: "No production data in test systems" },
];

export default function TrustSecurity() {
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const router = useRouter();
  const latest = db.demo.lastPartnerRef ?? [...db.referrals].sort((a, b) => b.receivedAt - a.receivedAt)[0]?.id;
  const canOpenReferral = accessForUser(pageById("PG-15"), me) !== "none";

  const showXray = () => {
    router.push(href("/app/referral", { id: latest, xray: "1" }));
  };

  return (
    <div>
      <PageHeader
        title="Trust & Security"
        description="How client information is protected, in plain terms. Most controls below can be seen working in this prototype."
        meta={<Badge tone="outline" className="whitespace-normal">Not legal advice. Final controls are approved by Clarvida Compliance, Legal and Information Security.</Badge>}
        actions={
          canOpenReferral ? (
            <Button variant="care" onClick={showXray}><Eye size={15} /> Show Privacy X-ray on a live referral</Button>
          ) : (
            <Tip content="Referrals open for intake and compliance roles only. Switch persona to Sam (Compliance) to see it."><span><Button variant="secondary" disabled><Eye size={15} /> Show Privacy X-ray on a live referral</Button></span></Tip>
          )
        }
      />

      <Panel className="mb-5">
        <PanelHeader title="Two zones, one controlled crossing" description="Outreach work never touches client data. Only counts and status codes cross from the Care Zone." />
        <PanelBody>
          <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <ZoneBox tone="teal" title="Outreach Zone" sub="No client data. AI allowed on organization data only." items={OUTREACH} />
            <div className="flex flex-row items-center justify-center gap-2 lg:flex-col">
              <ArrowLeftRight size={20} className="hidden text-ink-3 lg:block lg:rotate-0" />
              <div className="max-w-[11rem] rounded-md border border-dashed border-ink-3 bg-surface px-3 py-2 text-center text-xs text-ink-2">
                <p className="font-semibold text-ink">Counts and status codes only</p>
                <p className="mt-0.5">De-identified, nightly. Small counts suppressed.</p>
              </div>
            </div>
            <ZoneBox tone="care" title="Care Zone" sub="Client data. Encrypted, audited, no third-party scripts." items={CARE} icon={<Lock size={14} />} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2.5 rounded-md bg-canvas px-3 py-2.5 text-sm"><KeyRound size={16} className="shrink-0 text-ink-2" /><span><span className="font-medium">Identity across both:</span> Clarvida single sign-on with MFA, roles and state scope.</span></div>
            <div className="flex items-center gap-2.5 rounded-md bg-canvas px-3 py-2.5 text-sm"><ScrollText size={16} className="shrink-0 text-ink-2" /><span><span className="font-medium">Audit across both:</span> every view, change, export and block, with no client values.</span></div>
          </div>
        </PanelBody>
      </Panel>

      <div className="mb-5 grid gap-5 xl:grid-cols-5">
        <Panel className="xl:col-span-2">
          <PanelHeader title="Data classes" description="Every field has a class; the class decides who can see it and where." />
          <PanelBody className="p-0">
            <Table>
              <THead><tr><TH>Class</TH><TH>Covers</TH><TH>Where</TH></tr></THead>
              <tbody>
                {CLASSES.map(([c, name, covers, where]) => (
                  <TR key={c}>
                    <TD className="whitespace-nowrap"><span className={`font-mono text-xs font-semibold ${c >= "C3" ? "text-care" : "text-teal-strong"}`}>{c}</span> <span className="block text-xs text-ink-2">{name}</span></TD>
                    <TD className="text-sm">{covers}</TD>
                    <TD className="text-xs text-ink-2">{where}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </PanelBody>
        </Panel>
        <Panel className="xl:col-span-3" id="vendors">
          <PanelHeader title="Vendors and BAAs" description="Who handles what, and whether a Business Associate Agreement is needed." />
          <PanelBody className="p-0">
            <Table>
              <THead><tr><TH>Vendor</TH><TH>Used for</TH><TH>Client data</TH><TH>BAA and status</TH></tr></THead>
              <tbody>
                {db.vendors.map((v) => (
                  <TR key={v.vendor}>
                    <TD className="font-medium">{v.vendor}</TD>
                    <TD className="text-sm text-ink-2">{v.use}</TD>
                    <TD>{v.phi.startsWith("Yes") ? <Badge tone="care">Yes</Badge> : <Badge tone="outline">{v.phi}</Badge>}</TD>
                    <TD className="text-sm">{v.baa}<span className="block text-xs text-ink-3">{v.status}</span></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Controls: prototype and production" description="Each requirement, its legal basis, what you can see here, and what production adds." actions={<Badge tone="ok" icon={<ShieldCheck size={12} />}>{CONTROLS.filter((c) => c.see).length} of {CONTROLS.length} visible in the demo</Badge>} />
        <PanelBody className="p-0">
          <Table>
            <THead><tr><TH>ID</TH><TH>Control</TH><TH>Basis</TH><TH>In this prototype</TH><TH>In production</TH><TH /></tr></THead>
            <tbody>
              {CONTROLS.map((c) => (
                <TR key={c.id}>
                  <TD className="whitespace-nowrap font-mono text-xs">{c.id}</TD>
                  <TD className="font-medium">{c.control}</TD>
                  <TD className="text-xs text-ink-2">{c.basis}</TD>
                  <TD className={`text-sm ${c.demo === "Not shown" ? "text-ink-3" : ""}`}>{c.demo}</TD>
                  <TD className="text-sm text-ink-2">{c.prod}</TD>
                  <TD className="whitespace-nowrap">
                    {c.see ? (
                      c.see.route.startsWith("#") ? (
                        <a href={c.see.route} className="inline-flex items-center gap-1 text-sm font-medium text-teal-strong hover:underline">See it <ArrowRight size={13} /></a>
                      ) : (
                        <Link href={c.see.route.startsWith("/partner") ? `${c.see.route}/?${new URLSearchParams(c.see.query)}` : href(c.see.route, c.see.query)} target={c.see.route.startsWith("/partner") ? "_blank" : undefined} className="inline-flex items-center gap-1 text-sm font-medium text-teal-strong hover:underline">
                          See it <ArrowRight size={13} />
                        </Link>
                      )
                    ) : null}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </PanelBody>
      </Panel>
    </div>
  );
}

function ZoneBox({ tone, title, sub, items, icon }: { tone: "teal" | "care"; title: string; sub: string; items: string[][]; icon?: React.ReactNode }) {
  const t = tone === "care" ? { box: "border-care/40 bg-care-tint/50", h: "text-care-strong", chip: "border-care/30 hover:bg-care-tint" } : { box: "border-teal/40 bg-teal-tint/50", h: "text-teal-strong", chip: "border-teal/30 hover:bg-teal-tint" };
  return (
    <div className={`rounded-lg border-2 p-4 ${t.box}`}>
      <p className={`flex items-center gap-1.5 font-display text-lg font-semibold ${t.h}`}>{icon}{title}</p>
      <p className="text-sm text-ink-2">{sub}</p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {items.map(([name, desc]) => (
          <li key={name}>
            <Tip content={desc}>
              <button type="button" className={`rounded-md border bg-surface px-2.5 py-1.5 text-left text-sm text-ink ${t.chip}`}>{name}</button>
            </Tip>
          </li>
        ))}
      </ul>
    </div>
  );
}
