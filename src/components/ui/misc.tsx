import * as React from "react";
import { cn } from "./cn";

export function PageHeader({ title, description, actions, meta }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        {meta ? <div className="mb-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
        <h1 className="text-[1.75rem] leading-tight">{title}</h1>
        {description ? <p className="mt-1.5 text-[0.95rem] text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Stat({ label, value, sub, tone, className, onClick, active }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; tone?: "teal" | "care" | "warn" | "crit" | "ok"; className?: string; onClick?: () => void; active?: boolean }) {
  const toneCls = tone === "crit" ? "text-crit" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : tone === "care" ? "text-care" : tone === "teal" ? "text-teal" : "text-ink";
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn("rounded-lg border bg-surface px-4 py-3 text-left", active ? "border-teal ring-2 ring-teal/15" : "border-line", onClick && "hover:border-ink-3", className)}
    >
      <div className={cn("font-display text-[1.9rem] font-semibold leading-none tabular", toneCls)}>{value}</div>
      <div className="mt-1.5 text-sm font-medium text-ink">{label}</div>
      {sub ? <div className="mt-0.5 text-xs text-ink-3">{sub}</div> : null}
    </Comp>
  );
}

export function Empty({ title, children, className }: { title: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-dashed border-line px-6 py-10 text-center", className)}>
      <p className="font-medium text-ink">{title}</p>
      {children ? <div className="mt-1 text-sm text-ink-2">{children}</div> : null}
    </div>
  );
}

export function Callout({ tone = "neutral", icon, title, children, className, action }: { tone?: "neutral" | "warn" | "crit" | "ok" | "teal" | "care"; icon?: React.ReactNode; title?: React.ReactNode; children?: React.ReactNode; className?: string; action?: React.ReactNode }) {
  const t = {
    neutral: "border-line bg-surface",
    warn: "border-warn/30 bg-warn-tint",
    crit: "border-crit/30 bg-crit-tint",
    ok: "border-ok/30 bg-ok-tint",
    teal: "border-teal/30 bg-teal-tint",
    care: "border-care/30 bg-care-tint",
  }[tone];
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border px-4 py-3", t, className)} role={tone === "crit" ? "alert" : undefined}>
      {icon ? <div className="mt-0.5 shrink-0">{icon}</div> : null}
      <div className="min-w-0 flex-1 text-sm">
        {title ? <p className="font-semibold text-ink">{title}</p> : null}
        {children ? <div className={cn("text-ink-2", title && "mt-0.5")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
