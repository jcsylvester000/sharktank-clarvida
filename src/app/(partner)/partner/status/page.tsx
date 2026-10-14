"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, ShieldCheck, ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser } from "@/lib/store/hooks";
import { useLang } from "@/lib/i18n/lang";
import { tier1Status } from "@/lib/rules/status";
import { disclosure } from "@/lib/rules/disclosure";
import { audit } from "@/lib/services/core";
import { statusLink, statusToken, validToken } from "@/lib/services/notices";
import { JourneyTracker } from "@/components/domain/journey";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { fmtDateTime } from "@/lib/format";

/** PG-32 Referral status (FT-090, FT-091, FT-094). Tier 1 for every referrer via a signed link; Tier 2 only when consent rules allow. */
function Status() {
  const params = useSearchParams();
  const router = useRouter();
  const ref = (params.get("ref") ?? "").toUpperCase();
  const token = params.get("token");
  const { t } = useLang();
  const me = useCurrentUser();
  const r = useStore((s) => s.db.referrals.find((x) => x.id.toUpperCase() === ref));
  const program = useStore((s) => (r?.programId ? s.db.programs.find((p) => p.id === r.programId) : undefined));
  const mutate = useStore((s) => s.mutate);
  const [q, setQ] = useState(ref);
  const [email, setEmail] = useState("");
  const [fail, setFail] = useState(false);
  const logged = useRef("");

  // Who may see this page: a valid signed link, the partner who made the referral, or Clarvida staff previewing it.
  const staffPreview = Boolean(me && me.role !== "partner" && me.role !== "judge");
  const ownPartner = Boolean(r && me?.role === "partner" && r.referrerOrgId === me.orgId);
  const allowed = Boolean(r && (validToken(r.id, token) || ownPartner || staffPreview));

  useEffect(() => {
    if (!r || !allowed || logged.current === r.id) return;
    logged.current = r.id;
    mutate((d) => audit(d, { action: "Referrer viewed status (Tier 1)", objectId: r.id, zone: "External", actor: "external" }), undefined, { allowReadOnly: true });
  }, [r, allowed, mutate]);

  if (!r || !allowed) {
    return (
      <div className="space-y-4">
        <h1 className="text-[1.9rem] leading-tight text-cv-teal">{t.statusTitle}</h1>
        <form
          className="space-y-4 rounded-[var(--radius-panel)] bg-surface px-6 py-7 shadow-sm sm:px-9"
          onSubmit={(e) => {
            e.preventDefault();
            const id = q.trim().toUpperCase();
            const target = useStore.getState().db.referrals.find((x) => x.id.toUpperCase() === id);
            if (target && target.referrerEmail && target.referrerEmail.toLowerCase() === email.trim().toLowerCase()) {
              router.push(`/partner/status/?ref=${target.id}&token=${statusToken(target.id)}`);
            } else setFail(true);
          }}
        >
          <div>
            <p className="font-semibold">{t.verifyTitle}</p>
            <p className="mt-1 text-sm text-ink-2">{t.verifyHelp}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ref">{t.lookup}</Label>
              <Input id="ref" value={q} onChange={(e) => { setQ(e.target.value); setFail(false); }} placeholder="REF-NC-24818" className="mt-1 font-mono" />
            </div>
            <div>
              <Label htmlFor="vemail">{t.email}</Label>
              <Input id="vemail" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setFail(false); }} className="mt-1" aria-invalid={fail} aria-describedby="verify-err" />
            </div>
          </div>
          <FieldError id="verify-err">{fail ? t.verifyFail : null}</FieldError>
          <Button type="submit" variant="cta">{t.verifyBtn}</Button>
          <p className="text-xs text-ink-3">{t.signedLinkNote}</p>
        </form>
      </div>
    );
  }

  const t1 = tier1Status(r);
  const d = disclosure({ srcType: r.srcType, signedRelease: r.signedRelease, part2Program: Boolean(program?.part2), part2Consent: r.part2Consent });
  const labels = { Received: t.step_Received, Contacted: t.step_Contacted, "Intake scheduled": t["step_Intake scheduled"], "Intake completed": t["step_Intake completed"] };
  const t1Label = t[`t1_${t1}` as keyof typeof t] as string;

  return (
    <div className="space-y-5" data-guide="status">
      {ownPartner ? <Link href="/partner/hub/" className="link inline-flex items-center gap-1 text-sm font-medium"><ArrowLeft size={15} /> {t.myReferrals}</Link> : null}
      <div>
        <h1 className="text-[1.9rem] leading-tight text-cv-teal">{t.statusTitle}</h1>
        <p className="mt-1 font-mono text-ink-2">{r.id}{program ? <span className="ml-2 font-sans text-sm">· {program.partnerLabel}</span> : null}</p>
        {validToken(r.id, token) ? <p className="mt-1 inline-flex items-center gap-1 text-xs text-teal-strong"><ShieldCheck size={13} /> {t.secureLink}</p> : null}
      </div>
      <section className="rounded-[var(--radius-panel)] bg-surface px-6 py-7 shadow-sm sm:px-9">
        <p className="text-sm text-ink-3">{t.currentStatus}</p>
        <div className="mt-2 flex items-center gap-3">
          <p className="text-3xl font-medium text-cv-teal">{t1Label}</p>
        </div>
        <div className="mt-6">
          <JourneyTracker referral={r} tier2Allowed={d.tier2} audience="partner" labels={labels} lockedLabel={t.locked} holdNote={t1 === "On hold" ? t.holdPromise : undefined} />
        </div>
        <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-ink-3"><RefreshCw size={12} /> {t.updatesLive}</p>
      </section>
      {!d.tier2 ? (
        <details className="rounded-2xl border border-line bg-surface p-5">
          <summary className="cursor-pointer font-medium">{t.whyLocked}</summary>
          <p className="mt-2 text-sm text-ink-2">{t.tier2Rule}</p>
        </details>
      ) : null}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <ul className="space-y-1.5 text-sm text-ink-2">
          {[...r.notices].reverse().map((n, i) => (
            <li key={`${n.at}-${i}`} className="flex justify-between gap-4">
              <span>{t[`t1_${n.type}` as keyof typeof t] as string}</span>
              <span className="shrink-0 text-xs text-ink-3">{fmtDateTime(n.at)}</span>
            </li>
          ))}
        </ul>
      </section>
      {staffPreview ? <p className="text-xs text-ink-3">Staff preview. Referrers open this page with the secure link in their email: <span className="font-mono">{statusLink(r.id)}</span></p> : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Status />
    </Suspense>
  );
}
