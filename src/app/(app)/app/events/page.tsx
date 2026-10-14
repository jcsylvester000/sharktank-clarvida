"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bot, ExternalLink, Megaphone, Plus, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser } from "@/lib/store/hooks";
import { href, accessForUser, pageById } from "@/lib/access";
import { createEvent, publishEvent, suggestOrgs } from "@/lib/services/admin";
import { logAI } from "@/lib/services/outreach";
import { eventSummary, guardInputs, MODEL_ID, TEMPLATES } from "@/lib/ai/gateway";
import { useStream } from "@/lib/ai/use-stream";
import { fmtDate } from "@/lib/format";
import type { RelationshipEvent } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/overlays";
import { Empty, PageHeader } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";

const TYPES = ["Health plan merger", "Staff change", "Rate change", "Policy change", "New program", "Closure", "Other"];

export default function RelationshipEvents() {
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const canEdit = accessForUser(pageById("PG-12"), me) === "full";
  const states = me.scope.includes("ALL") ? ["NC", "CO"] : me.scope;
  const events = db.events.filter((e) => states.includes(e.state)).sort((a, b) => (a.status === b.status ? b.date.localeCompare(a.date) : a.status === "Draft" ? -1 : 1));
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <PageHeader
        title="Relationship Events"
        description="Mergers, staff changes and policy shifts that reset relationships. A person confirms each one against its public source before it turns into work for ambassadors."
        actions={canEdit ? <Button onClick={() => setAdding(true)}><Plus size={15} /> Add event</Button> : null}
      />
      {!canEdit ? <p className="mb-4 text-sm text-ink-3">View only for your role. Ambassador leads and marketing confirm and publish events.</p> : null}
      <div className="space-y-4" data-guide="events">
        {events.length === 0 ? <Empty title="No events yet">Add one from a public source.</Empty> : events.map((e) => (e.status === "Draft" && canEdit ? <DraftCard key={e.id} e={e} /> : <PublishedCard key={e.id} e={e} />))}
      </div>
      <AddDialog open={adding} onClose={() => setAdding(false)} states={states} />
    </div>
  );
}

function PublishedCard({ e }: { e: RelationshipEvent }) {
  const db = useStore((s) => s.db);
  const orgs = db.orgs.filter((o) => e.orgIds.includes(o.id));
  return (
    <Panel>
      <PanelBody className="flex flex-wrap items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-teal-tint text-teal"><Megaphone size={17} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={e.status === "Published" ? "ok" : "neutral"}>{e.status}</Badge>
            <Badge tone="outline">{e.type}</Badge>
            <span className="text-xs text-ink-3">{fmtDate(e.date)}, {e.state}</span>
          </div>
          <h2 className="mt-1.5 text-[1.05rem]">{e.title}</h2>
          {e.summary ? <p className="mt-1 max-w-3xl text-sm text-ink-2">{e.summary}</p> : <p className="mt-1 text-sm text-ink-3">Waiting for confirmation.</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
            <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">{e.sourceLabel} <ExternalLink size={11} /></a>
            {e.confirmedBy ? <span>Confirmed by {e.confirmedBy}</span> : null}
            {orgs.length ? <span>Affects {orgs.slice(0, 3).map((o, i) => <span key={o.id}>{i ? ", " : ""}<Link className="hover:underline" href={href("/app/organization", { id: o.id })}>{o.name}</Link></span>)}{orgs.length > 3 ? ` and ${orgs.length - 3} more` : ""}</span> : null}
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}

function DraftCard({ e }: { e: RelationshipEvent }) {
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const suggested = suggestOrgs(db, e);
  const [orgIds, setOrgIds] = useState<string[]>(() => e.orgIds);
  const [summary, setSummary] = useState(e.summary);
  const [gen, setGen] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const { shown, state, done } = useStream(gen);
  useEffect(() => { if (done && gen) setSummary(gen); }, [done, gen]);
  const candidates = db.orgs.filter((o) => o.state === e.state).sort((a, b) => Number(e.orgIds.includes(b.id)) - Number(e.orgIds.includes(a.id)) || Number(suggested.includes(b.id)) - Number(suggested.includes(a.id)));

  const generate = () => {
    const g = guardInputs(e.title, e.sourceLabel);
    if (!g.ok) { toast.error("Blocked: the source text looks like it contains client details"); return; }
    const text = eventSummary({ ...e, summary: "" });
    setGen(text);
    mutate((d) => logAI(d, { feature: "AI05", templateId: TEMPLATES.event.id, templateVersion: TEMPLATES.event.version, objectId: e.id, result: "Generated" }));
  };

  const publish = () => {
    let res = { tasks: 0, people: 0 };
    mutate((d) => { res = publishEvent(d, e.id, summary.trim(), orgIds); }, { entity: "event", id: e.id, action: "published" });
    toast.success(`Published. ${res.tasks} ${res.tasks === 1 ? "task" : "tasks"} added to ambassador plans; ${res.people} ${res.people === 1 ? "person" : "people"} notified.`);
  };

  return (
    <Panel className="border-hl/50">
      <PanelHeader
        title={e.title}
        description={<span className="inline-flex flex-wrap items-center gap-2"><Badge tone="hl">Draft: needs confirmation</Badge><Badge tone="outline">{e.type}</Badge><span>{fmtDate(e.date)}, {e.state}</span><a href={e.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal-strong hover:underline">{e.sourceLabel} <ExternalLink size={11} /></a></span>}
      />
      <PanelBody className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`sum-${e.id}`}>Summary for ambassadors</Label>
            <Button size="sm" variant="secondary" onClick={generate} disabled={state === "thinking" || state === "streaming"}><Sparkles size={14} /> {summary ? "Regenerate" : "Draft summary"}</Button>
          </div>
          {gen && !done ? (
            <div className="mt-1.5 min-h-[7rem] rounded-md border border-line bg-canvas px-3 py-2 text-sm">{state === "thinking" ? <span className="text-ink-3">Reading the public source…</span> : shown}</div>
          ) : (
            <Textarea id={`sum-${e.id}`} rows={5} value={summary} onChange={(x) => setSummary(x.target.value)} placeholder="Draft with AI from the public source, or write it yourself." className="mt-1.5" />
          )}
          {gen ? <p className="mt-1 flex items-center gap-1 text-[0.7rem] text-ink-3"><Bot size={11} /> AI draft from the public source title only ({TEMPLATES.event.id} {TEMPLATES.event.version}, in review). {MODEL_ID}. Check it before publishing.</p> : null}
          <div className="mt-4">
            <Checkbox checked={confirmed} onChange={(x) => setConfirmed(x.target.checked)} label="I checked this against the source and it is accurate" />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">Affected organizations</p>
          <p className="text-xs text-ink-3">Pick only the organizations this really affects. Ones in {e.counties.join(", ")} {e.counties.length === 1 ? "County" : "counties"} are listed first.</p>
          <ul className="mt-2 max-h-56 space-y-1.5 overflow-auto pr-1">
            {candidates.map((o) => (
              <li key={o.id}>
                <Checkbox checked={orgIds.includes(o.id)} onChange={(x) => setOrgIds((ids) => (x.target.checked ? [...ids, o.id] : ids.filter((i) => i !== o.id)))} label={<span className="text-sm">{o.name}{suggested.includes(o.id) ? null : <span className="text-ink-3"> ({o.county})</span>}</span>} />
              </li>
            ))}
          </ul>
          <Button className="mt-4 w-full" onClick={publish} disabled={!confirmed || !summary.trim() || orgIds.length === 0}>Publish and create tasks</Button>
          {!confirmed ? <p className="mt-1.5 text-center text-xs text-ink-3">Confirm accuracy to publish.</p> : null}
        </div>
      </PanelBody>
    </Panel>
  );
}

function AddDialog({ open, onClose, states }: { open: boolean; onClose: () => void; states: string[] }) {
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const blank = { title: "", type: TYPES[0], state: states[0], date: new Date().toISOString().slice(0, 10), sourceUrl: "", sourceLabel: "", counties: [] as string[] };
  const [f, setF] = useState(blank);
  const counties = Array.from(new Set(db.orgs.filter((o) => o.state === f.state).map((o) => o.county))).sort();
  const valid = f.title.trim() && /^https:\/\//.test(f.sourceUrl) && f.sourceLabel.trim() && f.counties.length;
  const save = () => {
    const g = guardInputs(f.title, f.sourceLabel);
    if (!g.ok) { toast.error("Blocked: possible client details in the event text"); return; }
    mutate((d) => { createEvent(d, { title: f.title.trim(), type: f.type, state: f.state, date: f.date, sourceUrl: f.sourceUrl.trim(), sourceLabel: f.sourceLabel.trim(), counties: f.counties }); });
    toast.success("Event added as a draft");
    setF(blank);
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title="Add a relationship event" description="Public sources only: news, board agendas, state notices." wide
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!valid}>Add as draft</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label htmlFor="ev-title">What happened</Label><Input id="ev-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Hospital opens a new pediatric behavioral health unit" className="mt-1" /></div>
        <div><Label htmlFor="ev-type">Type</Label><Select id="ev-type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className="mt-1">{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></div>
        <div><Label htmlFor="ev-date">Date</Label><Input id="ev-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="mt-1" /></div>
        <div><Label htmlFor="ev-url">Source link</Label><Input id="ev-url" value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} placeholder="https://" className="mt-1" /></div>
        <div><Label htmlFor="ev-label">Source name</Label><Input id="ev-label" value={f.sourceLabel} onChange={(e) => setF({ ...f, sourceLabel: e.target.value })} placeholder="e.g. County board agenda" className="mt-1" /></div>
        <div><Label htmlFor="ev-state">State</Label><Select id="ev-state" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value, counties: [] })} className="mt-1">{states.map((s) => <option key={s}>{s}</option>)}</Select></div>
        <div>
          <p className="text-sm font-medium">Counties affected</p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {counties.map((c) => <Checkbox key={c} checked={f.counties.includes(c)} onChange={(e) => setF({ ...f, counties: e.target.checked ? [...f.counties, c] : f.counties.filter((x) => x !== c) })} label={c} />)}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
