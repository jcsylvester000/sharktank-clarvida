"use client";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Copy, ExternalLink, Printer, QrCode } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser } from "@/lib/store/hooks";
import { createKit, kitCodeFor } from "@/lib/services/outreach";
import { isPaused } from "@/lib/rules/outreach";
import { suppress } from "@/lib/rules/suppress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Checkbox, Label, Segmented, Select } from "@/components/ui/field";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";

const COPY = {
  en: { title: "Refer someone to Clarvida", sub: "For partners in", how: "How to refer", s1: "Scan the code or open the link below.", s2: "Tell us who referred and what the family needs. It takes about a minute.", s3: "We contact the family within 1 business day and send you a status update.", programs: "Programs you can refer to", waitlist: "currently has a waitlist", code: "Your partner code", privacy: "The referral form loads no trackers. Please don't include diagnoses or case notes." },
  es: { title: "Referir a alguien a Clarvida", sub: "Para socios en", how: "Cómo referir", s1: "Escanee el código o abra el enlace.", s2: "Indique quién refiere y qué necesita la familia. Toma alrededor de un minuto.", s3: "Contactamos a la familia en 1 día hábil y le enviamos una actualización.", programs: "Programas disponibles", waitlist: "tiene lista de espera", code: "Su código de socio", privacy: "El formulario no carga rastreadores. No incluya diagnósticos ni notas de caso." },
};

export default function Kits() {
  const me = useCurrentUser()!;
  const db = useStore((s) => s.db);
  const mutate = useStore((s) => s.mutate);
  const states = me.scope.includes("ALL") ? ["NC", "CO"] : me.scope;
  const orgs = db.orgs.filter((o) => states.includes(o.state)).sort((a, b) => a.name.localeCompare(b.name));
  const [orgId, setOrgId] = useState(orgs.find((o) => o.id === "o3")?.id ?? orgs[0]?.id ?? "");
  const org = db.orgs.find((o) => o.id === orgId);
  const existing = db.kits.find((k) => k.orgId === orgId);
  const progs = db.programs.filter((p) => org && p.state === org.state && p.counties.includes(org.county));
  const [programIds, setProgramIds] = useState<string[]>(existing?.programIds ?? progs.filter((p) => !isPaused(p)).map((p) => p.id));
  const [lang, setLang] = useState<"en" | "es">(existing?.language ?? "en");
  const [svg, setSvg] = useState("");
  const code = existing?.code ?? (org ? kitCodeFor(org.name, org.state, db.kits.map((k) => k.code)) : "");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/partner/refer/?code=${encodeURIComponent(code)}`;
  const t = COPY[lang];

  useEffect(() => {
    const k = db.kits.find((x) => x.orgId === orgId);
    const o = db.orgs.find((x) => x.id === orgId);
    const ps = db.programs.filter((p) => o && p.state === o.state && p.counties.includes(o.county));
    setProgramIds(k?.programIds ?? ps.filter((p) => !isPaused(p)).map((p) => p.id));
    setLang(k?.language ?? "en");
  }, [orgId, db.kits, db.orgs, db.programs]);

  useEffect(() => {
    if (!code) return;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#17232a", light: "#ffffff" } }).then(setSvg).catch(() => setSvg(""));
  }, [url, code]);

  const save = () => { mutate((d) => { createKit(d, { orgId, programIds, language: lang }); }); toast.success(existing ? "Kit updated" : `Kit created: ${code}`); };
  const kitRows = useMemo(() => db.kits.filter((k) => states.includes(k.state)), [db.kits, states]);

  return (
    <div>
      <PageHeader title="Partner Kits" description="A one-page kit with a coded link and a real QR code. Every referral that comes through it carries its source automatically."
        actions={<Button variant="secondary" size="sm" onClick={() => window.print()}><Printer size={15} /> Print or save as PDF</Button>} />
      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Panel className="no-print h-fit">
          <PanelHeader title="Build a kit" />
          <PanelBody className="space-y-4">
            <div>
              <Label htmlFor="k-org">Partner organization</Label>
              <Select id="k-org" value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1">
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </div>
            <fieldset>
              <legend className="text-sm font-medium">Programs to feature</legend>
              <div className="mt-1.5 space-y-1.5">
                {progs.map((p) => (
                  <Checkbox key={p.id} checked={programIds.includes(p.id)} onChange={(e) => setProgramIds(e.target.checked ? [...programIds, p.id] : programIds.filter((x) => x !== p.id))}
                    label={<span>{p.partnerLabel}{isPaused(p) ? <span className="text-xs text-crit"> ({p.capacity})</span> : null}</span>} />
                ))}
              </div>
            </fieldset>
            <div>
              <p className="text-sm font-medium">Language</p>
              <Segmented label="Kit language" className="mt-1.5" value={lang} onChange={setLang} options={[{ value: "en", label: "English" }, { value: "es", label: "Español" }]} />
            </div>
            <div className="rounded-md bg-canvas px-3 py-2 text-sm">
              <p className="text-xs text-ink-3">Partner code</p>
              <p className="font-mono font-medium">{code}</p>
            </div>
            <Button className="w-full justify-center" onClick={save}><QrCode size={16} /> {existing ? "Update kit" : "Create kit"}</Button>
          </PanelBody>
        </Panel>

        <div data-guide="kit">
          <article className="mx-auto max-w-[760px] rounded-lg border border-line bg-white p-8 print:border-0 print:p-0">
            <header className="flex items-start justify-between gap-6 border-b-4 border-teal pb-5">
              <div>
                <p className="font-display text-sm font-semibold text-teal">Clarvida</p>
                <h2 className="mt-1 text-[1.9rem] leading-tight">{t.title}</h2>
                <p className="mt-1 text-ink-2">{t.sub} {org?.county} County: {org?.name}</p>
              </div>
            </header>
            <div className="mt-6 grid gap-8 sm:grid-cols-[1fr_220px]">
              <div>
                <h3 className="text-lg">{t.how}</h3>
                <ol className="mt-2 space-y-2 text-[0.95rem]">
                  {[t.s1, t.s2, t.s3].map((s, i) => <li key={s} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal text-xs font-semibold text-white">{i + 1}</span>{s}</li>)}
                </ol>
                <h3 className="mt-6 text-lg">{t.programs}</h3>
                <ul className="mt-2 space-y-1.5 text-[0.95rem]">
                  {db.programs.filter((p) => programIds.includes(p.id)).map((p) => (
                    <li key={p.id}><span className="font-medium">{p.partnerLabel}</span>, ages {p.ageMin}–{p.ageMax}, {p.office}{isPaused(p) ? <span className="text-crit"> ({t.waitlist})</span> : null}</li>
                  ))}
                </ul>
              </div>
              <div className="text-center">
                <div className="mx-auto w-[200px] rounded-md border border-line p-2" aria-label={`QR code for ${url}`} role="img" dangerouslySetInnerHTML={{ __html: svg }} />
                <p className="mt-2 break-all font-mono text-xs text-ink-2">{url.replace(/^https?:\/\//, "")}</p>
                <p className="mt-3 text-xs text-ink-3">{t.code}</p>
                <p className="font-mono text-lg font-medium">{code}</p>
              </div>
            </div>
            <p className="mt-6 border-t border-line-2 pt-3 text-xs text-ink-3">{t.privacy}</p>
          </article>
          <div className="no-print mx-auto mt-3 flex max-w-[760px] flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard?.writeText(url).catch(() => {}); toast.success("Link copied"); }}><Copy size={14} /> Copy link</Button>
            <Button variant="secondary" size="sm" onClick={() => window.open(url, "partner", "width=520,height=900")}><ExternalLink size={14} /> Open the form in a new window</Button>
            <span className="self-center text-xs text-ink-3">Phones can scan this when the demo is hosted on a shared address.</span>
          </div>
        </div>
      </div>

      <Panel className="no-print mt-6">
        <PanelHeader title="Kits in your territory" description="Scans and referrals count as a source signal. Referral counts under 11 are shown as <11." />
        <Table>
          <THead><tr><TH>Partner code</TH><TH>Organization</TH><TH>Language</TH><TH className="text-right">Form opens</TH><TH className="text-right">Referrals</TH></tr></THead>
          <tbody>
            {kitRows.map((k) => (
              <TR key={k.id}>
                <TD className="font-mono">{k.code}</TD>
                <TD>{db.orgs.find((o) => o.id === k.orgId)?.name}</TD>
                <TD>{k.language === "es" ? "Español" : "English"}</TD>
                <TD className="text-right tabular">{k.scans}</TD>
                <TD className="text-right tabular"><Badge tone="outline">{suppress(k.referrals)}</Badge></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}
