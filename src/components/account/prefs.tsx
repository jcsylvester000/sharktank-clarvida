"use client";
import type { NotifChannel, NotifType } from "@/lib/domain/types";
import { cn } from "@/components/ui/cn";

export const NOTIF_LABEL: Record<NotifType, { label: string; help: string }> = {
  escalation: { label: "Escalations", help: "A referral passes its response target" },
  handoff: { label: "Warm handoffs", help: "A partner is ready for a personal call" },
  approval: { label: "Approvals", help: "Something needs your approval, or was approved" },
  capacity: { label: "Capacity changes", help: "A program fills up or reopens" },
  task: { label: "New tasks", help: "A task is created for you" },
  event: { label: "Relationship events", help: "Mergers, rate changes and staff changes" },
  system: { label: "Account and system", help: "Security notices and reports" },
};

export function ChannelPicker({ value, onChange, label, disabled }: { value: NotifChannel; onChange: (v: NotifChannel) => void; label: string; disabled?: boolean }) {
  const opts: { v: NotifChannel; l: string }[] = [{ v: "in-app", l: "In app" }, { v: "email", l: "Email" }, { v: "digest", l: "Daily digest" }, { v: "off", l: "Off" }];
  return (
    <div role="radiogroup" aria-label={`${label}: where to send`} className="inline-flex rounded-full border border-line bg-sunken p-0.5">
      {opts.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} disabled={disabled} onClick={() => onChange(o.v)} className={cn("rounded-full px-3 py-1 text-xs font-semibold", value === o.v ? "bg-teal text-white" : "text-ink-2 hover:text-ink disabled:hover:text-ink-2")}>
          {o.l}
        </button>
      ))}
    </div>
  );
}
