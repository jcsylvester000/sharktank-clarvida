"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LogIn, ShieldCheck, Activity } from "lucide-react";
import { useGuide } from "@/components/shell/guide-bar";
import { useStore } from "@/lib/store/db";
import { Button } from "@/components/ui/button";
import { Logo, SunCircle, SyntheticNotice } from "@/components/brand/brand";
import { cn } from "@/components/ui/cn";

const METRICS = [
  { label: "Referrals with a known source", today: "0%", withCo: "100%" },
  { label: "Response promise to families", today: "None", withCo: "1 business day" },
  { label: "Referrer hears what happened", today: "Rarely", withCo: "Automatically" },
  { label: "Relationships that produce clients", today: "Unknown", withCo: "Visible" },
];

const PROOF = [
  ["54,000", "clients a year"],
  ["4,600", "employees"],
  ["16", "states"],
  ["94%", "client satisfaction"],
  ["180,000", "clients a year: the 2030 goal"],
];

/** PG-05 Before and after (FT-162): today's 3-field form vs the Co-Pilot's structured, attributed referral. */
export default function Story() {
  const { go } = useGuide();
  const guideOn = useStore((s) => s.db.demo.guideOn);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight" && !shown) { e.stopPropagation(); setShown(true); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [shown]);

  return (
    <main className="min-h-screen bg-surface">
      <header className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-8">
        <div className="flex items-center gap-3"><Logo width={150} /><span className="hidden border-l border-line pl-3 text-sm font-medium text-ink-2 sm:inline">Referral Co-Pilot</span></div>
        <div className="flex gap-2">
          <a href="/live/" className="inline-flex h-9 items-center gap-2 rounded-full border border-teal/40 px-4 text-sm font-semibold text-teal-strong hover:bg-teal-tint"><Activity size={15} /> Live sandbox</a>
          <Link href="/" className="inline-flex h-9 items-center gap-2 rounded-full border border-teal/40 px-4 text-sm font-semibold text-teal-strong hover:bg-teal-tint"><LogIn size={15} /> Sign in</Link>
        </div>
      </header>

      <section className="mx-auto max-w-[1240px] px-4 pb-12 sm:px-8" data-guide="before-after">
        <div className="grid items-center gap-8 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="text-sm font-semibold text-teal-strong">Referrals is already in Clarvida&apos;s main menu. This makes it work.</p>
            <h1 className="mt-2 text-[2.4rem] leading-[1.1] text-cv-teal sm:text-[3.1rem]">Today a referral is a name, an email and a message.</h1>
            <p className="mt-4 max-w-2xl text-lg text-ink-2">We can&apos;t tell who sent it, families wait, and the referrer never hears back. Families booked the same day attend 82% of the time; after a 30-day wait, 29% (Pace et al., Ann Fam Med 2018).</p>
          </div>
          <div className="relative mx-auto hidden w-full max-w-[460px] lg:block">
            <SunCircle size={150} soft={false} className="absolute -right-6 -top-8" />
            <span aria-hidden className="absolute -bottom-8 -left-8 h-36 w-36 rounded-tr-[144px] bg-cv-skylight/70" />
            <picture>
              <source srcSet="/brand/hero-family.webp" type="image/webp" />
              <img src="/brand/hero-family.jpg" alt="A smiling family together (Clarvida brand photography)" width={610} height={410} className="relative w-full rounded-[var(--radius-panel)] object-cover" fetchPriority="high" />
            </picture>
          </div>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <figure className="rounded-[28px] border border-line bg-canvas p-6">
            <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-lg font-semibold">Today</span>
              <span className="text-xs text-ink-3">Refer a Client form, as observed on the public site (Oct 2026)</span>
            </figcaption>
            <div className="space-y-3">
              {["Name", "Email", "Message"].map((f) => (
                <div key={f}>
                  <p className="text-sm text-ink-2">{f}</p>
                  <div className={cn("mt-1 rounded-xl border border-line bg-surface", f === "Message" ? "h-24" : "h-10")} />
                </div>
              ))}
              <div className="h-10 w-28 rounded-full bg-ink-3/30" />
            </div>
          </figure>

          <figure className={cn("rounded-[28px] border-2 bg-surface p-6 transition-all", shown ? "border-teal shadow-lg" : "border-dashed border-line")}>
            <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-lg font-semibold text-cv-teal">With the Co-Pilot</span>
              <span className="inline-flex items-center gap-1 text-xs text-ink-3"><ShieldCheck size={13} /> No trackers on the form</span>
            </figcaption>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
              {[
                ["Referred by", "Gaston County Schools"],
                ["Source type", "School"],
                ["Program", "In-home services, Gastonia"],
                ["County", "Gaston"],
                ["Family contact", "First name and phone only"],
                ["Consent", "Guardian agreed"],
                ["Routed to", "Gastonia intake, clock started"],
                ["Referrer told", "Reference number, then status"],
              ].map(([k, v]) => (
                <div key={k} className="border-b border-line-2 pb-2">
                  <dt className="text-xs text-ink-3">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </figure>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((m) => (
            <div key={m.label} className="rounded-2xl border border-line bg-surface px-5 py-4">
              <p className="text-sm text-ink-2">{m.label}</p>
              <p className={cn("num mt-2 text-[1.8rem] leading-none transition-colors duration-500", shown ? "text-cv-teal" : "text-ink-2")}>{shown ? m.withCo : m.today}</p>
              <p className="mt-1 text-xs text-ink-3">{shown ? `Today: ${m.today}` : "Today"}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button size="lg" variant={shown ? "secondary" : "primary"} onClick={() => setShown((s) => !s)} data-guide="toggle-with">{shown ? "Show today again" : "Show With the Co-Pilot"}</Button>
          <Button size="lg" variant="cta" onClick={() => go(guideOn ? 1 : 0)}>Start the demo</Button>
        </div>

        <div className="mt-12 rounded-[var(--radius-panel)] bg-cv-ice px-6 py-6 sm:px-9">
          <p className="text-sm font-semibold text-teal-strong">Why it matters to Clarvida</p>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {PROOF.map(([n, l]) => (
              <div key={l}><p className="num text-[1.9rem] leading-none text-cv-teal">{n}</p><p className="mt-1 text-sm text-ink-2">{l}</p></div>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-3">Clarvida figures are self-reported on clarvida.com and the Clarvida Press Kit (accessed Oct 14, 2026). Everything inside the prototype is synthetic.</p>
        </div>
        <SyntheticNotice className="mt-6" />
      </section>
    </main>
  );
}
