"use client";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { useStore } from "@/lib/store/db";
import { GuideBar } from "./guide-bar";
import { LiveRunner } from "@/components/live/live-runner";
import { setMode } from "@/lib/mode";

/** Hydrates the browser database before rendering, applies presenter mode, and hosts toasts + the guide bar. */
export function Providers({ children }: { children: React.ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);
  const hydrate = useStore((s) => s.hydrate);
  const presenter = useStore((s) => s.db.demo.presenter);
  const memoryOnly = useStore((s) => s.memoryOnly);

  useEffect(() => {
    // The pitch opening and speaker notes always use the demo world; /live always uses the sandbox.
    const p = window.location.pathname;
    if (p === "/" || p.startsWith("/story") || p.startsWith("/presenter")) setMode("demo");
    else if (p.startsWith("/live")) setMode("live");
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    document.documentElement.classList.toggle("presenter", presenter);
  }, [presenter]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface" aria-busy="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-color.png" alt="Clarvida" width={170} height={46} />
        <span className="text-sm text-ink-3">Loading the Referral Co-Pilot…</span>
      </div>
    );
  }
  return (
    <>
      {children}
      <GuideBar />
      <LiveRunner />
      <Toaster position="top-right" offset={76} closeButton toastOptions={{ style: { fontFamily: "var(--font-sans)", borderRadius: 16 } }} />
      {memoryOnly ? <p role="status" className="fixed bottom-2 left-2 z-50 rounded-full bg-cv-navy px-3 py-1 text-xs text-white">Browser storage is blocked: this demo is running in memory and resets on reload.</p> : null}
    </>
  );
}
