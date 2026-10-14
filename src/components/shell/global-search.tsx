"use client";
// FT-027 Global search: organizations, programs and pages for everyone; referral numbers for Care roles only.
// Results come through the same scope filter as the mock API, so Jon (CO) never finds a North Carolina record.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, BookOpen, LayoutGrid, Search } from "lucide-react";
import { useStore } from "@/lib/store/db";
import { scoped, canSeeCare } from "@/mock-api/scope";
import { PAGES, accessForUser, href } from "@/lib/access";
import { Dialog } from "@/components/ui/overlays";
import { Input } from "@/components/ui/field";
import type { User } from "@/lib/domain/types";

interface Hit { kind: "Organization" | "Program" | "Page" | "Referral"; label: string; sub: string; to: string }
const ICON = { Organization: Building2, Program: BookOpen, Page: LayoutGrid, Referral: FileText };

export function GlobalSearch({ user }: { user: User }) {
  const db = useStore((s) => s.db);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const hits = useMemo<Hit[]>(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 2) return [];
    const v = scoped(db, user);
    const out: Hit[] = [];
    const orgOk = user.role !== "partner";
    if (orgOk) v.orgs.filter((o) => `${o.name} ${o.county} ${o.type}`.toLowerCase().includes(n)).slice(0, 6)
      .forEach((o) => out.push({ kind: "Organization", label: o.name, sub: `${o.type} · ${o.county} County, ${o.state}`, to: href("/app/organization", { id: o.id }) }));
    v.programs.filter((p) => `${p.name} ${p.office}`.toLowerCase().includes(n)).slice(0, 4)
      .forEach((p) => out.push({ kind: "Program", label: p.name, sub: `${p.office}, ${p.state} · ${p.capacity}`, to: href("/app/catalog") }));
    if (canSeeCare(user)) v.referrals.filter((r) => r.id.toLowerCase().includes(n)).slice(0, 4)
      .forEach((r) => out.push({ kind: "Referral", label: r.id, sub: r.status, to: href("/app/referral", { id: r.id }) }));
    PAGES.filter((p) => !p.liveOnly && p.inMenu !== false && accessForUser(p, user) !== "none" && p.title.toLowerCase().includes(n)).slice(0, 4)
      .forEach((p) => out.push({ kind: "Page", label: p.title, sub: p.module, to: href(p.route) }));
    return out;
  }, [q, db, user]);

  const go = (h: Hit) => { setOpen(false); setQ(""); router.push(h.to); };

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-full p-2 hover:bg-white/15" aria-label="Search">
        <Search size={19} />
      </button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }} title="Search" description={canSeeCare(user) ? "Organizations, programs, pages and referral numbers in your territory." : "Organizations, programs and pages in your territory."}>
        <form onSubmit={(e) => { e.preventDefault(); if (hits[0]) go(hits[0]); }}>
          <label htmlFor="global-search" className="sr-only">Search</label>
          <Input id="global-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Kintegra, ABA, Impact" autoComplete="off" />
        </form>
        <ul className="mt-3 divide-y divide-line-2" aria-live="polite" data-testid="search-results">
          {q.trim().length >= 2 && hits.length === 0 ? <li className="py-3 text-sm text-ink-2">Nothing in your territory matches &ldquo;{q.trim()}&rdquo;.</li> : null}
          {hits.map((h) => {
            const I = ICON[h.kind];
            return (
              <li key={h.kind + h.to + h.label}>
                <button onClick={() => go(h)} className="flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left hover:bg-canvas">
                  <I size={16} className="mt-0.5 shrink-0 text-teal" />
                  <span className="min-w-0"><span className="block font-medium">{h.label}</span><span className="block text-xs text-ink-2">{h.kind} · {h.sub}</span></span>
                </button>
              </li>
            );
          })}
        </ul>
      </Dialog>
    </>
  );
}
