import * as React from "react";
import { cn } from "./cn";

/** The scroll wrapper is focusable so keyboard users can scroll wide tables on small screens (WCAG 2.1.1). */
export function Table({ className, label, ...props }: React.TableHTMLAttributes<HTMLTableElement> & { label?: string }) {
  return (
    <div className="relative w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-teal" tabIndex={0} role="region" aria-label={label ?? props["aria-label"] ?? "Table"}>
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}
export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("sticky top-0 z-[1] bg-surface", className)} {...props} />;
}
export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("border-b border-line px-3 py-2 text-left text-xs font-semibold text-ink-2 whitespace-nowrap", className)} {...props} />;
}
export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-line-2 px-3 py-2.5 align-top", className)} {...props} />;
}
export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("hover:bg-canvas/70", className)} {...props} />;
}
