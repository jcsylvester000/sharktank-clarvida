"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useLang } from "@/lib/i18n/lang";
import { tier1Status } from "@/lib/rules/status";
import { disclosure } from "@/lib/rules/disclosure";
import { audit } from "@/lib/services/core";
import { JourneyTracker } from "@/components/domain/journey";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/components/ui/cn";

function Status() {
  const params = useSearchParams();
  const router = useRouter();
  const ref = params.get("ref") ?? "";
  const { t } = useLang();
  const r = useStore((s) => s.db.referrals.find((x) => x.id.toLowerCase() === ref.toLowerCase()));
  const program = useStore((s) => (r?.programId ? s.db.programs.find((p) => p.id === r.programId) : undefined));
  const mutate = useStore((s) => s.mutate);
  const [q, setQ] = useState(ref);
  const logged = useRef("");

  useEffect(() => {
    if (!r || logged.current === r.id) return;
    logged.current = r.id;
    mutate((d) => audit(d, { action: "Referrer viewed status (Tier 1)", objectId: r.id, zone: "External", actor: "external" }));
  }, [r, mutate]);

  const lookup = (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => { e.preventDefault(); router.push(`/partner/status/?ref=${encodeURIComponent(q.trim().toUpperCase())}`); }}
    >
      <div className="min-w-56 flex-1">
        <Label htmlFor="ref">{t.lookup}</Label>
        <Input id="ref" value={q} onChange={(e) => setQ(e.target.value)} placeholder="REF-NC-24818" className="mt-1 font-mono" />
      </div>
      <Button type="submit" variant="secondary">{t.lookupBtn}</Button>
    </form>
  );

  if (!r) {
    return (
      <div className="space-y-4">
        <h1 className="text-[1.9rem]">{t.statusTitle}</h1>
        <div className="rounded-lg border border-line bg-surface p-5">
          {lookup}
          {ref ? <p className="mt-3 text-sm text-crit">{t.notFound}</p> : null}
          <p className="mt-3 text-xs text-ink-3">{t.signedLinkNote}</p>
        </div>
      </div>
    );
  }

  const t1 = tier1Status(r);
  const d = disclosure({ srcType: r.srcType, signedRelease: r.signedRelease, part2Program: Boolean(program?.part2), part2Consent: r.part2Consent });
  const labels = { Received: t.step_Received, Contacted: t.step_Contacted, "Intake scheduled": t["step_Intake scheduled"], "Intake completed": t["step_Intake completed"] };
  const t1Label = t[`t1_${t1}` as keyof typeof t] as string;

  return (
    <div className="space-y-5" data-guide="status">
      <div>
        <h1 className="text-[1.9rem]">{t.statusTitle}</h1>
        <p className="mt-1 font-mono text-ink-2">{r.id}{program ? <span className="ml-2 font-sans text-sm">· {program.partnerLabel}</span> : null}</p>
      </div>
      <section className="rounded-lg border border-line bg-surface p-6">
        <p className="text-sm text-ink-3">{t.currentStatus}</p>
        <p className={cn("mt-1 font-display text-3xl font-semibold", t1 === "On hold" ? "text-warn" : "text-teal-strong")}>{t1Label}</p>
        <div className="mt-6">
          <JourneyTracker referral={r} tier2Allowed={d.tier2} audience="partner" labels={labels} lockedLabel={t.locked} holdNote={t1 === "On hold" ? t.holdPromise : undefined} />
        </div>
        <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-ink-3"><RefreshCw size={12} /> {t.updatesLive}</p>
      </section>
      {!d.tier2 ? (
        <details className="rounded-lg border border-line bg-surface p-5">
          <summary className="cursor-pointer font-medium">{t.whyLocked}</summary>
          <p className="mt-2 text-sm text-ink-2">{t.tier2Rule}</p>
        </details>
      ) : null}
      <section className="rounded-lg border border-line bg-surface p-5">
        <ul className="space-y-1.5 text-sm text-ink-2">
          {[...r.notices].reverse().map((n, i) => (
            <li key={`${n.at}-${i}`} className="flex justify-between gap-4">
              <span>{n.text}</span>
              <span className="shrink-0 text-xs text-ink-3">{fmtDateTime(n.at)}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="rounded-lg border border-line bg-surface p-5">{lookup}</div>
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
