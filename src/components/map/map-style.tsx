import type { OrgType, Stage } from "@/lib/domain/types";

/** Pins in the Clarvida blue ramp by stage; amber marks the selected item and relationships that need attention. */
export const STAGE_PIN: Record<Stage, { fill: string; ring: string; label: string }> = {
  Active: { fill: "#075e7e", ring: "#ffffff", label: "Active" },
  Engaged: { fill: "#1d7fa3", ring: "#ffffff", label: "Engaged" },
  New: { fill: "#5dc7ee", ring: "#ffffff", label: "New" },
  Quiet: { fill: "#28a8e0", ring: "#ffb81c", label: "Quiet (amber ring)" },
  "At risk": { fill: "#03374a", ring: "#ffb81c", label: "At risk (amber ring)" },
  Dormant: { fill: "#7a8a91", ring: "#ffffff", label: "Dormant" },
};

export const TYPE_GLYPH: Record<OrgType, string> = {
  "Child welfare": "CW", "Health plan care managers": "HP", "School district": "S", Hospital: "H", "Primary care": "PC", "Juvenile justice": "JJ",
  "Child advocacy": "CA", Pediatrics: "P", "Crisis services": "CR", "Faith / community": "F", "Early childhood": "EC", "Community nonprofit": "NP", "Public health": "PH",
};

export const CAPACITY_COLOR = { Open: "#1d7fa3", Limited: "#5dc7ee", Waitlist: "#ffb81c" } as const;

export function Legend({ layers }: { layers: { orgs: boolean; offices: boolean; visits: boolean; heat: boolean; capacity: boolean } }) {
  return (
    <div className="space-y-2 text-xs text-ink-2" aria-label="Map legend">
      {layers.orgs ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {Object.values(STAGE_PIN).map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full border-2" style={{ background: s.fill, borderColor: s.ring === "#ffffff" ? s.fill : s.ring }} />{s.label}</span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full border-2 border-cv-ink bg-cv-amber" />Selected</span>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {layers.offices ? <span className="inline-flex items-center gap-1.5"><img src="/brand/logo-symbol.png" alt="" className="h-3.5 w-3.5" />Clarvida office</span> : null}
        {layers.visits ? <span className="inline-flex items-center gap-1.5"><span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cv-navy text-[9px] text-white">✓</span>Visit this month</span> : null}
        {layers.heat ? <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-cv-logo/50" />Referrals by county (counts under 11 hidden)</span> : null}
        {layers.capacity ? (
          <span className="inline-flex flex-wrap items-center gap-2">Office capacity:
            {Object.entries(CAPACITY_COLOR).map(([k, c]) => <span key={k} className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: c }} />{k}</span>)}
          </span>
        ) : null}
      </div>
      <p className="text-[11px] text-ink-3">Organization locations are illustrative. Client locations are never mapped.</p>
    </div>
  );
}
