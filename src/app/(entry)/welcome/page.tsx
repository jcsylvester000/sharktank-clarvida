"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Building2, UserRound, ShieldCheck, Bell, Mail, Check } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser } from "@/lib/store/hooks";
import { DASHBOARD_NAME, ROLE_LABEL, href, landingFor } from "@/lib/access";
import { DEFAULT_PREFS } from "@/lib/data/accounts";
import { account } from "@/mock-api";
import type { NotifChannel, NotifType, Role } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { Switch } from "@/components/ui/overlays";
import { Avatar, Logo, SunCircle, SyntheticNotice } from "@/components/brand/brand";
import { cn } from "@/components/ui/cn";
import { ChannelPicker, NOTIF_LABEL } from "@/components/account/prefs";

const RELEVANT: Record<Role, NotifType[]> = {
  ambassador: ["handoff", "task", "event", "capacity", "approval"],
  amb_lead: ["approval", "event", "handoff", "task"],
  intake: ["escalation", "task", "capacity"],
  intake_sup: ["escalation", "task", "capacity"],
  program_mgr: ["capacity", "task", "system"],
  marketing: ["approval", "task", "system"],
  compliance: ["system", "approval", "task"],
  admin: ["approval", "system", "task"],
  partner: ["system"],
  judge: ["system"],
};

const PLEDGE: Record<string, string[]> = {
  outreach: ["I will never enter client details (names, ages, dates of birth, Medicaid IDs or diagnoses) in outreach, notes or AI tools.", "I will review every AI draft and approve it myself before anything is sent.", "I will respect opt-outs and send limits."],
  care: ["I will open client records only to serve the family in front of me.", "I will share status with referrers only within consent rules.", "I will never copy client details into outreach, email or AI tools."],
  leader: ["I will look only at aggregate numbers and never ask for client-level data outside the Care Zone.", "I will keep small counts private (under 11 shows as <11).", "I will approve changes to routing and consent rules only after review."],
  partner: ["I will share only what Clarvida's intake team needs to reach the family.", "I have the guardian's agreement before I refer.", "I understand I will see status updates, not clinical details."],
  judge: ["I understand every person, referral and number here is synthetic.", "I can explore everything; changes to shared data are switched off for guests.", "I won't enter real client information."],
};
function pledgeFor(role: Role) {
  if (role === "ambassador" || role === "amb_lead") return PLEDGE.outreach;
  if (role === "intake" || role === "intake_sup") return PLEDGE.care;
  if (role === "partner") return PLEDGE.partner;
  if (role === "judge") return PLEDGE.judge;
  return PLEDGE.leader;
}

/** PG-04 First sign-in welcome (FT-007, FT-151): role and territory, notification preferences, privacy pledge. */
export default function Welcome() {
  const router = useRouter();
  const me = useCurrentUser();
  const users = useStore((s) => s.db.users);
  const live = useStore((s) => Boolean(s.db.live));
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<Record<NotifType, NotifChannel>>({ ...DEFAULT_PREFS });
  const [monday, setMonday] = useState(true);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!me) router.replace("/"); }, [me, router]);
  if (!me) return null;
  const manager = users.find((u) => u.id === me.managerId);
  const relevant = RELEVANT[me.role];
  const amb = me.role === "ambassador" || me.role === "amb_lead";
  const steps = ["Your role", "Notifications", "Privacy pledge"];

  const finish = async () => {
    setBusy(true);
    await account.completeWelcome(prefs, monday);
    setBusy(false);
    router.push(href(landingFor(me.role, live)));
  };

  return (
    <div className="min-h-screen bg-cv-ice">
      <header className="bg-teal">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo variant="white" width={140} />
          <span className="text-sm font-medium text-white/90">Welcome</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="relative overflow-hidden rounded-[var(--radius-panel)] bg-surface px-6 py-8 shadow-sm sm:px-10 sm:py-10">
          <SunCircle size={120} className="absolute -right-8 -top-10" />
          <ol className="relative mb-8 flex items-center gap-2" aria-label="Progress">
            {steps.map((s, i) => (
              <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", i < step ? "bg-teal text-white" : i === step ? "bg-cv-amber text-cv-ink" : "bg-sunken text-ink-3")}>
                  {i < step ? <Check size={14} /> : i + 1}
                </span>
                <span className={cn("hidden text-sm sm:block", i === step ? "font-semibold text-ink" : "text-ink-3")}>{s}</span>
                {i < steps.length - 1 ? <span className="h-px flex-1 bg-line" aria-hidden /> : null}
              </li>
            ))}
          </ol>

          {step === 0 && (
            <section>
              <h1 className="text-[1.9rem] leading-tight text-cv-teal">Welcome, {me.firstName ?? me.name}.</h1>
              <p className="mt-2 text-ink-2">Let&apos;s confirm a few things so the Co-Pilot is set up for you. It takes under a minute.</p>
              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                <Fact icon={<UserRound size={18} />} k="Role" v={ROLE_LABEL[me.role]} />
                <Fact icon={<Building2 size={18} />} k={me.role === "partner" ? "Organization" : "Office"} v={me.role === "partner" ? me.orgName ?? me.office : me.office} />
                <Fact icon={<MapPin size={18} />} k="Territory" v={me.counties?.length ? `${me.counties.join(", ")} counties` : me.territory ?? ""} />
                <Fact icon={<Avatar initials={manager?.initials ?? "··"} tone={manager?.avatarTone} size={22} />} k={manager ? "Your lead" : "Your start page"} v={manager ? `${manager.name}, ${ROLE_LABEL[manager.role]}` : me.role === "partner" ? "My referrals (partner hub)" : `${DASHBOARD_NAME[me.role]} dashboard`} />
              </dl>
              <p className="mt-4 text-sm text-ink-3">Something wrong? Your administrator can update your role and territory.</p>
              <div className="mt-8 flex justify-end"><Button variant="cta" size="lg" onClick={() => setStep(1)}>That&apos;s me</Button></div>
            </section>
          )}

          {step === 1 && (
            <section>
              <h1 className="text-[1.9rem] leading-tight text-cv-teal">How should we keep you posted?</h1>
              <p className="mt-2 text-ink-2">Choose where each kind of update goes. You can change this any time in Settings.</p>
              <ul className="mt-6 divide-y divide-line-2 rounded-2xl border border-line">
                {relevant.map((t) => (
                  <li key={t} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span>
                      <span className="block text-sm font-semibold">{NOTIF_LABEL[t].label}</span>
                      <span className="block text-xs text-ink-3">{NOTIF_LABEL[t].help}</span>
                    </span>
                    <ChannelPicker value={prefs[t]} onChange={(v) => setPrefs((p) => ({ ...p, [t]: v }))} label={NOTIF_LABEL[t].label} />
                  </li>
                ))}
              </ul>
              {amb ? (
                <div className="mt-5 rounded-2xl bg-cv-ice px-4 py-4">
                  <Switch checked={monday} onCheckedChange={setMonday} label={<span className="font-semibold">Monday briefing email at 7:00 am</span>} />
                  <div className="mt-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
                    <p className="flex items-center gap-2 text-xs text-ink-3"><Mail size={13} /> Preview</p>
                    <p className="mt-1 font-semibold">Your Monday briefing: 6 actions, 1 relationship reset, 2 quiet sources</p>
                    <p className="mt-1 text-ink-2">Top actions for your territory, relationship events and sources gone quiet. Organization data only, never client details.</p>
                  </div>
                </div>
              ) : null}
              <div className="mt-8 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
                <Button variant="cta" size="lg" onClick={() => setStep(2)}>Save and continue</Button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <div className="flex items-center gap-2 text-teal-strong"><ShieldCheck size={20} /><span className="text-sm font-semibold">Our privacy promise</span></div>
              <h1 className="mt-2 text-[1.9rem] leading-tight text-cv-teal">Protecting the families we serve</h1>
              <p className="mt-2 text-ink-2">Client information stays in the Care Zone. Outreach and AI only ever see organization data.</p>
              <ul className="mt-6 space-y-3">
                {pledgeFor(me.role).map((l) => (
                  <li key={l} className="flex gap-3 rounded-2xl bg-cv-ice px-4 py-3 text-sm"><Check size={18} className="mt-0.5 shrink-0 text-teal" /> {l}</li>
                ))}
              </ul>
              <Checkbox className="mt-6 text-base" checked={agree} onChange={(e) => setAgree(e.target.checked)} label={<span className="font-semibold">I agree to the privacy pledge.</span>} />
              <div className="mt-8 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button variant="cta" size="lg" disabled={!agree || busy} onClick={finish} data-guide="finish-welcome">{busy ? "Setting up…" : me.role === "partner" ? "Go to my referrals" : "Go to my dashboard"}</Button>
              </div>
            </section>
          )}
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-ink-3"><Bell size={12} /> You&apos;ll see this welcome once. Replay it any time from Profile and Settings.</p>
        <SyntheticNotice className="mt-2 text-center" />
      </main>
    </div>
  );
}

function Fact({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line px-4 py-3">
      <span className="mt-0.5 text-teal">{icon}</span>
      <span className="min-w-0">
        <dt className="text-xs text-ink-3">{k}</dt>
        <dd className="text-sm font-semibold">{v}</dd>
      </span>
    </div>
  );
}

