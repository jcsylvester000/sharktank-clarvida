"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Printer, Lock, Monitor, Phone, UserRound } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser } from "@/lib/store/hooks";
import { href } from "@/lib/access";
import { createReferral } from "@/lib/services/referrals";
import { findDuplicate } from "@/lib/rules/routing";
import { referralId } from "@/lib/rules/refs";
import { isPaused } from "@/lib/rules/outreach";
import { ORG_TO_SRC } from "@/lib/domain/source";
import { COVERAGE, SRC_TYPES, TIMES } from "@/lib/i18n/partner";
import type { Channel, Referral, SourceType } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, FieldError, Input, Label, Segmented, Select } from "@/components/ui/field";
import { Callout, PageHeader } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { now as clockNow } from "@/lib/clock";

const CHANNELS: { value: Channel; label: React.ReactNode }[] = [
  { value: "Phone", label: <span className="inline-flex items-center gap-1.5"><Phone size={14} /> Phone</span> },
  { value: "Fax", label: <span className="inline-flex items-center gap-1.5"><Printer size={14} /> Fax</span> },
  { value: "Statewide platform", label: <span className="inline-flex items-center gap-1.5"><Monitor size={14} /> Statewide platform</span> },
  { value: "Walk-in", label: <span className="inline-flex items-center gap-1.5"><UserRound size={14} /> Walk-in</span> },
];
const PLATFORMS: Record<string, string[]> = { NC: ["NCCARE360"], CO: ["Colorado statewide platform (to confirm)"] };

interface Form {
  channel: Channel; platform: string; platformRef: string; state: string; county: string; programId: string;
  orgId: string; orgName: string; srcType: string; refName: string; refRole: string; refPhone: string;
  age: string; coverage: string; language: Referral["language"]; times: string[];
  guardian: string; phone: string; voicemail: boolean; agree: boolean; release: boolean;
}

export default function NewReferral() {
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const router = useRouter();
  const states = me.scope.includes("ALL") ? ["NC", "CO"] : me.scope;
  const [f, setF] = useState<Form>({ channel: "Phone", platform: "", platformRef: "", state: states[0], county: "", programId: "", orgId: "", orgName: "", srcType: "", refName: "", refRole: "", refPhone: "", age: "", coverage: "", language: "English", times: [], guardian: "", phone: "", voicemail: true, agree: false, release: false });
  const [tried, setTried] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const counties = useMemo(() => Array.from(new Set(db.programs.filter((p) => p.state === f.state).flatMap((p) => p.counties))).sort(), [db.programs, f.state]);
  const programs = db.programs.filter((p) => p.state === f.state && (!f.county || p.counties.includes(f.county)));
  const orgs = db.orgs.filter((o) => o.state === f.state);
  const program = db.programs.find((p) => p.id === f.programId);
  const dup = f.phone.replace(/\D/g, "").length === 10 ? findDuplicate({ phone: f.phone, programId: f.programId || null, receivedAt: clockNow() }, db.referrals) : null;

  const errors: Partial<Record<keyof Form, string>> = {};
  if (!f.county) errors.county = "Choose a county";
  if (!f.srcType) errors.srcType = "Choose who referred";
  if (!f.refRole.trim()) errors.refRole = "Enter the referrer's role";
  if (!f.age || Number(f.age) > 99) errors.age = "Enter an age";
  if (!f.guardian.trim()) errors.guardian = "Enter the guardian's first name";
  if (f.phone.replace(/\D/g, "").length !== 10) errors.phone = "Enter a 10-digit phone number";
  if (!f.agree) errors.agree = "Confirm the family agreed to be contacted";
  if (f.channel === "Statewide platform" && !f.platform) errors.platform = "Choose the platform";
  const ok = Object.keys(errors).length === 0;
  const err = (k: keyof Form) => (tried && errors[k] ? { "aria-invalid": true, "aria-describedby": `${k}-err` } : {});

  const submit = () => {
    setTried(true);
    if (!ok) { toast.error("Some details are missing"); setTimeout(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus(), 50); return; }
    const expected = referralId(f.state, db.refSeq);
    const org = db.orgs.find((o) => o.id === f.orgId);
    mutate((d) => {
      createReferral(d, {
        state: f.state, county: f.county, programId: f.programId || null, channel: f.channel,
        platform: f.channel === "Statewide platform" ? `${f.platform}${f.platformRef ? ` (${f.platformRef})` : ""}` : undefined,
        referrerOrgId: org?.id ?? null, referrerOrgName: org ? undefined : f.orgName.trim() || undefined,
        srcType: f.srcType as SourceType, referrerName: f.refName.trim() || undefined, referrerRole: f.refRole.trim(), referrerPhone: f.refPhone.trim() || undefined,
        age: Number(f.age), coverage: f.coverage || "Not sure", language: f.language, times: f.times,
        guardianFirstName: f.guardian.trim(), phone: f.phone.trim(), voicemailOk: f.voicemail, consentAgreement: f.agree, signedRelease: f.release,
      }, { external: false });
    }, { entity: "referral", id: expected, action: "created" });
    toast.success(`${expected} created and routed. The response clock is running.`);
    router.push(href("/app/referral", { id: expected }));
  };

  return (
    <div>
      <PageHeader
        title="New referral"
        description="For referrals that arrive by phone, fax, a statewide platform or in person. They get the same routing, clock and status updates as the partner form."
        meta={<Badge tone="care" icon={<Lock size={12} />}>Care Zone: client data</Badge>}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate data-guide="new-referral">
          <Panel>
            <PanelHeader title="How it arrived" />
            <PanelBody className="space-y-4">
              <Segmented label="Channel" value={f.channel} onChange={(v) => set("channel", v)} options={CHANNELS} />
              {f.channel === "Statewide platform" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label htmlFor="platform">Platform</Label><Select id="platform" value={f.platform} onChange={(e) => set("platform", e.target.value)} {...err("platform")} className="mt-1"><option value="">Choose…</option>{(PLATFORMS[f.state] ?? []).map((p) => <option key={p}>{p}</option>)}</Select><FieldError id="platform-err">{tried ? errors.platform : null}</FieldError></div>
                  <div><Label htmlFor="pref">Platform reference (optional)</Label><Input id="pref" value={f.platformRef} onChange={(e) => set("platformRef", e.target.value)} className="mt-1" /></div>
                </div>
              ) : null}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Who referred" description="Captured on every referral, so outcomes trace back to the relationship." />
            <PanelBody className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="org">Referring organization</Label>
                <Select id="org" value={f.orgId} onChange={(e) => { const o = db.orgs.find((x) => x.id === e.target.value); setF((x) => ({ ...x, orgId: e.target.value, srcType: o ? ORG_TO_SRC[o.type] ?? x.srcType : x.srcType })); }} className="mt-1">
                  <option value="">Not listed or family</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              </div>
              {!f.orgId ? <div><Label htmlFor="orgName">Organization name (if any)</Label><Input id="orgName" value={f.orgName} onChange={(e) => set("orgName", e.target.value)} className="mt-1" /></div> : <div />}
              <div><Label htmlFor="src">Source type</Label><Select id="src" value={f.srcType} onChange={(e) => set("srcType", e.target.value)} {...err("srcType")} className="mt-1"><option value="">Choose…</option>{SRC_TYPES.map((s) => <option key={s.v}>{s.v}</option>)}</Select><FieldError id="srcType-err">{tried ? errors.srcType : null}</FieldError></div>
              <div><Label htmlFor="role">Referrer&apos;s role</Label><Input id="role" value={f.refRole} onChange={(e) => set("refRole", e.target.value)} {...err("refRole")} placeholder="e.g. School counselor, Parent" className="mt-1" /><FieldError id="refRole-err">{tried ? errors.refRole : null}</FieldError></div>
              <div><Label htmlFor="rname">Referrer&apos;s name (optional)</Label><Input id="rname" value={f.refName} onChange={(e) => set("refName", e.target.value)} className="mt-1" /></div>
              <div><Label htmlFor="rphone">Referrer&apos;s work phone (optional)</Label><Input id="rphone" type="tel" value={f.refPhone} onChange={(e) => set("refPhone", e.target.value)} className="mt-1" /></div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Family and program" description="Only what intake needs for the first call." />
            <PanelBody className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="state">State</Label><Select id="state" value={f.state} onChange={(e) => setF((x) => ({ ...x, state: e.target.value, county: "", programId: "", orgId: "" }))} className="mt-1">{states.map((s) => <option key={s}>{s}</option>)}</Select></div>
              <div><Label htmlFor="county">County</Label><Select id="county" value={f.county} onChange={(e) => setF((x) => ({ ...x, county: e.target.value, programId: "" }))} {...err("county")} className="mt-1"><option value="">Choose…</option>{counties.map((c) => <option key={c}>{c}</option>)}<option>Not sure</option></Select><FieldError id="county-err">{tried ? errors.county : null}</FieldError></div>
              <div className="sm:col-span-2">
                <Label htmlFor="program">Program</Label>
                <Select id="program" value={f.programId} onChange={(e) => set("programId", e.target.value)} className="mt-1">
                  <option value="">Not sure (goes to triage)</option>
                  {programs.map((p) => <option key={p.id} value={p.id}>{p.name}, {p.office}{isPaused(p) ? ` (${p.capacity})` : ""}</option>)}
                </Select>
                {program && isPaused(program) ? <p className="mt-1 text-sm text-warn">{program.name} is on {program.capacity}. The referral goes to On hold and the referrer is told honestly.</p> : null}
              </div>
              <div><Label htmlFor="age">Child&apos;s age (or adult&apos;s age)</Label><Input id="age" inputMode="numeric" value={f.age} onChange={(e) => set("age", e.target.value.replace(/\D/g, "").slice(0, 2))} {...err("age")} className="mt-1" /><FieldError id="age-err">{tried ? errors.age : null}</FieldError></div>
              <div><Label htmlFor="cov">Coverage</Label><Select id="cov" value={f.coverage} onChange={(e) => set("coverage", e.target.value)} className="mt-1"><option value="">Not sure</option>{COVERAGE.map((c) => <option key={c.v}>{c.v}</option>)}</Select></div>
              <div><Label htmlFor="guardian">Guardian&apos;s first name</Label><Input id="guardian" autoComplete="off" value={f.guardian} onChange={(e) => set("guardian", e.target.value)} {...err("guardian")} className="mt-1" /><FieldError id="guardian-err">{tried ? errors.guardian : null}</FieldError></div>
              <div><Label htmlFor="phone">Family phone</Label><Input id="phone" type="tel" autoComplete="off" value={f.phone} onChange={(e) => set("phone", e.target.value)} {...err("phone")} className="mt-1" /><FieldError id="phone-err">{tried ? errors.phone : null}</FieldError></div>
              <div><Label htmlFor="lang">Language</Label><Select id="lang" value={f.language} onChange={(e) => set("language", e.target.value as Referral["language"])} className="mt-1"><option>English</option><option>Español</option><option>Other</option></Select></div>
              <div>
                <p className="text-sm font-medium">Best times to call</p>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">{TIMES.map((t) => <Checkbox key={t.v} checked={f.times.includes(t.v)} onChange={(e) => set("times", e.target.checked ? [...f.times, t.v] : f.times.filter((x) => x !== t.v))} label={<span className="text-sm">{t.v}</span>} />)}</div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Checkbox checked={f.voicemail} onChange={(e) => set("voicemail", e.target.checked)} label="OK to leave a voicemail" />
                <Checkbox checked={f.agree} onChange={(e) => set("agree", e.target.checked)} label="The family agreed to be contacted by Clarvida" />
                <FieldError id="agree-err">{tried ? errors.agree : null}</FieldError>
                <Checkbox checked={f.release} onChange={(e) => set("release", e.target.checked)} label="A signed release to update the referrer was received" />
              </div>
            </PanelBody>
          </Panel>
          {dup ? (
            <Callout tone="warn" icon={<Copy size={16} className="text-warn" />} title={`Possible duplicate of ${dup}`} action={<Link href={href("/app/referral", { id: dup })} className="text-sm font-medium text-warn hover:underline">Open</Link>}>
              Same phone number in the last 30 days. You can still create it; it will be flagged for review.
            </Callout>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => router.push(href("/app/intake"))}>Cancel</Button>
            <Button type="submit" variant="care">Create referral</Button>
          </div>
        </form>
        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <Callout tone="care" title="What happens next">
            <ol className="mt-1 list-decimal space-y-1 pl-4">
              <li>Routed to the right queue by state, county and age.</li>
              <li>The one-business-day clock starts now.</li>
              <li>If the referrer left contact details, they get a status update with no client details.</li>
            </ol>
          </Callout>
          <p className="text-xs text-ink-3">Every referral in this prototype is synthetic. Do not enter real client information.</p>
        </aside>
      </div>
    </div>
  );
}
