"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Activity, ExternalLink, FastForward, Pause, Play, PlayCircle, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { reanchor, SPEEDS } from "@/lib/clock";
import { businessStart } from "@/lib/live/seed";
import { fmtSimClock } from "@/lib/live/stats";
import { businessDueAt } from "@/lib/rules/clock";
import { switchMode } from "@/lib/mode";
import { Button } from "@/components/ui/button";
import { Dialog, Popover, PopoverClose } from "@/components/ui/overlays";
import { cn } from "@/components/ui/cn";
import { LiveFeedList } from "./live-feed";

/** Shared by the top bar and the /live page: speed, pause, skip, reset. */
export function useLiveClock() {
  const live = useStore((s) => s.db.live);
  const sla = useStore((s) => s.db.sla.find((x) => x.state === "NC"));
  const mutate = useStore((s) => s.mutate);
  const t = useNow(1000);
  const open = sla ? businessDueAt(t, 0, sla) === t : true;
  return {
    t,
    open,
    speed: live?.clock.speed ?? 1,
    paused: live?.clock.paused ?? false,
    setSpeed: (speed: number) => mutate((d) => { if (d.live) d.live.clock = reanchor(d.live.clock, { speed, paused: false }); }),
    pause: () => mutate((d) => { if (d.live) d.live.clock = reanchor(d.live.clock, { paused: true }); }),
    resume: () => mutate((d) => { if (d.live) d.live.clock = reanchor(d.live.clock, { paused: false }); }),
    skipToMorning: () => mutate((d) => { if (d.live) d.live.clock = reanchor(d.live.clock, { jumpTo: businessStart(t, d) }); }),
  };
}

export function SpeedControl({ className }: { className?: string }) {
  const c = useLiveClock();
  return (
    <div className={cn("inline-flex rounded-md border border-line bg-surface p-0.5", className)} role="group" aria-label="Simulation speed">
      <button
        type="button"
        onClick={c.paused ? c.resume : c.pause}
        aria-pressed={c.paused}
        className={cn("inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium", c.paused ? "bg-warn-tint text-warn" : "text-ink-2 hover:text-ink")}
      >
        {c.paused ? <Play size={13} /> : <Pause size={13} />} {c.paused ? "Resume" : "Pause"}
      </button>
      {SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => c.setSpeed(s)}
          aria-pressed={!c.paused && c.speed === s}
          className={cn("rounded px-2 py-1 text-xs font-medium tabular", !c.paused && c.speed === s ? "bg-teal text-white" : "text-ink-2 hover:text-ink")}
        >
          {s}x
        </button>
      ))}
    </div>
  );
}

export function LiveControls() {
  const c = useLiveClock();
  const user = useCurrentUser();
  const feed = useStore((s) => s.db.live?.feed ?? []);
  const reset = useStore((s) => s.reset);
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const clock = fmtSimClock(c.t);
  return (
    <>
      <Popover
        trigger={
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-teal/40 bg-teal-tint px-2.5 text-sm text-teal-strong hover:bg-teal-tint/70"
            aria-label={`Live sandbox controls. Simulated time ${clock.full}, ${c.paused ? "paused" : `${c.speed} times speed`}`}
          >
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              {!c.paused ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-60 motion-reduce:hidden" /> : null}
              <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", c.paused ? "bg-warn" : "bg-teal")} />
            </span>
            <span className="hidden font-medium md:inline">Live</span>
            <span className="hidden font-mono text-xs tabular sm:inline">{clock.time}</span>
            <span className="hidden text-xs sm:inline">{c.paused ? "Paused" : `${c.speed}x`}</span>
          </button>
        }
        className="w-80"
      >
        <p className="text-sm font-semibold">Live sandbox</p>
        <p className="mt-0.5 text-xs text-ink-2">Simulated teammates keep working while you explore. Separate from the pitch demo.</p>
        <div className="mt-3 rounded-md border border-line-2 bg-canvas px-3 py-2">
          <p className="font-mono text-sm tabular">{clock.full}</p>
          <p className="text-xs text-ink-3">{c.open ? "Business hours: intake clocks are running" : "After hours: clocks wait for the next business morning"}</p>
        </div>
        <p className="mb-1 mt-3 text-xs font-medium text-ink-2">Speed</p>
        <SpeedControl />
        <div className="mt-3 grid gap-2">
          {!c.open ? (
            <Button variant="secondary" size="sm" onClick={c.skipToMorning}>
              <FastForward size={14} /> Skip to the next business morning
            </Button>
          ) : null}
          <PopoverClose asChild>
            <Link href="/app/live/" className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-medium hover:bg-sunken">
              <Activity size={14} /> Live Operations
            </Link>
          </PopoverClose>
          <Button variant="secondary" size="sm" onClick={() => window.open("/partner/refer/?code=GCS-NC-2026", "partner", "width=520,height=900")}>
            <ExternalLink size={14} /> Send a referral as a partner
          </Button>
          <Button variant="ghost" size="sm" onClick={() => switchMode("demo", "/")}>
            <PlayCircle size={14} /> Switch to the guided demo
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>
            <RotateCcw size={14} /> Start the sandbox over
          </Button>
        </div>
      </Popover>

      <Popover
        trigger={
          <Button variant="ghost" size="icon" aria-label="Live activity feed">
            <Activity size={18} />
          </Button>
        }
        className="w-[26rem] max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="flex items-center justify-between border-b border-line-2 px-3 py-2.5">
          <p className="text-sm font-semibold">Live activity</p>
          <PopoverClose asChild>
            <Link href="/app/live/" className="text-xs text-teal hover:underline">Open Live Operations</Link>
          </PopoverClose>
        </div>
        <div className="max-h-[26rem] overflow-y-auto" aria-live="polite">
          {user ? <LiveFeedList items={feed.slice(0, 25)} role={user.role} now={c.t} compact /> : null}
        </div>
      </Popover>

      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Start the sandbox over?"
        description="Everything that happened in the sandbox is cleared and the simulation restarts from the starting data. The pitch demo is not affected."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                reset();
                setConfirm(false);
                toast.success("Sandbox restarted");
                router.push("/");
              }}
            >
              Start over
            </Button>
          </>
        }
      />
    </>
  );
}
