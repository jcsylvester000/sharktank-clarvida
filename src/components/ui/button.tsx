import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "./cn";

// Clarvida buttons are pills. Amber ("cta") is reserved for the single most important action on a screen,
// always with a dark label and a trailing chevron (AC-BR-04). Teal is the everyday action colour.
type Variant = "primary" | "cta" | "secondary" | "ghost" | "danger" | "care" | "link" | "onDark";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-teal text-white hover:bg-teal-strong disabled:bg-ink-3/40",
  cta: "bg-cv-amber text-cv-ink hover:bg-[#f2aa00] disabled:bg-cv-amber/50 disabled:text-ink-2 font-semibold",
  care: "bg-care text-white hover:bg-care-strong disabled:bg-ink-3/40",
  secondary: "bg-surface text-teal-strong border border-teal/40 hover:bg-teal-tint disabled:text-ink-3 disabled:border-line",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink disabled:text-ink-3",
  danger: "bg-surface text-crit border border-crit/40 hover:bg-crit-tint disabled:text-ink-3",
  link: "text-cv-link underline-offset-4 hover:underline hover:text-cv-deep px-0 h-auto",
  onDark: "bg-white/10 text-white border border-white/30 hover:bg-white/20",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[0.8125rem] gap-1.5",
  md: "h-10 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  icon: "h-9 w-9 justify-center",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Trailing chevron (›). On by default for the amber CTA. */
  chevron?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", chevron, children, ...props },
  ref,
) {
  const showChevron = chevron ?? variant === "cta";
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center rounded-full font-semibold transition-colors disabled:cursor-not-allowed whitespace-nowrap",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
      {showChevron ? <ChevronRight size={size === "sm" ? 14 : 17} aria-hidden className="-mr-1" /> : null}
    </button>
  );
});
