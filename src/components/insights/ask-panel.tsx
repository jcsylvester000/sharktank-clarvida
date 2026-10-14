"use client";
import { useState } from "react";
import { Bot, Code2, SendHorizontal, ShieldBan } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { answer, SUGGESTED, type AskResult } from "@/lib/ai/ask";
import { useStream } from "@/lib/ai/use-stream";
import { MODEL_ID, TEMPLATES } from "@/lib/ai/gateway";
import { logAI } from "@/lib/services/outreach";
import { audit } from "@/lib/services/core";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";

/** AI06: plain-English questions over aggregate data. The question text is never stored (it could contain client details). */
export function AskPanel({ className }: { className?: string }) {
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [result, setResult] = useState<AskResult | null>(null);
  const [nonce, setNonce] = useState(0);
  const [showQuery, setShowQuery] = useState(false);
  const { shown, state, done } = useStream(result ? `${result.summary}${"​".repeat(nonce % 2)}` : null, { delayMs: 700 });

  const ask = (text: string) => {
    const t = text.trim();
    if (!t) return;
    const r = answer(db, t);
    setAsked(t);
    setResult(r);
    setNonce((n) => n + 1);
    setShowQuery(false);
    if (r.kind === "unknown") return;
    mutate((d) => {
      logAI(d, { feature: "AI06", templateId: TEMPLATES.ask.id, templateVersion: TEMPLATES.ask.version, objectId: r.kind === "answer" ? `mart:${r.intent}` : "mart", result: r.kind === "answer" ? "Answered" : "Refused" });
      audit(d, { action: r.kind === "answer" ? `Asked the Co-Pilot (${r.intent}): answered from aggregates` : "Ask the Co-Pilot refused a client-level question", zone: "Outreach", category: r.kind === "refused" ? "blocked" : "ai" });
    });
  };

  return (
    <Panel className={className} data-guide="ask">
      <PanelHeader title="Ask the Co-Pilot" description="Plain-English questions about sources, speed and partners. Totals only." actions={<Badge tone="teal" icon={<Bot size={12} />}>AI</Badge>} />
      <PanelBody className="space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2">
          <label htmlFor="ask-input" className="sr-only">Ask a question</label>
          <Input id="ask-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Which partners went quiet?" autoComplete="off" />
          <Button type="submit" size="icon" aria-label="Ask" disabled={!q.trim()}><SendHorizontal size={16} /></Button>
        </form>
        {result ? (
          <div className="rounded-md border border-line-2 bg-canvas/60 p-3" aria-live="polite">
            <p className="text-xs text-ink-3">You asked</p>
            <p className="text-sm font-medium text-ink">{asked}</p>
            <div className="mt-3 flex items-start gap-2">
              {result.kind === "refused" ? <ShieldBan size={16} className="mt-0.5 shrink-0 text-crit" /> : <Bot size={16} className="mt-0.5 shrink-0 text-teal" />}
              <p className={result.kind === "refused" ? "text-sm text-crit" : "text-sm text-ink"}>
                {state === "thinking" ? <span className="text-ink-3">Reading the aggregate tables…</span> : shown}
              </p>
            </div>
            {done && result.kind === "answer" ? (
              <>
                <div className="mt-3 max-h-64 overflow-auto rounded border border-line-2 bg-surface">
                  <Table>
                    <THead><tr>{result.columns.map((c) => <TH key={c}>{c}</TH>)}</tr></THead>
                    <tbody>
                      {result.rows.map((r, i) => (
                        <TR key={i}>{r.map((v, j) => <TD key={j} className={typeof v === "number" || /^[<\d]/.test(String(v)) ? "tabular" : undefined}>{v}</TD>)}</TR>
                      ))}
                    </tbody>
                  </Table>
                </div>
                <button type="button" onClick={() => setShowQuery((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink" aria-expanded={showQuery}>
                  <Code2 size={12} /> {showQuery ? "Hide" : "Show"} how this was calculated
                </button>
                {showQuery ? <pre className="mt-1 overflow-x-auto rounded bg-ink p-2.5 font-mono text-[0.7rem] leading-relaxed text-white/90">{result.query}</pre> : null}
              </>
            ) : null}
            {done && result.kind !== "unknown" ? (
              <p className="mt-2 text-[0.7rem] text-ink-3">{TEMPLATES.ask.id} {TEMPLATES.ask.version}. {MODEL_ID}. Logged; your question text is not stored.</p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-ink-3">Questions about a person or a referral are refused. Try one to see.</p>
        )}
        <div className="flex flex-wrap gap-1.5" aria-label="Suggested questions">
          {result ? <p className="w-full text-xs text-ink-3">Try another</p> : null}
          {SUGGESTED.map((s) => (
            <button key={s} type="button" onClick={() => { setQ(s); ask(s); }} className="rounded-full border border-line bg-surface px-2.5 py-1 text-left text-xs text-ink-2 hover:border-teal hover:text-teal-strong">
              {s}
            </button>
          ))}
        </div>

      </PanelBody>
    </Panel>
  );
}
