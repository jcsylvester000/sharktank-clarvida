"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, CirclePause, FastForward, Flame, Mail, Pause, Play, Plus, PhoneCall, Sprout, SkipForward } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { accessForUser, pageById } from "@/lib/access";
import { isPaused } from "@/lib/rules/outreach";
import { approveFirstStep, enroll, fastForward, setPaused, talkingPoints, WARM_THRESHOLD, NURTURE_TEMPLATES } from "@/lib/services/nurture";
import type { NurtureEnrollment } from "@/lib/domain/types";
import { PageHeader, Callout } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Select, FieldError } from "@/components/ui/field";
import { Dialog } from "@/components/ui/overlays";
import { StageChip } from "@/components/domain/chips";
import { SunState, HOPEFUL_LINE } from "@/components/brand/brand";
import { ago, fmtShortDate } from "@/lib/format";
import { cn } from "@/components/ui/cn";

const D = 86_400_000;

/** PG-10 Nurture Journeys (FT-062, FT-063). */
export default function Nurture() {
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const now = useNow(30_000);
  const canAct = accessForUser(pageById("PG-10"), me) === "full";
  const [enrollOpen, setEnrollOpen] = useState(false);
  const mine = useMemo(() => db.nurture.filter((j) => {
    const o = db.orgs.find((x) => x.id === j.orgId);
    return o && (me.scope.includes("ALL") || me.scope.includes(o.state)) && (me.role !== "ambassador" || j.ownerId === me.id);
  }), [db.nurture, db.orgs, me]);
  const warm = mine.filter((j) => j.status === "Warm: call now");
  const active = mine.filter((j) => j.status === "Active" || j.status === "Paused");
  const done = mine.filter((j) => j.status === "Completed");

  return (
    <div>
      <PageHeader
        title="Nurture Journeys"
        description="Automation handles the early, repetitive outreach. When a relationship turns warm, you get a 'Warm: call now' handoff with talking points."
        actions={canAct ? <Button variant="cta" onClick={() => setEnrollOpen(true)} data-guide="enroll"><Plus size={16} /> Enroll organization</Button> : null}
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Tile label="Warm: call now" value={warm.length} amber={warm.length > 0} />
        <Tile label="Journeys running" value={active.length} />
        <Tile label="Handed off this month" value={done.length + warm.length} />
      </div>
      {warm.map((j) => <JourneyCard key={j.id} j={j} now={now} canAct={canAct} />)}
      <div className="space-y-4">
        {active.length === 0 && warm.length === 0 ? <Panel><SunState title="No journeys running.">{HOPEFUL_LINE}</SunState></Panel> : null}
        {active.map((j) => <JourneyCard key={j.id} j={j} now={now} canAct={canAct} />)}
        {done.length ? <p className="pt-2 text-sm font-semibold text-ink-2">Completed</p> : null}
        {done.map((j) => <JourneyCard key={j.id} j={j} now={now} canAct={false} />)}
      </div>
      <EnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} />
    </div>
  );
}

function Tile({ label, value, amber }: { label: string; value: number; amber?: boolean }) {
  return (
    <div className={cn("rounded-2xl border bg-surface px-4 py-3", amber ? "border-cv-amber bg-[#fffaf0]" : "border-line")}>
      <p className={cn("num text-[1.8rem] leading-none", amber ? "text-cv-ink" : "text-cv-teal")}>{value}</p>
      <p className="mt-1 text-sm text-ink-2">{label}</p>
    </div>
  );
}

function JourneyCard({ j, now, canAct }: { j: NurtureEnrollment; now: number; canAct: boolean }) {
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const org = db.orgs.find((o) => o.id === j.orgId)!;
  const program = db.programs.find((p) => p.id === j.programId);
  const owner = db.users.find((u) => u.id === j.ownerId);
  const paused = isPaused(program) || j.status === "Paused";
  const warm = j.status === "Warm: call now";
  const pts = warm ? talkingPoints(org, j, program?.partnerLabel ?? "our programs") : [];
  return (
    <Panel className={cn("mb-4 overflow-hidden", warm && "border-cv-amber ring-2 ring-cv-amber/50")} data-guide={warm ? "warm" : "journey"}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {warm ? <Badge tone="hl" icon={<Flame size={12} />}>Warm: call now</Badge> : j.status === "Paused" || isPaused(program) ? <Badge tone="neutral" icon={<CirclePause size={12} />}>Paused</Badge> : j.status === "Completed" ? <Badge tone="solid" icon={<Check size={12} />}>Handed off</Badge> : <Badge tone="sky" icon={<Sprout size={12} />}>Running</Badge>}
            <Badge tone="outline">{j.template}</Badge>
            <StageChip stage={org.stage} />
          </div>
          <Link href={`/app/organization/?id=${org.id}`} className="mt-1.5 block text-lg font-medium hover:text-cv-link">{org.name}</Link>
          <p className="text-sm text-ink-3">For {program?.name ?? "a program"} · owner {owner?.name} · enrolled {ago(j.enrolledAt, now)}</p>
        </div>
        <WarmMeter score={j.warmScore} />
      </div>
      {isPaused(program) ? (
        <Callout tone="neutral" className="mx-5 mb-3 border-cv-amber bg-hl-tint" icon={<CirclePause size={16} className="text-warn" />}>{program!.name} is on {program!.capacity.toLowerCase()}: this journey is paused automatically and nothing will send.</Callout>
      ) : null}
      <ol className="grid gap-0 border-t border-line-2 sm:grid-cols-4">
        {j.steps.map((s, i) => (
          <li key={s.kind} className={cn("border-line-2 px-5 py-3 sm:border-r sm:last:border-r-0", i > 0 && "border-t sm:border-t-0")}>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-3">
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white", s.status === "Sent" ? "bg-teal" : s.status === "Waiting for approval" ? "bg-cv-amber text-cv-ink" : s.status === "Skipped" ? "bg-ink-3/50" : "bg-cv-lightsky text-cv-navy")}>{s.status === "Sent" ? <Check size={11} /> : i + 1}</span>
              {s.kind} · day {s.day}
            </p>
            <p className="mt-1 text-sm font-medium leading-snug">{s.subject}</p>
            <p className="mt-0.5 text-xs text-ink-3">{s.status === "Sent" ? `Sent ${fmtShortDate(s.sentAt)}` : s.status === "Scheduled" ? `Scheduled ${fmtShortDate(j.enrolledAt + s.day * D)}` : s.status}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">{j.signals.filter((g) => g.step === s.kind).map((g, k) => <Badge key={k} tone={g.kind === "Registered" || g.kind === "Replied" ? "hl" : "lightsky"}>{g.kind}</Badge>)}</div>
          </li>
        ))}
      </ol>
      {warm ? (
        <div className="border-t border-cv-amber/50 bg-[#fffaf0] px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><PhoneCall size={16} className="text-warn" /> Talking points for your call</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-2">{pts.map((p) => <li key={p}>{p}</li>)}</ol>
          <p className="mt-2 text-xs text-ink-3">Simulated model, from organization data and engagement signals only. The journey has stopped; the relationship is yours now.</p>
          {canAct ? <Link href={`/app/organization/?id=${org.id}`} className="mt-3 inline-flex"><Button variant="cta">Call and log it</Button></Link> : null}
        </div>
      ) : null}
      {canAct && !warm && j.status !== "Completed" ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line-2 px-5 py-3">
          {!j.firstApproved ? (
            <Button variant="cta" size="sm" disabled={isPaused(program)} onClick={() => { let err: string | null = null; mutate((d) => { err = approveFirstStep(d, j.id); }); if (err) toast.error(err); else toast.success("Step 1 approved and queued in the approved CRM", { description: "Later steps now run on schedule." }); }} data-guide="approve-step">
              Approve step 1
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled={paused} onClick={() => { mutate((d) => { fastForward(d, j.id, 14); }); toast("Two weeks passed (demo)", { description: "Steps went out on schedule and engagement signals arrived." }); }} data-guide="fast-forward">
              <FastForward size={14} /> Fast-forward 2 weeks (demo)
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => mutate((d) => setPaused(d, j.id, j.status !== "Paused"))} disabled={isPaused(program)}>
            {j.status === "Paused" ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause journey</>}
          </Button>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-3"><Mail size={13} /> Business email to the organization only; every message shows in the Demo Inbox.</span>
        </div>
      ) : null}
    </Panel>
  );
}

function WarmMeter({ score }: { score: number }) {
  const pct = Math.min(100, score);
  return (
    <div className="w-44" aria-label={`Warm score ${score} of 100; warm at ${WARM_THRESHOLD}`}>
      <div className="flex items-baseline justify-between"><span className="text-xs text-ink-3">Warm score</span><span className={cn("num text-xl", score >= WARM_THRESHOLD ? "text-cv-ink" : "text-cv-teal")}>{score}</span></div>
      <div className="relative mt-1 h-2.5 rounded-full bg-sunken">
        <div className={cn("h-2.5 rounded-full", score >= WARM_THRESHOLD ? "bg-cv-amber" : "bg-teal")} style={{ width: `${pct}%` }} />
        <span className="absolute -top-1 h-4.5 w-0.5 bg-cv-navy" style={{ left: `${WARM_THRESHOLD}%`, height: 18 }} aria-hidden />
      </div>
      <p className="mt-1 text-[11px] text-ink-3">Warm at {WARM_THRESHOLD}: opens, downloads, registrations, replies</p>
    </div>
  );
}

function EnrollDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const orgs = db.orgs.filter((o) => (me.role === "ambassador" ? o.ownerId === me.id : me.scope.includes("ALL") || me.scope.includes(o.state)) && !db.nurture.some((j) => j.orgId === o.id && (j.status === "Active" || j.status === "Warm: call now")));
  const [orgId, setOrgId] = useState("");
  const org = db.orgs.find((o) => o.id === orgId);
  const programs = db.programs.filter((p) => org && p.state === org.state && p.counties.includes(org.county));
  const [template, setTemplate] = useState<NurtureEnrollment["template"]>("Clinic intro");
  const [programId, setProgramId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); setErr(null); }} title="Enroll an organization" description="A 4-step journey: intro, resource, webinar invite, check-in. You approve the first message; the rest run on schedule."
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="cta" disabled={!orgId || !programId} onClick={() => {
        let res: { ok: boolean; reason?: string } = { ok: false };
        mutate((d) => { res = enroll(d, { orgId, template, programId }); });
        if (!res.ok) { setErr(res.reason ?? "Couldn't enroll."); return; }
        toast.success("Enrolled", { description: "Approve step 1 to start the journey." });
        setOrgId(""); setProgramId(""); onOpenChange(false);
      }}>Enroll</Button></>}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="nj-org">Organization</Label>
          <Select id="nj-org" value={orgId} onChange={(e) => { setOrgId(e.target.value); setProgramId(""); setErr(null); const o = db.orgs.find((x) => x.id === e.target.value); if (o) setTemplate(o.type === "School district" || o.type === "Early childhood" ? "School intro" : o.type === "Primary care" || o.type === "Pediatrics" || o.type === "Hospital" ? "Clinic intro" : "Agency re-engage"); }} className="mt-1">
            <option value="">Choose an organization</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.stage})</option>)}
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="nj-tpl">Journey</Label>
            <Select id="nj-tpl" value={template} onChange={(e) => setTemplate(e.target.value as NurtureEnrollment["template"])} className="mt-1">
              {Object.keys(NURTURE_TEMPLATES).map((t) => <option key={t}>{t}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="nj-prog">Program to feature</Label>
            <Select id="nj-prog" value={programId} onChange={(e) => { setProgramId(e.target.value); setErr(null); }} className="mt-1" disabled={!org}>
              <option value="">Choose a program</option>
              {programs.map((p) => <option key={p.id} value={p.id} disabled={isPaused(p)}>{p.name}{isPaused(p) ? ` (${p.capacity}: paused)` : ""}</option>)}
            </Select>
          </div>
        </div>
        <FieldError>{err}</FieldError>
        {org ? <p className="flex items-center gap-1.5 text-xs text-ink-3"><SkipForward size={12} /> {NURTURE_TEMPLATES[template].map((s) => `${s.kind} (day ${s.day})`).join(" → ")}</p> : null}
      </div>
    </Dialog>
  );
}
