"use client";
import { useEffect, useRef, useState } from "react";

/** Reveals text word by word like a live model (about 1 s "thinking", then ~40 words per second). */
export function useStream(text: string | null, opts: { delayMs?: number; wordsPerSec?: number } = {}) {
  const { delayMs = 900, wordsPerSec = 40 } = opts;
  const [shown, setShown] = useState("");
  const [state, setState] = useState<"idle" | "thinking" | "streaming" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (text === null) { setShown(""); setState("idle"); return; }
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setShown(text); setState("done"); return; }
    const tokens = text.split(/(\s+)/);
    let i = 0;
    setShown("");
    setState("thinking");
    const step = () => {
      i += 2;
      setShown(tokens.slice(0, i).join(""));
      if (i < tokens.length) timer.current = setTimeout(step, 1000 / wordsPerSec);
      else setState("done");
    };
    timer.current = setTimeout(() => { setState("streaming"); step(); }, delayMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text, delayMs, wordsPerSec]);

  return { shown, state, done: state === "done" };
}
