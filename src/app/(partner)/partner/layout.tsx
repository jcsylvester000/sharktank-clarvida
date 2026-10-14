"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { LangProvider, useLang } from "@/lib/i18n/lang";
import { useCurrentUser } from "@/lib/store/hooks";
import { auth } from "@/mock-api";
import { Segmented } from "@/components/ui/field";
import { Popover } from "@/components/ui/overlays";
import { Avatar, Logo } from "@/components/brand/brand";

function Header() {
  const { lang, setLang, t } = useLang();
  const me = useCurrentUser();
  const router = useRouter();
  const partner = me?.role === "partner" ? me : undefined;
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href={partner ? "/partner/hub/" : "/partner/refer/"} className="flex items-center gap-3" aria-label="Clarvida partner portal">
          <Logo width={140} />
          <span className="hidden border-l border-line pl-3 text-sm font-medium text-ink-2 sm:inline">Partner portal</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Popover
            trigger={
              <button className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal-tint px-2.5 py-1 text-xs font-semibold text-teal-strong">
                <ShieldCheck size={13} /> {t.noTrackers}
              </button>
            }
          >
            <p className="text-sm">{t.noTrackersDetail}</p>
          </Popover>
          <Segmented label="Language" size="sm" value={lang} onChange={setLang} options={[{ value: "en", label: "English" }, { value: "es", label: "Español" }]} />
          {partner ? (
            <span className="flex items-center gap-1">
              <Avatar initials={partner.initials} tone={partner.avatarTone} size={30} />
              <button onClick={async () => { await auth.signOutNow(); router.replace("/?signedout=1"); }} className="rounded-full p-1.5 text-ink-3 hover:bg-sunken hover:text-ink" aria-label="Sign out"><LogOut size={16} /></button>
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useLang();
  return <footer className="mx-auto max-w-3xl px-4 pb-10 pt-4 text-xs text-ink-3 sm:px-6">{t.synthetic}</footer>;
}

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <div className="min-h-screen bg-cv-ice">
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</main>
        <Footer />
      </div>
    </LangProvider>
  );
}
