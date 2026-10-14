// Geography for the maps (FT-170..FT-182). Offices and organization points are illustrative: positions are placed
// from each organization's stored distance and bearing from its office, so distances, rings and drive times agree.
// No client address is ever geocoded or plotted; referral demand is shown per county only.
import type { DB, Organization, Program } from "@/lib/domain/types";

export interface LatLng { lat: number; lng: number }
export interface Office extends LatLng { id: string; name: string; state: string; locationId: string; short: string }

export const OFFICES: Office[] = [
  { id: "off-gastonia", locationId: "loc-gastonia", name: "Clarvida Gastonia office", short: "Gastonia", state: "NC", lat: 35.2621, lng: -81.1873 },
  { id: "off-springs", locationId: "loc-springs", name: "Clarvida Colorado Springs office", short: "Colorado Springs", state: "CO", lat: 38.8339, lng: -104.8214 },
  { id: "off-denver", locationId: "loc-denver", name: "Clarvida Denver office", short: "Denver", state: "CO", lat: 39.7392, lng: -104.9903 },
];

export const COUNTY_CENTROIDS: Record<string, LatLng & { state: string }> = {
  "NC|Gaston": { state: "NC", lat: 35.294, lng: -81.177 },
  "NC|Lincoln": { state: "NC", lat: 35.486, lng: -81.224 },
  "NC|Cleveland": { state: "NC", lat: 35.334, lng: -81.556 },
  "CO|El Paso": { state: "CO", lat: 38.827, lng: -104.527 },
  "CO|Teller": { state: "CO", lat: 38.882, lng: -105.162 },
  "CO|Denver": { state: "CO", lat: 39.762, lng: -104.881 },
  "CO|Arapahoe": { state: "CO", lat: 39.65, lng: -104.339 },
};

/** Illustrative 90-day referral demand by county (aggregate only). Live referrals made in the demo are added on top. */
export const COUNTY_BASELINE: Record<string, number> = { "NC|Gaston": 58, "NC|Lincoln": 14, "NC|Cleveland": 6, "CO|El Paso": 41, "CO|Teller": 4, "CO|Denver": 23, "CO|Arapahoe": 9 };

const MI_PER_DEG_LAT = 69.0;

export function officeFor(state: string): Office {
  return OFFICES.find((o) => o.state === state) ?? OFFICES[0];
}

export function offset(origin: LatLng, miles: number, bearingDeg: number): LatLng {
  const b = (bearingDeg * Math.PI) / 180;
  const lat = origin.lat + (miles * Math.cos(b)) / MI_PER_DEG_LAT;
  const lng = origin.lng + (miles * Math.sin(b)) / (MI_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180));
  return { lat, lng };
}

/** Great-circle distance in miles (Turf-style haversine). */
export function milesBetween(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Drive time estimate (FT-174): road distance about 1.3x straight line at ~30 mph in town, plus parking. */
export function driveMinutes(miles: number): number {
  return Math.round((miles * 1.3) / 30 * 60 + 3);
}

export function orgPoint(o: Pick<Organization, "state" | "distanceMiles" | "bearing">): LatLng {
  return offset(officeFor(o.state), o.distanceMiles, o.bearing);
}

/** Grouped entries such as "Pediatric practices in Gastonia (4)" expand to individual points of interest. */
export function orgPoints(o: Organization): (LatLng & { key: string; label: string })[] {
  const m = o.name.match(/\((\d+)\)\s*$/);
  const n = m ? Math.min(8, Number(m[1])) : 1;
  const base = orgPoint(o);
  if (n === 1) return [{ ...base, key: o.id, label: o.name }];
  return Array.from({ length: n }, (_, i) => {
    const p = offset(base, 0.4 + (i % 3) * 0.35, (i * 360) / n + 15);
    return { ...p, key: `${o.id}-${i + 1}`, label: `${o.name.replace(/\s*\(\d+\)\s*$/, "")}, location ${i + 1} of ${n}` };
  });
}

export function countyDemand(db: DB): { key: string; county: string; state: string; n: number; point: LatLng }[] {
  const counts: Record<string, number> = { ...COUNTY_BASELINE };
  for (const r of db.referrals) {
    if (r.receivedAt <= db.seededAt) continue;
    const k = `${r.state}|${r.county}`;
    if (k in counts) counts[k] += 1;
  }
  return Object.entries(counts).map(([key, n]) => {
    const [state, county] = key.split("|");
    return { key, county, state, n, point: COUNTY_CENTROIDS[key] };
  });
}

/** Worst capacity among an office's programs (FT-178). */
export function officeCapacity(programs: Program[], office: Office): { status: "Open" | "Limited" | "Waitlist"; programs: Program[] } {
  const ps = programs.filter((p) => p.state === office.state && p.office === office.short);
  const status = ps.some((p) => p.capacity === "Waitlist" || p.capacity === "Closed") ? "Waitlist" : ps.some((p) => p.capacity === "Limited") ? "Limited" : "Open";
  return { status, programs: ps };
}

/** FT-180: categories with no engaged relationship within `radius` miles of the office. */
export function coverageGaps(orgs: Organization[], office: Office, radius = 10): { type: string; nearest?: Organization }[] {
  const near = orgs.filter((o) => o.state === office.state && o.distanceMiles <= radius);
  const types = Array.from(new Set(orgs.filter((o) => o.state === office.state).map((o) => o.type)));
  return types
    .filter((t) => !near.some((o) => o.type === t && (o.stage === "Active" || o.stage === "Engaged")))
    .map((t) => ({ type: t, nearest: near.filter((o) => o.type === t).sort((a, b) => a.distanceMiles - b.distanceMiles)[0] }));
}

/** FT-176: nearest-neighbour stop order from the office, with straight-line legs and estimated drive time. */
export function planRoute(office: LatLng, stops: { id: string; point: LatLng }[]) {
  const left = [...stops];
  const order: typeof stops = [];
  let cur: LatLng = office;
  let miles = 0;
  while (left.length) {
    left.sort((a, b) => milesBetween(cur, a.point) - milesBetween(cur, b.point));
    const next = left.shift()!;
    miles += milesBetween(cur, next.point);
    order.push(next);
    cur = next.point;
  }
  const backMiles = order.length ? milesBetween(cur, office) : 0;
  const legs = order.length;
  return { order, miles, backMiles, minutes: legs ? Math.round((miles * 1.3) / 30 * 60 + legs * 3) : 0 };
}
