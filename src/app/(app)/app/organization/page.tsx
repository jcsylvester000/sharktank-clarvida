"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { MapPin, Map as MapIcon, NotebookPen, Car } from "lucide-react";
import { ArrowLeft, Bot, CheckCircle2, CircleAlert, CircleCheck, CirclePause, FlaskConical, Mail, Plus, RotateCcw, Sparkles, TriangleAlert, UserRoundCog } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { href, accessForUser, pageById } from "@/lib/access";
import { fitScore } from "@/lib/rules/fitScore";
import { canApprove, isPaused, sendChecks } from "@/lib/rules/outreach";
import { suppress } from "@/lib/rules/suppress";
import { generateBrief, generateEmail, guardInputs, TEMPLATES, MODEL_ID } from "@/lib/ai/gateway";
import { useStream } from "@/lib/ai/use-stream";
import { addContact, approveDraft, logAI, logTouch, reassignOrg, recordBlocked, setOptOut } from "@/lib/services/outreach";
import { phiScan } from "@/lib/rules/phi";
import { driveMinutes } from "@/lib/geo";
import { CheckInDialog } from "@/components/map/check-in-dialog";
import { uid } from "@/lib/store/db";
import { PHI_TEST_STRINGS } from "@/lib/data/seed";
import { fmtDate, ago, daysSince } from "@/lib/format";
import type { Organization } from "@/lib/domain/types";
import { StageChip } from "@/components/domain/chips";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, Empty } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Dialog, Tabs, TabList, Tab, TabPanel, Tip, Switch } from "@/components/ui/overlays";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";
import { now as clockNow } from "@/lib/clock";

function OrgPage() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const now = useNow(60_000);
  const org = db.orgs.find((o) => o.id === id);
  const [tab, setTab] = useState(params.get("tab") ?? "brief");
  const [checkIn, setCheckIn] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  useEffect(() => { setTab(params.get("tab") ?? "brief"); }, [params]);

  if (!org) return <Empty title="Organization not found"><Link href={href("/app/finder")} className="text-teal hover:underline">Back to the Gatekeeper Finder</Link></Empty>;
  if (!me.scope.includes("ALL") && !me.scope.includes(org.state)) return <Empty title="This organization is outside your scope" />;

  const fit = fitScore(org, { family: "child", weights: db.gatekeeperWeights, programs: db.programs, now });
  const owner = db.users.find((u) => u.id === org.ownerId);
  const isLead = me.role === "amb_lead" || me.role === "admin";
  const canWork = accessForUser(pageById("PG-09"), me) === "full";
  return (
    <div>
      <Link href={href("/app/finder")} className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"><ArrowLeft size={15} /> Gatekeeper Finder</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <StageChip stage={org.stage} />
            <Badge tone="outline">{org.type}</Badge>
            <Badge tone="teal">Outreach Zone: organization data only</Badge>
          </div>
          <h1 className="mt-2 text-[1.75rem] leading-tight">{org.name}</h1>
          <p className="mt-1 text-sm text-ink-2">{org.county} County, {org.state}. Owner: {owner?.name ?? "—"}. Sources: {org.sources.join(", ")} ({org.identifiers}).</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-teal-strong"><Car size={15} /> {driveMinutes(org.distanceMiles)}-minute drive from the office ({org.distanceMiles} miles)</p>
          {canWork ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setLogOpen(true)}><NotebookPen size={14} /> Log a visit or call</Button>
              <Button size="sm" variant="secondary" onClick={() => setCheckIn(true)}><MapPin size={14} /> Check in here</Button>
              <Link href={`/app/map/?org=${org.id}`} className="inline-flex"><Button size="sm" variant="ghost"><MapIcon size={14} /> See on the map</Button></Link>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-display text-3xl font-semibold tabular">{suppress(org.referrals90d)}</p>
            <p className="text-xs text-ink-3">referrals, last 90 days</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-3xl font-semibold text-teal tabular">{fit.score}</p>
            <p className="text-xs text-ink-3">fit score</p>
          </div>
          {isLead ? <ReassignButton org={org} onReassign={(uid) => mutate((d) => reassignOrg(d, org.id, uid))} /> : null}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); router.replace(href("/app/organization", { id: org.id, tab: v })); }}>
        <TabList className="mb-5">
          <Tab value="brief">Brief</Tab>
          <Tab value="outreach">Outreach</Tab>
          <Tab value="contacts">Contacts ({org.contacts.length})</Tab>
          <Tab value="history">History</Tab>
        </TabList>
        <TabPanel value="brief"><BriefTab org={org} onDraft={() => setTab("outreach")} /></TabPanel>
        <TabPanel value="outreach"><OutreachTab org={org} /></TabPanel>
        <TabPanel value="contacts"><ContactsTab org={org} /></TabPanel>
        <TabPanel value="history"><HistoryTab org={org} /></TabPanel>
      </Tabs>
      {checkIn ? <CheckInDialog orgId={org.id} onClose={() => setCheckIn(false)} /> : null}
      <LogTouchDialog open={logOpen} onOpenChange={setLogOpen} org={org} />
    </div>
  );
}

function BriefTab({ org, onDraft }: { org: Organization; onDraft: () => void }) {
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const now = useNow(60_000);
  const fit = fitScore(org, { family: "child", weights: db.gatekeeperWeights, programs: db.programs, now });
  const brief = useMemo(() => generateBrief(org, db.programs, db.events, fit, now), [org, db.programs, db.events, fit, now]);
  const [run, setRun] = useState(0);
  const { shown, state } = useStream(brief.summary + (run % 2 ? " " : ""), { delayMs: 700 });
  const logged = useRef("");
  useEffect(() => {
    const key = `${org.id}:${run}`;
    if (logged.current === key) return;
    logged.current = key;
    mutate((d) => logAI(d, { feature: "AI01", templateId: TEMPLATES.brief.id, templateVersion: TEMPLATES.brief.version, objectId: org.id, result: "Viewed" }));
  }, [org.id, run, mutate]);
  const ready = state === "done";
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Panel>
        <PanelHeader
          title={<span className="inline-flex items-center gap-2"><Sparkles size={16} className="text-teal" /> AI brief</span>}
          description="Built only from the organization record, program catalog and published events."
          actions={<><AiChip /><Button size="sm" variant="ghost" onClick={() => setRun((r) => r + 1)}><RotateCcw size={14} /> Regenerate</Button></>}
        />
        <PanelBody className="space-y-5">
          <div>
            <p className="text-xs font-medium text-ink-3">Summary</p>
            <p className="mt-1 min-h-12 text-[0.98rem] leading-relaxed">{state === "thinking" ? <span className="text-ink-3">Reading the organization record…</span> : shown}</p>
          </div>
          <div className={cn("transition-opacity", ready ? "opacity-100" : "opacity-0")}>
            <p className="text-xs font-medium text-ink-3">Why it matters</p>
            <ul className="mt-1 space-y-1.5">{brief.whyItMatters.map((w) => <li key={w} className="flex gap-2 text-sm"><CircleCheck size={15} className="mt-0.5 shrink-0 text-teal" />{w}</li>)}</ul>
          </div>
          <div className={cn("grid gap-5 transition-opacity sm:grid-cols-2", ready ? "opacity-100" : "opacity-0")}>
            <div>
              <p className="text-xs font-medium text-ink-3">Best contact role</p>
              <p className="mt-1 text-sm font-medium">{brief.bestContact}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-3">Sources used</p>
              <div className="mt-1 flex flex-wrap gap-1">{brief.sources.map((s) => <Badge key={s} tone="outline" className="text-[0.7rem]">{s}</Badge>)}</div>
            </div>
          </div>
          <div className={cn("transition-opacity", ready ? "opacity-100" : "opacity-0")}>
            <p className="text-xs font-medium text-ink-3">Talking points for a call</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">{brief.talkingPoints.map((t) => <li key={t}>{t}</li>)}</ol>
          </div>
          <Button onClick={onDraft}><Mail size={16} /> Draft outreach</Button>
        </PanelBody>
      </Panel>
      <div className="space-y-5">
        <Panel>
          <PanelHeader title="Fit score" description="A transparent formula, not AI." />
          <PanelBody className="space-y-1.5 text-sm">
            {([["Organization type", fit.parts.template], ["Distance", fit.parts.distance], ["Referral history", fit.parts.history], ["Relationship stage", fit.parts.stage], ["Program capacity", fit.parts.capacity]] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-ink-2">{k}</span><span className="font-mono tabular">+{v}</span></div>
            ))}
            <div className="flex justify-between border-t border-line-2 pt-1.5 font-semibold"><span>Fit score</span><span className="font-mono tabular">{fit.score}</span></div>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Referrals by month" description="Aggregate counts only, from the attribution mart." />
          <PanelBody>
            <MonthBars values={org.monthly} now={now} />
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}

function MonthBars({ values, now }: { values: number[]; now: number }) {
  const max = Math.max(4, ...values);
  const months = values.map((_, i) => new Date(new Date(now).getFullYear(), new Date(now).getMonth() - (values.length - 1 - i), 1).toLocaleDateString("en-US", { month: "short" }));
  return (
    <div>
      <div className="flex h-28 items-end gap-2" role="img" aria-label={`Referrals by month: ${values.map((v, i) => `${months[i]} ${v ? "<11" : 0}`).join(", ")}`}>
        {values.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[0.7rem] text-ink-3">{v ? "<11" : "0"}</span>
            <div className="w-full rounded-t bg-teal/70" style={{ height: `${(v / max) * 80}px`, minHeight: v ? 4 : 1 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">{months.map((m, i) => <span key={i} className="flex-1 text-center text-[0.7rem] text-ink-3">{m}</span>)}</div>
      <p className="mt-2 text-xs text-ink-3">Monthly counts are under 11, so values are shown as &ldquo;&lt;11&rdquo;; bar heights show the trend.</p>
    </div>
  );
}

function AiChip() {
  return (
    <Tip content={`Outputs come from approved templates filled with organization data. ${MODEL_ID}.`}>
      <span><Badge tone="outline" icon={<Bot size={12} />}>Simulated model</Badge></span>
    </Tip>
  );
}

function OutreachTab({ org }: { org: Organization }) {
  const params = useSearchParams();
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const now = useNow(30_000);
  const programs = db.programs.filter((p) => p.state === org.state && p.counties.includes(org.county) && p.family !== "adult");
  const firstOpen = programs.find((p) => !isPaused(p));
  const [programId, setProgramId] = useState(params.get("program") && programs.some((p) => p.id === params.get("program")) ? params.get("program")! : firstOpen?.id ?? programs[0]?.id ?? "");
  const program = db.programs.find((p) => p.id === programId);
  const contacts = org.contacts;
  const [contactId, setContactId] = useState(contacts.find((c) => !c.optOut)?.id ?? "");
  const contact = contacts.find((c) => c.id === contactId);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [streamText, setStreamText] = useState<string | null>(null);
  const { shown, state } = useStream(streamText, { delayMs: 1000, wordsPerSec: 45 });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [approved, setApproved] = useState<string | null>(null);
  const [blockNotice, setBlockNotice] = useState<string | null>(null);
  const blockedLogged = useRef(false);
  const paused = isPaused(program);
  const presenter = db.demo.presenter;
  const canEdit = accessForUser(pageById("PG-09"), me) === "full";

  useEffect(() => { if (state === "done" && draft) setBody(draft.body); }, [state, draft]);

  const checks = sendChecks({ text: body, contact, program, userSends: db.sendCounts[me.id] ?? 0, orgSends: db.orgSendCounts[org.id] ?? 0, cap: db.sendCap, orgCap: db.orgSendCap, now });
  const phiFail = checks.find((c) => c.id === "phi" && !c.pass);

  // Log the first PHI block of this draft for Compliance (FR-101).
  useEffect(() => {
    if (phiFail && !blockedLogged.current && draft) {
      blockedLogged.current = true;
      const cat = phiFail.detail.match(/\((.*)\)/)?.[1] ?? "client details";
      mutate((d) => recordBlocked(d, { objectId: org.id, category: cat, where: "an outreach draft", feature: "AI02" }));
      setBlockNotice(cat);
    }
    if (!phiFail) blockedLogged.current = false;
  }, [phiFail, draft, org.id, mutate]);

  const makeDraft = () => {
    if (!program || paused) return;
    const guard = guardInputs(org.summary, org.name, program.partnerLabel);
    if (!guard.ok) { toast.error("AI call blocked by the PHI guard"); return; }
    const d = generateEmail(org, contact, program, me, db.events);
    setApproved(null);
    setBlockNotice(null);
    setDraft(d);
    setSubject(d.subject);
    setBody("");
    setStreamText(d.body + " ");
    setTimeout(() => setStreamText(d.body), 0);
    mutate((dr) => logAI(dr, { feature: "AI02", templateId: TEMPLATES.email.id, templateVersion: TEMPLATES.email.version, objectId: org.id, result: "Generated" }));
  };

  const approve = () => {
    if (!draft || !program || !contact) return;
    mutate((d) => approveDraft(d, { orgId: org.id, contactId: contact.id, programId: program.id, templateId: TEMPLATES.email.id, templateVersion: TEMPLATES.email.version, subject, draftText: draft.body, finalText: body }), { entity: "draft", id: org.id, action: "approved" });
    setApproved(subject);
    setDraft(null);
    setStreamText(null);
    toast.success("Approved and queued in the approved CRM");
  };

  const streaming = state === "thinking" || state === "streaming";
  const bodyValue = streaming ? shown : body;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" data-guide="outreach">
      <Panel>
        <PanelHeader
          title={<span className="inline-flex items-center gap-2"><Mail size={16} className="text-teal" /> Outreach draft</span>}
          description="AI drafts from organization data only. A person edits and approves; nothing sends on its own."
          actions={<AiChip />}
        />
        <PanelBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="o-program">Program</Label>
              <Select id="o-program" value={programId} onChange={(e) => { setProgramId(e.target.value); setDraft(null); setStreamText(null); setBody(""); }} className="mt-1">
                {programs.map((p) => <option key={p.id} value={p.id}>{p.name}{isPaused(p) ? ` (${p.capacity}: outreach paused)` : ""}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="o-contact">Recipient</Label>
              <Select id="o-contact" value={contactId} onChange={(e) => setContactId(e.target.value)} className="mt-1">
                <option value="">{contacts.length ? "Choose a contact" : "No contacts yet: add one first"}</option>
                {contacts.map((c) => <option key={c.id} value={c.id} disabled={c.optOut}>{c.name}, {c.role}{c.optOut ? " (opted out)" : !c.verifiedAt ? " (unverified)" : ""}</option>)}
              </Select>
            </div>
          </div>

          {paused && program ? (
            <Callout tone="neutral" className="border-cv-amber bg-hl-tint" icon={<CirclePause size={18} className="text-warn" />} title={`Program on ${program.capacity}: outreach paused`}>
              {program.name} is not taking new referrals{program.expectedReopen ? ` (expected to reopen ${program.expectedReopen})` : ""}. Choose another program, or wait until it reopens.
            </Callout>
          ) : null}

          {approved ? (
            <Callout tone="ok" icon={<CheckCircle2 size={18} className="text-ok" />} title="Approved and queued in the approved CRM (simulated)">
              &ldquo;{approved}&rdquo; to {contact?.name}. Your sends this week: {db.sendCounts[me.id] ?? 0} of {db.sendCap}. Logged with the draft and your edits.
            </Callout>
          ) : null}

          {!draft && !streaming ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={makeDraft} disabled={!canEdit || paused || !program}>
                <Sparkles size={16} /> {approved ? "Draft another" : "Draft outreach"}
              </Button>
              {!contacts.length ? <span className="text-sm text-ink-3">Add a verified contact on the Contacts tab to send.</span> : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge tone="hl" icon={<Bot size={12} />}>AI draft: needs your approval</Badge>
                {streaming ? <span className="text-xs text-ink-3">{state === "thinking" ? "Drafting from organization data…" : "Writing…"}</span> : null}
              </div>
              <div>
                <Label htmlFor="o-subject">Subject</Label>
                <Input id="o-subject" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={streaming} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="o-body">Message</Label>
                <Textarea id="o-body" value={bodyValue} onChange={(e) => setBody(e.target.value)} readOnly={streaming} className={cn("mt-1 min-h-[22rem] rounded-2xl bg-cv-ice font-sans text-[0.9rem]", phiFail && "border-crit")} />
              </div>
              {blockNotice ? (
                <Callout tone="crit" icon={<TriangleAlert size={18} className="text-crit" />} title={`Blocked: possible client details (${blockNotice})`}>
                  Outreach and AI use organization data only. Remove the client details to continue. Compliance has been notified; the text itself was not stored.
                </Callout>
              ) : null}
              {canEdit && !streaming ? (
                <Button size="sm" variant="link" onClick={() => setBody((b) => `Avery, age 9, Medicaid ID 9001234567, needs help after school.\n\n${b}`)} data-guide="paste-phi">
                  <FlaskConical size={14} /> Try pasting client details (demo)
                </Button>
              ) : null}
            </div>
          )}
        </PanelBody>
      </Panel>

      <div className="space-y-5">
        <Panel>
          <PanelHeader title="Before it can be sent" description="Checks run on every edit." />
          <PanelBody>
            <ul className="space-y-2.5">
              {checks.map((c) => (
                <li key={c.id} className="flex gap-2.5 text-sm">
                  {c.pass ? <CircleCheck size={17} className="mt-0.5 shrink-0 text-ok" /> : c.warnOnly ? <CircleAlert size={17} className="mt-0.5 shrink-0 text-warn" /> : <TriangleAlert size={17} className="mt-0.5 shrink-0 text-crit" />}
                  <span>
                    <span className="font-medium">{c.label}</span>
                    <span className="block text-xs text-ink-2">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="cta" onClick={approve} disabled={!draft || streaming || !canApprove(checks) || !canEdit} className="justify-center" data-guide="approve">
                Approve and queue
              </Button>
              {draft ? <Button variant="ghost" onClick={() => { setDraft(null); setStreamText(null); setBody(""); }}>Discard draft</Button> : null}
            </div>
            <p className="mt-3 text-xs text-ink-3">Business email through the approved CRM only. No texts, robocalls or AI voice. Opt-outs are honored within 10 business days.</p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Recent approved outreach" />
          <PanelBody>
            {db.drafts.filter((x) => x.orgId === org.id).length === 0 ? <p className="text-sm text-ink-3">None yet.</p> : (
              <ul className="space-y-2 text-sm">
                {db.drafts.filter((x) => x.orgId === org.id).slice(0, 4).map((x) => (
                  <li key={x.id} className="rounded-md bg-canvas px-3 py-2">
                    <p className="font-medium">{x.subject}</p>
                    <p className="text-xs text-ink-3">{db.users.find((u) => u.id === x.approvedBy)?.name}, {ago(x.approvedAt)}{x.finalText !== x.draftText ? ", edited before approval" : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}

function ContactsTab({ org }: { org: Organization }) {
  const mutate = useStore((s) => s.mutate);
  const now = useNow(60_000);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", role: "", workEmail: "", workPhone: "", source: "" });
  const valid = f.name.trim().length > 1 && f.role.trim().length > 1 && f.source.trim().length > 1 && (!f.workEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.workEmail));
  return (
    <Panel>
      <PanelHeader title="Business contacts" description="Contacts come from people and verified sources, never from AI. Each one carries a verification date and opt-out status." actions={<Button size="sm" onClick={() => setOpen(true)}><Plus size={15} /> Add contact</Button>} />
      {org.contacts.length === 0 ? (
        <PanelBody><Empty title="No contacts yet">Add the first one after you meet them, with where the contact came from.</Empty></PanelBody>
      ) : (
        <Table>
          <THead><tr><TH>Name</TH><TH>Role</TH><TH>Work email</TH><TH>Verified</TH><TH>Source</TH><TH>Opt-out</TH></tr></THead>
          <tbody>
            {org.contacts.map((c) => {
              const days = daysSince(c.verifiedAt, now);
              return (
                <TR key={c.id}>
                  <TD className="font-medium">{c.name}</TD>
                  <TD>{c.role}</TD>
                  <TD>{c.workEmail ?? "—"}</TD>
                  <TD>{c.verifiedAt ? <span className={cn(days! > 365 && "text-warn")}>{fmtDate(c.verifiedAt)}{days! > 365 ? " (over a year)" : ""}</span> : <Badge tone="warn">Unverified</Badge>}</TD>
                  <TD className="text-ink-2">{c.source}</TD>
                  <TD><Switch checked={c.optOut} onCheckedChange={(v) => mutate((d) => setOptOut(d, org.id, c.id, v))} label={c.optOut ? "Opted out" : "Can email"} /></TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      )}
      <Dialog open={open} onOpenChange={setOpen} title="Add a business contact" description="Work details only. Say where the contact came from."
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!valid} onClick={() => { mutate((d) => addContact(d, org.id, { name: f.name.trim(), role: f.role.trim(), workEmail: f.workEmail.trim() || undefined, workPhone: f.workPhone.trim() || undefined, source: f.source.trim(), verifiedAt: clockNow(), optOut: false })); setOpen(false); setF({ name: "", role: "", workEmail: "", workPhone: "", source: "" }); toast.success("Contact added"); }}>Add contact</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          {([["name", "Name"], ["role", "Role"], ["workEmail", "Work email"], ["workPhone", "Work phone"]] as const).map(([k, l]) => (
            <div key={k}><Label htmlFor={`c-${k}`}>{l}</Label><Input id={`c-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="mt-1" /></div>
          ))}
          <div className="sm:col-span-2"><Label htmlFor="c-source">Source</Label><Input id="c-source" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="e.g. Met at county provider meeting" className="mt-1" /></div>
        </div>
      </Dialog>
    </Panel>
  );
}

function HistoryTab({ org }: { org: Organization }) {
  const db = useStore((s) => s.db);
  const items = [
    ...db.touches.filter((t) => t.orgId === org.id && !db.visits.some((v) => v.orgId === org.id && Math.abs(v.at - t.at) < 2000)).map((t) => ({ at: t.at, title: t.type, text: t.note, by: db.users.find((u) => u.id === t.byUserId)?.name ?? "—" })),
    ...db.visits.filter((v) => v.orgId === org.id).map((v) => ({ at: v.at, title: v.method === "location" ? "Visit (location confirmed)" : v.method === "demo" ? "Visit (demo location)" : "Visit (checked in at address)", text: `${v.outcome}${v.distanceMi !== null ? ` · ${v.distanceMi.toFixed(2)} mi from site` : ""}`, by: db.users.find((u) => u.id === v.userId)?.name ?? "—" })),
    ...db.drafts.filter((x) => x.orgId === org.id).map((x) => ({ at: x.approvedAt + 1, title: "Outreach approved", text: `"${x.subject}" approved by ${db.users.find((u) => u.id === x.approvedBy)?.name ?? "—"}, queued in the approved CRM`, by: db.users.find((u) => u.id === x.approvedBy)?.name ?? "—" })),
    ...db.audit.filter((a) => a.objectId === org.id && /Reassigned|Opted out|Added contact/.test(a.action)).map((a) => ({ at: a.at, title: a.action, text: "", by: a.actorName })),
  ].sort((a, b) => b.at - a.at);
  return (
    <Panel>
      <PanelHeader title="Relationship history" description="Shared, so knowledge stays when people change roles." />
      <PanelBody>
        {items.length === 0 ? <p className="text-sm text-ink-3">No history yet.</p> : (
          <ol className="relative space-y-3 border-l border-line pl-4">
            {items.map((h, i) => (
              <li key={`${h.at}-${i}`} className="text-sm">
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-teal" aria-hidden />
                <span className="font-medium">{h.title}</span>{h.text ? <span className="text-ink-2">: {h.text}</span> : null}
                <span className="block text-xs text-ink-3">{h.by}, {fmtDate(h.at)}</span>
              </li>
            ))}
          </ol>
        )}
      </PanelBody>
    </Panel>
  );
}

function ReassignButton({ org, onReassign }: { org: Organization; onReassign: (userId: string) => void }) {
  const db = useStore((s) => s.db);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const options = db.users.filter((u) => u.role === "ambassador" && u.scope.includes(org.state) && u.id !== org.ownerId);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><UserRoundCog size={15} /> Reassign</Button>
      <Dialog open={open} onOpenChange={setOpen} title="Reassign this organization" description="History, contacts and open tasks move to the new owner."
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!to} onClick={() => { onReassign(to); setOpen(false); toast.success("Organization reassigned"); }}>Reassign</Button></>}>
        <Label htmlFor="ra">New owner</Label>
        <Select id="ra" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1">
          <option value="">Choose an ambassador</option>
          {options.map((u) => <option key={u.id} value={u.id}>{u.name}, {u.office}</option>)}
        </Select>
        {options.length === 0 ? <p className="mt-2 text-sm text-ink-3">No other ambassadors cover {org.state} in this demo.</p> : null}
      </Dialog>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <OrgPage />
    </Suspense>
  );
}


/** FT-061: log a visit or call with outcome and next step; updates the timeline and creates a follow-up task. */
function LogTouchDialog({ open, onOpenChange, org }: { open: boolean; onOpenChange: (o: boolean) => void; org: Organization }) {
  const mutate = useStore((s) => s.mutate);
  const me = useCurrentUser()!;
  const [type, setType] = useState<"Call" | "Visit" | "Email">("Call");
  const [note, setNote] = useState("");
  const [next, setNext] = useState("");
  const [due, setDue] = useState(() => new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10));
  const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setErr(null); }} title={`Log a visit or call: ${org.name.split(",")[0]}`} description="Notes are about the organization, never about clients."
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="cta" disabled={!note.trim()} onClick={() => {
        const phi = phiScan(`${note} ${next}`);
        if (phi.blocked) { mutate((d) => recordBlocked(d, { objectId: org.id, category: phi.category!, where: "a visit note" })); setErr(`Blocked: possible client details (${phi.category}). This was logged for Compliance.`); return; }
        mutate((d) => {
          logTouch(d, { orgId: org.id, type, note: note.trim() });
          if (next.trim()) d.tasks.push({ id: uid("t"), ownerId: me.id, orgId: org.id, text: next.trim(), reason: "manual", minutes: 10, dueAt: new Date(due + "T12:00:00").getTime(), done: false, source: "manual" });
          for (const j of d.nurture.filter((x) => x.orgId === org.id && x.status === "Warm: call now")) { j.status = "Completed"; }
        });
        toast.success(`${type} logged`, { description: next.trim() ? "A follow-up task is on your dashboard." : undefined });
        setNote(""); setNext(""); onOpenChange(false);
      }}>Save</Button></>}>
      <div className="space-y-4">
        <div className="flex gap-2">{(["Call", "Visit", "Email"] as const).map((t) => <button key={t} type="button" onClick={() => setType(t)} className={cn("rounded-full border px-3 py-1 text-sm font-semibold", type === t ? "border-teal bg-teal text-white" : "border-line text-ink-2")}>{t}</button>)}</div>
        <div><Label htmlFor="lt-note">What happened</Label><Textarea id="lt-note" value={note} onChange={(e) => { setNote(e.target.value); setErr(null); }} placeholder="e.g. Spoke with T. Alvarez; send the program list" className="mt-1" /></div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div><Label htmlFor="lt-next">Next step (creates a task)</Label><Input id="lt-next" value={next} onChange={(e) => setNext(e.target.value)} placeholder="e.g. Send the updated program list" className="mt-1" /></div>
          <div><Label htmlFor="lt-due">Due</Label><Input id="lt-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1" /></div>
        </div>
        {err ? <p className="rounded-xl bg-crit-tint px-3 py-2 text-sm text-crit" role="alert">{err}</p> : null}
      </div>
    </Dialog>
  );
}
