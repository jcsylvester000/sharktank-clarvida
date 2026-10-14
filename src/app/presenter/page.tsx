"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Play, RotateCcw, Scissors, TimerReset } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { STEPS } from "@/lib/demo/steps";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/brand";
import { cn } from "@/components/ui/cn";

const parseTime = (t: string) => { const [a, b] = t.split("–"); const s = (x: string) => { const [m, sec] = x.split(":").map(Number); return m * 60 + sec; }; return { start: s(a), end: s(b) }; };

/** PG-34 Presenter notes (FT-161): script, timing and fallback for each step; Back/Next here drive the demo window. */
export default function Presenter() {
  const demo = useStore((s) => s.db.demo);
  const users = useStore((s) => s.db.users);
  const mutate = useStore((s) => s.mutate);
  const reset = useStore((s) => s.reset);
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [short, setShort] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !window.name) window.name = "speaker";
    document.title = "Presenter notes · Clarvida Referral Co-Pilot";
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const order = short ? STEPS.filter((s) => s.short).map((s) => s.n - 1) : STEPS.map((s) => s.n - 1);
  const go = (i: number) => {
    const idx = Math.max(0, Math.min(STEPS.length - 1, i));
    mutate((d) => { d.demo.guideOn = true; d.demo.step = idx; }, { entity: "guide", action: "guide-step" }, { allowReadOnly: true });
    if (started === null) setStarted(Date.now());
  };
  const pos = order.indexOf(demo.step);
  const nextIdx = pos >= 0 ? order[pos + 1] : order.find((x) => x > demo.step);
  const prevIdx = pos > 0 ? order[pos - 1] : [...order].reverse().find((x) => x < demo.step);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") && nextIdx !== undefined) { e.preventDefault(); go(nextIdx); }
      if ((e.key === "ArrowLeft" || e.key === "PageUp") && prevIdx !== undefined) { e.preventDefault(); go(prevIdx); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const step = STEPS[demo.step];
  const next = nextIdx !== undefined ? STEPS[nextIdx] : undefined;
  const elapsed = started ? Math.floor((now - started) / 1000) : 0;
  const limit = short ? 180 : 300;
  const fmt = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
  const persona = step.userId ? users.find((u) => u.id === step.userId) : null;
  const budget = parseTime(step.time);
  const behind = !short && started !== null && elapsed > budget.end + 10;

  return (
    <main className="min-h-screen bg-cv-navy px-5 py-5 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><Logo variant="white" width={140} /><span className="text-sm text-white/70">Presenter notes</span></div>
          <div className="flex items-center gap-2">
            <span className={cn("font-mono text-3xl font-bold tabular", elapsed > limit ? "text-cv-amber" : "")} aria-label="Elapsed time">{fmt(elapsed)}</span>
            <span className="text-xs text-white/60">of {fmt(limit)}</span>
            <Button size="icon" variant="onDark" onClick={() => setStarted(started ? null : Date.now())} aria-label={started ? "Reset timer" : "Start timer"}>{started ? <TimerReset size={16} /> : <Play size={16} />}</Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={() => setShort((s) => !s)} aria-pressed={short} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold", short ? "border-cv-amber bg-cv-amber text-cv-ink" : "border-white/40 text-white")}>
            <Scissors size={14} /> 3-minute cut {short ? "on" : "off"}
          </button>
          <button onClick={() => window.open("/partner/refer/?code=GCS-NC-2026", "partner", "width=520,height=900")} className="inline-flex items-center gap-1.5 rounded-full border border-white/40 px-3 py-1 text-sm font-semibold"><ExternalLink size={14} /> Open partner window</button>
          <button onClick={() => { reset(); setStarted(null); }} className="inline-flex items-center gap-1.5 rounded-full border border-white/40 px-3 py-1 text-sm font-semibold"><RotateCcw size={14} /> Reset demo</button>
        </div>

        {!demo.guideOn ? (
          <div className="mt-10 rounded-[28px] bg-white/10 px-6 py-8 text-center">
            <p className="text-lg">The guided demo is not running.</p>
            <p className="mt-1 text-sm text-white/70">Put the demo window on the projector. This window drives it.</p>
            <Button variant="cta" className="mt-5" onClick={() => go(order[0])}>Start at step {order[0] + 1}</Button>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-baseline gap-3">
              <span className="rounded-full bg-white/15 px-3 py-0.5 font-mono text-sm font-bold tabular">{step.n} / {STEPS.length}</span>
              <span className={cn("font-mono text-sm", behind ? "font-bold text-cv-amber" : "text-white/70")}>{step.time}{behind ? " · running long" : ""}</span>
              <span className="text-sm text-white/70">{persona ? `signed in as ${persona.name}` : "public page"}</span>
            </div>
            <h1 className="mt-2 text-3xl font-medium text-white">{step.title}</h1>
            <p className="mt-3 text-xl leading-relaxed text-white">{step.narration}</p>
            <div className="mt-5 rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-xs font-semibold text-cv-amber">Click / show</p>
              <p className="mt-0.5 text-base">{step.click}</p>
            </div>
            <ul className="mt-4 space-y-1.5 border-l-2 border-cv-amber pl-4">{step.notes.map((n) => <li key={n} className="text-base text-white/90">{n}</li>)}</ul>
            <p className="mt-4 text-sm text-white/70"><span className="font-semibold text-white">If it fails: </span>{step.fallback}</p>
            <div className="mt-7 flex items-center gap-2">
              <Button variant="onDark" onClick={() => prevIdx !== undefined && go(prevIdx)} disabled={prevIdx === undefined}><ChevronLeft size={16} /> Back</Button>
              <Button variant="cta" className="flex-1 justify-center" chevron={false} onClick={() => nextIdx !== undefined && go(nextIdx)} disabled={!next}>
                {next ? <>Next: {next.title} <ChevronRight size={16} /></> : "Last step: close on the ask"}
              </Button>
            </div>
            <ol className="mt-6 grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <button onClick={() => go(s.n - 1)} className={cn("w-full truncate rounded-lg px-2 py-1 text-left", s.n - 1 === demo.step ? "bg-cv-amber font-semibold text-cv-ink" : short && !s.short ? "text-white/35" : "text-white/80 hover:bg-white/10")}>
                    {s.n}. {s.title}
                  </button>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-white/60">Arrow keys, space or a clicker work here. The demo window follows and signs in as the right person.</p>
          </>
        )}
      </div>
    </main>
  );
}
