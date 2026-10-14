"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Phone, ScanEye, Scale, ShieldCheck, Lock, TriangleAlert, Copy } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { href, accessForUser, pageById } from "@/lib/access";
import { TRANSITIONS, HOLD_REASONS, CLOSE_REASONS, suggestUnableToContact, tier1Status } from "@/lib/rules/status";
import { disclosure } from "@/lib/rules/disclosure";
import { queueLabel } from "@/lib/rules/routing";
import { assignOwner, logAttempt, logReveal, recordConsent, resolveDuplicate, setStatus } from "@/lib/services/referrals";
import { audit } from "@/lib/services/core";
import { REFERRAL_FIELDS, type FieldMeta } from "@/lib/xray";
import { fmtDateTime, maskPhone, ago } from "@/lib/format";
import type { ContactAttempt, Referral, ReferralStatus, SourceType } from "@/lib/domain/types";
import { JourneyTracker } from "@/components/domain/journey";
import { ClockCell } from "@/components/domain/clock";
import { StatusChip, Tier1Chip } from "@/components/domain/chips";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, Empty } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Dialog, Switch } from "@/components/ui/overlays";
import { Label, Select, Segmented, Input } from "@/components/ui/field";
import { cn } from "@/components/ui/cn";

const ACTION_LABEL: Partial<Record<ReferralStatus, string>> = {
  Accepted: "Accept",
  Hold: "Put on hold",
  Redirected: "Redirect",
  "Intake scheduled": "Intake scheduled",
  "Intake completed": "Intake completed",
  Closed: "Close",
};

function Detail() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const user = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const now = useNow(1000);
  const r = db.referrals.find((x) => x.id === id);
  const readOnly = accessForUser(pageById("PG-15"), user) === "read";
  const [xray, setXray] = useState(params.get("xray") === "1");
  const [simOpen, setSimOpen] = useState(params.get("panel") === "consent");
  const [attemptOpen, setAttemptOpen] = useState(false);
  const [statusDlg, setStatusDlg] = useState<ReferralStatus | null>(null);
  const [revealUntil, setRevealUntil] = useState(0);
  const [dupOpen, setDupOpen] = useState(false);

  useEffect(() => { setXray(params.get("xray") === "1"); setSimOpen(params.get("panel") === "consent"); }, [params]);
  useEffect(() => {
    if (xray && r) mutate((d) => audit(d, { action: "Privacy X-ray turned on", objectId: r.id, zone: "Care", category: "care" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xray]);

  const inScope = r && (user.scope.includes("ALL") || user.scope.includes(r.state) || r.queue.includes(user.scope[0] ?? "--"));
  if (!r || !inScope) {
    return (
      <div className="mx-auto max-w-xl">
        <Empty title={r ? "This referral is outside your scope" : "Referral not found"}>
          <Link href={href("/app/intake")} className="text-teal hover:underline">Back to the Intake Queue</Link>
        </Empty>
      </div>
    );
  }

  const program = db.programs.find((p) => p.id === r.programId);
  const org = r.referrerOrgId ? db.orgs.find((o) => o.id === r.referrerOrgId) : undefined;
  const d = disclosure({ srcType: r.srcType, signedRelease: r.signedRelease, part2Program: Boolean(program?.part2), part2Consent: r.part2Consent });
  const owner = db.users.find((u) => u.id === r.ownerId);
  const intakeUsers = db.users.filter((u) => (u.role === "intake" || u.role === "intake_sup") && u.scope.some((s) => s === r.state || s === "ALL"));
  const allowed = TRANSITIONS[r.status].filter((s) => s !== "Contacted");
  const realNow = Date.now(); // the reveal countdown is real seconds, even when sandbox time runs faster
  const revealed = revealUntil > realNow;

  return (
    <div>
      <Link href={href("/app/intake")} className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={15} /> Intake Queue
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-[1.6rem] font-medium tracking-tight">{r.id}</h1>
            <StatusChip status={r.status} />
            {program?.part2 ? <Badge tone="care" icon={<Lock size={12} />}>Part 2 program (C4)</Badge> : null}
            {readOnly ? <Badge tone="outline">Read only</Badge> : null}
          </div>
          <p className="mt-1 text-ink-2">
            {program ? `${program.name} (${program.partnerLabel})` : "Program not chosen"}, {queueLabel(r.queue, db.routing)}
          </p>
          <p className="text-sm text-ink-3">
            Received {fmtDateTime(r.receivedAt)} by {r.channel.toLowerCase()} from {r.srcType}{org ? `, ${org.name}` : r.referrerOrgName ? `, ${r.referrerOrgName}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <ClockCell referral={r} now={now} size="lg" />
          <div data-guide="xray" className="rounded-md border border-line bg-surface px-3 py-2">
            <Switch checked={xray} onCheckedChange={setXray} label={<span className="inline-flex items-center gap-1.5 font-medium"><ScanEye size={15} /> Privacy X-ray</span>} />
          </div>
        </div>
      </div>

      {xray ? <XrayPanel referral={r} programName={program?.name} orgName={org?.name} /> : null}

      {r.dupOf ? (
        <Callout tone="warn" className="mb-4" icon={<Copy size={16} className="text-warn" />} title={`Possible duplicate of ${r.dupOf}`} action={!readOnly ? <Button size="sm" variant="secondary" onClick={() => setDupOpen(true)}>Compare</Button> : null}>
          Same phone number and program within 30 days. Merging keeps both referrers.
        </Callout>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Progress" description="The referrer sees the same tracker, limited by the consent rules." />
            <PanelBody>
              <JourneyTracker referral={r} tier2Allowed audience="staff" />
            </PanelBody>
          </Panel>

          <Panel data-guide="actions">
            <PanelHeader
              title="Actions"
              description={readOnly ? "Compliance view: actions are disabled." : "Log every attempt. The first one stops the clock and tells the referrer."}
              actions={owner ? <span className="text-xs text-ink-3">Owner: {owner.name}</span> : <Badge tone="warn">No owner yet</Badge>}
            />
            <PanelBody className="space-y-4">
              {suggestUnableToContact(r) ? (
                <Callout tone="warn" icon={<TriangleAlert size={16} className="text-warn" />} title="Three attempts without reaching the guardian">
                  Consider closing as Unable to contact, or try a different time.
                </Callout>
              ) : null}
              {!readOnly ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="care" onClick={() => setAttemptOpen(true)} disabled={r.status === "Closed" || r.status === "Redirected"}>
                      <Phone size={16} /> Log contact attempt
                    </Button>
                    {allowed.map((s) => (
                      <Button key={s} variant={s === "Closed" ? "danger" : "secondary"} onClick={() => (s === "Hold" || s === "Closed" || s === "Redirected" ? setStatusDlg(s) : doStatus(s))}>
                        {ACTION_LABEL[s] ?? s}
                      </Button>
                    ))}
                  </div>
                  {r.status === "Intake scheduled" ? <p className="text-xs text-ink-3">Intake completed is recorded by hand in the pilot. In production it comes from the EHR status feed.</p> : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="owner" className="text-ink-2">Owner</Label>
                    <Select id="owner" value={r.ownerId ?? ""} onChange={(e) => mutate((dr) => assignOwner(dr, r.id, e.target.value))} className="h-9 w-auto min-w-48">
                      <option value="" disabled>Choose an owner</option>
                      {intakeUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </Select>
                  </div>
                </>
              ) : null}

              <div>
                <p className="mb-2 text-sm font-medium">Contact attempts</p>
                {r.attempts.length === 0 ? (
                  <p className="text-sm text-ink-3">No attempts yet.</p>
                ) : (
                  <ul className="divide-y divide-line-2 rounded-md border border-line-2">
                    {[...r.attempts].reverse().map((a, i) => (
                      <li key={`${a.at}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span><span className="font-medium">{a.method}</span>: {a.outcome}</span>
                        <span className="text-xs text-ink-3">{a.by}, {fmtDateTime(a.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </PanelBody>
          </Panel>

          {simOpen ? <ConsentSimulator referral={r} part2={Boolean(program?.part2)} onClose={() => setSimOpen(false)} /> : null}

          <Panel>
            <PanelHeader title="History" />
            <PanelBody>
              <ol className="relative space-y-3 border-l border-line pl-4">
                {[...r.history].reverse().map((h, i) => (
                  <li key={`${h.at}-${i}`} className="text-sm">
                    <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-ink-3" aria-hidden />
                    <span className="font-medium">{h.to}</span>
                    {h.note ? <span className="text-ink-2">: {h.note}</span> : null}
                    <span className="block text-xs text-ink-3">{h.by}, {fmtDateTime(h.at)}</span>
                  </li>
                ))}
              </ol>
            </PanelBody>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel className="border-care/40">
            <PanelHeader title={<span className="inline-flex items-center gap-2"><Lock size={15} className="text-care" /> Family contact</span>} description="Minimum necessary: first name and phone only." />
            <PanelBody className="space-y-3 text-sm">
              <XField xray={xray} meta={REFERRAL_FIELDS.guardian}>
                <Row k="Guardian first name" v={r.guardianFirstName} />
              </XField>
              <XField xray={xray} meta={REFERRAL_FIELDS.phone}>
                <div className="flex items-center justify-between gap-2">
                  <Row k="Phone" v={<span className="font-mono">{revealed ? r.phone : maskPhone(r.phone)}</span>} />
                  {!readOnly ? (
                    revealed ? (
                      <Button size="sm" variant="ghost" onClick={() => setRevealUntil(0)}><EyeOff size={14} /> Hide</Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => { setRevealUntil(Date.now() + 60_000); mutate((dr) => logReveal(dr, r.id, "phone")); }}>
                        <Eye size={14} /> Reveal
                      </Button>
                    )
                  ) : null}
                </div>
                {revealed ? <p className="mt-1 text-xs text-ink-3">Hides again in {Math.ceil((revealUntil - realNow) / 1000)} s. This reveal was logged.</p> : null}
              </XField>
              <XField xray={xray} meta={REFERRAL_FIELDS.language}>
                <Row k="Language" v={r.language} />
                <Row k="Best times" v={r.times.length ? r.times.join(", ") : "Any time"} />
                <Row k="Voicemail" v={r.voicemailOk === false ? "Do not leave a voicemail" : "OK to leave a voicemail"} />
              </XField>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Need and source" />
            <PanelBody className="space-y-3 text-sm">
              <XField xray={xray} meta={REFERRAL_FIELDS.age}><Row k="Age" v={r.age} /></XField>
              <XField xray={xray} meta={REFERRAL_FIELDS.coverage}><Row k="Coverage" v={r.coverage} /></XField>
              <XField xray={xray} meta={REFERRAL_FIELDS.county}><Row k="County" v={`${r.county}, ${r.state}`} /></XField>
              <XField xray={xray} meta={REFERRAL_FIELDS.source}>
                <Row k="Source" v={`${r.srcType}${org ? `, ${org.name}` : r.referrerOrgName ? `, ${r.referrerOrgName}` : ""}`} />
                {r.partnerCode ? <Row k="Partner code" v={<span className="font-mono">{r.partnerCode}</span>} /> : null}
              </XField>
              <XField xray={xray} meta={REFERRAL_FIELDS.referrer}>
                <Row k="Referrer" v={[r.referrerName, r.referrerRole].filter(Boolean).join(", ")} />
                <Row k="Work contact" v={r.referrerEmail ?? r.referrerPhone ?? "—"} />
              </XField>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title={<span className="inline-flex items-center gap-2"><Scale size={15} /> Consent and disclosure</span>}
              actions={<Button size="sm" variant="secondary" onClick={() => setSimOpen((s) => !s)}>{simOpen ? "Hide simulator" : "Consent simulator"}</Button>}
            />
            <PanelBody className="space-y-3 text-sm">
              <XField xray={xray} meta={REFERRAL_FIELDS.consent}>
                <Row k="Guardian agreed to referral" v={r.consentAgreement ? "Yes" : "No"} />
                <div className="flex items-center justify-between gap-2">
                  <Row k="Signed release" v={r.signedRelease ? "On file" : "Not on file"} />
                  {!readOnly && !r.signedRelease ? <Button size="sm" variant="secondary" onClick={() => mutate((dr) => recordConsent(dr, r.id, "signed_release"))}>Record release</Button> : null}
                </div>
                {program?.part2 ? (
                  <div className="flex items-center justify-between gap-2">
                    <Row k="Part 2 consent" v={r.part2Consent ? "On file" : "Not on file"} />
                    {!readOnly && !r.part2Consent ? <Button size="sm" variant="secondary" onClick={() => mutate((dr) => recordConsent(dr, r.id, "part2_consent"))}>Record Part 2 consent</Button> : null}
                  </div>
                ) : null}
              </XField>
              <div className={cn("rounded-md px-3 py-2", d.tier2 ? "bg-ok-tint" : "bg-sunken")}>
                <p className="font-medium">{d.tier2 ? "Referrer can see Tier 2 detail" : "Referrer sees Tier 1 status only"}</p>
                <p className="text-xs text-ink-2">{d.basis}</p>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Referrer updates" description={<>Tier 1 status now: <Tier1Chip status={tier1Status(r)} /></>} />
            <PanelBody>
              <XField xray={xray} meta={REFERRAL_FIELDS.notices}>
                <ul className="space-y-2 text-sm">
                  {[...r.notices].reverse().map((n, i) => (
                    <li key={`${n.at}-${i}`} className="rounded-md bg-canvas px-3 py-2">
                      <p className="font-medium">{n.subject}</p>
                      <p className="text-ink-2">{n.text}</p>
                      <p className="text-xs text-ink-3">To {n.to}, {ago(n.at, now)}</p>
                    </li>
                  ))}
                </ul>
              </XField>
              <Link href={`/partner/status/?ref=${r.id}`} target="_blank" className="mt-3 inline-block text-sm text-teal hover:underline">Open the referrer's status page</Link>
            </PanelBody>
          </Panel>
        </div>
      </div>

      <AttemptDialog open={attemptOpen} onOpenChange={setAttemptOpen} onSave={(m, o) => { mutate((dr) => logAttempt(dr, r.id, m, o)); toast.success("Contact attempt logged", { description: r.firstContactAt ? undefined : "Clock stopped. The referrer was told: In outreach." }); }} />
      <StatusDialog status={statusDlg} onClose={() => setStatusDlg(null)} onSave={(s, reason, to) => doStatus(s, reason, to)} programs={db.programs.filter((p) => p.state === r.state && p.id !== r.programId).map((p) => `${p.name}, ${p.office}`)} />
      <DuplicateDialog open={dupOpen} onOpenChange={setDupOpen} a={r} b={db.referrals.find((x) => x.id === r.dupOf)} onDecide={(dec) => { mutate((dr) => resolveDuplicate(dr, r.id, dec)); setDupOpen(false); }} />
    </div>
  );

  function doStatus(s: ReferralStatus, reason?: string, redirectTo?: string) {
    try {
      mutate((dr) => setStatus(dr, r!.id, s, { reason, redirectTo }), { entity: "referral", id: r!.id, action: "status" });
      toast.success(`Referral ${s === "Hold" ? "put on hold" : s.toLowerCase()}`, { description: "The referrer was sent a PHI-free update." });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-3">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function XField({ xray, meta, children }: { xray: boolean; meta: FieldMeta; children: React.ReactNode }) {
  if (!xray) return <div className="space-y-1.5">{children}</div>;
  const tone = meta.dataClass === "C3" || meta.dataClass === "C4" ? "border-care bg-care-tint/40" : meta.dataClass === "C2" ? "border-teal bg-teal-tint/40" : "border-line bg-canvas";
  return (
    <div className={cn("relative space-y-1.5 rounded-md border-2 border-dashed p-2.5", tone)}>
      {children}
      <div className="mt-2 flex flex-wrap gap-1 border-t border-line-2 pt-2 text-[0.7rem]">
        <Badge tone={meta.dataClass === "C3" || meta.dataClass === "C4" ? "care" : meta.dataClass === "C2" ? "teal" : "outline"} className="font-mono">{meta.dataClass}</Badge>
        <Badge tone="outline">{meta.zone === "Care" ? "Care Zone" : meta.zone === "Both" ? "Both zones" : "Outreach Zone"}</Badge>
        <Badge tone="outline" className="whitespace-normal">{meta.protection}</Badge>
        <Badge tone="outline" className="whitespace-normal">Seen by: {meta.whoCanSee}</Badge>
        <Badge tone={meta.crosses === "Never" ? "ok" : "hl"} className="whitespace-normal">To marketing: {meta.crosses}</Badge>
      </div>
    </div>
  );
}

function XrayPanel({ referral, programName, orgName }: { referral: Referral; programName?: string; orgName?: string }) {
  return (
    <div className="mb-5 grid gap-4 rounded-lg border-2 border-care bg-surface p-5 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <p className="inline-flex items-center gap-2 font-display text-lg font-semibold"><ScanEye size={18} className="text-care" /> Privacy X-ray</p>
        <p className="mt-1 text-sm text-ink-2">Every field below shows its data class, zone, protection and who can see it. This shows policy, never extra values.</p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          <Badge tone="care" className="font-mono">C3 / C4 client data</Badge>
          <Badge tone="teal" className="font-mono">C2 business contacts</Badge>
          <Badge tone="outline" className="font-mono">C1 internal</Badge>
        </div>
      </div>
      <div className="rounded-md bg-teal-tint/60 p-4">
        <p className="text-sm font-semibold text-teal-strong">This is all marketing ever sees from this referral</p>
        <p className="mt-2 font-display text-2xl font-semibold">+1 referral</p>
        <p className="text-sm text-ink-2">
          from &ldquo;{referral.srcType}&rdquo;{orgName ? ` (${orgName})` : ""}, {referral.county} County{programName ? `, ${programName}` : ""}, status &ldquo;{referral.status}&rdquo;. Shown on the dashboard as a count; counts under 11 appear as &ldquo;&lt;11&rdquo;.
        </p>
        <p className="mt-2 text-xs text-ink-3">No name, phone, age, coverage or notes leave the Care Zone. The AI never sees this record.</p>
      </div>
    </div>
  );
}

const SIM_TYPES: SourceType[] = ["School", "Child welfare", "Hospital / clinician", "Health plan care manager", "Primary care", "Court / legal", "Community / faith", "Family / self"];

function ConsentSimulator({ referral, part2, onClose }: { referral: Referral; part2: boolean; onClose: () => void }) {
  const [src, setSrc] = useState<SourceType>(referral.srcType);
  const [release, setRelease] = useState(referral.signedRelease);
  const [isPart2, setIsPart2] = useState(part2);
  const [p2c, setP2c] = useState(referral.part2Consent);
  const res = useMemo(() => disclosure({ srcType: src, signedRelease: release, part2Program: isPart2, part2Consent: p2c }), [src, release, isPart2, p2c]);
  return (
    <Panel data-guide="consent-sim" className="border-teal">
      <PanelHeader title={<span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-teal" /> What can this referrer see?</span>} description="Try the disclosure rules. This does not change the referral." actions={<Button size="sm" variant="ghost" onClick={onClose}>Close</Button>} />
      <PanelBody className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <Label htmlFor="sim-src">Referrer type</Label>
            <Select id="sim-src" value={src} onChange={(e) => setSrc(e.target.value as SourceType)} className="mt-1">
              {SIM_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <Switch checked={release} onCheckedChange={setRelease} label="Signed release on file" />
          <Switch checked={isPart2} onCheckedChange={(v) => { setIsPart2(v); if (!v) setP2c(false); }} label="Program covered by 42 CFR Part 2" />
          <Switch checked={p2c} onCheckedChange={setP2c} disabled={!isPart2} label="Part 2 consent on file" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md bg-ok-tint px-3 py-2 text-sm">
            <span className="font-medium">Tier 1: reference and coarse status</span>
            <Badge tone="ok">Always visible</Badge>
          </div>
          <div className={cn("flex items-center justify-between rounded-md px-3 py-2 text-sm", res.tier2 ? "bg-ok-tint" : "bg-sunken")}>
            <span className="font-medium">Tier 2: intake scheduled and completed</span>
            {res.tier2 ? <Badge tone="ok">Unlocked</Badge> : <Badge tone="outline" icon={<Lock size={11} />}>Locked</Badge>}
          </div>
          <p className="rounded-md border border-line-2 px-3 py-2 text-sm text-ink-2"><span className="font-medium text-ink">Basis: </span>{res.basis}</p>
          <p className="text-xs text-ink-3">Illustrative rules for the demo. Clarvida Legal and Compliance approve the production rules.</p>
        </div>
      </PanelBody>
    </Panel>
  );
}

function AttemptDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (m: ContactAttempt["method"], o: ContactAttempt["outcome"]) => void }) {
  const [method, setMethod] = useState<ContactAttempt["method"]>("Phone");
  const [outcome, setOutcome] = useState<ContactAttempt["outcome"]>("Reached guardian");
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Log contact attempt"
      description="Staff make every call and message. Nothing here is automated."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="care" onClick={() => { onSave(method, outcome); onOpenChange(false); }}>Log attempt</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">Method</p>
          <Segmented label="Method" value={method} onChange={setMethod} options={(["Phone", "Voicemail", "Staff text", "Email"] as const).map((m) => ({ value: m, label: m }))} />
        </div>
        <div>
          <Label htmlFor="outcome">Outcome</Label>
          <Select id="outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as ContactAttempt["outcome"])} className="mt-1">
            {(["Reached guardian", "Left voicemail", "No answer", "Wrong number"] as const).map((o) => <option key={o}>{o}</option>)}
          </Select>
        </div>
      </div>
    </Dialog>
  );
}

function StatusDialog({ status, onClose, onSave, programs }: { status: ReferralStatus | null; onClose: () => void; onSave: (s: ReferralStatus, reason?: string, to?: string) => void; programs: string[] }) {
  const [reason, setReason] = useState("");
  const [to, setTo] = useState("");
  useEffect(() => { setReason(""); setTo(""); }, [status]);
  if (!status) return null;
  const reasons = status === "Hold" ? HOLD_REASONS : status === "Closed" ? CLOSE_REASONS : null;
  const valid = status === "Redirected" ? to.trim().length > 1 : Boolean(reason);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={status === "Hold" ? "Put on hold" : status === "Closed" ? "Close referral" : "Redirect referral"}
      description="A reason is required. The referrer gets a Tier 1 update with no client details."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={status === "Closed" ? "danger" : "primary"} disabled={!valid} onClick={() => { onSave(status, status === "Redirected" ? "Redirected" : reason, status === "Redirected" ? to : undefined); onClose(); }}>
            {status === "Hold" ? "Put on hold" : status === "Closed" ? "Close referral" : "Redirect"}
          </Button>
        </>
      }
    >
      {reasons ? (
        <div>
          <Label htmlFor="reason">Reason</Label>
          <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1">
            <option value="">Choose a reason</option>
            {reasons.map((x) => <option key={x}>{x}</option>)}
          </Select>
        </div>
      ) : (
        <div>
          <Label htmlFor="to">Redirect to</Label>
          <Input id="to" list="redirect-programs" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Another Clarvida program or an external provider" className="mt-1" />
          <datalist id="redirect-programs">{programs.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
      )}
    </Dialog>
  );
}

function DuplicateDialog({ open, onOpenChange, a, b, onDecide }: { open: boolean; onOpenChange: (o: boolean) => void; a: Referral; b?: Referral; onDecide: (d: "keep" | "merge") => void }) {
  if (!b) return null;
  const rows: [string, (r: Referral) => React.ReactNode][] = [
    ["Received", (r) => fmtDateTime(r.receivedAt)],
    ["Source", (r) => r.srcType],
    ["Channel", (r) => r.channel],
    ["Program", (r) => r.programId ?? "—"],
    ["Status", (r) => r.status],
  ];
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Compare possible duplicates"
      description="Same phone number and program within 30 days. Merging closes this record as a duplicate and keeps both referrers on the other."
      footer={
        <>
          <Button variant="secondary" onClick={() => onDecide("keep")}>Keep separate</Button>
          <Button onClick={() => onDecide("merge")}>Merge, keep both referrers</Button>
        </>
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-3"><th className="py-1" /><th className="py-1 font-mono">{a.id}</th><th className="py-1 font-mono">{b.id}</th></tr>
        </thead>
        <tbody>
          {rows.map(([k, f]) => (
            <tr key={k} className="border-t border-line-2"><td className="py-1.5 text-ink-3">{k}</td><td className="py-1.5">{f(a)}</td><td className="py-1.5">{f(b)}</td></tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Detail />
    </Suspense>
  );
}
