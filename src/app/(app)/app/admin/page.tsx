"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, GitPullRequestArrow, ShieldCheck, X } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { accessFor, PAGES, ROLE_LABEL } from "@/lib/access";
import { canDecide, decideChange, proposeChange, setCaps, setUserActive } from "@/lib/services/admin";
import { ago } from "@/lib/format";
import type { PendingChange, Role, RoutingRule } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Input, Label } from "@/components/ui/field";
import { Dialog, Switch, Tabs, TabList, Tab, TabPanel, Tip } from "@/components/ui/overlays";
import { Callout, PageHeader } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";

const ROLES = Object.keys(ROLE_LABEL) as Role[];

export default function AdminPage() {
  return <Suspense><Admin /></Suspense>;
}

function Admin() {
  const params = useSearchParams();
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const now = useNow(30_000);
  const [tab, setTab] = useState(params.get("tab") ?? "users");
  const [proposing, setProposing] = useState<RoutingRule | null>(null);
  const [sendCap, setSendCap] = useState(String(db.sendCap));
  const [orgCap, setOrgCap] = useState(String(db.orgSendCap));
  const [slaDraft, setSlaDraft] = useState<Record<string, string>>(() => Object.fromEntries(db.sla.map((s) => [s.state, String(s.targetHours)])));
  const waiting = db.pending.filter((c) => c.status === "Waiting for second approver");
  const name = (id?: string) => db.users.find((u) => u.id === id)?.name ?? "—";

  const decide = (c: PendingChange, approve: boolean) => {
    let ok = false;
    mutate((d) => { ok = decideChange(d, c.id, approve); }, { entity: "change", id: c.id, action: approve ? "approved" : "rejected" });
    if (ok) toast.success(approve ? "Approved and applied. Both approvals are in the audit log." : "Rejected");
  };

  return (
    <div>
      <PageHeader title="Administration" description="Users, roles, routing and response targets. Changes that affect where referrals go need a second administrator to approve them." />
      {waiting.length ? (
        <Callout tone="warn" className="mb-5" icon={<GitPullRequestArrow size={18} className="text-warn" />} title={`${waiting.length} ${waiting.length === 1 ? "change is" : "changes are"} waiting for a second approver`}
          action={<Button size="sm" variant="secondary" onClick={() => setTab("routing")}>Review</Button>}>
          The person who proposed a change can&apos;t approve it.
        </Callout>
      ) : null}
      <Tabs value={tab} onValueChange={setTab}>
        <TabList className="mb-4">
          <Tab value="users">Users</Tab>
          <Tab value="roles">Roles and access</Tab>
          <Tab value="routing">Routing{waiting.length ? ` (${waiting.length})` : ""}</Tab>
          <Tab value="targets">Response targets</Tab>
          <Tab value="limits">Send limits</Tab>
        </TabList>

        <TabPanel value="users">
          <div className="rounded-lg border border-line bg-surface" data-guide="admin-users">
            <Table>
              <THead><tr><TH>Name</TH><TH>Role</TH><TH>Scope</TH><TH>Office</TH><TH>MFA</TH><TH>Active</TH></tr></THead>
              <tbody>
                {db.users.map((u) => (
                  <TR key={u.id} className={!u.active ? "opacity-60" : undefined}>
                    <TD className="font-medium">{u.name}{u.id === me.id ? <span className="ml-1.5 text-xs text-ink-3">(you)</span> : null}</TD>
                    <TD>{ROLE_LABEL[u.role]}</TD>
                    <TD>{u.scope.includes("ALL") ? "All states" : u.scope.join(", ")}</TD>
                    <TD className="text-ink-2">{u.office}</TD>
                    <TD>{u.mfa ? <Badge tone="ok" icon={<ShieldCheck size={12} />}>On</Badge> : <Badge tone="crit">Off</Badge>}</TD>
                    <TD>
                      <Switch checked={u.active} disabled={u.id === me.id} onCheckedChange={(v) => { mutate((d) => setUserActive(d, u.id, v)); toast.success(`${u.name} ${v ? "enabled" : "disabled"}${v ? "" : ". They can't sign in."}`); }} label={<span className="sr-only">Active: {u.name}</span>} />
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-ink-3">Production: accounts come from Clarvida single sign-on; disabling here removes access to this tool only.</p>
        </TabPanel>

        <TabPanel value="roles">
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <Table>
              <THead><tr><TH>Page</TH>{ROLES.map((r) => <TH key={r} className="text-center text-xs">{ROLE_LABEL[r]}</TH>)}</tr></THead>
              <tbody>
                {PAGES.map((p) => (
                  <TR key={p.id}>
                    <TD><span className="font-medium">{p.title}</span><span className="block text-xs text-ink-3">{p.zone === "Care" ? "Care Zone" : p.zone === "Both" ? "Both zones" : "Outreach Zone"}</span></TD>
                    {ROLES.map((r) => {
                      const a = accessFor(p, r);
                      return <TD key={r} className="text-center">{a === "full" ? <Check size={16} className="mx-auto text-ok" aria-label="Full" /> : a === "read" ? <span className="text-xs text-ink-2">View</span> : <span className="text-ink-3" aria-label="No access">·</span>}</TD>;
                    })}
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-ink-3">Read only. Mirrors the Roles and Access sheet in the build breakdown. Scope by state applies on top.</p>
        </TabPanel>

        <TabPanel value="routing" className="space-y-5">
          <Panel>
            <PanelHeader title="Changes waiting for approval" description="A second administrator approves or rejects. Both decisions are logged." />
            <PanelBody className="p-0">
              {db.pending.length === 0 ? <p className="px-5 py-4 text-sm text-ink-3">No changes proposed.</p> : (
                <Table>
                  <THead><tr><TH>Change</TH><TH>Proposed by</TH><TH>Status</TH><TH /></tr></THead>
                  <tbody>
                    {db.pending.map((c) => (
                      <TR key={c.id}>
                        <TD><Badge tone="outline" className="mb-1">{c.area}</Badge><span className="block">{c.change}</span></TD>
                        <TD className="whitespace-nowrap">{name(c.proposedBy)}<span className="block text-xs text-ink-3">{ago(c.proposedAt, now)}</span></TD>
                        <TD>{c.status === "Waiting for second approver" ? <Badge tone="hl">Waiting</Badge> : <Badge tone={c.status === "Approved" ? "ok" : "crit"}>{c.status} by {name(c.decidedBy)}</Badge>}</TD>
                        <TD className="whitespace-nowrap">
                          {c.status === "Waiting for second approver" ? (
                            canDecide(c, me.id) ? (
                              <>
                                <Button size="sm" onClick={() => decide(c, true)}><Check size={14} /> Approve</Button>
                                <Button size="sm" variant="ghost" onClick={() => decide(c, false)}><X size={14} /> Reject</Button>
                              </>
                            ) : (
                              <Tip content="You proposed this change. A second administrator must approve it. Switch to Lena Ortiz (Ambassador Lead) to try."><span><Button size="sm" disabled>Approve</Button></span></Tip>
                            )
                          ) : null}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader title="Routing table" description="Which intake queue a referral lands in, by state, county and age." />
            <PanelBody className="p-0">
              <Table>
                <THead><tr><TH>State</TH><TH>Counties</TH><TH>Who</TH><TH>Ages</TH><TH>Queue</TH><TH /></tr></THead>
                <tbody>
                  {db.routing.map((r) => (
                    <TR key={r.id}>
                      <TD>{r.state === "*" ? "Any" : r.state}</TD>
                      <TD>{r.counties.join(", ")}</TD>
                      <TD>{r.family === "*" ? "Anyone" : r.family === "all" ? "All ages" : r.family === "child" ? "Children and families" : "Adults"}</TD>
                      <TD className="tabular">{r.ages}</TD>
                      <TD><span className="font-medium">{r.queueLabel}</span><span className="block font-mono text-xs text-ink-3">{r.queue}</span></TD>
                      <TD>{r.state !== "*" ? <Button size="sm" variant="secondary" onClick={() => setProposing(r)}>Propose change</Button> : null}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </PanelBody>
          </Panel>
        </TabPanel>

        <TabPanel value="targets">
          <div className="grid gap-5 md:grid-cols-2">
            {db.sla.map((s) => (
              <Panel key={s.state}>
                <PanelHeader title={`${s.state} response target`} description={`Business hours ${s.startHour}:00–${s.endHour}:00, ${s.timezone.replace("_", " ")}`} />
                <PanelBody className="space-y-4">
                  <div className="flex items-end gap-3">
                    <div>
                      <Label htmlFor={`sla-${s.state}`}>First contact within (business hours)</Label>
                      <Input id={`sla-${s.state}`} inputMode="numeric" value={slaDraft[s.state]} onChange={(e) => setSlaDraft({ ...slaDraft, [s.state]: e.target.value.replace(/\D/g, "").slice(0, 2) })} className="mt-1 w-28" />
                    </div>
                    <Button variant="secondary" disabled={!slaDraft[s.state] || Number(slaDraft[s.state]) === s.targetHours} onClick={() => {
                      const h = Number(slaDraft[s.state]);
                      mutate((d) => { proposeChange(d, { area: "Response targets", change: `Set ${s.state} first-contact target to ${h} business hours (was ${s.targetHours})`, payload: { kind: "sla", state: s.state, targetHours: h } }); });
                      toast.success("Proposed. A second administrator must approve it.");
                      setTab("routing");
                    }}>Propose change</Button>
                  </div>
                  <p className="text-sm text-ink-2">Currently {s.targetHours} business hours (stretch: {s.stretch.toLowerCase()}). Due-soon warning {s.dueSoonHours} h before.</p>
                  <div>
                    <p className="text-sm font-medium">Holidays (clock paused)</p>
                    <p className="mt-1 flex flex-wrap gap-1.5">{s.holidays.map((h) => <Badge key={h} tone="outline" className="font-mono">{h}</Badge>)}</p>
                  </div>
                </PanelBody>
              </Panel>
            ))}
          </div>
        </TabPanel>

        <TabPanel value="limits">
          <Panel className="max-w-xl">
            <PanelHeader title="Outreach send limits" description="Keeps partner email personal and within CAN-SPAM good practice." />
            <PanelBody className="space-y-4">
              <div><Label htmlFor="cap1">Emails per ambassador per week</Label><Input id="cap1" inputMode="numeric" value={sendCap} onChange={(e) => setSendCap(e.target.value.replace(/\D/g, "").slice(0, 3))} className="mt-1 w-28" /></div>
              <div><Label htmlFor="cap2">Emails per organization per week</Label><Input id="cap2" inputMode="numeric" value={orgCap} onChange={(e) => setOrgCap(e.target.value.replace(/\D/g, "").slice(0, 2))} className="mt-1 w-28" /></div>
              <Button disabled={!Number(sendCap) || !Number(orgCap)} onClick={() => { mutate((d) => setCaps(d, Number(sendCap), Number(orgCap))); toast.success("Send limits saved"); }}>Save limits</Button>
            </PanelBody>
          </Panel>
        </TabPanel>
      </Tabs>

      <ProposeDialog rule={proposing} onClose={() => setProposing(null)} />
    </div>
  );
}

function ProposeDialog({ rule, onClose }: { rule: RoutingRule | null; onClose: () => void }) {
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const [sel, setSel] = useState<string[]>([]);
  const [for_, setFor] = useState<string | null>(null);
  if (rule && for_ !== rule.id) { setFor(rule.id); setSel(rule.counties); }
  if (!rule) return null;
  const all = Array.from(new Set([...db.orgs.filter((o) => o.state === rule.state).map((o) => o.county), ...db.programs.filter((p) => p.state === rule.state).flatMap((p) => p.counties), ...rule.counties])).sort();
  const added = sel.filter((c) => !rule.counties.includes(c));
  const removed = rule.counties.filter((c) => !sel.includes(c));
  const close = () => { setFor(null); onClose(); };
  const submit = () => {
    const parts = [added.length ? `add ${added.join(", ")}` : "", removed.length ? `remove ${removed.join(", ")}` : ""].filter(Boolean).join(" and ");
    mutate((d) => { proposeChange(d, { area: "Routing table", change: `${rule.queueLabel} (${rule.queue}): ${parts}`, payload: { kind: "routing", ruleId: rule.id, counties: sel } }); });
    toast.success("Proposed. Another administrator was notified to approve it.");
    close();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && close()} title={`Change counties for ${rule.queueLabel}`} description="Nothing changes until a second administrator approves."
      footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button onClick={submit} disabled={!added.length && !removed.length || sel.length === 0}>Propose change</Button></>}>
      <div className="grid grid-cols-2 gap-2">
        {all.map((c) => <Checkbox key={c} checked={sel.includes(c)} onChange={(e) => setSel(e.target.checked ? [...sel, c] : sel.filter((x) => x !== c))} label={c} />)}
      </div>
    </Dialog>
  );
}
