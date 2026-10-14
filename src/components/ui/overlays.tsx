"use client";
import * as React from "react";
import { Dialog as D, Popover as P, Tooltip as T, Switch as S, Tabs as Tb } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "./cn";

export function Dialog({ open, onOpenChange, title, description, children, footer, wide }: { open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <D.Content className={cn("fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-surface shadow-xl", wide ? "max-w-3xl" : "max-w-lg")}>
          <div className="flex items-start justify-between gap-4 border-b border-line-2 px-5 py-4">
            <div>
              <D.Title className="font-display text-lg font-semibold">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-sm text-ink-2">{description}</D.Description> : <D.Description className="sr-only">Dialog</D.Description>}
            </div>
            <D.Close className="rounded-md p-1 text-ink-3 hover:bg-sunken hover:text-ink" aria-label="Close">
              <X size={18} />
            </D.Close>
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer ? <div className="flex justify-end gap-2 border-t border-line-2 px-5 py-3">{footer}</div> : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function Popover({ trigger, children, align = "end", className }: { trigger: React.ReactNode; children: React.ReactNode; align?: "start" | "center" | "end"; className?: string }) {
  return (
    <P.Root>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content align={align} sideOffset={6} className={cn("z-50 w-80 rounded-lg border border-line bg-surface p-3 shadow-lg", className)}>
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
export const PopoverClose = P.Close;

export function Tip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Provider delayDuration={250}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content side={side} sideOffset={6} className="z-50 max-w-xs rounded-md bg-ink px-2.5 py-1.5 text-xs leading-snug text-white shadow">
            {content}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}

export function Switch({ checked, onCheckedChange, label, id, disabled }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: React.ReactNode; id?: string; disabled?: boolean }) {
  const autoId = React.useId();
  const sid = id ?? autoId;
  return (
    <div className="flex items-center gap-2.5">
      <S.Root id={sid} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="relative h-5 w-9 shrink-0 rounded-full bg-line transition-colors data-[state=checked]:bg-teal disabled:opacity-50">
        <S.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
      </S.Root>
      <label htmlFor={sid} className="cursor-pointer text-sm">
        {label}
      </label>
    </div>
  );
}

export const Tabs = Tb.Root;
export function TabList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Tb.List className={cn("flex gap-1 overflow-x-auto border-b border-line", className)}>{children}</Tb.List>;
}
export function Tab({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Tb.Trigger value={value} className="-mb-px shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink data-[state=active]:border-teal data-[state=active]:text-ink">
      {children}
    </Tb.Trigger>
  );
}
export const TabPanel = Tb.Content;
