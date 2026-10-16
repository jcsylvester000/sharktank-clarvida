"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Activity, Eye, EyeOff, KeyRound, Lock, PlayCircle, RotateCcw, Users, ExternalLink, Clapperboard, ChevronDown, Route } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser } from "@/lib/store/hooks";
import { switchMode } from "@/lib/mode";
import { isSimUser } from "@/lib/live/seed";
import { ROLE_LABEL, href, landingFor } from "@/lib/access";
import { auth } from "@/mock-api";
import { AuthFrame } from "@/components/auth/auth-frame";
import { ReferralShowcase } from "@/components/auth/referral-showcase";
import { useGuide } from "@/components/shell/guide-bar";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/misc";
import { Dialog } from "@/components/ui/overlays";
import { Input, Label, FieldError } from "@/components/ui/field";
import { Avatar, LogoSymbol } from "@/components/brand/brand";
import { cn } from "@/components/ui/cn";
import type { User } from "@/lib/domain/types";

/** Demo accounts card (PG-01): the one place in the app the shared demo password appears. */
const DEMO_PASSWORD = "Brighter2026!";

function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const me = useCurrentUser();
  const users = useStore((s) => s.db.users).filter((u) => !isSimUser(u.id));
  const live = useStore((s) => Boolean(s.db.live));
  const accounts = useStore((s) => s.db.accounts);
  const reset = useStore((s) => s.reset);
  const { go } = useGuide();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [sso, setSso] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [demoOpen, setDemoOpen] = useState(true);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!lockedUntil) return;
    const i = setInterval(() => { tick((n) => n + 1); if (Date.now() >= lockedUntil) { setLockedUntil(null); setError(null); } }, 1000);
    return () => clearInterval(i);
  }, [lockedUntil]);

  const afterSignIn = (u: User | undefined) => {
    if (!u) return;
    const onboarded = Boolean(accounts?.[u.id]?.onboardedAt);
    router.push(onboarded ? href(landingFor(u.role, live)) : "/welcome/");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(!email.trim() ? "Enter your work email." : "Enter your password.");
      return;
    }
    setBusy(true);
    const res = await auth.passwordSignIn(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      if (res.reason === "locked" && res.lockedUntil) setLockedUntil(res.lockedUntil);
      return;
    }
    if (res.signedIn) {
      toast.success("Signed in on a remembered device");
      afterSignIn(useStore.getState().db.users.find((u) => u.id === res.userId));
    } else router.push("/login/verify/");
  };

  const chooseSso = async (u: User) => {
    setSso(false);
    setBusy(true);
    const res = await auth.ssoSignIn(u.id);
    setBusy(false);
    if (!res.ok) { setError(res.message ?? "That account can't sign in."); return; }
    if (res.needsMfa) router.push("/login/verify/");
    else afterSignIn(u);
  };

  const lockLeft = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000)) : 0;

  return (
    <AuthFrame
      hero={<ReferralShowcase />}
      heading="It all starts with a referral."
      intro="A school counselor, caseworker or doctor sends a family to Clarvida. Everything in the Co-Pilot follows from that moment: who sent it, how fast the family is called, what the referrer hears back, and which relationships to grow."
      aside={
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/story/" className="inline-flex items-center gap-1.5 rounded-full border border-teal/40 bg-surface px-4 py-2 text-sm font-semibold text-teal-strong hover:bg-teal-tint"><Clapperboard size={15} /> Opening scene</Link>
          <button onClick={() => window.open("/partner/refer/?code=GCS-NC-2026", "partner", "width=520,height=900")} className="inline-flex items-center gap-1.5 rounded-full border border-teal/40 bg-surface px-4 py-2 text-sm font-semibold text-teal-strong hover:bg-teal-tint"><ExternalLink size={15} /> Try the referral form</button>
        </div>
      }
    >
      {me ? (
        <Callout tone="teal" className="mb-6" title={`You're signed in as ${me.name}.`} action={<Button size="sm" onClick={() => router.push(href(landingFor(me.role, live)))}>Continue</Button>}>
          {ROLE_LABEL[me.role]}. Sign in below to use a different account in this window.
        </Callout>
      ) : null}
      {params.get("idle") ? (
        <Callout tone="warn" className="mb-6" title="You were signed out after a period of inactivity.">Automatic sign-out protects client information on shared screens.</Callout>
      ) : params.get("signedout") ? (
        <Callout tone="teal" className="mb-6" title="You're signed out.">See you next time.</Callout>
      ) : params.get("reset") ? (
        <Callout tone="teal" className="mb-6" title="Your password was changed.">Sign in with your new password.</Callout>
      ) : null}
      {live ? (
        <Callout tone="teal" className="mb-6" icon={<Activity size={18} className="text-teal" />} title="Live sandbox">Referrals, intake work and outreach happen on their own while you explore. Separate from the pitch demo.</Callout>
      ) : null}

      <h1 className="text-[1.9rem] leading-tight text-cv-teal">Sign in</h1>
      <p className="mt-1 text-ink-2">Welcome to the Clarvida Referral Co-Pilot. Use your work email.</p>

      <form onSubmit={submit} noValidate className="mt-6 space-y-4" data-guide="sign-in">
        <div>
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="name@clarvida.example" className="mt-1 h-12 rounded-xl text-base" aria-invalid={Boolean(error)} aria-describedby={error ? "signin-error" : undefined} />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/login/forgot/" className="link text-sm font-medium">Forgot password?</Link>
          </div>
          <div className="relative mt-1">
            <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} className="h-12 rounded-xl pr-12 text-base" aria-invalid={Boolean(error)} aria-describedby={error ? "signin-error" : undefined} />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink-3 hover:bg-sunken hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <FieldError id="signin-error">
          {error ? (lockedUntil ? <span className="inline-flex items-center gap-1.5"><Lock size={13} /> {error} Try again in {Math.floor(lockLeft / 60)}:{String(lockLeft % 60).padStart(2, "0")}.</span> : error) : null}
        </FieldError>
        <Button type="submit" variant="cta" size="lg" className="w-full justify-center" disabled={busy || Boolean(lockedUntil)}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-ink-3"><span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" /></div>
      <Button variant="secondary" size="lg" className="w-full justify-center" onClick={() => setSso(true)} disabled={busy}>
        <KeyRound size={18} /> Sign in with Clarvida SSO
      </Button>

      {/* Demo accounts card (click to fill). The shared demo password appears only here and in the README (NF-06). */}
      <section className="mt-8 rounded-2xl border border-line bg-cv-ice" aria-labelledby="demo-accounts">
        <button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setDemoOpen((o) => !o)} aria-expanded={demoOpen} aria-controls="demo-accounts-list">
          <span>
            <span id="demo-accounts" className="flex items-center gap-2 text-sm font-semibold text-ink"><Users size={16} className="text-teal" /> Demo accounts</span>
            <span className="block text-xs text-ink-3">Click an account to fill the form. Password for all: <span className="font-mono font-semibold text-ink-2">{DEMO_PASSWORD}</span></span>
          </span>
          <ChevronDown size={18} className={cn("shrink-0 text-ink-3 transition-transform", demoOpen && "rotate-180")} />
        </button>
        {demoOpen ? (
          <ul id="demo-accounts-list" className="grid gap-1 px-2 pb-2 sm:grid-cols-2">
            {users.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => { setEmail(u.email ?? ""); setPassword(DEMO_PASSWORD); setError(null); document.getElementById("password")?.focus(); }}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-surface", email === u.email && "bg-surface ring-1 ring-teal/40", !u.active && "opacity-60")}
                >
                  <Avatar initials={u.initials} tone={u.avatarTone} size={30} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{u.name}{!u.active ? " (disabled)" : ""}</span>
                    <span className="block truncate text-xs text-ink-3">{ROLE_LABEL[u.role]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {live ? (
          <Button variant="secondary" className="justify-center sm:col-span-2" onClick={() => switchMode("demo", "/")}><PlayCircle size={16} /> Switch to the pitch demo</Button>
        ) : (
          <>
            <Button variant="primary" className="justify-center" onClick={() => go(0, "pitch")}><PlayCircle size={16} /> Run the guided demo</Button>
            <Button variant="secondary" className="justify-center sm:col-span-2" onClick={() => go(0, "journey")} data-guide="journey-start"><Route size={16} /> Follow one referral through every account</Button>
            <Button variant="secondary" className="justify-center" onClick={() => switchMode("live", "/live/")}><Activity size={16} /> Live sandbox</Button>
          </>
        )}
        <Button variant="ghost" className="justify-center sm:col-span-2" onClick={() => setConfirm(true)}><RotateCcw size={15} /> {live ? "Start the sandbox over" : "Reset demo"}</Button>
      </div>

      <SsoChooser open={sso} onOpenChange={setSso} users={users} onChoose={chooseSso} />

      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title={live ? "Start the sandbox over?" : "Reset the demo world?"}
        description={live ? "The simulation restarts from its starting data. The pitch demo is not affected." : "Every page and account goes back to its starting state, including passwords, welcome tours and notifications."}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => { reset(); setConfirm(false); auth.cancelPending(); toast.success(live ? "Sandbox restarted" : "Demo world restored"); }}>{live ? "Start over" : "Reset demo world"}</Button>
          </>
        }
      />
      <div className="mt-10 lg:hidden">
        <p className="mb-2 text-sm font-semibold text-cv-teal">It all starts with a referral</p>
        <ReferralShowcase compact />
      </div>
    </AuthFrame>
  );
}

/** FT-002: simulated Clarvida SSO, a Clarvida-branded account chooser (no third-party identity branding). */
function SsoChooser({ open, onOpenChange, users, onChoose }: { open: boolean; onOpenChange: (o: boolean) => void; users: User[]; onChoose: (u: User) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={<span className="flex items-center gap-2"><LogoSymbol size={26} /> Clarvida single sign-on</span>} description="Choose an account to continue to the Referral Co-Pilot.">
      <ul className="-mx-2 max-h-[55vh] space-y-1 overflow-y-auto">
        {users.map((u) => (
          <li key={u.id}>
            <button disabled={!u.active} onClick={() => onChoose(u)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-cv-ice disabled:cursor-not-allowed disabled:opacity-50">
              <Avatar initials={u.initials} tone={u.avatarTone} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{u.name}</span>
                <span className="block truncate text-xs text-ink-3">{u.email}</span>
              </span>
              <span className="hidden text-right text-xs text-ink-3 sm:block">{u.active ? ROLE_LABEL[u.role] : <span className="inline-flex items-center gap-1"><Lock size={12} /> Disabled</span>}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-ink-3">Simulated for the demo. In production this is Clarvida&apos;s existing identity provider with MFA.</p>
    </Dialog>
  );
}

export default function Page() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
