"use client";
import { AlarmClock, CheckCircle2, Clock3, MoonStar, TriangleAlert } from "lucide-react";
import type { Referral } from "@/lib/domain/types";
import { clockFor, hms, hoursText } from "@/lib/rules/clock";
import { useStore } from "@/lib/store/db";
import { fmtTime } from "@/lib/format";
import { cn } from "@/components/ui/cn";

/** Response clock with words and an icon, not colour alone (Q06). */
export function ClockCell({ referral, now, size = "sm" }: { referral: Referral; now: number; size?: "sm" | "lg" }) {
  const mode = useStore((s) => s.db.demo.clockMode);
  const sla = useStore((s) => s.db.sla.find((x) => x.state === referral.state));
  const c = clockFor(referral, now, mode, sla);
  const due = `due by ${fmtTime(c.dueAt, sla?.timezone)}`;
  const big = size === "lg";

  if (c.state === "stopped") {
    return (
      <span className="inline-flex items-center gap-1.5 text-teal-strong">
        <CheckCircle2 size={big ? 18 : 14} />
        <span className={cn(big && "text-base font-medium")}>{c.firstContactMs !== undefined ? `${referral.firstContactAt ? "First contact" : "Actioned"} in ${hoursText(c.firstContactMs)}` : "Actioned"}</span>
      </span>
    );
  }
  if (c.state === "waiting_to_start") {
    return (
      <span className="inline-flex items-center gap-1.5 text-ink-2">
        <MoonStar size={big ? 18 : 14} />
        <span>Starts next business morning ({due})</span>
      </span>
    );
  }
  // Brand: teal badge with white numerals; amber only when about to breach (or past it). Words + icon, never colour alone.
  const pill = c.state === "overdue" ? "bg-cv-amber text-cv-ink ring-2 ring-cv-ink/70" : c.state === "due_soon" ? "bg-cv-amber text-cv-ink" : "bg-teal text-white";
  const Icon = c.state === "overdue" ? TriangleAlert : c.state === "due_soon" ? AlarmClock : Clock3;
  const word = c.state === "overdue" ? "Overdue" : c.state === "due_soon" ? "Due soon" : "On track";
  return (
    <span className="inline-flex flex-col items-start gap-1" data-clock={c.state}>
      <span className={cn("inline-flex items-center gap-1.5 rounded-full", pill, big ? "px-4 py-1.5" : "px-2.5 py-0.5")}>
        <Icon size={big ? 18 : 13} aria-hidden />
        <span className={cn("font-mono tabular font-bold", big ? "text-2xl" : "text-[0.85rem]")}>{hms(c.leftMs)}</span>
      </span>
      <span className={cn("text-xs", c.state === "on_track" ? "text-ink-3" : "font-semibold text-ink-2")}>
        {word}, {c.state === "overdue" ? `was ${due}` : due}
      </span>
    </span>
  );
}
