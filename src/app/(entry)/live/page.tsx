"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Activity, Bot, Gauge, Inbox, LogIn, PhoneCall, PlayCircle, RotateCcw, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { switchMode } from "@/lib/mode";
import { fmtSimClock } from "@/lib/live/stats";
import { SpeedControl, useLiveClock } from "@/components/live/live-controls";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlays";

const WHAT_RUNS = [
  { icon: Inbox, title: "Referrals arrive", text: "Schools, child welfare, hospitals, courts and families refer by web form, phone, fax and the statewide platform, more in the day than at night." },
  { icon: PhoneCall, title: "Intake answers", text: "Simulated coordinators in North Carolina and Colorado call families, accept, hold, redirect and schedule intakes. Half the NC queue is left for you." },
  { icon: Bot, title: "AI drafts, people approve", text: "A simulated ambassador sends AI-drafted outreach, partners reply, and the Co-Pilot prepares briefs and spots public updates for people to confirm." },
  { icon: Gauge, title: "Programs fill up", text: "A simulated program manager changes capacity. Waitlists pause outreach automatically; reopening resumes it." },
];

export default function LiveEntry() {
  const router = useRouter();
  const live = useStore((s) => s.db.live);
  const signedIn = useStore((s) => Boolean(s.db.session));
  const reset = useStore((s) => s.reset);
  const c = useLiveClock();
  const [confirm, setConfirm] = useState(false);

  // Reached without a full page load from the demo: reload into the sandbox's own data.
  useEffect(() => {
    if (!live) switchMode("live", "/live/");
  }, [live]);
  if (!live) return null;

  const clock = fmtSimClock(c.t);
  const fresh = live.totals.arrivals === 0 && live.feed.length <= 1;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-8 lg:px-12">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between gap-4">
        <div>
          <p className="font-display text-lg font-semibold">Clarvida Referral Co-Pilot</p>
          <p className="text-xs text-ink-3">Live sandbox. Synthetic data only.</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- leaving the sandbox needs a full reload to switch storage */}
        <a href="/" onClick={(e) => { e.preventDefault(); switchMode("demo", "/"); }} className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm font-medium hover:bg-sunken">
          <PlayCircle size={15} /> Pitch demo
        </a>
      </header>

      <section className="mx-auto mt-10 grid max-w-[1180px] gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-teal-tint px-3 py-1 text-xs font-medium text-teal-strong">
            <Activity size={13} /> Live sandbox
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl leading-[1.08] sm:text-[3rem]">Watch the Co-Pilot run on its own, then step in.</h1>
          <p className="mt-4 max-w-xl text-lg text-ink-2">
            The guided demo tells the story in five minutes. The sandbox lets people use it: work arrives, simulated teammates act on it, and every rule, clock, AI guard and audit entry behaves as it would for a real team.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {WHAT_RUNS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-lg border border-line bg-surface px-4 py-3.5">
                <p className="flex items-center gap-2 font-medium"><Icon size={16} className="text-teal" /> {title}</p>
                <p className="mt-1 text-sm text-ink-2">{text}</p>
              </li>
            ))}
          </ul>
        </div>

        <aside className="self-start rounded-lg border border-line bg-surface p-6" aria-label="Sandbox status">
          <p className="text-xs font-medium text-ink-3">Simulated time (Eastern)</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular">{clock.day} · {clock.time}</p>
          <p className="mt-1 text-sm text-ink-2">{c.paused ? "Paused" : c.open ? "Business hours: intake clocks are running" : "After hours: clocks wait for the next business morning"}</p>
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-ink-2">Speed (simulated minutes per real minute)</p>
            <SpeedControl />
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            {[
              ["Referrals arrived", live.totals.arrivals],
              ["Intake actions", live.totals.simActions],
              ["AI emails approved", live.totals.aiDrafts],
              ["Partner replies", live.totals.replies],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-md bg-canvas px-3 py-2">
                <dt className="text-xs text-ink-3">{k}</dt>
                <dd className="font-display text-xl font-semibold tabular">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 grid gap-2">
            <Button size="lg" className="w-full justify-center" onClick={() => router.push(signedIn ? "/app/live/" : "/")}>
              <LogIn size={17} /> {fresh ? "Enter the sandbox" : signedIn ? "Back to Live Operations" : "Resume the sandbox"}
            </Button>
            <Link href="/partner/refer/?code=GCS-NC-2026" target="_blank" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-medium hover:bg-sunken">
              Send a referral as a partner (new tab)
            </Link>
            <Button variant="ghost" className="w-full justify-center" onClick={() => setConfirm(true)}>
              <RotateCcw size={15} /> Start the sandbox over
            </Button>
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs text-ink-3">
            <ShieldCheck size={14} className="mt-px shrink-0" /> Runs in this browser only, with its own data. The pitch demo and its reset are untouched. Time pauses while no sandbox window is open.
          </p>
        </aside>
      </section>

      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Start the sandbox over?"
        description="Everything that happened in the sandbox is cleared and the simulation restarts from the starting data. The pitch demo is not affected."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => { reset(); setConfirm(false); toast.success("Sandbox restarted"); }}>Start over</Button>
          </>
        }
      />
    </main>
  );
}
