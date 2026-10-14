"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Smartphone, ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { href, landingFor } from "@/lib/access";
import { auth } from "@/mock-api";
import type { PendingAuth } from "@/mock-api/auth";
import { AuthFrame } from "@/components/auth/auth-frame";
import { DemoAuthenticator } from "@/components/auth/demo-authenticator";
import { Button } from "@/components/ui/button";
import { Checkbox, FieldError } from "@/components/ui/field";
import { Avatar } from "@/components/brand/brand";
import { cn } from "@/components/ui/cn";

/** PG-02 Verify your identity (FT-003, FT-004). */
export default function Verify() {
  const router = useRouter();
  const users = useStore((s) => s.db.users);
  const accounts = useStore((s) => s.db.accounts);
  const live = useStore((s) => Boolean(s.db.live));
  const [pending, setPending] = useState<PendingAuth | null | undefined>(undefined);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [shake, setShake] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const p = auth.getPending();
    setPending(p);
    if (!p) router.replace("/");
    else setTimeout(() => refs.current[0]?.focus(), 50);
  }, [router]);

  const user = pending ? users.find((u) => u.id === pending.userId) : undefined;
  if (!pending || !user) return null;

  const code = digits.join("");
  const setAll = (c: string) => {
    const d = c.replace(/\D/g, "").slice(0, 6).split("");
    setDigits(Array.from({ length: 6 }, (_, i) => d[i] ?? ""));
    refs.current[Math.min(5, d.length)]?.focus();
    setError(null);
  };

  const verify = async (c = code) => {
    if (c.length !== 6) { setError("Enter all 6 digits."); return; }
    setBusy(true);
    const res = await auth.verifyMfaCode(c, remember);
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? "That code didn't match.");
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setDigits(Array(6).fill(""));
      refs.current[0]?.focus();
      return;
    }
    const onboarded = Boolean(accounts?.[user.id]?.onboardedAt);
    router.push(onboarded ? href(landingFor(user.role, live)) : "/welcome/");
  };

  return (
    <AuthFrame>
      <Link href="/" onClick={() => auth.cancelPending()} className="link inline-flex items-center gap-1 text-sm font-medium"><ArrowLeft size={15} /> Use a different account</Link>
      <div className="mt-6 flex items-center gap-2 text-teal-strong">
        <ShieldCheck size={20} /> <span className="text-sm font-semibold">Two-step verification</span>
      </div>
      <h1 className="mt-2 text-[1.9rem] leading-tight text-cv-teal">Verify your identity</h1>
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-cv-ice px-4 py-3">
        <Avatar initials={user.initials} tone={user.avatarTone} size={36} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{user.name}</span>
          <span className="block truncate text-xs text-ink-3">{user.email}</span>
        </span>
      </div>
      <p className="mt-4 text-ink-2">Enter the 6-digit code from your authenticator app.</p>

      <form onSubmit={(e) => { e.preventDefault(); void verify(); }} className="mt-4" data-guide="mfa">
        <fieldset>
          <legend className="sr-only">6-digit code</legend>
          <div className={cn("flex justify-between gap-2", shake && "animate-[shake_0.35s_ease-in-out]")} onPaste={(e) => { e.preventDefault(); setAll(e.clipboardData.getData("text")); }}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { refs.current[i] = el; }}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`Digit ${i + 1} of 6`}
                maxLength={1}
                value={d}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  if (v.length > 1) { setAll(v); return; }
                  const next = [...digits];
                  next[i] = v;
                  setDigits(next);
                  setError(null);
                  if (v && i < 5) refs.current[i + 1]?.focus();
                  if (v && i === 5 && next.every(Boolean)) void verify(next.join(""));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
                  if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
                  if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
                }}
                className={cn("h-14 w-full min-w-0 rounded-xl border bg-surface text-center font-mono text-2xl font-bold text-cv-navy focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25", error ? "border-crit" : "border-line")}
                aria-invalid={Boolean(error)}
              />
            ))}
          </div>
        </fieldset>
        <FieldError>{error}</FieldError>
        <Checkbox className="mt-4" checked={remember} onChange={(e) => setRemember(e.target.checked)} label="Remember this device for 30 days" />
        <Button type="submit" variant="cta" size="lg" className="mt-5 w-full justify-center" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify"}</Button>
      </form>

      <button type="button" onClick={() => setDrawer(true)} className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-dashed border-teal/50 px-4 py-3 text-left hover:bg-cv-ice" data-guide="authenticator">
        <Smartphone size={20} className="text-teal" />
        <span>
          <span className="block text-sm font-semibold text-teal-strong">Open the Demo Authenticator</span>
          <span className="block text-xs text-ink-3">The simulated phone app that shows this account&apos;s current code.</span>
        </span>
      </button>
      <p className="mt-3 text-xs text-ink-3">Lost access to your authenticator? Your administrator can reset it.</p>

      <DemoAuthenticator userId={user.id} accountLabel={user.email ?? user.name} open={drawer} onClose={() => setDrawer(false)} onUse={(c) => { setDrawer(false); setAll(c); void verify(c); }} />
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}`}</style>
    </AuthFrame>
  );
}
