"use client";
import { useEffect, useState } from "react";
import { Check, Clock3, Inbox, Link2, MailCheck, Send } from "lucide-react";
import { cn } from "@/components/ui/cn";

// Opening-page showcase: a mock partner fills in a referral, sends it, and the Co-Pilot takes over.
// It makes the point that the referral is where everything in the application starts. Synthetic data only;
// it mirrors seeded referral REF-NC-24811 from Gaston County Schools.

const FIELDS: { label: string; value: string }[] = [
  { label: "Child's age", value: "12" },
  { label: "Guardian (first name)", value: "Morgan" },
  { label: "Coverage", value: "Medicaid" },
  { label: "Best phone for the family", value: "(555) 010-0388" },
  { label: "Best times to call", value: "Weekday mornings" },
  { label: "What's going on", value: "Withdrawn in class since a family loss. Counselor recommends outpatient therapy." },
];
const AFTER: { icon: React.ComponentType<{ size?: number; className?: string }>; text: string }[] = [
  { icon: Check, text: "Received as REF-NC-24811" },
  { icon: Link2, text: "Source captured: Gaston County Schools (coded link)" },
  { icon: Inbox, text: "Routed to the Gastonia intake queue" },
  { icon: Clock3, text: "1-business-day response clock started" },
  { icon: MailCheck, text: "Counselor gets status updates, never client details" },
];

const TYPE_MS = 28;

export function ReferralShowcase({ compact = false }: { compact?: boolean }) {
  const [reduced, setReduced] = useState(false);
  const [field, setField] = useState(0); // field being typed
  const [chars, setChars] = useState(0); // characters typed in that field
  const [phase, setPhase] = useState<"typing" | "consent" | "sending" | "sent">("typing");
  const [after, setAfter] = useState(0); // confirmation lines shown

  useEffect(() => {
    try { setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (reduced) { setField(FIELDS.length); setPhase("sent"); setAfter(AFTER.length); return; }
    let t: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (field >= FIELDS.length) t = setTimeout(() => setPhase("consent"), 300);
      else if (chars < FIELDS[field].value.length) t = setTimeout(() => setChars((c) => c + 1), TYPE_MS);
      else t = setTimeout(() => { setField((f) => f + 1); setChars(0); }, 220);
    } else if (phase === "consent") t = setTimeout(() => setPhase("sending"), 700);
    else if (phase === "sending") t = setTimeout(() => setPhase("sent"), 900);
    else if (after < AFTER.length) t = setTimeout(() => setAfter((a) => a + 1), 650);
    else t = setTimeout(() => { setField(0); setChars(0); setAfter(0); setPhase("typing"); }, 7000);
    return () => clearTimeout(t);
  }, [reduced, phase, field, chars, after]);

  const shown = (i: number) => (i < field ? FIELDS[i].value : i === field && phase === "typing" ? FIELDS[i].value.slice(0, chars) : "");
  const consent = phase !== "typing";

  return (
    <div className="relative w-full" data-guide="referral-showcase">
      <p className="sr-only">
        Example: Jordan Carter, a school counselor at Gaston County Schools, refers a 12-year-old through the school&apos;s coded link. The Co-Pilot records the source, routes it to the Gastonia intake queue and starts the one-business-day clock. All data is synthetic.
      </p>
      <div aria-hidden className="rounded-[var(--radius-panel)] border border-line bg-surface shadow-sm">
        <div className="flex items-center justify-between gap-3 rounded-t-[var(--radius-panel)] bg-cv-teal px-4 py-2.5 text-white">
          <span className="text-sm font-semibold">Refer someone to Clarvida</span>
          <span className="rounded-full bg-cv-navy px-2 py-0.5 text-[0.7rem] font-semibold text-white">Partner form · 1 minute</span>
        </div>
        <div className={cn("px-4", compact ? "py-3" : "py-4")}>
          <div className="mb-3 flex items-center gap-2.5 rounded-md bg-teal-tint px-3 py-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cv-navy text-xs font-semibold text-white">JC</span>
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-ink">Jordan Carter, Lead School Counselor</p>
              <p className="truncate text-ink-2">Gaston County Schools · from the school&apos;s own link (GCS-NC-2026)</p>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-x-3 gap-y-2">
            {FIELDS.map((f, i) => (
              <div key={f.label} className={cn(i < 3 ? "col-span-2" : i < 5 ? "col-span-3" : "col-span-6", compact && i === FIELDS.length - 1 && "hidden")}>
                <p className="text-[0.68rem] font-medium text-ink-3">{f.label}</p>
                <p className={cn("min-h-[1.6rem] rounded border px-2 py-1 text-[0.8rem] text-ink", i === field && phase === "typing" ? "border-teal ring-2 ring-teal/15" : "border-line")}>
                  {shown(i)}
                  {i === field && phase === "typing" ? <span className="ml-px inline-block h-3.5 w-px animate-pulse bg-ink align-middle" /> : null}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[0.72rem] text-ink-2">
              <span className={cn("grid size-4 place-items-center rounded border", consent ? "border-teal bg-teal text-white" : "border-line")}>{consent ? <Check size={11} /> : null}</span>
              The family agreed to this referral
            </span>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition", phase === "sending" ? "scale-95 bg-cv-amber text-cv-navy ring-4 ring-cv-amber/30" : phase === "sent" ? "bg-ok-tint text-ok" : "bg-cv-amber text-cv-navy")}>
              {phase === "sent" ? <><Check size={13} /> Sent</> : <><Send size={13} /> Send referral</>}
            </span>
          </div>
        </div>
        <div className="rounded-b-[var(--radius-panel)] border-t border-line-2 bg-cv-navy px-4 py-3 text-white">
          <p className={cn("mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide transition-colors", phase === "sent" ? "text-cv-amber" : "text-white/60")}>{phase === "sent" ? "The Co-Pilot takes it from here" : "Waiting for the partner to send…"}</p>
          <ul className="space-y-1">
            {AFTER.map((a, i) => {
              const I = a.icon;
              return (
                <li key={a.text} className={cn("flex items-center gap-2 text-[0.8rem] transition-opacity duration-300", i < after ? "opacity-100" : "opacity-0")}>
                  <I size={14} className="shrink-0 text-cv-sky" /> {a.text}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
