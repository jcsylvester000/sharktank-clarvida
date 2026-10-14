"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Info, Sparkles } from "lucide-react";
import { announce, useStore } from "@/lib/store/db";
import { useLang } from "@/lib/i18n/lang";
import { CONCERNS, COVERAGE, SRC_TYPES, TIMES } from "@/lib/i18n/partner";
import { countKitScan } from "@/lib/services/referrals";
import { referrals as api } from "@/mock-api";
import { matchPrograms } from "@/lib/rules/routing";
import { phiScan } from "@/lib/rules/phi";
import { referralId } from "@/lib/rules/refs";
import type { SourceType } from "@/lib/domain/types";
import { ORG_TO_SRC } from "@/lib/domain/source";
import { Button } from "@/components/ui/button";
import { Checkbox, FieldError, Help, Input, Label, Select } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";


interface Form {
  orgId: string; orgName: string; srcType: string; name: string; role: string; email: string; phone: string;
  state: string; county: string; programId: string; age: string; coverage: string; language: string; times: string[];
  guardian: string; famPhone: string; voicemail: boolean; agree: boolean; release: boolean; hp: string;
}

const EMPTY: Form = { orgId: "", orgName: "", srcType: "", name: "", role: "", email: "", phone: "", state: "NC", county: "", programId: "", age: "", coverage: "", language: "English", times: [], guardian: "", famPhone: "", voicemail: true, agree: false, release: false, hp: "" };
const RATE_KEY = "cv-portal-sends";

function ReferForm() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code") ?? "";
  const { t, lang } = useLang();
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const kit = useMemo(() => db.kits.find((k) => k.code.toLowerCase() === code.toLowerCase()), [db.kits, code]);
  const kitOrg = kit ? db.orgs.find((o) => o.id === kit.orgId) : undefined;
  const [f, setF] = useState<Form>(EMPTY);
  const [locked, setLocked] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Form | "form", string>>>({});
  const [showHelp, setShowHelp] = useState(false);
  const [concern, setConcern] = useState("Not sure");
  const [sending, setSending] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const counted = useRef(false);

  // Partner code prefill + kit scan count (BR28). Counted once per browser session per code.
  useEffect(() => {
    if (!kitOrg || counted.current) return;
    counted.current = true;
    setF((x) => ({ ...x, orgId: kitOrg.id, srcType: ORG_TO_SRC[kitOrg.type] ?? "Other", state: kitOrg.state, county: kitOrg.county }));
    setLocked(true);
    try {
      const k = `cv-scan-${kit!.code}`;
      if (!sessionStorage.getItem(k)) {
        sessionStorage.setItem(k, "1");
        mutate((d) => countKitScan(d, kit!.code), { entity: "kit", id: kit!.code, action: "scanned" });
      }
    } catch { /* ignore */ }
  }, [kitOrg, kit, mutate]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const counties = useMemo(() => Array.from(new Set(db.programs.filter((p) => p.state === f.state).flatMap((p) => p.counties))).sort(), [db.programs, f.state]);
  const programs = useMemo(() => db.programs.filter((p) => p.state === f.state && (!f.county || f.county === "Not sure" || p.counties.includes(f.county))), [db.programs, f.state, f.county]);
  const matches = useMemo(() => (f.county && f.county !== "Not sure" ? matchPrograms({ state: f.state, county: f.county, age: f.age ? Number(f.age) : NaN, concern }, db.programs) : []), [db.programs, f.state, f.county, f.age, concern]);
  const orgs = useMemo(() => db.orgs.filter((o) => o.state === f.state).sort((a, b) => a.name.localeCompare(b.name)), [db.orgs, f.state]);

  function validate(): Partial<Record<keyof Form, string>> {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!f.orgId) e.orgId = t.reqOrg;
    if (f.orgId === "__none" && f.orgName.trim().length < 2) e.orgName = t.reqOrgName;
    if (!f.srcType) e.srcType = t.reqSrc;
    if (f.role.trim().length < 2) e.role = t.reqRole;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
    const phoneOk = f.phone.replace(/\D/g, "").length === 10;
    if (!f.email && !f.phone) e.email = t.emailOrPhone;
    else {
      if (f.email && !emailOk) e.email = t.invalidEmail;
      if (f.phone && !phoneOk) e.phone = t.invalidPhone;
    }
    if (!f.county) e.county = t.reqCounty;
    if (!f.programId) e.programId = t.reqProgram;
    const age = Number(f.age);
    if (f.age === "" || !Number.isInteger(age) || age < 0 || age > 99) e.age = t.ageRange;
    if (!f.coverage) e.coverage = t.reqCoverage;
    if (!/^[A-Za-zÀ-ÿ' -]{1,40}$/.test(f.guardian.trim()) || f.guardian.trim().includes(" ")) e.guardian = t.firstNameOnly;
    if (f.famPhone.replace(/\D/g, "").length !== 10) e.famPhone = t.invalidPhone;
    if (!f.agree) e.agree = t.mustAgree;
    if (phiScan(`${f.role} ${f.orgName}`).blocked) e.role = t.minimum;
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (f.hp) return; // honeypot: silently ignore bots
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    // Rate limit: 5 submissions per 10 minutes per browser (FR-018).
    try {
      const now = Date.now();
      const recent = (JSON.parse(localStorage.getItem(RATE_KEY) ?? "[]") as number[]).filter((x) => now - x < 600_000);
      if (recent.length >= 5) { setErrors({ form: t.rateLimit }); return; }
      localStorage.setItem(RATE_KEY, JSON.stringify([...recent, now]));
    } catch { /* ignore */ }

    setSending(true);
    const org = db.orgs.find((o) => o.id === f.orgId);
    const expectedId = referralId(f.state, db.refSeq);
    const id = await api.submitReferral(
      {
        state: f.state,
        county: f.county,
        programId: f.programId === "__notsure" ? null : f.programId,
        channel: "Web form",
        partnerCode: kit?.code,
        referrerOrgId: org?.id ?? null,
        referrerOrgName: org ? undefined : f.orgName.trim(),
        srcType: f.srcType as SourceType,
        referrerName: f.name.trim() || undefined,
        referrerRole: f.role.trim(),
        referrerEmail: f.email.trim() || undefined,
        referrerPhone: f.phone.trim() || undefined,
        age: Number(f.age),
        coverage: f.coverage,
        language: f.language as "English" | "Español" | "Other",
        times: f.times,
        guardianFirstName: f.guardian.trim(),
        phone: f.famPhone.trim(),
        voicemailOk: f.voicemail,
        consentAgreement: f.agree,
        signedRelease: f.release,
      },
      { external: true },
    ).catch(() => expectedId);
    announce({ entity: "referral", id, action: "created" });
    router.push(`/partner/confirmation/?ref=${encodeURIComponent(id)}`);
  }

  function fillSample() {
    const o = kitOrg ?? db.orgs.find((x) => x.id === "o3")!;
    const prog = db.programs.find((p) => p.id === "p-nc-iih") ?? programs[0];
    setLocked(Boolean(kitOrg));
    setF({ ...EMPTY, orgId: o.id, srcType: ORG_TO_SRC[o.type] ?? "School", name: o.id === "o3" ? "Jordan Carter" : "", role: o.id === "o3" ? "Lead School Counselor" : "Caseworker", email: o.id === "o3" ? "jordan.carter@gcs.example" : "referrer@partner.example", phone: "", state: o.state, county: o.county, programId: prog?.id ?? "__notsure", age: "12", coverage: "Medicaid", language: "English", times: ["After 3:30 pm"], guardian: "Alex", famPhone: "(555) 010-0190", voicemail: true, agree: true, release: false, hp: "" });
    setErrors({});
  }

  const office = (() => {
    if (!f.county || f.county === "Not sure") return null;
    const p = db.programs.find((x) => x.state === f.state && x.counties.includes(f.county));
    return p ? `${p.office}, ${f.state}` : null;
  })();

  const errCount = Object.keys(errors).filter((k) => k !== "form").length;
  const err = (k: keyof Form) => (errors[k] ? { "aria-invalid": true, "aria-describedby": `${k}-err` } : {});
  const label = (v: { v: string; es: string }) => (lang === "es" ? v.es : v.v);

  return (
    <div data-guide="refer-form" className="rounded-[var(--radius-panel)] bg-surface px-5 py-7 shadow-sm sm:px-9 sm:py-9">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-[1.9rem] leading-tight text-cv-teal">{t.title}</h1>
        <button type="button" onClick={fillSample} className="link text-xs font-medium" data-guide="fill-sample">{t.fillSample}</button>
      </div>
      <p className="mt-2 text-ink-2">{t.intro}</p>

      {code && !kit ? <Callout tone="warn" className="mt-5" icon={<Info size={16} />}>{t.unknownCode}</Callout> : null}
      {locked && kitOrg ? (
        <Callout tone="teal" className="mt-5" icon={<Building2 size={16} className="text-teal" />} title={`${t.referringFrom} ${kitOrg.name}`} action={<Button variant="link" size="sm" onClick={() => setLocked(false)}>{t.change}</Button>}>
          {label(SRC_TYPES.find((s) => s.v === f.srcType) ?? { v: f.srcType, es: f.srcType })}, {kitOrg.county} County, {kitOrg.state}
        </Callout>
      ) : null}

      <form onSubmit={submit} noValidate className="mt-6 space-y-6">
        {errCount || errors.form ? (
          <div ref={summaryRef} tabIndex={-1} className="rounded-lg border border-crit/40 bg-crit-tint px-4 py-3 text-sm font-medium text-crit" role="alert">
            {errors.form ?? t.fixErrors(errCount)}
          </div>
        ) : null}

        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.hp} onChange={(e) => set("hp", e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden="true" />

        <fieldset className="rounded-2xl border border-line p-5">
          <legend className="px-1 text-lg font-semibold text-ink">{t.secReferrer}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {!locked ? (
              <div className="sm:col-span-2">
                <Label htmlFor="orgId">{t.org}</Label>
                <Select id="orgId" value={f.orgId} onChange={(e) => { const o = db.orgs.find((x) => x.id === e.target.value); set("orgId", e.target.value); if (o) set("srcType", ORG_TO_SRC[o.type] ?? "Other"); }} {...err("orgId")} className="mt-1">
                  <option value="">—</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  <option value="__none">{t.orgNotListed}</option>
                </Select>
                <FieldError id="orgId-err">{errors.orgId}</FieldError>
              </div>
            ) : null}
            {f.orgId === "__none" && !locked ? (
              <div className="sm:col-span-2">
                <Label htmlFor="orgName">{t.orgName}</Label>
                <Input id="orgName" value={f.orgName} onChange={(e) => set("orgName", e.target.value)} {...err("orgName")} className="mt-1" />
                <FieldError id="orgName-err">{errors.orgName}</FieldError>
              </div>
            ) : null}
            <div>
              <Label htmlFor="srcType">{t.srcType}</Label>
              <Select id="srcType" value={f.srcType} onChange={(e) => set("srcType", e.target.value)} {...err("srcType")} className="mt-1">
                <option value="">—</option>
                {SRC_TYPES.map((s) => <option key={s.v} value={s.v}>{label(s)}</option>)}
              </Select>
              <Help>{t.srcTypeHelp}</Help>
              <FieldError id="srcType-err">{errors.srcType}</FieldError>
            </div>
            <div>
              <Label htmlFor="role">{t.role}</Label>
              <Input id="role" value={f.role} placeholder={t.rolePh} onChange={(e) => set("role", e.target.value)} {...err("role")} className="mt-1" />
              <FieldError id="role-err">{errors.role}</FieldError>
            </div>
            <div>
              <Label htmlFor="name">{t.yourName}</Label>
              <Input id="name" value={f.name} autoComplete="name" onChange={(e) => set("name", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="email">{t.email}</Label>
              <Input id="email" type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} {...err("email")} className="mt-1" />
              <Help>{t.emailHelp}</Help>
              <FieldError id="email-err">{errors.email}</FieldError>
            </div>
            <div>
              <Label htmlFor="phone">{t.phone}</Label>
              <Input id="phone" type="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} {...err("phone")} className="mt-1" />
              <FieldError id="phone-err">{errors.phone}</FieldError>
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-2xl border border-line p-5">
          <legend className="px-1 text-lg font-semibold text-ink">{t.secNeed}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="state">{t.state}</Label>
              <Select id="state" value={f.state} onChange={(e) => { set("state", e.target.value); set("county", ""); set("programId", ""); }} className="mt-1">
                <option value="NC">North Carolina</option>
                <option value="CO">Colorado</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="county">{t.county}</Label>
              <Select id="county" value={f.county} onChange={(e) => { set("county", e.target.value); set("programId", ""); }} {...err("county")} className="mt-1">
                <option value="">—</option>
                {counties.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="Not sure">{t.countyNotSure}</option>
              </Select>
              <FieldError id="county-err">{errors.county}</FieldError>
              {office ? <Help>{t.nearestOffice}: {office}</Help> : null}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="programId">{t.program}</Label>
              <Select id="programId" value={f.programId} onChange={(e) => set("programId", e.target.value)} {...err("programId")} className="mt-1">
                <option value="">—</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.partnerLabel}, {p.office}{p.capacity === "Waitlist" || p.capacity === "Closed" ? ` (${t.waitlisted})` : ""}
                  </option>
                ))}
                <option value="__notsure">{t.programNotSure}</option>
              </Select>
              <FieldError id="programId-err">{errors.programId}</FieldError>
              <button type="button" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:underline" onClick={() => setShowHelp((s) => !s)} aria-expanded={showHelp}>
                <Sparkles size={14} /> {t.helpChoose}
              </button>
              {showHelp ? (
                <div className="mt-3 rounded-md border border-line-2 bg-canvas p-4">
                  <Label htmlFor="concern">{t.concern}</Label>
                  <Select id="concern" value={concern} onChange={(e) => setConcern(e.target.value)} className="mt-1 sm:max-w-sm">
                    {CONCERNS.map((c) => <option key={c.en} value={c.en}>{lang === "es" ? c.es : c.en}</option>)}
                  </Select>
                  <p className="mt-3 text-sm font-medium">{t.matches}</p>
                  {!f.county || f.county === "Not sure" ? <p className="text-sm text-ink-3">{t.county}: —</p> : matches.length === 0 ? <p className="text-sm text-ink-3">{t.noMatch}</p> : (
                    <ul className="mt-2 grid gap-2">
                      {matches.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2">
                          <span className="text-sm">
                            <span className="font-medium">{p.partnerLabel}, {p.office}</span>
                            <span className={cn("ml-2 text-xs", p.capacity === "Open" ? "text-ok" : p.capacity === "Limited" ? "text-warn" : "text-crit")}>
                              {p.capacity === "Open" ? t.accepting : p.capacity === "Limited" ? t.limited : t.waitlisted}
                            </span>
                          </span>
                          <Button size="sm" variant="secondary" onClick={() => { set("programId", p.id); setShowHelp(false); }}>{t.useThis}</Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
            <div>
              <Label htmlFor="age">{t.age}</Label>
              <Input id="age" inputMode="numeric" value={f.age} onChange={(e) => set("age", e.target.value.replace(/\D/g, "").slice(0, 2))} {...err("age")} className="mt-1" />
              <FieldError id="age-err">{errors.age}</FieldError>
            </div>
            <div>
              <Label htmlFor="coverage">{t.coverage}</Label>
              <Select id="coverage" value={f.coverage} onChange={(e) => set("coverage", e.target.value)} {...err("coverage")} className="mt-1">
                <option value="">—</option>
                {COVERAGE.map((c) => <option key={c.v} value={c.v}>{label(c)}</option>)}
              </Select>
              <FieldError id="coverage-err">{errors.coverage}</FieldError>
            </div>
            <div>
              <Label htmlFor="language">{t.language}</Label>
              <Select id="language" value={f.language} onChange={(e) => set("language", e.target.value)} className="mt-1">
                <option value="English">English</option>
                <option value="Español">Español</option>
                <option value="Other">{lang === "es" ? "Otro" : "Other"}</option>
              </Select>
            </div>
            <fieldset>
              <legend className="text-sm font-medium">{t.times}</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {TIMES.map((x) => (
                  <Checkbox key={x.v} label={label(x)} checked={f.times.includes(x.v)} onChange={(e) => set("times", e.target.checked ? [...f.times, x.v] : f.times.filter((y) => y !== x.v))} />
                ))}
              </div>
            </fieldset>
          </div>
        </fieldset>

        <fieldset className="rounded-2xl border border-line p-5">
          <legend className="px-1 text-lg font-semibold text-ink">{t.secFamily}</legend>
          <Callout tone="neutral" className="mb-4 bg-canvas" icon={<Info size={16} className="text-ink-3" />}>{t.minimum}</Callout>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="guardian">{t.guardian}</Label>
              <Input id="guardian" value={f.guardian} autoComplete="off" onChange={(e) => set("guardian", e.target.value)} {...err("guardian")} className="mt-1" />
              <Help>{t.guardianHelp}</Help>
              <FieldError id="guardian-err">{errors.guardian}</FieldError>
            </div>
            <div>
              <Label htmlFor="famPhone">{t.famPhone}</Label>
              <Input id="famPhone" type="tel" autoComplete="off" value={f.famPhone} onChange={(e) => set("famPhone", e.target.value)} {...err("famPhone")} className="mt-1" />
              <Help>{t.famPhoneHelp}</Help>
              <FieldError id="famPhone-err">{errors.famPhone}</FieldError>
            </div>
            <Checkbox label={t.voicemail} checked={f.voicemail} onChange={(e) => set("voicemail", e.target.checked)} />
          </div>
        </fieldset>

        <fieldset className="rounded-2xl border border-line p-5">
          <legend className="px-1 text-lg font-semibold text-ink">{t.secConsent}</legend>
          <div className="space-y-3">
            <div>
              <Checkbox label={t.agree} checked={f.agree} onChange={(e) => set("agree", e.target.checked)} aria-invalid={Boolean(errors.agree)} />
              <FieldError id="agree-err">{errors.agree}</FieldError>
            </div>
            <div>
              <Checkbox label={t.release} checked={f.release} onChange={(e) => set("release", e.target.checked)} />
              <Help className="ml-6">{t.releaseHelp}</Help>
            </div>
          </div>
        </fieldset>

        <Button type="submit" variant="cta" size="lg" className="w-full justify-center sm:w-auto" disabled={sending} data-guide="send-referral">
          {sending ? t.sending : t.send}
        </Button>
      </form>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ReferForm />
    </Suspense>
  );
}
