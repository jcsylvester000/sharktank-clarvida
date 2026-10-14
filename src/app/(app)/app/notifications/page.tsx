"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CheckCheck, Settings2 } from "lucide-react";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { useApi, account } from "@/mock-api";
import { notificationsFor } from "@/lib/services/core";
import type { Notification } from "@/lib/domain/types";
import { NOTIF_LABEL } from "@/components/account/prefs";
import { PageHeader } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/field";
import { SunState, HOPEFUL_LINE } from "@/components/brand/brand";
import { ago } from "@/lib/format";
import { cn } from "@/components/ui/cn";


/** PG-26 Notifications (FT-150). Personal, grouped Today / Earlier, never client details. */
export default function Notifications() {
  const me = useCurrentUser()!;
  const router = useRouter();
  const now = useNow(30_000);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { data } = useApi((db, u) => notificationsFor(db, u), []);
  const list = useMemo(() => (data ?? []).filter((n) => filter === "all" || !n.readBy.includes(me.id)), [data, filter, me.id]);
  const unread = (data ?? []).filter((n) => !n.readBy.includes(me.id)).length;
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const today = list.filter((n) => n.at >= startOfDay.getTime());
  const earlier = list.filter((n) => n.at < startOfDay.getTime());

  const open = (n: Notification) => { void account.markRead([n.id]); router.push(n.link); };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Escalations, handoffs, approvals and capacity changes for you. Never includes client details."
        actions={
          <>
            <Link href="/app/settings/?tab=notifications" className="inline-flex"><Button variant="ghost" size="sm"><Settings2 size={15} /> Preferences</Button></Link>
            <Button variant="secondary" size="sm" disabled={!unread} onClick={() => account.markRead((data ?? []).map((n) => n.id))}><CheckCheck size={15} /> Mark all read</Button>
          </>
        }
      />
      <div className="mb-4 flex items-center justify-between">
        <Segmented label="Show" value={filter} onChange={setFilter} options={[{ value: "all", label: `All (${data?.length ?? 0})` }, { value: "unread", label: `Unread (${unread})` }]} />
      </div>
      {list.length === 0 ? (
        <Panel><SunState title={filter === "unread" ? "You're all caught up." : "No notifications yet."}>{HOPEFUL_LINE}</SunState></Panel>
      ) : (
        <div className="space-y-5">
          {[{ label: "Today", items: today }, { label: "Earlier", items: earlier }].filter((g) => g.items.length).map((g) => (
            <Panel key={g.label}>
              <p className="border-b border-line-2 px-5 py-2.5 text-sm font-semibold text-ink-2">{g.label}</p>
              <ul className="divide-y divide-line-2">
                {g.items.map((n) => {
                  const isUnread = !n.readBy.includes(me.id);
                  return (
                    <li key={n.id}>
                      <button onClick={() => open(n)} className="flex w-full items-start gap-3 px-5 py-3.5 text-left hover:bg-canvas">
                        <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", isUnread ? "bg-hl-tint text-warn" : "bg-sunken text-ink-3")}><Bell size={16} /></span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm", isUnread ? "font-semibold text-ink" : "text-ink-2")}>{n.text}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                            {ago(n.at, now)}
                            {n.type ? <Badge tone="outline">{NOTIF_LABEL[n.type].label}</Badge> : null}
                          </span>
                        </span>
                        {isUnread ? <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-cv-amber" aria-label="Unread" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
