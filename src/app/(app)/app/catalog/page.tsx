"use client";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, FileJson, Pencil } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { accessForUser, pageById } from "@/lib/access";
import { audit } from "@/lib/services/core";
import { updateProgramCopy, verifyProgram } from "@/lib/services/admin";
import { phiScan } from "@/lib/rules/phi";
import { ago, pct } from "@/lib/format";
import type { Program } from "@/lib/domain/types";
import { CapacityChip } from "@/components/domain/chips";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/overlays";
import { PageHeader, Stat } from "@/components/ui/misc";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";

const D = 86_400_000;
const STALE_DAYS = 90;

export default function ProgramCatalog() {
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const now = useNow(60_000);
  const canEdit = accessForUser(pageById("PG-18"), me) === "full";
  const states = me.scope.includes("ALL") ? ["NC", "CO"] : me.scope;
  const programs = db.programs.filter((p) => states.includes(p.state));
  const stale = (p: Program) => now - p.verifiedAt > STALE_DAYS * D;
  const verified = programs.filter((p) => !stale(p)).length;
  const [editing, setEditing] = useState<Program | null>(null);

  const exportJson = () => {
    const pub = programs.map((p) => ({ id: p.id, state: p.state, office: p.office, program: p.partnerLabel, ages: `${p.ageMin}–${p.ageMax}`, coverage: p.payers, counties: p.counties, description: p.description, capacity: p.capacity, verified: new Date(p.verifiedAt).toISOString().slice(0, 10) }));
    const blob = new Blob([JSON.stringify({ generated: new Date().toISOString(), programs: pub }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "clarvida-partner-catalog.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    mutate((d) => audit(d, { action: `Exported partner program catalog (JSON, ${pub.length} programs)`, zone: "Outreach", category: "export" }));
    toast.success("Catalog exported. Partner-facing fields only.");
  };

  return (
    <div>
      <PageHeader
        title="Program Catalog"
        description="The one list partners see: generic program names, ages, coverage and counties. Each program has an owner who verifies it at least every 90 days."
        actions={<Button variant="secondary" size="sm" onClick={exportJson}><FileJson size={14} /> Export for partner sites</Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Programs" value={programs.length} />
        <Stat label="Verified in 90 days" value={pct(verified / Math.max(1, programs.length))} tone={verified === programs.length ? "ok" : "warn"} sub="Target 100%" />
        <Stat label="Need verification" value={programs.length - verified} tone={programs.length - verified ? "warn" : undefined} />
        <Stat label="Part 2 programs" value={programs.filter((p) => p.part2).length} sub="Extra consent rules" tone="care" />
      </div>
      <div className="rounded-lg border border-line bg-surface" data-guide="catalog">
        <Table>
          <THead><tr><TH>Program</TH><TH>Partners see</TH><TH>Office</TH><TH>Ages</TH><TH>Coverage</TH><TH>Counties</TH><TH>Capacity</TH><TH>Verified</TH>{canEdit ? <TH /> : null}</tr></THead>
          <tbody>
            {programs.map((p) => (
              <TR key={p.id}>
                <TD><span className="font-medium">{p.name}</span>{p.part2 ? <Badge tone="care" className="ml-1.5">Part 2</Badge> : null}<span className="block text-xs text-ink-3">Owner: {db.users.find((u) => u.id === p.ownerId)?.name ?? "—"}</span></TD>
                <TD className="max-w-[16rem]"><span className="text-sm">{p.partnerLabel}</span><span className="block text-xs text-ink-3 line-clamp-2">{p.description}</span></TD>
                <TD className="whitespace-nowrap">{p.office}, {p.state}</TD>
                <TD className="tabular whitespace-nowrap">{p.ageMin}–{p.ageMax}</TD>
                <TD className="text-sm text-ink-2">{p.payers}</TD>
                <TD className="text-sm text-ink-2">{p.counties.join(", ")}</TD>
                <TD><CapacityChip capacity={p.capacity} /></TD>
                <TD className="whitespace-nowrap">{stale(p) ? <Badge tone="warn">Needs verification</Badge> : <span className="text-sm text-ink-2">{ago(p.verifiedAt, now)}</span>}</TD>
                {canEdit ? (
                  <TD className="whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => { mutate((d) => verifyProgram(d, p.id)); toast.success(`${p.name} verified`); }} aria-label={`Verify ${p.name}`}><BadgeCheck size={14} /> Verify</Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}><Pencil size={14} /></Button>
                  </TD>
                ) : null}
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
      {!canEdit ? <p className="mt-3 text-xs text-ink-3">View only for your role.</p> : null}
      <EditDialog p={editing} onClose={() => setEditing(null)} onSave={(label, desc) => {
        const scan = phiScan(`${label} ${desc}`);
        if (scan.blocked) { toast.error(`Blocked: possible client details (${scan.category})`); return false; }
        mutate((d) => updateProgramCopy(d, editing!.id, label, desc));
        toast.success("Saved and marked verified");
        return true;
      }} />
    </div>
  );
}

function EditDialog({ p, onClose, onSave }: { p: Program | null; onClose: () => void; onSave: (label: string, desc: string) => boolean }) {
  const [label, setLabel] = useState("");
  const [desc, setDesc] = useState("");
  const [for_, setFor] = useState<string | null>(null);
  if (p && for_ !== p.id) { setFor(p.id); setLabel(p.partnerLabel); setDesc(p.description); }
  if (!p) return null;
  const close = () => { setFor(null); onClose(); };
  return (
    <Dialog open onOpenChange={(o) => !o && close()} title={`Edit ${p.name}`} description="What partners see on the referral form and kits. Keep it generic: no clinical claims or promises about openings."
      footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button onClick={() => { if (onSave(label.trim(), desc.trim())) close(); }} disabled={!label.trim()}>Save</Button></>}>
      <div className="space-y-4">
        <div><Label htmlFor="pl">Partner-facing name</Label><Input id="pl" value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1" /></div>
        <div><Label htmlFor="pd">Description</Label><Textarea id="pd" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-1" /></div>
      </div>
    </Dialog>
  );
}
