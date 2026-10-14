"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Copy, Mail } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useLang } from "@/lib/i18n/lang";
import { tier1Status } from "@/lib/rules/status";
import { Button } from "@/components/ui/button";

function Confirmation() {
  const params = useSearchParams();
  const ref = params.get("ref") ?? "";
  const { t } = useLang();
  const r = useStore((s) => s.db.referrals.find((x) => x.id === ref));
  const kitCode = r?.partnerCode;
  const [copied, setCopied] = useState(false);

  if (!r) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6">
        <h1 className="text-2xl">{t.statusTitle}</h1>
        <p className="mt-2 text-ink-2">{t.notFound}</p>
      </div>
    );
  }
  const onHold = tier1Status(r) === "On hold";
  const notice = r.notices[0];

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-surface p-6">
        <div className="flex items-center gap-2 text-ok">
          <CheckCircle2 size={22} />
          <h1 className="text-2xl text-ink">{t.receivedTitle}</h1>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-md bg-sunken px-4 py-2 font-mono text-2xl font-medium tracking-wide">{r.id}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText(r.id).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Copy size={14} /> {copied ? t.copied : t.copy}
          </Button>
        </div>
        <p className={onHold ? "mt-4 rounded-md bg-warn-tint px-3 py-2 text-warn" : "mt-4 text-lg"}>{onHold ? t.holdPromise : t.promise}</p>
      </section>

      <section className="rounded-lg border border-line bg-surface p-6">
        <h2 className="text-lg">{t.next}</h2>
        <ol className="mt-3 space-y-2 text-ink-2">
          {[t.next1, t.next2, t.next3].map((x, i) => (
            <li key={x} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-tint text-xs font-semibold text-teal-strong">{i + 1}</span>
              <span>{x}</span>
            </li>
          ))}
        </ol>
      </section>

      {notice && r.referrerEmail ? (
        <section className="rounded-lg border border-dashed border-line bg-surface p-5">
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <Mail size={15} /> {t.emailSent} {r.referrerEmail}
          </p>
          <div className="mt-3 rounded-md bg-canvas p-4 text-sm">
            <p className="font-medium">{notice.subject}</p>
            <p className="mt-1 text-ink-2">{notice.text}</p>
            <p className="mt-2 text-xs text-teal underline">{t.track}</p>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link href={`/partner/status/?ref=${encodeURIComponent(r.id)}`} className="inline-flex h-11 items-center rounded-md bg-teal px-5 font-medium text-white hover:bg-teal-strong">
          {t.track}
        </Link>
        <Link href={`/partner/refer/${kitCode ? `?code=${encodeURIComponent(kitCode)}` : ""}`} className="inline-flex h-11 items-center rounded-md border border-line bg-surface px-5 font-medium hover:bg-sunken">
          {t.referAnother}
        </Link>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Confirmation />
    </Suspense>
  );
}
