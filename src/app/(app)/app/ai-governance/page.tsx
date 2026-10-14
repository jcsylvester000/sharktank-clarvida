"use client";
import { useState } from "react";
import { Ban, CircleCheck, CircleX, FileText } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useNow } from "@/lib/store/hooks";
import { audit } from "@/lib/services/core";
import { MODEL_ID } from "@/lib/ai/gateway";
import { ago, pct } from "@/lib/format";
import type { AIFeature, AILogEntry, PromptTemplate } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Badge, type Tone } from "@/components/ui/badge";
import { Dialog, Tabs, TabList, Tab, TabPanel } from "@/components/ui/overlays";
import { PageHeader, Stat, Callout } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";

const FEATURE: Record<AIFeature, string> = { AI01: "Organization brief", AI02: "Outreach draft", AI03: "Talking points", AI04: "Weekly plan wording", AI05: "Event summary", AI06: "Ask the Co-Pilot" };
const RESULT_TONE: Record<AILogEntry["result"], Tone> = { Viewed: "neutral", Generated: "teal", "Approved and queued": "ok", "Edited and approved": "ok", Blocked: "crit", Answered: "teal", Refused: "warn" };
const CAP = 200;

export default function AIGovernance() {
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const now = useNow(30_000);
  const [only, setOnly] = useState<"all" | "blocked">("all");
  const [open, setOpen] = useState<PromptTemplate | null>(null);

  const log = db.ailog.filter((l) => only === "all" || l.result === "Blocked" || l.result === "Refused");
  const drafts = db.ailog.filter((l) => l.feature === "AI02");
  const approved = drafts.filter((l) => l.result === "Approved and queued" || l.result === "Edited and approved").length;
  const blocked = db.ailog.filter((l) => l.result === "Blocked").length;
  const refused = db.ailog.filter((l) => l.result === "Refused").length;
  const failing = db.evals.filter((e) => e.passed / e.cases < e.threshold);
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const usage = db.users.map((u) => ({ u, n: db.ailog.filter((l) => l.userId === u.id && l.at >= monthStart.getTime() && l.result !== "Blocked").length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);

  const viewTemplate = (t: PromptTemplate) => {
    setOpen(t);
    mutate((d) => audit(d, { action: `Viewed prompt template ${t.id} ${t.version}`, objectId: t.id, zone: "Outreach", category: "ai" }));
  };

  return (
    <div>
      <PageHeader
        title="AI Governance"
        description="Every AI call, the approved templates behind it, and the tests that must pass before a release. AI only ever sees organization, program and aggregate data."
        meta={<Badge tone="outline">{MODEL_ID}</Badge>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="AI calls logged" value={db.ailog.length} />
        <Stat label="Drafts approved by a person" value={approved ? "100%" : "—"} tone="ok" sub={`${approved} approved, 0 sent without review`} />
        <Stat label="Blocked: client details" value={blocked} tone={blocked ? "crit" : undefined} sub="Stopped before the model" />
        <Stat label="Refused questions" value={refused} tone={refused ? "warn" : undefined} sub="About people or referrals" />
      </div>
      {failing.length ? (
        <Callout tone="crit" className="mb-5" icon={<Ban size={18} className="text-crit" />} title="Release blocked">
          {failing.map((e) => `${e.suite} passed ${e.passed} of ${e.cases} (needs ${pct(e.threshold)})`).join("; ")}. Template changes can't ship until every suite meets its threshold.
        </Callout>
      ) : null}

      <Tabs defaultValue="log">
        <TabList className="mb-4">
          <Tab value="log">Call log</Tab>
          <Tab value="templates">Prompt templates</Tab>
          <Tab value="evals">Evaluations</Tab>
          <Tab value="usage">Usage</Tab>
        </TabList>

        <TabPanel value="log">
          <div className="mb-3 flex gap-1.5" role="group" aria-label="Filter">
            {(["all", "blocked"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={only === v} onClick={() => setOnly(v)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", only === v ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2")}>
                {v === "all" ? "All calls" : "Blocked and refused"}
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-line bg-surface" data-guide="ai-log">
            <Table>
              <THead><tr><TH>When</TH><TH>Who</TH><TH>Feature</TH><TH>Template</TH><TH>Model</TH><TH>Object</TH><TH>Result</TH></tr></THead>
              <tbody>
                {log.slice(0, 150).map((l) => (
                  <TR key={l.id} className={l.result === "Blocked" ? "bg-crit-tint/40" : undefined}>
                    <TD className="whitespace-nowrap">{ago(l.at, now)}</TD>
                    <TD>{db.users.find((u) => u.id === l.userId)?.name ?? "System"}</TD>
                    <TD>{FEATURE[l.feature]}</TD>
                    <TD className="font-mono text-xs">{l.templateId} {l.templateVersion}</TD>
                    <TD className="text-xs text-ink-2">{l.modelId === "—" ? "Not called" : "Simulated"}</TD>
                    <TD className="font-mono text-xs">{l.objectId}</TD>
                    <TD><Badge tone={RESULT_TONE[l.result]}>{l.result}{l.blockedCategory ? `: ${l.blockedCategory}` : ""}</Badge></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        </TabPanel>

        <TabPanel value="templates">
          <div className="rounded-lg border border-line bg-surface">
            <Table>
              <THead><tr><TH>Template</TH><TH>Version</TH><TH>Status</TH><TH>Approved by</TH><TH>Allowed inputs</TH><TH /></tr></THead>
              <tbody>
                {db.prompts.map((t) => (
                  <TR key={t.id}>
                    <TD><span className="font-medium">{t.name}</span><span className="block font-mono text-xs text-ink-3">{t.id}</span></TD>
                    <TD className="font-mono text-xs">{t.version}</TD>
                    <TD><Badge tone={t.status === "Approved" ? "ok" : "hl"}>{t.status}</Badge></TD>
                    <TD className="text-sm">{t.approvedBy}<span className="block text-xs text-ink-3">{ago(t.updatedAt, now)}</span></TD>
                    <TD className="max-w-[20rem] text-sm text-ink-2">{t.allowedInputs}</TD>
                    <TD><Button size="sm" variant="ghost" onClick={() => viewTemplate(t)}><FileText size={14} /> Open</Button></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-ink-3">Templates are versioned and approved by Marketing and Compliance. No template accepts referral or client data as an input.</p>
        </TabPanel>

        <TabPanel value="evals">
          <div className="rounded-lg border border-line bg-surface">
            <Table>
              <THead><tr><TH>Test suite</TH><TH className="text-right">Cases</TH><TH className="text-right">Passed</TH><TH className="text-right">Needs</TH><TH>Result</TH></tr></THead>
              <tbody>
                {db.evals.map((e) => {
                  const pass = e.passed / e.cases >= e.threshold;
                  return (
                    <TR key={e.suite}>
                      <TD className="font-medium">{e.suite}</TD>
                      <TD className="text-right tabular">{e.cases}</TD>
                      <TD className="text-right tabular">{e.passed} ({pct(e.passed / e.cases, 1)})</TD>
                      <TD className="text-right tabular">{pct(e.threshold)}</TD>
                      <TD>{pass ? <Badge tone="ok" icon={<CircleCheck size={12} />}>Pass</Badge> : <Badge tone="crit" icon={<CircleX size={12} />}>Fail: release blocked</Badge>}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-ink-3">Suites re-run on every model or template change. Thresholds are agreed with Compliance.</p>
        </TabPanel>

        <TabPanel value="usage">
          <Panel>
            <PanelHeader title="Calls this month" description={`Each person has a monthly cap of ${CAP} calls to control cost.`} />
            <PanelBody className="space-y-3">
              {usage.length === 0 ? <p className="text-sm text-ink-3">No AI calls this month yet.</p> : usage.map(({ u, n }) => (
                <div key={u.id}>
                  <div className="flex justify-between text-sm"><span>{u.name}</span><span className="tabular text-ink-2">{n} / {CAP}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-sunken"><div className="h-2 rounded-full bg-teal" style={{ width: `${Math.min(100, (n / CAP) * 100)}%` }} /></div>
                </div>
              ))}
            </PanelBody>
          </Panel>
        </TabPanel>
      </Tabs>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={open ? `${open.name} (${open.id} ${open.version})` : ""} description={open ? `Allowed inputs: ${open.allowedInputs}` : undefined} wide
        footer={<Button variant="secondary" onClick={() => setOpen(null)}>Close</Button>}>
        <pre className="whitespace-pre-wrap rounded-md bg-canvas p-3 font-mono text-xs leading-relaxed text-ink">{open?.body}</pre>
        <p className="mt-2 text-xs text-ink-3">Read only. Changes go through Marketing and Compliance approval and the evaluation suites.</p>
      </Dialog>
    </div>
  );
}
