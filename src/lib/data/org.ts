// Company structure for Teams and Access (PG-36): National -> Region -> State -> City office -> Teams.
// States are the 16 listed on clarvida.com/about-us (accessed Oct 16, 2026). Regions, office cities, team sizes
// and every name below are illustrative (synthetic); only North Carolina and Colorado hold pilot data.
import type { DB, Role, User } from "@/lib/domain/types";
import { scoped } from "@/mock-api/scope";
import { accessFor, pageById } from "@/lib/access";

export interface Office { id: string; city: string; state: string; counties: string[]; pilot?: boolean }
export interface StateUnit { code: string; name: string; region: string; offices: Office[]; pilot?: boolean; director?: string }
export interface Region { id: string; name: string; vp: string; states: string[] }

const off = (state: string, city: string, counties: string[], pilot = false): Office => ({ id: `${state}-${city.replace(/\s+/g, "")}`, city, state, counties, pilot });

export const STATES: StateUnit[] = [
  { code: "NC", name: "North Carolina", region: "east", pilot: true, director: "Tasha Greene", offices: [off("NC", "Gastonia", ["Gaston", "Lincoln", "Cleveland"], true), off("NC", "Charlotte", ["Mecklenburg"])] },
  { code: "CO", name: "Colorado", region: "west", pilot: true, director: "Mark Delgado", offices: [off("CO", "Colorado Springs", ["El Paso", "Teller"], true), off("CO", "Denver", ["Denver"])] },
  { code: "VA", name: "Virginia", region: "east", offices: [off("VA", "Fredericksburg", ["Spotsylvania"]), off("VA", "Richmond", ["Henrico"])] },
  { code: "PA", name: "Pennsylvania", region: "east", offices: [off("PA", "Pittsburgh", ["Allegheny"]), off("PA", "Harrisburg", ["Dauphin"])] },
  { code: "DE", name: "Delaware", region: "east", offices: [off("DE", "Wilmington", ["New Castle"])] },
  { code: "ME", name: "Maine", region: "east", offices: [off("ME", "Portland", ["Cumberland"])] },
  { code: "GA", name: "Georgia", region: "east", offices: [off("GA", "Atlanta", ["Fulton"]), off("GA", "Savannah", ["Chatham"])] },
  { code: "TN", name: "Tennessee", region: "central", offices: [off("TN", "Nashville", ["Davidson"]), off("TN", "Memphis", ["Shelby"])] },
  { code: "LA", name: "Louisiana", region: "central", offices: [off("LA", "Baton Rouge", ["East Baton Rouge"]), off("LA", "New Orleans", ["Orleans"])] },
  { code: "IN", name: "Indiana", region: "central", offices: [off("IN", "Indianapolis", ["Marion"])] },
  { code: "IL", name: "Illinois", region: "central", offices: [off("IL", "Chicago", ["Cook"]), off("IL", "Springfield", ["Sangamon"])] },
  { code: "AZ", name: "Arizona", region: "west", offices: [off("AZ", "Phoenix", ["Maricopa"]), off("AZ", "Tucson", ["Pima"])] },
  { code: "CA", name: "California", region: "west", offices: [off("CA", "Sacramento", ["Sacramento"]), off("CA", "Fresno", ["Fresno"])] },
  { code: "OR", name: "Oregon", region: "west", offices: [off("OR", "Portland", ["Multnomah"])] },
  { code: "WA", name: "Washington", region: "west", offices: [off("WA", "Seattle", ["King"]), off("WA", "Spokane", ["Spokane"])] },
  { code: "ID", name: "Idaho", region: "west", offices: [off("ID", "Boise", ["Ada"])] },
];

export const REGIONS: Region[] = [
  { id: "east", name: "East", vp: "Evelyn Brooks", states: STATES.filter((s) => s.region === "east").map((s) => s.code) },
  { id: "central", name: "Central", vp: "Grace Okafor", states: STATES.filter((s) => s.region === "central").map((s) => s.code) },
  { id: "west", name: "West", vp: "Victor Han", states: STATES.filter((s) => s.region === "west").map((s) => s.code) },
];

export const stateName = (code: string) => STATES.find((s) => s.code === code)?.name ?? code;

/** Levels of the hierarchy, bottom up. "zone" says whether the level can ever open client records. */
export interface Position {
  id: string;
  level: number;
  title: string;
  person: string;
  where: string; // "Gastonia office, NC" / "North Carolina" / "East region" / "National"
  role: Role; // what the app treats this person as (decides Care vs Outreach)
  scope: string[]; // states, or ["ALL"]
  counties?: string[]; // city-level positions only see these counties
  accountId?: string; // signed-in demo account, when there is one
  note: string;
}

const gas = STATES[0].offices[0];
const cos = STATES[1].offices[0];
const clt = STATES[0].offices[1];

/** Every position in the two pilot states plus the levels above them. People with an accountId can sign in. */
export const POSITIONS: Position[] = [
  { id: "p-jordan", level: 0, title: "Referral Partner", person: "Jordan Carter (Gaston County Schools)", where: "Outside Clarvida", role: "partner", scope: ["NC"], accountId: "u-jordan", note: "Sees only referrals their own organization sent, as status words." },
  { id: "p-maria", level: 1, title: "Brand Ambassador", person: "Maria Reyes", where: `${gas.city} office, NC`, role: "ambassador", scope: ["NC"], counties: gas.counties, accountId: "u-maria", note: "City level: only organizations in Gaston, Lincoln and Cleveland counties." },
  { id: "p-kim", level: 1, title: "Brand Ambassador", person: "Kim Alvarez", where: `${clt.city} office, NC`, role: "ambassador", scope: ["NC"], counties: clt.counties, note: "Same state as Maria, different city: sees none of Maria's organizations." },
  { id: "p-jon", level: 1, title: "Brand Ambassador", person: "Jon Whitaker", where: `${cos.city} office, CO`, role: "ambassador", scope: ["CO"], counties: cos.counties, accountId: "u-jon", note: "Different state: sees nothing in North Carolina." },
  { id: "p-dana", level: 1, title: "Intake Coordinator", person: "Dana Kim", where: `${gas.city} office, NC`, role: "intake", scope: ["NC"], counties: [...gas.counties, "Not sure"], accountId: "u-dana", note: "Client referrals for the Gastonia queues only." },
  { id: "p-lena", level: 2, title: "Ambassador Lead", person: "Lena Ortiz", where: "North Carolina and Colorado", role: "amb_lead", scope: ["NC", "CO"], accountId: "u-lena", note: "Team lead across two states: every ambassador and organization there." },
  { id: "p-ray", level: 2, title: "Intake Supervisor", person: "Ray Mendez", where: "North Carolina", role: "intake_sup", scope: ["NC"], accountId: "u-ray", note: "Every NC referral and coordinator; breaches escalate to Ray." },
  { id: "p-priya", level: 3, title: "Program Manager", person: "Priya Shah", where: `${gas.city} office, NC`, role: "program_mgr", scope: ["NC", "CO"], accountId: "u-priya", note: "Programs and capacity; referral counts only." },
  { id: "p-tasha", level: 4, title: "State Director", person: "Tasha Greene", where: "North Carolina", role: "program_mgr", scope: ["NC"], note: "Whole state, every city office, in aggregate. Client records stay with Care roles." },
  { id: "p-evelyn", level: 5, title: "Regional Vice President", person: "Evelyn Brooks", where: "East region (6 states)", role: "program_mgr", scope: REGIONS[0].states, note: "Six states side by side, in aggregate." },
  { id: "p-alex", level: 6, title: "Marketing Lead", person: "Alex Morgan", where: "National", role: "marketing", scope: ["ALL"], accountId: "u-alex", note: "All states, aggregate only." },
  { id: "p-sam", level: 6, title: "Compliance Officer", person: "Sam Patel", where: "National", role: "compliance", scope: ["ALL"], accountId: "u-sam", note: "All states including client records, for audit; every look is logged." },
  { id: "p-chris", level: 6, title: "Administrator", person: "Chris Lee", where: "National", role: "admin", scope: ["ALL"], accountId: "u-chris", note: "Every user and team in every state. No client records unless also given a Care role." },
];

export const LEVEL_NAMES = ["Outside partner", "Field staff", "Team lead", "Office / program", "State", "Region", "National"];

const inCounties = (counties: string[] | undefined, county: string) => !counties || counties.includes(county);

/** What a position can see, using the same scoping the app applies to every screen (mock-api/scope.ts),
 *  narrowed to the office's counties for city-level positions. */
export function visibleTo(db: DB, p: Position) {
  const pseudo: User = { id: p.accountId ?? p.id, name: p.person, initials: "", role: p.role, scope: p.scope, office: p.where, mfa: true, active: true, orgId: p.role === "partner" ? "o3" : undefined };
  const s = scoped(db, pseudo);
  // Organizations reach a person only through Outreach pages (Partner Directory) or, for directors and VPs, as roll-ups.
  const outreach = accessFor(pageById("PG-08"), p.role) !== "none" || p.level === 4 || p.level === 5;
  const orgs = p.role === "partner" ? s.orgs.filter((o) => o.id === pseudo.orgId) : outreach ? s.orgs.filter((o) => inCounties(p.counties, o.county)) : [];
  const referrals = s.referrals.filter((r) => inCounties(p.counties, r.county));
  const orgIds = new Set(orgs.map((o) => o.id));
  const tasks = s.tasks.filter((t) => !t.orgId || orgIds.has(t.orgId));
  const states = p.scope.includes("ALL") ? STATES.map((x) => x.code) : p.scope;
  const offices = p.role === "partner" ? [] : STATES.flatMap((st) => st.offices).filter((o) => states.includes(o.state) && (!p.counties || o.counties.some((c) => p.counties!.includes(c))));
  const team = POSITIONS.filter((q) => q.id !== p.id && q.level < p.level && q.level > 0 && (p.scope.includes("ALL") || q.scope.some((st) => p.scope.includes(st))));
  return {
    states, offices, orgs, referrals, tasks, team,
    activity: s.activity.length,
    outreach,
    clientRecords: referrals.length > 0 && p.role !== "partner",
    hiddenOrgs: db.orgs.length - orgs.length,
    hiddenReferrals: db.referrals.length - referrals.length,
  };
}

/** Team size per office: the default per-state team (3 ambassadors, 4 intake, 3 program managers) split across the
 *  state's offices, so the structure matches the numbers used for costing. */
export function officeTeam(o: Office) {
  const st = STATES.find((x) => x.code === o.state)!;
  const n = st.offices.length;
  const i = st.offices.findIndex((x) => x.id === o.id);
  const share = (total: number) => Math.floor(total / n) + (i < total % n ? 1 : 0);
  return { ambassadors: share(3), intake: share(4), programs: share(3) };
}
