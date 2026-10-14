import * as React from "react";
import { Logo, SunCircle, SyntheticNotice } from "@/components/brand/brand";
import { cn } from "@/components/ui/cn";

/** The Clarvida sign-in frame: brand panel with the Brand Kit hero photo, sun circle and sky quarter-shape; form card on white. */
export function AuthFrame({ children, aside, wide }: { children: React.ReactNode; aside?: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="relative hidden overflow-hidden bg-cv-ice lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10">
        <Logo width={170} />
        <div className="relative mx-auto my-10 w-full max-w-[520px]">
          <SunCircle size={190} soft={false} className="absolute -right-8 -top-12" />
          <span aria-hidden className="absolute -bottom-10 -left-10 h-44 w-44 rounded-tr-[176px] bg-cv-skylight/70" />
          <picture>
            <source srcSet="/brand/hero-family.webp" type="image/webp" />
            <img src="/brand/hero-family.jpg" alt="A smiling family together outdoors (Clarvida brand photography)" width={610} height={410} className="relative w-full rounded-[var(--radius-panel)] object-cover shadow-sm" fetchPriority="high" />
          </picture>
        </div>
        <div className="max-w-[520px]">
          <h2 className="text-[1.9rem] leading-tight text-cv-teal">Every referral known. Every family reached. Every referrer told.</h2>
          <p className="mt-3 text-[1.02rem] text-ink-2">The Referral Co-Pilot helps Clarvida teams find the partners who refer, answer every family within one business day and show which relationships create brighter tomorrows.</p>
          {aside}
        </div>
      </section>
      <section className="flex min-h-screen flex-col px-4 py-8 sm:px-10 lg:py-10">
        <div className="lg:hidden">
          <Logo width={150} />
        </div>
        <div className={cn("mx-auto my-auto w-full py-8", wide ? "max-w-xl" : "max-w-md")}>{children}</div>
        <SyntheticNotice className="mx-auto text-center" />
      </section>
    </div>
  );
}
