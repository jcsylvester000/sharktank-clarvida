"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PlayCircle, LogIn, ShieldCheck, Activity } from "lucide-react";
import { useGuide } from "@/components/shell/guide-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

const METRICS = [
  { label: "Referrals with a known source", today: "0%", withCo: "100%" },
  { label: "Response promise to families", today: "None", withCo: "1 business day" },
  { label: "Referrer hears what happened", today: "Rarely", withCo: "Automatically" },
  { label: "Safeguards on AI and outreach", today: "None", withCo: "5 built in" },
];

/** Opening scene (E03): today's three-field form next to the Co-Pilot's structured referral. */
export default function Opening() {
  const { go } = useGuide();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight" && !shown) { e.stopPropagation(); setShown(true); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [shown]);

  return (
    <main className="min-h-screen px-4 py-8 sm:px-8 lg:px-12">
      <header className="mx-auto flex max-w-[1240px] items-center justify-between">
        <div>
          <p className="font-display text-lg font-semibold">Clarvida Referral Co-Pilot</p>
          <p className="text-xs text-ink-3">Prototype for the Clarvida Shark Tank. Synthetic data only.</p>
        </div>
        <div className="flex gap-2">
          <a href="/live/" className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm font-medium hover:bg-sunken">
            <Activity size={15} /> Live sandbox
          </a>
          <Link href="/" className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm font-medium hover:bg-sunken">
            <LogIn size={15} /> Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto mt-10 max-w-[1240px]" data-guide="before-after">
        <h1 className="max-w-3xl text-4xl leading-[1.08] sm:text-[3.2rem]">Today a referral is a name, an email and a message.</h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-2">Nobody can tell who sent it, what it is for, or whether anyone called back. The Co-Pilot changes what arrives at the front door.</p>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <figure className="rounded-lg border border-line bg-surface p-6">
            <figcaption className="mb-4 flex items-baseline justify-between">
              <span className="font-display text-lg font-semibold">Today</span>
              <span className="text-xs text-ink-3">Refer a Client form, as observed on the public site (Oct 2026)</span>
            </figcaption>
            <div className="space-y-3 opacity-80">
              {["Name", "Email", "Message"].map((f) => (
                <div key={f}>
                  <p className="text-sm text-ink-2">{f}</p>
                  <div className={cn("mt-1 rounded-md border border-line bg-canvas", f === "Message" ? "h-24" : "h-10")} />
                </div>
              ))}
              <div className="h-10 w-28 rounded-md bg-ink-3/30" />
            </div>
          </figure>

          <figure className="rounded-lg border-2 border-teal bg-surface p-6">
            <figcaption className="mb-4 flex items-baseline justify-between">
              <span className="font-display text-lg font-semibold text-teal-strong">With the Co-Pilot</span>
              <span className="inline-flex items-center gap-1 text-xs text-ink-3"><ShieldCheck size={13} /> No trackers on the form</span>
            </figcaption>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
              {[
                ["Referred by", "Gaston County Schools"],
                ["Source type", "School"],
                ["Program", "In-home services, Gastonia"],
                ["County", "Gaston"],
                ["Age", "12"],
                ["Family contact", "First name and phone only"],
                ["Consent", "Guardian agreed"],
                ["Routed to", "Gastonia intake, clock started"],
              ].map(([k, v]) => (
                <div key={k} className="border-b border-line-2 pb-2">
                  <dt className="text-xs text-ink-3">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </figure>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((m) => (
            <div key={m.label} className="rounded-lg border border-line bg-surface px-4 py-4">
              <p className="text-sm text-ink-2">{m.label}</p>
              <p className={cn("mt-2 font-display text-[1.8rem] font-semibold leading-none transition-colors duration-500", shown ? "text-teal" : "text-ink-3")}>{shown ? m.withCo : m.today}</p>
              <p className="mt-1 text-xs text-ink-3">{shown ? `Today: ${m.today}` : "Today"}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" onClick={() => setShown((s) => !s)} variant={shown ? "secondary" : "primary"}>
            {shown ? "Show today again" : "Show the difference"}
          </Button>
          <Button size="lg" variant="secondary" onClick={() => go(0)}>
            <PlayCircle size={18} /> Run the guided demo
          </Button>
        </div>
      </section>
    </main>
  );
}
