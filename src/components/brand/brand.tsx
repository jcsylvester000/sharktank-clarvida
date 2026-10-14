import * as React from "react";
import { cn } from "@/components/ui/cn";

/** Clarvida logo, used exactly as supplied (AC-BR-03): full colour on light backgrounds, white only on Teal or Navy. Minimum 140 px wide. */
export function Logo({ variant = "color", width = 150, className }: { variant?: "color" | "white"; width?: number; className?: string }) {
  const w = Math.max(140, width);
  const h = Math.round(w * (variant === "white" ? 162 / 593 : 160 / 593));
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={variant === "white" ? "/brand/logo-white.png" : "/brand/logo-color.png"} alt="Clarvida" width={w} height={h} className={cn("block select-none", className)} draggable={false} />
  );
}

export function LogoSymbol({ size = 40, className }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/logo-symbol.png" alt="" aria-hidden width={size} height={Math.round((size * 337) / 354)} className={cn("block select-none", className)} draggable={false} />;
}

/** The decorative yellow sun circle (empty and success states, hero photos). */
export function SunCircle({ size = 96, className, soft = true }: { size?: number; className?: string; soft?: boolean }) {
  return <span aria-hidden className={cn("block rounded-full", soft ? "bg-cv-softsun" : "bg-cv-sun", className)} style={{ width: size, height: size }} />;
}

/** On-brand empty / success state (FT-030, AC-BR-09). */
export function SunState({ title, children, action, className, compact }: { title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string; compact?: boolean }) {
  const s = compact ? 56 : 76;
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "px-4 py-6" : "px-6 py-10", className)}>
      <div className="relative mb-4 flex items-center justify-center" style={{ width: s, height: s }}>
        <SunCircle size={s} className="absolute inset-0" />
        <LogoSymbol size={compact ? 26 : 34} className="relative" />
      </div>
      <p className="font-medium text-ink">{title}</p>
      {children ? <div className="mt-1 max-w-md text-sm text-ink-2">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export const HOPEFUL_LINE = "Every referral is a brighter tomorrow in motion.";

export type AvatarTone = "teal" | "sky" | "navy" | "amber";
export function Avatar({ initials, tone = "teal", size = 32, className }: { initials: string; tone?: AvatarTone; size?: number; className?: string }) {
  const t = { teal: "bg-teal text-white", sky: "bg-cv-lightsky text-cv-navy", navy: "bg-cv-navy text-white", amber: "bg-cv-amber text-cv-ink" }[tone];
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", t, className)} style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }} aria-hidden>
      {initials}
    </span>
  );
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden className={cn("skeleton block h-4", className)} style={style} />;
}

/** Page-level skeleton shown while the simulated API answers (FT-021, AC-FR-15). */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-80 max-w-full" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-4">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line-2 py-3 last:border-0">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** FT-025: slim, on-brand synthetic-data notice. */
export function SyntheticNotice({ className, live }: { className?: string; live?: boolean }) {
  return (
    <p className={cn("text-xs text-ink-3", className)}>
      {live ? "Live sandbox: simulated activity on synthetic data. Separate from the pitch demo." : "Prototype with synthetic data. No real people or clients."}
    </p>
  );
}
