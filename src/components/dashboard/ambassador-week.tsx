"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowUpRight, NotebookPen, RefreshCw, Sparkles, Clock3 } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { href } from "@/lib/access";
import { REASON_LABEL, weeklyPlan, isPaused } from "@/lib/rules/outreach";
import { planReason } from "@/lib/ai/gateway";
import { phiScan } from "@/lib/rules/phi";
import { logTouch, recordBlocked, refreshPlan, setTaskDone } from "@/lib/services/outreach";
import { daysSince } from "@/lib/format";
import type { TouchType } from "@/lib/domain/types";
import { CapacityChip, StageChip } from "@/components/domain/chips";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, Stat } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Dialog, Tip } from "@/components/ui/overlays";
import { Label, Select, Segmented, Textarea } from "@/components/ui/field";
import { cn } from "@/components/ui/cn";
import { now as clockNow } from "@/lib/clock";

const D = 86_400_000;

/** The ambassador's week (v2 My Week, now embedded in the role-aware dashboard PG-06). */
export function AmbassadorWeek({ lead = false }: { lead?: boolean }) {
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const now = useNow(60_000);
  const ambassadors = db.users.filter((u) => u.role === "ambassador" && (me.scope.includes("ALL") || u.scope.some((s) => me.scope.includes(s))));
  const [viewId, setViewId] = useState(me.role === "ambassador" ? me.id : ambassadors[0]?.id ?? me.id);
  const owner = db.users.find((u) => u.id === viewId)!;
  const [logOpen, setLogOpen] = useState(false);

  const plan = useMemo(() => weeklyPlan(db.tasks, db.orgs, viewId), [db.tasks, db.orgs, viewId]);
  const doneThisWeek = db.tasks.filter((t) => t.ownerId === viewId && t.done && t.doneAt && now - t.doneAt < 7 * D);
  const owned = db.orgs.filter((o) => o.ownerId === viewId);
  const events = db.events.filter((e) => e.status === "Published" && e.orgIds.some((id) => owned.some((o) => o.id === id)) && now - Date.parse(e.date) < 60 * D);
  const quiet = owned.filter((o) => o.stage === "Quiet" || o.stage === "Dormant" || o.stage === "At risk").sort((a, b) => (a.lastReferralAt ?? 0) - (b.lastReferralAt ?? 0));
  const progs = db.programs.filter((p) => owner.scope.includes(p.state));
  const touches = db.touches.filter((t) => t.byUserId === viewId && now - t.at < 7 * D).length;
  const sends = db.sendCounts[viewId] ?? 0;
  const org = (id: string) => db.orgs.find((o) => o.id === id);
  const firstName = owner.name.split(" ")[0];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl text-cv-teal">{lead || me.id !== viewId ? `${firstName}'s week` : "Your week"}</h2>
          <p className="text-sm text-ink-2">{owned.length} organizations in {me.id === viewId ? "your" : "the"} territory, {plan.length} actions this week. Each one says why it matters.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {me.role !== "ambassador" ? (
            <Select aria-label="Ambassador" value={viewId} onChange={(e) => setViewId(e.target.value)} className="h-9 w-auto rounded-full">
              {ambassadors.map((a) => <option key={a.id} value={a.id}>{a.name}, {a.office}</option>)}
            </Select>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => setLogOpen(true)}><NotebookPen size={15} /> Log a visit or call</Button>
          <Button variant="ghost" size="sm" onClick={() => { let n = 0; mutate((d) => { n = refreshPlan(d, viewId, clockNow()); }); toast.success(n ? `Plan updated: ${n} new ${n === 1 ? "action" : "actions"}` : "Plan is up to date"); }}>
            <RefreshCw size={15} /> Refresh plan
          </Button>
        </div>
      </div>


      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel data-guide="plan">
          <PanelHeader title="This week's plan" description="Ranked by what will keep referrals flowing. About 5 minutes to read, not hours of research." />
          <ol className="divide-y divide-line-2">
            {plan.length === 0 ? <li className="px-5 py-8 text-center text-sm text-ink-2">Nothing open. Refresh the plan to pull new actions from your territory.</li> : null}
            {plan.map((t, i) => {
              const o = org(t.orgId);
              return (
                <li key={t.id} className="flex gap-4 px-5 py-4">
                  <span className="mt-0.5 font-display text-lg font-semibold text-ink-3 tabular">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={t.reason === "event" ? "crit" : t.reason === "quiet" ? "warn" : t.reason === "new_high_fit" ? "teal" : "neutral"}>{REASON_LABEL[t.reason]}</Badge>
                      <span className="inline-flex items-center gap-1 text-xs text-ink-3"><Clock3 size={12} /> {t.minutes} min</span>
                    </div>
                    <p className="mt-1.5 font-medium">{t.text}</p>
                    <p className="mt-0.5 flex items-start gap-1.5 text-sm text-ink-2">
                      <Tip content="Written by the simulated model from organization data only. Production: AWS Bedrock.">
                        <Sparkles size={14} className="mt-0.5 shrink-0 text-teal" aria-label="AI-written reason" />
                      </Tip>
                      {planReason(t, o, db.events, now)}
                    </p>
                    {o ? (
                      <Link href={href("/app/organization", { id: o.id, ...(t.reason === "quiet" || t.reason === "new_high_fit" || t.reason === "event" ? { tab: "outreach" } : {}) })} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
                        {t.reason === "quiet" || t.reason === "new_high_fit" || t.reason === "event" ? "Draft outreach" : "Open"}: {o.name} <ArrowUpRight size={14} />
                      </Link>
                    ) : null}
                  </div>
                  <label className="flex shrink-0 cursor-pointer items-start gap-2 text-sm text-ink-2">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-teal" checked={t.done} onChange={(e) => { const v = e.target.checked; mutate((d) => setTaskDone(d, t.id, v)); toast.success("Task completed", { action: { label: "Undo", onClick: () => mutate((d) => setTaskDone(d, t.id, false)) } }); }} />
                    Done
                  </label>
                </li>
              );
            })}
          </ol>
          {doneThisWeek.length ? (
            <div className="border-t border-line-2 px-5 py-3">
              <p className="text-xs font-medium text-ink-3">Done this week</p>
              <ul className="mt-1 space-y-1">
                {doneThisWeek.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-sm text-ink-3">
                    <span className="line-through">{t.text}</span>
                    <button className="text-xs text-teal hover:underline" onClick={() => mutate((d) => setTaskDone(d, t.id, false))}>Reopen</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Done" value={doneThisWeek.length} sub="this week" />
            <Stat label="Touches logged" value={touches} sub="this week" />
          </div>

          <Panel>
            <PanelHeader title="Sources gone quiet" description="Organizations whose referrals stopped." />
            <ul className="divide-y divide-line-2">
              {quiet.length === 0 ? <li className="px-5 py-5 text-sm text-ink-2">No quiet sources. Nice work.</li> : null}
              {quiet.map((o) => (
                <li key={o.id}>
                  <Link href={href("/app/organization", { id: o.id })} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{o.name}</span>
                      <span className="text-xs text-ink-3">Last referral {o.lastReferralAt ? `${daysSince(o.lastReferralAt, now)} days ago` : "never"}</span>
                    </span>
                    <StageChip stage={o.stage} />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Program openings" description="Outreach pauses automatically for full programs." actions={<Link href={href("/app/capacity")} className="text-sm text-teal hover:underline">Capacity Board</Link>} />
            <ul className="divide-y divide-line-2">
              {progs.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="block text-xs text-ink-3">{p.office}{isPaused(p) ? ", outreach paused" : ""}</span>
                  </span>
                  <CapacityChip capacity={p.capacity} stale={now - p.capacityUpdatedAt > 7 * D} />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <LogTouchDialog open={logOpen} onOpenChange={setLogOpen} orgs={owned.length ? owned : db.orgs.filter((o) => owner.scope.includes(o.state))} onSave={(orgId, type, note) => {
        const phi = phiScan(note);
        if (phi.blocked) {
          mutate((d) => recordBlocked(d, { objectId: orgId, category: phi.category!, where: "a visit note" }));
          return phi.category!;
        }
        mutate((d) => logTouch(d, { orgId, type, note }));
        toast.success(`${type} logged`);
        return null;
      }} />
    </div>
  );
}

function LogTouchDialog({ open, onOpenChange, orgs, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; orgs: { id: string; name: string }[]; onSave: (orgId: string, type: TouchType, note: string) => string | null }) {
  const [orgId, setOrgId] = useState("");
  const [type, setType] = useState<TouchType>("Visit");
  const [note, setNote] = useState("");
  const [blocked, setBlocked] = useState<string | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { onOpenChange(o); if (!o) { setBlocked(null); } }}
      title="Log a visit or call"
      description="Three fields. Notes are about the organization, never about clients."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!orgId} onClick={() => { const b = onSave(orgId, type, note); if (b) setBlocked(b); else { onOpenChange(false); setNote(""); setOrgId(""); setBlocked(null); } }}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="lt-org">Organization</Label>
          <Select id="lt-org" value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1">
            <option value="">Choose an organization</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Type</p>
          <Segmented label="Type" value={type} onChange={setType} options={(["Visit", "Call", "Email", "Event"] as const).map((v) => ({ value: v, label: v }))} />
        </div>
        <div>
          <Label htmlFor="lt-note">What happened</Label>
          <Textarea id="lt-note" value={note} onChange={(e) => { setNote(e.target.value); setBlocked(null); }} placeholder="e.g. Met the new discharge lead; follow up Nov 3" className={cn("mt-1", blocked && "border-crit")} />
          {blocked ? <p className="mt-1.5 rounded-md bg-crit-tint px-3 py-2 text-sm text-crit" role="alert">Blocked: possible client details ({blocked}). Notes are about organizations only. This was logged for Compliance.</p> : null}
        </div>
      </div>
    </Dialog>
  );
}

