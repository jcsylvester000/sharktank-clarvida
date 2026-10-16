"use client";
import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, Download, LogIn } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { useApi } from "@/mock-api";
import { tier1Status } from "@/lib/rules/status";
import { businessElapsed } from "@/lib/rules/clock";
import { Tier1Chip } from "@/components/domain/chips";
import { Button } from "@/components/ui/button";
import { SunState } from "@/components/brand/brand";
import { statusLink } from "@/lib/services/notices";
import { fmtShortDate, ago } from "@/lib/format";

const H = 3_600_000;

/** PG-33 Partner hub (FT-097): a signed-in partner sees their referrals this term, response times, and can refer again. */
export default function PartnerHub() {
  const me = useCurrentUser();
  const now = useNow(60_000);
  const kits = useStore((s) => s.db.kits);
  const { data } = useApi((db, u) => (u.role === "partner" ? { refs: [...db.referrals].sort((a, b) => b.receivedAt - a.receivedAt), programs: db.programs, sla: db.sla } : null), []);

  const stats = useMemo(() => {
    if (!data) return null;
    const contacted = data.refs.filter((r) => r.firstContactAt);
    const hours = contacted.map((r) => {
      const sla = data.sla.find((s) => s.state === r.state);
      return (sla ? businessElapsed(r.receivedAt, r.firstContactAt!, sla) : r.firstContactAt! - r.receivedAt) / H;
    }).sort((a, b) => a - b);
    const median = hours.length ? hours[Math.floor((hours.length - 1) / 2)] : null;
    const onTime = hours.filter((h) => h <= 8).length;
    return { total: data.refs.length, median, onTime, contacted: hours.length };
  }, [data]);

  if (!me || me.role !== "partner") {
    return (
      <div className="rounded-[var(--radius-panel)] bg-surface px-6 py-10 shadow-sm">
        <SunState title="Sign in to see your referrals." action={<Link href="/"><Button variant="cta"><LogIn size={16} /> Sign in</Button></Link>}>
          Partners with an account can follow every referral they make. You can still refer without an account.
        </SunState>
      </div>
    );
  }
  const kit = kits.find((k) => k.orgId === me.orgId);
  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-panel)] bg-surface px-6 py-7 shadow-sm sm:px-9">
        <p className="text-sm font-medium text-teal-strong">{me.orgName}</p>
        <h1 className="mt-1 text-[1.9rem] leading-tight text-cv-teal">Welcome back, {me.firstName}.</h1>
        <p className="mt-1 text-ink-2">Every referral you make, and what happened next. Status only: client details are never shown here.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/partner/refer/?code=${kit?.code ?? "GCS-NC-2026"}`} className="inline-flex"><Button variant="cta" size="lg">Refer again</Button></Link>
          <Button variant="secondary" size="lg" onClick={() => window.print()}><Download size={16} /> Partner kit (print)</Button>
        </div>
      </section>
      {stats ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface px-5 py-4"><p className="text-sm text-ink-2">Referrals this term</p><p className="num mt-1 text-[2rem] text-cv-teal">{stats.total}</p></div>
          <div className="rounded-2xl border border-cv-amber bg-[#fffaf0] px-5 py-4"><p className="text-sm text-ink-2">Median time to first contact</p><p className="num mt-1 text-[2rem] text-cv-ink">{stats.median !== null ? `${stats.median.toFixed(1)} h` : "—"}</p><p className="text-xs text-ink-3">business hours</p></div>
          <div className="rounded-2xl border border-line bg-surface px-5 py-4"><p className="text-sm text-ink-2">Contacted within 1 business day</p><p className="num mt-1 text-[2rem] text-cv-teal">{stats.onTime} of {stats.contacted}</p></div>
        </div>
      ) : null}
      <section className="overflow-hidden rounded-2xl border border-line bg-surface" aria-labelledby="my-refs" data-guide="hub">
        <h2 id="my-refs" className="border-b border-line-2 px-5 py-3 text-lg">My referrals</h2>
        {!data?.refs.length ? (
          <SunState compact title="No referrals yet.">Your first referral will appear here.</SunState>
        ) : (
          <ul className="divide-y divide-line-2">
            {data.refs.map((r) => {
              const p = data.programs.find((x) => x.id === r.programId);
              return (
                <li key={r.id}>
                  <Link href={statusLink(r.id)} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-canvas">
                    <span className="min-w-0">
                      <span className="block font-mono text-sm font-semibold">{r.id}</span>
                      <span className="block text-sm text-ink-2">{p?.partnerLabel ?? "Program to be confirmed"} · sent {fmtShortDate(r.receivedAt)} ({ago(r.receivedAt, now)})</span>
                    </span>
                    <span className="flex items-center gap-3"><Tier1Chip status={tier1Status(r)} /><ArrowUpRight size={16} className="text-ink-3" /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
