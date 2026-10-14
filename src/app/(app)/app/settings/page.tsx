"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Laptop, LogOut, RotateCcw, ShieldCheck, Smartphone, Trash2, PlayCircle, Eye } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { useCurrentUser, useNow } from "@/lib/store/hooks";
import { account } from "@/mock-api";
import { deviceId } from "@/mock-api/auth";
import { readAccount } from "@/lib/services/account";
import { ROLE_LABEL } from "@/lib/access";
import type { NotifType } from "@/lib/domain/types";
import { ChannelPicker, NOTIF_LABEL } from "@/components/account/prefs";
import { PageHeader, Callout } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, FieldError, Help, Segmented } from "@/components/ui/field";
import { Dialog, Switch, Tabs, TabList, Tab, TabPanel } from "@/components/ui/overlays";
import { Avatar } from "@/components/brand/brand";
import { ago, fmtDate } from "@/lib/format";
import { DemoAuthenticator } from "@/components/auth/demo-authenticator";

const ALL_TYPES: NotifType[] = ["escalation", "handoff", "approval", "capacity", "task", "event", "system"];

/** PG-27 Profile and Settings (FT-012, FT-014, FT-026, FT-151). */
function Settings() {
  const me = useCurrentUser()!;
  const params = useSearchParams();
  const acc = useStore((s) => readAccount(s.db, me.id));
  const cred = useStore((s) => s.db.credentials?.[me.id]);
  const readOnly = Boolean(me.readOnly);
  const [tab, setTab] = useState(params.get("tab") ?? "profile");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Profile and Settings" description="Your profile, sign-in security, notifications and language." meta={readOnly ? <Badge tone="hl" icon={<Eye size={12} />}>View only for guests</Badge> : undefined} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabList className="mb-5">
          <Tab value="profile">Profile</Tab>
          <Tab value="security">Sign-in and security</Tab>
          <Tab value="notifications">Notifications</Tab>
          <Tab value="demo">Demo account</Tab>
        </TabList>
        <TabPanel value="profile"><Profile readOnly={readOnly} /></TabPanel>
        <TabPanel value="security"><Security readOnly={readOnly} changedAt={cred?.changedAt} acc={acc} /></TabPanel>
        <TabPanel value="notifications"><Prefs readOnly={readOnly} acc={acc} /></TabPanel>
        <TabPanel value="demo"><DemoTab /></TabPanel>
      </Tabs>
    </div>
  );
}

function Profile({ readOnly }: { readOnly: boolean }) {
  const me = useCurrentUser()!;
  const acc = useStore((s) => readAccount(s.db, me.id));
  const manager = useStore((s) => s.db.users.find((u) => u.id === me.managerId));
  const [phone, setPhone] = useState(me.phone ?? "");
  const [lang, setLang] = useState<"en" | "es">(acc.language);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Panel>
      <PanelBody className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar initials={me.initials} tone={me.avatarTone} size={64} />
          <div>
            <p className="text-lg font-semibold">{me.name}</p>
            <p className="text-sm text-ink-2">{me.title ?? ROLE_LABEL[me.role]} · {me.role === "partner" ? me.orgName : me.office}</p>
            <p className="text-sm text-ink-3">{me.email}</p>
          </div>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            ["Role", ROLE_LABEL[me.role]],
            ["Territory", me.counties?.length ? `${me.counties.join(", ")} counties` : me.territory ?? ""],
            ["States in scope", me.scope.includes("ALL") ? "All states" : me.scope.join(", ")],
            ["Reports to", manager ? `${manager.name}, ${ROLE_LABEL[manager.role]}` : "Not applicable"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-cv-ice px-4 py-3">
              <dt className="text-xs text-ink-3">{k}</dt>
              <dd className="text-sm font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-ink-3">Name, role and territory come from Clarvida&apos;s directory (single sign-on). Ask your administrator to change them.</p>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (phone && phone.replace(/\D/g, "").length !== 10) { setErr("Enter a 10-digit phone number."); return; }
            setBusy(true);
            await account.saveProfile({ phone, language: lang });
            setBusy(false);
            toast.success("Profile saved");
          }}
        >
          <div>
            <Label htmlFor="ph">Work phone</Label>
            <Input id="ph" inputMode="tel" value={phone} disabled={readOnly} onChange={(e) => { setPhone(e.target.value); setErr(null); }} placeholder="(555) 010-0000" className="mt-1" aria-invalid={Boolean(err)} aria-describedby="ph-err" />
            <FieldError id="ph-err">{err}</FieldError>
          </div>
          <div>
            <p className="text-sm font-medium">Language</p>
            <Segmented className="mt-1" label="Language" value={lang} onChange={setLang} options={[{ value: "en", label: "English" }, { value: "es", label: "Español" }]} />
            <Help>Partner pages are available in English and Spanish.</Help>
          </div>
          <div className="sm:col-span-2"><Button type="submit" disabled={readOnly || busy}>{busy ? "Saving…" : "Save profile"}</Button></div>
        </form>
      </PanelBody>
    </Panel>
  );
}

function Security({ readOnly, changedAt, acc }: { readOnly: boolean; changedAt?: number; acc: ReturnType<typeof readAccount> }) {
  const me = useCurrentUser()!;
  const now = useNow(60_000);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [auth, setAuth] = useState(false);
  const thisDevice = typeof window !== "undefined" ? deviceId() : null;
  const sessions = acc.sessions.filter((s) => !s.revoked);
  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader title="Password" description={changedAt ? `Last changed ${ago(changedAt, now)}.` : undefined} />
        <PanelBody>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const r = await account.changePassword(cur, next);
              setBusy(false);
              if (!r.ok) { setErr(r.message ?? "Couldn't change the password."); return; }
              setCur(""); setNext(""); setErr(null);
              toast.success("Password changed", { description: "A security notice was sent to your Demo Inbox." });
            }}
          >
            <div>
              <Label htmlFor="cpw">Current password</Label>
              <Input id="cpw" type="password" autoComplete="current-password" disabled={readOnly} value={cur} onChange={(e) => { setCur(e.target.value); setErr(null); }} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="npw">New password</Label>
              <Input id="npw" type="password" autoComplete="new-password" disabled={readOnly} value={next} onChange={(e) => { setNext(e.target.value); setErr(null); }} className="mt-1" aria-describedby="npw-help" />
              <Help id="npw-help">At least 12 characters, upper and lower case and a number.</Help>
            </div>
            <div className="sm:col-span-2">
              <FieldError>{err}</FieldError>
              <Button type="submit" disabled={readOnly || busy || !cur || !next}>{busy ? "Saving…" : "Change password"}</Button>
            </div>
          </form>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Two-step verification" description="Required for every account." actions={<Badge tone="teal" icon={<ShieldCheck size={12} />}>On</Badge>} />
        <PanelBody className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-3 text-sm"><Smartphone size={20} className="text-teal" /> Demo Authenticator (simulated phone app)</span>
          <Button variant="secondary" size="sm" onClick={() => setAuth(true)}>Show my current code</Button>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Remembered devices" description="These browsers can skip the code for 30 days." />
        {acc.devices.length === 0 ? (
          <PanelBody><p className="text-sm text-ink-2">No remembered devices. Tick &quot;Remember this device&quot; when you verify to add this browser.</p></PanelBody>
        ) : (
          <ul className="divide-y divide-line-2">
            {acc.devices.map((d) => (
              <li key={d.deviceId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="flex items-center gap-3 text-sm">
                  <Laptop size={18} className="text-ink-3" />
                  <span>
                    <span className="block font-medium">{d.label}{d.deviceId === thisDevice ? " (this browser)" : ""}</span>
                    <span className="block text-xs text-ink-3">Added {fmtDate(d.addedAt)} · expires {fmtDate(d.expiresAt)}</span>
                  </span>
                </span>
                <Button variant="ghost" size="sm" disabled={readOnly} onClick={async () => { await account.forgetDevice(d.deviceId); toast.success("Device forgotten. The code will be asked next time."); }}><Trash2 size={14} /> Forget</Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Active sessions"
          description="Where your account is signed in."
          actions={<Button variant="secondary" size="sm" disabled={readOnly || sessions.filter((s) => !s.current).length === 0} onClick={async () => { await account.signOutOthers(); toast.success("Other sessions signed out"); }}><LogOut size={14} /> Sign out other sessions</Button>}
        />
        <ul className="divide-y divide-line-2">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <span className="flex items-center gap-3 text-sm">
                {/iPhone|iPad|Android/.test(s.device) ? <Smartphone size={18} className="text-ink-3" /> : <Laptop size={18} className="text-ink-3" />}
                <span>
                  <span className="block font-medium">{s.device}</span>
                  <span className="block text-xs text-ink-3">{s.place} · {s.current ? `signed in ${ago(s.startedAt, now)}` : `last active ${ago(s.lastSeenAt, now)}`}</span>
                </span>
              </span>
              {s.current ? <Badge tone="teal">This session</Badge> : null}
            </li>
          ))}
        </ul>
      </Panel>
      <DemoAuthenticator userId={me.id} accountLabel={me.email ?? me.name} open={auth} onClose={() => setAuth(false)} onUse={(c) => { void navigator.clipboard?.writeText(c).catch(() => undefined); setAuth(false); toast.success("Code copied"); }} />
    </div>
  );
}

function Prefs({ readOnly, acc }: { readOnly: boolean; acc: ReturnType<typeof readAccount> }) {
  const me = useCurrentUser()!;
  const [prefs, setPrefs] = useState(acc.prefs);
  const [monday, setMonday] = useState(acc.mondayBriefing);
  const [busy, setBusy] = useState(false);
  return (
    <Panel>
      <PanelHeader title="Notification preferences" description="Choose where each kind of update goes. Notifications never include client details." />
      <ul className="divide-y divide-line-2">
        {ALL_TYPES.map((t) => (
          <li key={t} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <span>
              <span className="block text-sm font-semibold">{NOTIF_LABEL[t].label}</span>
              <span className="block text-xs text-ink-3">{NOTIF_LABEL[t].help}</span>
            </span>
            <ChannelPicker value={prefs[t]} onChange={(v) => setPrefs((p) => ({ ...p, [t]: v }))} label={NOTIF_LABEL[t].label} disabled={readOnly} />
          </li>
        ))}
      </ul>
      <PanelBody className="flex flex-wrap items-center justify-between gap-4 border-t border-line-2">
        {me.role === "ambassador" || me.role === "amb_lead" ? <Switch checked={monday} onCheckedChange={setMonday} disabled={readOnly} label="Monday briefing email at 7:00 am" /> : <span />}
        <Button disabled={readOnly || busy} onClick={async () => { setBusy(true); await account.savePreferences(prefs, monday); setBusy(false); toast.success("Preferences saved"); }}>{busy ? "Saving…" : "Save preferences"}</Button>
      </PanelBody>
    </Panel>
  );
}

function DemoTab() {
  const router = useRouter();
  const me = useCurrentUser()!;
  const reset = useStore((s) => s.reset);
  const [confirm, setConfirm] = useState<"me" | "world" | null>(null);
  return (
    <div className="space-y-5">
      <Callout tone="teal" title="Demo account">These options exist because this is a prototype. They are not part of the production product.</Callout>
      <Panel>
        <ul className="divide-y divide-line-2">
          <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <span>
              <span className="block text-sm font-semibold">Replay the welcome tour</span>
              <span className="block text-sm text-ink-2">See the first sign-in welcome again.</span>
            </span>
            <Button variant="secondary" size="sm" onClick={async () => { await account.replayWelcome(); router.push("/welcome/"); }}><PlayCircle size={15} /> Replay welcome</Button>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <span>
              <span className="block text-sm font-semibold">Reset my account</span>
              <span className="block text-sm text-ink-2">Restores {me.firstName ?? "your"}&apos;s preferences, welcome tour, read notifications and remembered devices. Keeps your password and the shared demo world.</span>
            </span>
            <Button variant="secondary" size="sm" onClick={() => setConfirm("me")}><RotateCcw size={15} /> Reset my account</Button>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <span>
              <span className="block text-sm font-semibold">Reset the demo world</span>
              <span className="block text-sm text-ink-2">Everything and everyone goes back to the starting state. Signs everyone out.</span>
            </span>
            <Button variant="danger" size="sm" onClick={() => setConfirm("world")}><RotateCcw size={15} /> Reset demo world</Button>
          </li>
        </ul>
      </Panel>
      <Dialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "me" ? "Reset your account?" : "Reset the demo world?"}
        description={confirm === "me" ? "Your preferences and memory go back to the start. Your password and everyone else's data are kept." : "Every page and account goes back to its starting state."}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (confirm === "me") { await account.resetMyAccount(); toast.success("Your account was reset"); setConfirm(null); }
                else { reset(); setConfirm(null); toast.success("Demo world restored"); router.push("/"); }
              }}
            >
              Reset
            </Button>
          </>
        }
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}
