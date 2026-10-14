"use client";
import { Check, Lock } from "lucide-react";
import type { Referral } from "@/lib/domain/types";
import { JOURNEY, TIER2_STEPS, journeyReached, type JourneyStep } from "@/lib/rules/status";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/components/ui/cn";

/**
 * Delivery-style tracker (E09). On partner pages Tier 2 steps are locked unless the disclosure rules allow them;
 * staff always see every step.
 */
export function JourneyTracker({ referral, tier2Allowed, audience, labels, lockedLabel, holdNote }: { referral: Referral; tier2Allowed: boolean; audience: "partner" | "staff"; labels?: Partial<Record<JourneyStep, string>>; lockedLabel?: string; holdNote?: string }) {
  const reached = journeyReached(referral);
  const lastReached = [...JOURNEY].reverse().find((s) => reached[s]);
  return (
    <div>
      <ol className="grid gap-0 sm:grid-cols-4" aria-label="Referral progress">
        {JOURNEY.map((step, i) => {
          const tier2 = TIER2_STEPS.includes(step);
          const lockedForViewer = audience === "partner" && tier2 && !tier2Allowed;
          const at = reached[step];
          const done = Boolean(at) && !lockedForViewer;
          const current = step === lastReached && !lockedForViewer;
          return (
            <li key={step} className="relative flex gap-3 pb-5 sm:block sm:pb-0 sm:pr-3">
              {i < JOURNEY.length - 1 ? (
                <span aria-hidden className={cn("absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 sm:left-8 sm:top-[15px] sm:h-0.5 sm:w-[calc(100%-2rem)]", done && reached[JOURNEY[i + 1]] && !(audience === "partner" && TIER2_STEPS.includes(JOURNEY[i + 1]) && !tier2Allowed) ? "bg-teal" : "bg-line")} />
              ) : null}
              <span
                className={cn(
                  "relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                  lockedForViewer ? "border-line bg-sunken text-ink-3" : done ? "border-teal bg-teal text-white" : "border-line bg-surface text-ink-3",
                  current && "ring-4 ring-teal/15",
                )}
              >
                {lockedForViewer ? <Lock size={13} /> : done ? <Check size={15} /> : i + 1}
              </span>
              <div className="sm:mt-2">
                <p className={cn("text-sm font-medium", done ? "text-ink" : "text-ink-3")}>{labels?.[step] ?? step}</p>
                <p className="text-xs text-ink-3">{lockedForViewer ? lockedLabel ?? "Not shared" : at ? fmtDateTime(at) : "—"}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {holdNote ? <p className="mt-3 rounded-md bg-warn-tint px-3 py-2 text-sm text-warn">{holdNote}</p> : null}
    </div>
  );
}
