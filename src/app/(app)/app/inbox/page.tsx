"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Inbox as InboxIcon, Send, ShieldCheck } from "lucide-react";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { useApi, account } from "@/mock-api";
import type { OutboxMessage, OutboxType } from "@/lib/domain/types";
import { PageHeader, Callout } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented, Select } from "@/components/ui/field";
import { SunState } from "@/components/brand/brand";
import { ago, fmtDateTime } from "@/lib/format";
import { cn } from "@/components/ui/cn";

const TYPE_LABEL: Record<OutboxType, string> = {
  "referrer-notice": "Referrer notice",
  outreach: "Approved outreach",
  nurture: "Nurture journey",
  briefing: "Monday briefing",
  "password-reset": "Password reset",
  security: "Security notice",
  welcome: "Welcome",
  escalation: "Escalation",
  digest: "Digest",
};

/** PG-28 Demo Inbox (FT-152, FT-153): every email the system "sends", so automation is visible. Nothing leaves the browser. */
function InboxPage() {
  const me = useCurrentUser()!;
  const now = useNow(30_000);
  const router = useRouter();
  const params = useSearchParams();
  const [box, setBox] = useState<"mine" | "all">("mine");
  const [type, setType] = useState<"" | OutboxType>("");
  const { data } = useApi((db) => db.outbox, []);
  const list = useMemo(() => (data ?? []).filter((m) => (box === "all" || m.toUserId === me.id || m.fromUserId === me.id) && (!type || m.type === type)), [data, box, type, me.id]);
  const selectedId = params.get("m") ?? list[0]?.id;
  const selected = (data ?? []).find((m) => m.id === selectedId);
  const mobileDetail = Boolean(params.get("m"));

  useEffect(() => {
    if (selected && selected.toUserId === me.id && !selected.readBy.includes(me.id)) void account.markMailRead(selected.id);
  }, [selected, me.id]);

  const pick = (m: OutboxMessage) => router.replace(`/app/inbox/?m=${m.id}`, { scroll: false });

  return (
    <div>
      <PageHeader
        title="Demo Inbox"
        description="Every email the Co-Pilot would send: referrer notices, approved outreach, briefings and account emails."
        meta={<Badge tone="teal" icon={<ShieldCheck size={12} />}>Nothing leaves this browser</Badge>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented label="Mailbox" value={box} onChange={setBox} options={[{ value: "mine", label: "My mail" }, { value: "all", label: "All simulated email" }]} />
        <Select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value as OutboxType | "")} className="h-9 w-auto rounded-full">
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <span className="text-sm text-ink-3">{list.length} message{list.length === 1 ? "" : "s"}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Panel className={cn("overflow-hidden", mobileDetail && "hidden lg:block")} data-guide="inbox-list">
          {list.length === 0 ? (
            <SunState compact title="No email here yet.">When the Co-Pilot sends something for you, it appears here.</SunState>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-line-2 overflow-y-auto">
              {list.map((m) => {
                const unread = m.toUserId === me.id && !m.readBy.includes(me.id);
                return (
                  <li key={m.id}>
                    <button onClick={() => pick(m)} className={cn("block w-full px-4 py-3 text-left hover:bg-canvas", m.id === selected?.id && "bg-cv-ice")} aria-current={m.id === selected?.id ? "true" : undefined}>
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn("truncate text-sm", unread ? "font-bold text-ink" : "font-medium text-ink-2")}>{m.fromUserId === me.id ? `To: ${m.toName ?? m.to}` : m.toName ?? m.to}</span>
                        <span className="shrink-0 text-xs text-ink-3">{ago(m.at, now)}</span>
                      </span>
                      <span className={cn("mt-0.5 block truncate text-sm", unread ? "font-semibold text-ink" : "text-ink-2")}>{m.subject}</span>
                      <span className="mt-1 flex items-center gap-2">
                        <Badge tone="outline">{TYPE_LABEL[m.type]}</Badge>
                        {unread ? <span className="h-2 w-2 rounded-full bg-cv-amber" aria-label="Unread" /> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel className={cn("min-h-[420px]", !mobileDetail && "hidden lg:block")}>
          {selected ? <Message m={selected} onBack={() => router.replace("/app/inbox/")} /> : <SunState title="Choose a message to read it." />}
        </Panel>
      </div>
    </div>
  );
}

function Message({ m, onBack }: { m: OutboxMessage; onBack: () => void }) {
  return (
    <article className="px-5 py-5 sm:px-7" data-guide="inbox-message">
      <button onClick={onBack} className="link mb-3 inline-flex items-center gap-1 text-sm font-medium lg:hidden"><ArrowLeft size={15} /> All messages</button>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="teal">{TYPE_LABEL[m.type]}</Badge>
        <Badge tone="outline" icon={m.sentVia.includes("CRM") ? <Send size={12} /> : <InboxIcon size={12} />}>Sent via: {m.sentVia}</Badge>
      </div>
      <h2 className="mt-3 text-xl leading-snug">{m.subject}</h2>
      <dl className="mt-3 grid gap-1 text-sm text-ink-2 sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="text-ink-3">From</dt><dd className="break-words">{m.from}</dd>
        <dt className="text-ink-3">To</dt><dd className="break-words">{m.toName ? `${m.toName} <${m.to}>` : m.to}</dd>
        <dt className="text-ink-3">Sent</dt><dd>{fmtDateTime(m.at)}</dd>
      </dl>
      <div className="mt-5 whitespace-pre-line rounded-2xl bg-cv-ice px-5 py-4 text-[0.95rem] leading-relaxed text-ink">{m.body}</div>
      {m.link ? (
        <Link href={m.link} className="mt-5 inline-flex"><Button variant="primary" chevron>{m.linkLabel ?? "Open"}</Button></Link>
      ) : null}
      <Callout tone="neutral" className="mt-6" icon={<ShieldCheck size={16} className="text-teal" />}>
        Simulated email. In production this goes through Clarvida&apos;s approved email service; referrer notices never include client details.
      </Callout>
    </article>
  );
}

export default function Page() {
  return (
    <Suspense>
      <InboxPage />
    </Suspense>
  );
}
