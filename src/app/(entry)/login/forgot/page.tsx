"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Mail, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { auth } from "@/mock-api";
import { passwordProblems, strength, type TokenState } from "@/lib/services/auth";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, Help } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { SunState } from "@/components/brand/brand";
import { ago } from "@/lib/format";
import { cn } from "@/components/ui/cn";

/** PG-03 Forgot / reset password (FT-006). */
function Forgot() {
  const params = useSearchParams();
  const token = params.get("token");
  return <AuthFrame>{token ? <SetPassword token={token} /> : <RequestLink />}</AuthFrame>;
}

function RequestLink() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outbox = useStore((s) => s.db.outbox);
  const mails = useMemo(() => (sent ? outbox.filter((m) => m.type === "password-reset" && m.to.toLowerCase() === sent.toLowerCase()).slice(0, 1) : []), [outbox, sent]);
  const now = Date.now();

  return (
    <>
      <Link href="/" className="link inline-flex items-center gap-1 text-sm font-medium"><ArrowLeft size={15} /> Back to sign in</Link>
      <h1 className="mt-6 text-[1.9rem] leading-tight text-cv-teal">Reset your password</h1>
      {!sent ? (
        <>
          <p className="mt-1 text-ink-2">Enter your work email and we&apos;ll send you a secure link.</p>
          <form
            noValidate
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setError("Enter a valid work email, like name@clarvida.example."); return; }
              setBusy(true);
              await auth.requestPasswordReset(email);
              setBusy(false);
              setSent(email.trim());
            }}
          >
            <div>
              <Label htmlFor="fp-email">Work email</Label>
              <Input id="fp-email" type="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} className="mt-1 h-12 rounded-xl text-base" aria-invalid={Boolean(error)} aria-describedby={error ? "fp-err" : undefined} />
              <FieldError id="fp-err">{error}</FieldError>
            </div>
            <Button type="submit" variant="cta" size="lg" className="w-full justify-center" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
          </form>
        </>
      ) : (
        <>
          <Callout tone="teal" className="mt-5" icon={<Mail size={18} className="text-teal" />} title="Check your email">
            If an account exists for {sent}, we sent a link to reset the password. The link works once and expires in 15 minutes.
          </Callout>
          <section className="mt-6 rounded-2xl border border-line" aria-label="Demo Inbox preview">
            <p className="border-b border-line-2 px-4 py-2.5 text-sm font-semibold">Demo Inbox <span className="font-normal text-ink-3">(simulated email; nothing leaves this browser)</span></p>
            {mails.length ? (
              mails.map((m) => (
                <div key={m.id} className="px-4 py-4">
                  <p className="text-xs text-ink-3">To {m.to} · {ago(m.at, now)}</p>
                  <p className="mt-1 font-semibold">{m.subject}</p>
                  <p className="mt-2 whitespace-pre-line text-sm text-ink-2">{m.body}</p>
                  {m.link ? <Link href={m.link} className="mt-4 inline-flex"><Button variant="primary">{m.linkLabel ?? "Open link"}</Button></Link> : null}
                </div>
              ))
            ) : (
              <SunState compact title="No email for that address.">That&apos;s expected when no account exists. Try a demo account email.</SunState>
            )}
          </section>
          <button className="link mt-4 text-sm font-medium" onClick={() => { setSent(null); setEmail(""); }}>Use a different email</button>
        </>
      )}
    </>
  );
}

function SetPassword({ token }: { token: string }) {
  const router = useRouter();
  const users = useStore((s) => s.db.users);
  const [state, setState] = useState<TokenState | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { void auth.tokenState(token).then(setState); }, [token]);
  if (!state) return <p className="text-sm text-ink-3" aria-busy>Checking your link…</p>;
  if (!state.ok && !done) {
    return (
      <>
        <h1 className="text-[1.9rem] leading-tight text-cv-teal">{state.reason === "expired" ? "This link has expired" : state.reason === "used" ? "This link was already used" : "This link isn't valid"}</h1>
        <p className="mt-2 text-ink-2">Reset links work once and expire after 15 minutes. Request a new one to continue.</p>
        <Link href="/login/forgot/" className="mt-6 inline-flex"><Button variant="cta">Request a new link</Button></Link>
      </>
    );
  }
  const user = state.ok ? users.find((u) => u.id === state.userId) : undefined;
  const st = strength(pw);
  const probs = passwordProblems(pw, user?.email);
  if (done) {
    return (
      <SunState title="Your password was changed." action={<Button variant="cta" onClick={() => router.push("/?reset=1")}>Back to sign in</Button>}>
        A security notice was sent to your Demo Inbox. Your old password no longer works.
      </SunState>
    );
  }
  return (
    <>
      <h1 className="text-[1.9rem] leading-tight text-cv-teal">Set a new password</h1>
      <p className="mt-1 text-ink-2">For {user?.email}</p>
      <form
        noValidate
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (probs.length) { setError(probs[0]); return; }
          if (pw !== pw2) { setError("The two passwords don't match."); return; }
          setBusy(true);
          const ok = await auth.resetPassword(token, pw);
          setBusy(false);
          if (!ok) { setError("This link is no longer valid. Request a new one."); return; }
          setDone(true);
        }}
      >
        <div>
          <Label htmlFor="np">New password</Label>
          <div className="relative mt-1">
            <Input id="np" type={show ? "text" : "password"} autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setError(null); }} className="h-12 rounded-xl pr-12 text-base" aria-describedby="np-help" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink-3 hover:bg-sunken" aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          <div className="mt-2 flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < st ? (st >= 3 ? "bg-teal" : "bg-cv-amber") : "bg-line")} />)}
          </div>
          <Help id="np-help">Strength: {["Too short", "Weak", "Fair", "Good", "Strong"][st]}. At least 12 characters, upper and lower case and a number.</Help>
        </div>
        <div>
          <Label htmlFor="np2">Confirm new password</Label>
          <Input id="np2" type={show ? "text" : "password"} autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setError(null); }} className="mt-1 h-12 rounded-xl text-base" />
        </div>
        <FieldError>{error}</FieldError>
        <ul className="space-y-1 text-sm">
          {["Use at least 12 characters.", "Mix upper and lower case letters.", "Add a number."].map((r) => (
            <li key={r} className={cn("flex items-center gap-2", pw && !probs.includes(r) ? "text-teal-strong" : "text-ink-3")}><CheckCircle2 size={15} /> {r}</li>
          ))}
        </ul>
        <Button type="submit" variant="cta" size="lg" className="w-full justify-center" disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button>
      </form>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Forgot />
    </Suspense>
  );
}
