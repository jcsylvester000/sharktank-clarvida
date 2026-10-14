"use client";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Lightbulb, Sparkles } from "lucide-react";
import { useStore, uid } from "@/lib/store/db";
import { useCurrentUser } from "@/lib/store/hooks";
import { accessForUser, pageById } from "@/lib/access";
import { activity, audit } from "@/lib/services/core";
import { logAI } from "@/lib/services/outreach";
import type { ContentIdea } from "@/lib/domain/types";
import { PageHeader } from "@/components/ui/misc";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/field";
import { SunState } from "@/components/brand/brand";

const AUDIENCES: ContentIdea["audience"][] = ["Schools", "Clinics", "Child welfare", "Faith and community"];
const MORE: Record<ContentIdea["audience"], Omit<ContentIdea, "id" | "status" | "audience">[]> = {
  Schools: [
    { title: "Five signs a student needs more than a counselor visit (one-pager)", whyNow: "Report cards go home in four weeks; counselors see more concerns then.", format: "One-pager" },
    { title: "Lunch-and-learn for school social workers", whyNow: "Three Gaston schools have new social workers this term (public board agendas).", format: "Event" },
  ],
  Clinics: [
    { title: "Care-manager quick guide after the Vaya Partners merger", whyNow: "Care managers changed teams on Oct 1.", format: "One-pager" },
    { title: "Webinar: same-day referrals and why they matter", whyNow: "82% attended a first visit when booked the same day vs 29% after 30 days (Pace et al., 2018).", format: "Webinar" },
  ],
  "Child welfare": [
    { title: "Monthly openings email for caseworkers", whyNow: "Caseworkers asked for one place to see openings.", format: "Email" },
    { title: "Foster family info night co-hosted with DSS", whyNow: "Licensed homes needed for ages 12 to 17.", format: "Event" },
  ],
  "Faith and community": [
    { title: "How to refer a family: a guide for ministry leaders", whyNow: "Faith partners asked for a simple guide at the last visit.", format: "One-pager" },
    { title: "Community resource table at the fall festival", whyNow: "Two congregations host fall festivals in November.", format: "Event" },
  ],
};

/** PG-11 Content and Webinar Ideas (FT-064): AI-suggested topics by audience that marketing approves into a calendar. */
export default function Content() {
  const me = useCurrentUser()!;
  const ideas = useStore((s) => s.db.ideas);
  const mutate = useStore((s) => s.mutate);
  const canEdit = accessForUser(pageById("PG-11"), me) === "full";
  const [aud, setAud] = useState<ContentIdea["audience"]>("Schools");
  const [busy, setBusy] = useState(false);
  const list = ideas.filter((i) => i.audience === aud && i.status === "Suggested");
  const calendar = ideas.filter((i) => i.status === "Approved");

  const generate = () => {
    setBusy(true);
    setTimeout(() => {
      mutate((d) => {
        for (const x of MORE[aud]) if (!d.ideas.some((i) => i.title === x.title)) d.ideas.push({ ...x, id: uid("idea"), audience: aud, status: "Suggested" });
        logAI(d, { feature: "AI06", templateId: "PT-ideas", templateVersion: "v1.0", objectId: aud, result: "Generated" });
      });
      setBusy(false);
      toast.success("New ideas suggested", { description: "Simulated model, from aggregate trends and public calendars only." });
    }, 900);
  };
  const approve = (i: ContentIdea) => {
    const date = new Date(Date.now() + (14 + calendar.length * 7) * 86_400_000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    mutate((d) => {
      const x = d.ideas.find((y) => y.id === i.id);
      if (!x) return;
      x.status = "Approved"; x.scheduledFor = date; x.approvedBy = me.name;
      audit(d, { action: `Approved content idea to calendar (${i.format})`, objectId: i.id, zone: "Outreach" });
      activity(d, `${me.firstName ?? me.name} approved a ${i.format.toLowerCase()} idea for ${i.audience.toLowerCase()}`, { link: "/app/content/" });
    });
    toast.success(`Added to the calendar for ${date}`);
  };

  return (
    <div>
      <PageHeader title="Content and Webinar Ideas" description="Topics by audience, each with a reason it matters now. Marketing approves the ones worth doing into the calendar."
        actions={canEdit ? <Button variant="cta" onClick={generate} disabled={busy}><Sparkles size={16} /> {busy ? "Thinking…" : "Suggest more ideas"}</Button> : null} />
      <div className="mb-4"><Segmented label="Audience" value={aud} onChange={setAud} options={AUDIENCES.map((a) => ({ value: a, label: a }))} /></div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid gap-3 sm:grid-cols-2" data-guide="ideas">
          {list.length === 0 ? <Panel className="sm:col-span-2"><SunState title="No new ideas for this audience.">Choose &quot;Suggest more ideas&quot;.</SunState></Panel> : null}
          {list.map((i) => (
            <Panel key={i.id} className="flex flex-col p-5">
              <div className="flex items-center gap-2"><Lightbulb size={16} className="text-teal" /><Badge tone="outline">{i.format}</Badge><Badge tone="outline">Simulated model</Badge></div>
              <p className="mt-2 font-semibold leading-snug">{i.title}</p>
              <p className="mt-2 flex-1 rounded-xl bg-cv-ice px-3 py-2 text-sm text-ink-2"><span className="font-semibold text-teal-strong">Why now: </span>{i.whyNow}</p>
              {canEdit ? <Button size="sm" className="mt-3 self-start" onClick={() => approve(i)}><CalendarCheck size={14} /> Approve to calendar</Button> : null}
            </Panel>
          ))}
        </div>
        <Panel>
          <PanelHeader title="Content calendar" description="Approved ideas, with who approved them." />
          <ul className="divide-y divide-line-2">
            {calendar.map((i) => (
              <li key={i.id} className="flex gap-3 px-5 py-3">
                <span className="w-14 shrink-0 text-center"><span className="num block text-lg text-cv-teal">{i.scheduledFor?.split(" ")[1]}</span><span className="text-xs text-ink-3">{i.scheduledFor?.split(" ")[0]}</span></span>
                <span className="min-w-0"><span className="block text-sm font-semibold">{i.title}</span><span className="text-xs text-ink-3">{i.audience} · {i.format} · approved by {i.approvedBy}</span></span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
