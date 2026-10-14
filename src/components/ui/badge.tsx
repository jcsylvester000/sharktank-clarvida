import * as React from "react";
import { cn } from "./cn";

export type Tone = "neutral" | "teal" | "care" | "ok" | "warn" | "crit" | "hl" | "outline";
const TONES: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2",
  teal: "bg-teal-tint text-teal-strong",
  care: "bg-care-tint text-care-strong",
  ok: "bg-ok-tint text-ok",
  warn: "bg-warn-tint text-warn",
  crit: "bg-crit-tint text-crit",
  hl: "bg-hl-tint text-warn",
  outline: "border border-line text-ink-2 bg-surface",
};

export function Badge({ tone = "neutral", className, icon, children, ...rest }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; icon?: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONES[tone], className)} {...rest}>
      {icon}
      {children}
    </span>
  );
}
