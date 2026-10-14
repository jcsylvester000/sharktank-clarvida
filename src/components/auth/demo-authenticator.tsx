"use client";
import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";
import { mfaCode, mfaSecondsLeft } from "@/lib/auth/crypto";
import { Button } from "@/components/ui/button";
import { LogoSymbol } from "@/components/brand/brand";
import { cn } from "@/components/ui/cn";

/** FT-003: a simulated authenticator app. The code is derived from the account and the current 30-second window. */
export function DemoAuthenticator({ userId, accountLabel, open, onClose, onUse }: { userId: string; accountLabel: string; open: boolean; onClose: () => void; onUse: (code: string) => void }) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const i = setInterval(() => setT(Date.now()), 500);
    return () => clearInterval(i);
  }, [open]);
  const code = mfaCode(userId, t);
  const left = mfaSecondsLeft(t);
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div inert={!open} className={cn("fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 sm:inset-x-auto sm:bottom-6 sm:right-6", open ? "translate-y-0" : "pointer-events-none translate-y-[120%]")} aria-hidden={!open}>
      <div role="dialog" aria-label="Demo Authenticator" className="mx-auto w-full max-w-sm rounded-t-[28px] border border-line bg-surface shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center justify-between rounded-t-[28px] bg-cv-navy px-5 py-3 text-white">
          <span className="inline-flex items-center gap-2 text-sm font-semibold"><Smartphone size={16} /> Demo Authenticator</span>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-white/15" aria-label="Close Demo Authenticator" tabIndex={open ? 0 : -1}><X size={18} /></button>
        </div>
        <div className="px-5 py-5">
          <div className="flex items-center gap-3">
            <LogoSymbol size={34} />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Clarvida</p>
              <p className="truncate text-xs text-ink-3">{accountLabel}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-cv-ice px-4 py-3">
            <p className="num font-mono text-[2.1rem] tracking-[0.18em] text-cv-navy" aria-live="polite" aria-label={`Current code ${code.split("").join(" ")}`}>
              {code.slice(0, 3)} {code.slice(3)}
            </p>
            <svg width="52" height="52" viewBox="0 0 52 52" aria-label={`${left} seconds left`} role="img">
              <circle cx="26" cy="26" r={r} fill="none" stroke="var(--color-line)" strokeWidth="5" />
              <circle cx="26" cy="26" r={r} fill="none" stroke={left <= 5 ? "var(--color-cv-amber)" : "var(--color-cv-teal)"} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - left / 30)} transform="rotate(-90 26 26)" />
              <text x="26" y="31" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--color-ink-2)">{left}</text>
            </svg>
          </div>
          <p className="mt-3 text-xs text-ink-3">A new code every 30 seconds. Simulated phone app for the demo; production uses Clarvida SSO with MFA.</p>
          <Button className="mt-4 w-full justify-center" onClick={() => onUse(code)} tabIndex={open ? 0 : -1}>Use this code</Button>
        </div>
      </div>
    </div>
  );
}
