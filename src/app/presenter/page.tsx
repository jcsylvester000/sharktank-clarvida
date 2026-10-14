"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Play, RotateCcw, TimerReset } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { STEPS } from "@/lib/demo/steps";
import { Button } from "@/components/ui/button";

/** Speaker notes (E02): a second window for the presenter. Back/Next here drive the demo window via BroadcastChannel. */
export default function SpeakerNotes() {
  const demo = useStore((s) => s.db.demo);
  const users = useStore((s) => s.db.users);
  const mutate = useStore((s) => s.mutate);
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (typeof window !== "undefined" && !window.name) window.name = "speaker";
    document.title = "Speaker notes: Clarvida Referral Co-Pilot";
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const go = (i: number) => {
    const idx = Math.max(0, Math.min(STEPS.length - 1, i));
    mutate((d) => { d.demo.guideOn = true; d.demo.step = idx; }, { entity: "guide", action: "guide-step" });
    if (started === null) setStarted(Date.now());
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); go(demo.step + 1); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(demo.step - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const step = STEPS[demo.step];
  const next = STEPS[demo.step + 1];
  const elapsed = started ? Math.floor((now - started) / 1000) : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(1, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const over = elapsed > 300;
  const persona = step.userId ? users.find((u) => u.id === step.userId) : null;

  return (
    <main className="min-h-screen bg-ink px-6 py-5 text-white">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-white/60">Speaker notes</p>
          <div className="flex items-center gap-2">
            <span className={`font-mono text-2xl tabular ${over ? "text-hl" : ""}`} aria-label="Elapsed time">{mm}:{ss}</span>
            <span className="text-xs text-white/50">of 5:00</span>
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setStarted(started ? null : Date.now())} aria-label={started ? "Reset timer" : "Start timer"}>
              {started ? <TimerReset size={16} /> : <Play size={16} />}
            </Button>
          </div>
        </div>

        {!demo.guideOn ? (
          <div className="mt-10 text-center">
            <p className="text-lg">The guided demo is not running.</p>
            <Button className="mt-4 bg-hl text-ink hover:bg-hl/90" onClick={() => go(0)}><Play size={16} /> Start at step 1</Button>
          </div>
        ) : (
          <>
            <div className="mt-5 flex items-baseline gap-3">
              <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-sm tabular">{step.n} / {STEPS.length}</span>
              <span className="font-mono text-sm text-white/60">{step.time}</span>
              {persona ? <span className="text-sm text-white/60">as {persona.name}</span> : <span className="text-sm text-white/60">public page</span>}
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold">{step.title}</h1>
            <p className="mt-3 text-xl leading-relaxed text-white/90">{step.narration}</p>
            <ul className="mt-5 space-y-2 border-l-2 border-hl pl-4">
              {step.notes.map((n) => <li key={n} className="text-base text-white/85">{n}</li>)}
            </ul>
            {step.fallback && step.fallback !== "—" ? <p className="mt-4 text-sm text-white/60">If it fails: {step.fallback}</p> : null}
            <div className="mt-8 flex items-center gap-2">
              <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => go(demo.step - 1)} disabled={demo.step === 0}><ChevronLeft size={16} /> Back</Button>
              <Button className="flex-1 bg-hl text-ink hover:bg-hl/90" onClick={() => go(demo.step + 1)} disabled={!next}>
                {next ? <>Next: {next.title} <ChevronRight size={16} /></> : "Last step"}
              </Button>
              <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => go(0)} aria-label="Back to step 1"><RotateCcw size={16} /></Button>
            </div>
            <p className="mt-3 text-xs text-white/50">Arrow keys or a clicker work here. The demo window follows along and switches persona for you.</p>
          </>
        )}
      </div>
    </main>
  );
}
