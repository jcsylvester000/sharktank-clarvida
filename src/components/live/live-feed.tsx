"use client";
import Link from "next/link";
import { ArrowRightLeft, Bot, Gauge, Inbox, Megaphone, PhoneCall, Sparkles } from "lucide-react";
import type { LiveFeedItem, LiveFeedKind, Role } from "@/lib/domain/types";
import { feedLine, fmtSimClock } from "@/lib/live/stats";
import { ago } from "@/lib/format";
import { cn } from "@/components/ui/cn";

const ICON: Record<LiveFeedKind, React.ComponentType<{ size?: number; className?: string }>> = {
  referral: Inbox,
  intake: PhoneCall,
  outreach: ArrowRightLeft,
  ai: Bot,
  capacity: Gauge,
  event: Megaphone,
  system: Sparkles,
};
const TONE: Record<LiveFeedKind, string> = {
  referral: "bg-care-tint text-care",
  intake: "bg-care-tint text-care",
  outreach: "bg-teal-tint text-teal-strong",
  ai: "bg-teal-tint text-teal-strong",
  capacity: "bg-warn-tint text-warn",
  event: "bg-hl-tint text-ink",
  system: "bg-sunken text-ink-2",
};

/** Activity feed. Care Zone lines are shown in full only to Care roles; everyone else sees the counts-only line. */
export function LiveFeedList({ items, role, now, compact, onNavigate }: { items: LiveFeedItem[]; role: Role; now: number; compact?: boolean; onNavigate?: () => void }) {
  if (!items.length) return <p className="px-4 py-6 text-center text-sm text-ink-3">Nothing yet. Activity appears here as the simulation runs.</p>;
  return (
    <ol className="divide-y divide-line-2" aria-label="Live activity">
      {items.map((it) => {
        const Icon = ICON[it.kind];
        const { text, link } = feedLine(it, role);
        const body = (
          <>
            <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", TONE[it.kind])} aria-hidden>
              <Icon size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-ink", compact ? "text-[0.84rem] leading-snug" : "text-sm")}>{text}</span>
              <span className="mt-0.5 block text-xs text-ink-3">
                {fmtSimClock(it.at).time} · {ago(it.at, now)} · {it.actor}
              </span>
            </span>
          </>
        );
        return (
          <li key={it.id}>
            {link ? (
              <Link href={link} onClick={onNavigate} className={cn("flex gap-3 hover:bg-canvas", compact ? "px-3 py-2" : "px-4 py-2.5")}>{body}</Link>
            ) : (
              <div className={cn("flex gap-3", compact ? "px-3 py-2" : "px-4 py-2.5")}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
