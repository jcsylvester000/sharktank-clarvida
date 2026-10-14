"use client";
import { useState } from "react";
import { toast } from "sonner";
import { CirclePause, Clock3, Pencil } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { accessForUser, pageById } from "@/lib/access";
import { phiScan } from "@/lib/rules/phi";
import { isPaused } from "@/lib/rules/outreach";
import { setCapacity, recordBlocked } from "@/lib/services/outreach";
import type { Capacity, Program } from "@/lib/domain/types";
import { CapacityChip } from "@/components/domain/chips";
import { Button } from "@/components/ui/button";
import { Callout, PageHeader, Stat } from "@/components/ui/misc";
import { Dialog } from "@/components/ui/overlays";
import { Input, Label, Segmented } from "@/components/ui/field";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { ago } from "@/lib/format";

const D = 86_400_000;

export default function CapacityBoard() {
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const now = useNow(60_000);
  const canEdit = accessForUser(pageById("PG-17"), me) === "full";
  const programs = db.programs.filter((p) => me.scope.includes("ALL") || me.scope.includes(p.state));
  const stale = programs.filter((p) => now - p.capacityUpdatedAt > 7 * D);
  const [editing, setEditing] = useState<Program | null>(null);
  const [lastChange, setLastChange] = useState<{ program: string; paused: boolean; capacity: Capacity } | null>(null);
  const ambassadors = (state: string) => db.users.filter((u) => u.role === "ambassador" && u.scope.includes(state)).length;

  return (
    <div>
      <PageHeader title="Capacity Board" description="Where openings actually exist. Waitlist or Closed pauses outreach for that program automatically, so we never push families toward a full program." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open" value={programs.filter((p) => p.capacity === "Open").length} tone="ok" />
        <Stat label="Limited" value={programs.filter((p) => p.capacity === "Limited").length} tone="warn" />
        <Stat label="Waitlist or closed" value={programs.filter(isPaused).length} tone="warn" sub="Outreach paused" />
        <Stat label="Not updated in 7 days" value={stale.length} sub="Owner reminded" tone={stale.length ? "warn" : undefined} />
      </div>
      {lastChange ? (
        <Callout tone={lastChange.paused ? "warn" : "teal"} className="mb-4" icon={<CirclePause size={18} className={lastChange.paused ? "text-crit" : "text-ok"} />}
          title={lastChange.paused ? `Outreach paused for ${lastChange.program}` : `${lastChange.program} is ${lastChange.capacity}`}>
          {lastChange.paused ? "Recommendations, drafts and sends for this program are turned off. Ambassadors were notified. New referrals still arrive and go to On hold with an honest status." : "Ambassadors can recommend and draft outreach for this program again."}
        </Callout>
      ) : null}
      {stale.length ? (
        <Callout tone="warn" className="mb-4" icon={<Clock3 size={18} className="text-warn" />} title={`${stale.length} ${stale.length === 1 ? "program hasn't" : "programs haven't"} been updated in 7 days`}>
          Stale capacity makes outreach unreliable. Owners get a reminder each week.
        </Callout>
      ) : null}
      <div className="rounded-lg border border-line bg-surface" data-guide="capacity">
        <Table>
          <THead><tr><TH>Program</TH><TH>Office</TH><TH>Status</TH><TH>Note</TH><TH>Expected reopen</TH><TH>Updated</TH>{canEdit ? <TH /> : null}</tr></THead>
          <tbody>
            {programs.map((p) => (
              <TR key={p.id}>
                <TD>
                  <span className="font-medium">{p.name}</span>
                  <span className="block text-xs text-ink-3">Partner label: {p.partnerLabel}{p.part2 ? ", Part 2" : ""}</span>
                </TD>
                <TD>{p.office}, {p.state}</TD>
                <TD>
                  <CapacityChip capacity={p.capacity} stale={now - p.capacityUpdatedAt > 7 * D} />
                  {isPaused(p) ? <span className="mt-1 block text-xs font-semibold text-warn">Outreach paused</span> : null}
                </TD>
                <TD className="max-w-[16rem] text-ink-2">{p.capacityNote || "—"}</TD>
                <TD>{p.expectedReopen || "—"}</TD>
                <TD className="whitespace-nowrap text-ink-2">{ago(p.capacityUpdatedAt, now)}<span className="block text-xs text-ink-3">{db.users.find((u) => u.id === p.capacityUpdatedBy)?.name}</span></TD>
                {canEdit ? <TD><Button size="sm" variant="secondary" onClick={() => setEditing(p)}><Pencil size={13} /> Update</Button></TD> : null}
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
      {!canEdit ? <p className="mt-3 text-xs text-ink-3">View only for your role. Program managers and intake supervisors keep this current.</p> : null}
      <EditDialog program={editing} onClose={() => setEditing(null)} onSave={(cap, note, reopen) => {
        const p = editing!;
        const phi = phiScan(note);
        if (phi.blocked) { mutate((d) => recordBlocked(d, { objectId: p.id, category: phi.category!, where: "a capacity note" })); toast.error(`Blocked: possible client details (${phi.category}) in the note`); return false; }
        mutate((d) => setCapacity(d, p.id, cap, note, reopen), { entity: "program", id: p.id, action: "capacity" });
        const paused = cap === "Waitlist" || cap === "Closed";
        setLastChange({ program: `${p.name} (${p.office})`, paused, capacity: cap });
        toast.success(`${p.name} set to ${cap}${paused ? `: outreach paused, ${ambassadors(p.state)} ambassador${ambassadors(p.state) === 1 ? "" : "s"} notified` : ""}`);
        return true;
      }} />
    </div>
  );
}

function EditDialog({ program, onClose, onSave }: { program: Program | null; onClose: () => void; onSave: (c: Capacity, note: string, reopen: string) => boolean }) {
  const [cap, setCap] = useState<Capacity>("Open");
  const [note, setNote] = useState("");
  const [reopen, setReopen] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (program && loadedFor !== program.id) { setLoadedFor(program.id); setCap(program.capacity); setNote(program.capacityNote); setReopen(program.expectedReopen); }
  if (!program) return null;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) { onClose(); setLoadedFor(null); } }} title={`Update ${program.name}`} description={`${program.office}, ${program.state}. Takes about ten seconds.`}
      footer={<><Button variant="secondary" onClick={() => { onClose(); setLoadedFor(null); }}>Cancel</Button><Button onClick={() => { if (onSave(cap, note, reopen)) { onClose(); setLoadedFor(null); } }}>Save</Button></>}>
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">Status</p>
          <Segmented label="Capacity status" value={cap} onChange={setCap} options={(["Open", "Limited", "Waitlist", "Closed"] as const).map((v) => ({ value: v, label: v }))} />
          {cap === "Waitlist" || cap === "Closed" ? <p className="mt-2 text-sm font-medium text-warn">Outreach for this program will pause and ambassadors will be notified.</p> : null}
        </div>
        <div><Label htmlFor="cap-note">Note (optional)</Label><Input id="cap-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Waitlist about 6 weeks" className="mt-1" /></div>
        <div><Label htmlFor="cap-reopen">Expected reopen (optional)</Label><Input id="cap-reopen" value={reopen} onChange={(e) => setReopen(e.target.value)} placeholder="e.g. Jan 2027" className="mt-1" /></div>
      </div>
    </Dialog>
  );
}
