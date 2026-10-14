"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Search } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { href } from "@/lib/access";
import { audit } from "@/lib/services/core";
import { reassignOrg } from "@/lib/services/outreach";
import { downloadCsv } from "@/lib/csv";
import { ago, plural } from "@/lib/format";
import type { Organization, Stage } from "@/lib/domain/types";
import { StageChip } from "@/components/domain/chips";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Empty, PageHeader, Stat } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";

const STAGES: Stage[] = ["Active", "Engaged", "New", "Quiet", "At risk", "Dormant"];
const TONE: Partial<Record<Stage, "ok" | "teal" | "warn" | "crit">> = { Active: "ok", Engaged: "teal", Quiet: "warn", "At risk": "crit", Dormant: "crit" };

function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <span className="inline-flex h-5 items-end gap-[2px]" aria-label={`Referrals by month, last 6 months: ${values.join(", ")}`} role="img">
      {values.map((v, i) => (
        <span key={i} className="w-1.5 rounded-t-sm bg-s1" style={{ height: `${Math.max(2, (v / max) * 20)}px`, opacity: v ? 1 : 0.25 }} />
      ))}
    </span>
  );
}

export default function PartnerDirectory() {
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const now = useNow(60_000);
  const isLead = me.role === "amb_lead";
  const states = me.scope.includes("ALL") ? ["NC", "CO"] : me.scope;
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<Stage | null>(null);
  const [owner, setOwner] = useState<string>(me.role === "ambassador" ? me.id : "all");
  const [st, setSt] = useState<string>("all");

  const ambassadors = db.users.filter((u) => u.role === "ambassador" && u.scope.some((s) => states.includes(s)));
  const inScope = db.orgs.filter((o) => states.includes(o.state));
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return inScope
      .filter((o) => (st === "all" || o.state === st) && (owner === "all" || o.ownerId === owner) && (!stage || o.stage === stage))
      .filter((o) => !n || [o.name, o.type, o.county, ...o.contacts.map((c) => c.role)].some((s) => s.toLowerCase().includes(n)))
      .sort((a, b) => STAGES.indexOf(b.stage) - STAGES.indexOf(a.stage) || (b.referrals90d - a.referrals90d));
  }, [inScope, q, st, owner, stage]);

  const team = ambassadors.map((u) => {
    const mine = inScope.filter((o) => o.ownerId === u.id);
    return { u, orgs: mine.length, quiet: mine.filter((o) => ["Quiet", "At risk", "Dormant"].includes(o.stage)).length, open: db.tasks.filter((t) => t.ownerId === u.id && !t.done).length, done: db.tasks.filter((t) => t.ownerId === u.id && t.done && t.doneAt && now - t.doneAt < 7 * 86_400_000).length };
  });

  const exportCsv = () => {
    downloadCsv("partner-directory.csv", ["Organization", "Type", "County", "State", "Stage", "Owner", "Referrals 90 days", "Last touch"], rows.map((o) => [o.name, o.type, o.county, o.state, o.stage, db.users.find((u) => u.id === o.ownerId)?.name ?? "", o.referrals90d, o.lastTouchAt ? new Date(o.lastTouchAt).toISOString().slice(0, 10) : ""]));
    mutate((d) => audit(d, { action: `Exported partner directory (${rows.length} organizations, no client data)`, zone: "Outreach", category: "export" }));
    toast.success("Exported. Logged in the audit trail.");
  };

  const reassign = (o: Organization, uid: string) => {
    mutate((d) => reassignOrg(d, o.id, uid));
    toast.success(`${o.name} moved to ${db.users.find((u) => u.id === uid)?.name}. Open tasks moved too.`);
  };

  return (
    <div>
      <PageHeader
        title="Partner Directory"
        description="Every partner organization, who owns the relationship, and how it is doing. Stages update from referrals and visits automatically."
        actions={<Button variant="secondary" size="sm" onClick={exportCsv}><Download size={14} /> Export CSV</Button>}
      />

      <div className="mb-5 grid grid-cols-3 gap-3 md:grid-cols-6">
        {STAGES.map((s) => (
          <Stat key={s} label={s} value={inScope.filter((o) => o.stage === s).length} tone={TONE[s]} onClick={() => setStage((x) => (x === s ? null : s))} active={stage === s} />
        ))}
      </div>

      {isLead || me.role === "marketing" ? (
        <Panel className="mb-5">
          <PanelHeader title="Team this week" description="Relationships per ambassador, how many need attention, and plan progress." />
          <PanelBody className="p-0">
            <Table>
              <THead><tr><TH>Ambassador</TH><TH className="text-right">Organizations</TH><TH className="text-right">Need attention</TH><TH className="text-right">Open actions</TH><TH className="text-right">Done in 7 days</TH><TH /></tr></THead>
              <tbody>
                {team.map(({ u, orgs, quiet, open, done }) => (
                  <TR key={u.id}>
                    <TD><span className="font-medium">{u.name}</span><span className="block text-xs text-ink-3">{u.office}</span></TD>
                    <TD className="text-right tabular">{orgs}</TD>
                    <TD className={`text-right tabular ${quiet ? "font-semibold text-warn" : ""}`}>{quiet}</TD>
                    <TD className="text-right tabular">{open}</TD>
                    <TD className="text-right tabular">{done}</TD>
                    <TD><Button size="sm" variant="ghost" onClick={() => setOwner(u.id)}>Show</Button></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </PanelBody>
        </Panel>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <label htmlFor="dir-q" className="sr-only">Search organizations</label>
          <Input id="dir-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, type, county or contact role" className="pl-8" />
        </div>
        <label className="sr-only" htmlFor="dir-owner">Owner</label>
        <Select id="dir-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className="w-48">
          <option value="all">All owners</option>
          {ambassadors.map((u) => <option key={u.id} value={u.id}>{u.id === me.id ? "Mine" : u.name}</option>)}
        </Select>
        {states.length > 1 ? (
          <>
            <label className="sr-only" htmlFor="dir-state">State</label>
            <Select id="dir-state" value={st} onChange={(e) => setSt(e.target.value)} className="w-32">
              <option value="all">All states</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </>
        ) : null}
        {stage || q || owner !== "all" || st !== "all" ? <Button variant="link" size="sm" onClick={() => { setStage(null); setQ(""); setOwner("all"); setSt("all"); }}>Clear filters</Button> : null}
        <span className="ml-auto text-sm text-ink-3">{plural(rows.length, "organization")}</span>
      </div>

      <div className="rounded-lg border border-line bg-surface" data-guide="directory">
        {rows.length === 0 ? (
          <Empty title="No organizations match" className="m-4">Clear a filter or search for something else.</Empty>
        ) : (
          <Table>
            <THead><tr><TH>Organization</TH><TH>Stage</TH><TH>Owner</TH><TH>Referrals, 6 months</TH><TH>Last referral</TH><TH>Last touch</TH><TH className="text-right">Contacts</TH></tr></THead>
            <tbody>
              {rows.map((o) => (
                <TR key={o.id}>
                  <TD>
                    <Link href={href("/app/organization", { id: o.id })} className="font-medium hover:underline">{o.name}</Link>
                    <span className="block text-xs text-ink-3">{o.type}, {o.county} County, {o.state}</span>
                  </TD>
                  <TD><StageChip stage={o.stage} /></TD>
                  <TD>
                    {isLead ? (
                      <>
                        <label className="sr-only" htmlFor={`own-${o.id}`}>Owner of {o.name}</label>
                        <Select id={`own-${o.id}`} value={o.ownerId} onChange={(e) => reassign(o, e.target.value)} className="h-8 w-40 text-sm">
                          {ambassadors.filter((u) => u.scope.includes(o.state)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </Select>
                      </>
                    ) : (
                      <span className="text-sm">{db.users.find((u) => u.id === o.ownerId)?.name ?? "Unassigned"}</span>
                    )}
                  </TD>
                  <TD><Spark values={o.monthly} /></TD>
                  <TD className="whitespace-nowrap text-sm text-ink-2">{o.lastReferralAt ? ago(o.lastReferralAt, now) : "Never"}</TD>
                  <TD className="whitespace-nowrap text-sm text-ink-2">{o.lastTouchAt ? ago(o.lastTouchAt, now) : "Never"}</TD>
                  <TD className="text-right tabular">{o.contacts.filter((c) => !c.optOut).length}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </div>
      <p className="mt-3 text-xs text-ink-3">Organization data only (classes C0 and C2). No referral or client details appear in the directory.</p>
    </div>
  );
}
