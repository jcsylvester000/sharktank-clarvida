// Page registry and role access (FT-008). Mirrors the User Journey workbook › Access Matrix exactly.
// F = full use, V = view only, blank = locked ("Access restricted" + audit entry).
import type { Role, User, Zone } from "@/lib/domain/types";

export type Module = "Home" | "Outreach" | "Referrals" | "Programs" | "Insights" | "Governance" | "Account";

export interface PageDef {
  id: string; // PG-xx (BRD / workbook ID)
  title: string;
  route: string; // without trailing slash
  module: Module;
  zone: Zone;
  dataClass: string;
  roles: Role[]; // full use
  readOnly?: Role[]; // view only
  brd: string; // feature IDs, shown only behind the "Explain" toggle
  icon: string; // lucide icon name
  inMenu?: boolean;
  liveOnly?: boolean; // shown only in the Live sandbox
}

/** Column order of the Access Matrix sheet. */
export const ROLE_ORDER: Role[] = ["ambassador", "amb_lead", "intake", "intake_sup", "program_mgr", "marketing", "compliance", "admin", "partner", "judge"];

/** Parses one Access Matrix row, e.g. "FF..V.V..V" (F full, V view, . locked) in ROLE_ORDER. */
function m(row: string): { roles: Role[]; readOnly: Role[] } {
  const roles: Role[] = [];
  const readOnly: Role[] = [];
  ROLE_ORDER.forEach((r, i) => {
    if (row[i] === "F") roles.push(r);
    else if (row[i] === "V") readOnly.push(r);
  });
  return { roles, readOnly };
}

type Def = Omit<PageDef, "roles" | "readOnly"> & { matrix: string };
const def = ({ matrix, ...p }: Def): PageDef => ({ ...p, ...m(matrix) });

//                                                                                                 Amb Lead Int Sup PM Mktg Comp Admin Partner Judge
export const PAGES: PageDef[] = [
  def({ id: "PG-06", title: "My dashboard", route: "/app", module: "Home", zone: "Both", dataClass: "C0–C2", matrix: "FFFFFFFF.F", brd: "FT-040 to FT-045", icon: "LayoutDashboard" }),
  def({ id: "PG-07", title: "Gatekeeper Finder", route: "/app/finder", module: "Outreach", zone: "Outreach", dataClass: "C0", matrix: "FF...V...V", brd: "FT-050 to FT-052", icon: "Radar" }),
  def({ id: "PG-35", title: "Map Explorer", route: "/app/map", module: "Outreach", zone: "Outreach", dataClass: "C0, C1 (aggregate)", matrix: "FF.VVF.V.V", brd: "FT-170 to FT-182", icon: "Map" }),
  def({ id: "PG-08", title: "Partner Directory", route: "/app/directory", module: "Outreach", zone: "Outreach", dataClass: "C0–C2", matrix: "FF...V...V", brd: "FT-053, FT-123", icon: "Building2" }),
  def({ id: "PG-09", title: "Organization", route: "/app/organization", module: "Outreach", zone: "Outreach", dataClass: "C0, C2", matrix: "FF...V...V", brd: "FT-054 to FT-061", icon: "Building", inMenu: false }),
  def({ id: "PG-10", title: "Nurture Journeys", route: "/app/nurture", module: "Outreach", zone: "Outreach", dataClass: "C0, C2", matrix: "FF...F...V", brd: "FT-062, FT-063", icon: "Sprout" }),
  def({ id: "PG-11", title: "Content and Webinar Ideas", route: "/app/content", module: "Outreach", zone: "Outreach", dataClass: "C0", matrix: "VF...F...V", brd: "FT-064", icon: "Lightbulb" }),
  def({ id: "PG-12", title: "Relationship Events", route: "/app/events", module: "Outreach", zone: "Outreach", dataClass: "C0", matrix: "VF...F.F.V", brd: "FT-065", icon: "Megaphone" }),
  def({ id: "PG-13", title: "Partner Kits and QR", route: "/app/kits", module: "Outreach", zone: "Outreach", dataClass: "C0", matrix: "FF...F...V", brd: "FT-066", icon: "QrCode" }),
  def({ id: "PG-38", title: "Where Referrals Come From", route: "/app/sources", module: "Referrals", zone: "Outreach", dataClass: "C0", matrix: "FFFFFFFF.V", brd: "MQ-07 (referral origin, Oct 17 2026)", icon: "Route" }),
  def({ id: "PG-14", title: "Intake Queue", route: "/app/intake", module: "Referrals", zone: "Care", dataClass: "C3, C4", matrix: "..FF..V...", brd: "FT-084 to FT-087", icon: "Inbox" }),
  def({ id: "PG-15", title: "Referral", route: "/app/referral", module: "Referrals", zone: "Care", dataClass: "C3, C4", matrix: "..FF..V...", brd: "FT-088 to FT-093", icon: "FileText", inMenu: false }),
  def({ id: "PG-16", title: "New referral (phone / fax)", route: "/app/referral/new", module: "Referrals", zone: "Care", dataClass: "C3", matrix: "..FF......", brd: "FT-095", icon: "PhoneIncoming" }),
  def({ id: "PG-17", title: "Capacity Board", route: "/app/capacity", module: "Programs", zone: "Both", dataClass: "C1", matrix: "VVVVFVVF.V", brd: "FT-110 to FT-112", icon: "Gauge" }),
  def({ id: "PG-18", title: "Program Catalog", route: "/app/catalog", module: "Programs", zone: "Both", dataClass: "C0", matrix: ".V..FV.F.V", brd: "FT-113, FT-179", icon: "BookOpen" }),
  def({ id: "PG-19", title: "Impact Dashboard", route: "/app/impact", module: "Insights", zone: "Outreach", dataClass: "C1 (aggregate)", matrix: "VF.V.FVV.V", brd: "FT-120 to FT-128", icon: "ChartColumnBig" }),
  def({ id: "PG-20", title: "Impact and Pilot", route: "/app/pilot", module: "Insights", zone: "Outreach", dataClass: "C1 (aggregate)", matrix: ".V...FVV.F", brd: "FT-126, FT-127", icon: "Rocket" }),
  def({ id: "PG-21", title: "Foster Pipeline", route: "/app/foster", module: "Insights", zone: "Outreach", dataClass: "C2", matrix: "VV...V...V", brd: "BR-11 (Release 3 preview)", icon: "HeartHandshake" }),
  def({ id: "PG-37", title: "Time and Value", route: "/app/value", module: "Insights", zone: "Outreach", dataClass: "C0 (model)", matrix: ".V..VFVF.V", brd: "MQ-02 (management Q&A, Oct 16 2026)", icon: "Calculator" }),
  def({ id: "PG-29", title: "Live Operations", route: "/app/live", module: "Insights", zone: "Both", dataClass: "C1 (aggregate)", matrix: ".F...F.F.V", brd: "FT-163, FT-182", icon: "Activity", liveOnly: true }),
  def({ id: "PG-22", title: "Audit Log", route: "/app/audit", module: "Governance", zone: "Both", dataClass: "C1", matrix: "......FF.V", brd: "FT-140", icon: "ScrollText" }),
  def({ id: "PG-23", title: "AI Governance", route: "/app/ai-governance", module: "Governance", zone: "Both", dataClass: "C1", matrix: ".....VFF.V", brd: "FT-141", icon: "Bot" }),
  def({ id: "PG-24", title: "Trust and Security", route: "/app/trust", module: "Governance", zone: "Both", dataClass: "C0", matrix: "FFFFFFFF.F", brd: "FT-142", icon: "ShieldCheck" }),
  def({ id: "PG-39", title: "Questions and Answers", route: "/app/answers", module: "Governance", zone: "Both", dataClass: "C0", matrix: "FFFFFFFF.V", brd: "MQ-08 (Q&A guide, Oct 17 2026)", icon: "MessageCircleQuestion" }),
  def({ id: "PG-36", title: "Teams and Access", route: "/app/teams", module: "Governance", zone: "Both", dataClass: "C1 (counts)", matrix: ".V.VVVVF.V", brd: "MQ-04, MQ-06 (management Q&A, Oct 16 2026)", icon: "Network" }),
  def({ id: "PG-25", title: "Administration", route: "/app/admin", module: "Governance", zone: "Both", dataClass: "C1, C2", matrix: ".F.....F..", brd: "FT-143, FT-144", icon: "Settings" }),
  def({ id: "PG-26", title: "Notifications", route: "/app/notifications", module: "Account", zone: "Both", dataClass: "C1", matrix: "FFFFFFFF.F", brd: "FT-150", icon: "Bell", inMenu: false }),
  def({ id: "PG-27", title: "Profile and Settings", route: "/app/settings", module: "Account", zone: "Identity", dataClass: "C2", matrix: "FFFFFFFFFV", brd: "FT-012, FT-026, FT-151", icon: "UserCog", inMenu: false }),
  def({ id: "PG-28", title: "Demo Inbox", route: "/app/inbox", module: "Account", zone: "Both", dataClass: "C1", matrix: "FFFFFFFF.F", brd: "FT-152, FT-153", icon: "Mail", inMenu: false }),
];

export const MODULES: Module[] = ["Outreach", "Referrals", "Programs", "Insights", "Governance"];

export const ROLE_LABEL: Record<Role, string> = {
  ambassador: "Brand Ambassador",
  amb_lead: "Ambassador Lead",
  intake: "Intake Coordinator",
  intake_sup: "Intake Supervisor",
  program_mgr: "Program Manager",
  marketing: "Marketing Lead",
  compliance: "Compliance Officer",
  admin: "Administrator",
  partner: "Referral Partner",
  judge: "Shark Tank Judge (guest)",
};

/** Every staff role and the judge land on their own dashboard (PG-06); the partner lands on the partner hub (PG-33). */
export const LANDING: Record<Role, string> = {
  ambassador: "/app",
  amb_lead: "/app",
  intake: "/app",
  intake_sup: "/app",
  program_mgr: "/app",
  marketing: "/app",
  compliance: "/app",
  admin: "/app",
  partner: "/partner/hub",
  judge: "/app",
};

/** The name of each role's dashboard variant (FT-040). */
export const DASHBOARD_NAME: Record<Role, string> = {
  ambassador: "My Week",
  amb_lead: "Team",
  intake: "Today's queue",
  intake_sup: "Team SLA",
  program_mgr: "Capacity",
  marketing: "Impact",
  compliance: "Governance",
  admin: "System",
  partner: "My referrals",
  judge: "Executive overview",
};

/** Start page: in the Live sandbox everyone starts on Live Operations. */
export function landingFor(role: Role, live: boolean): string {
  if (role === "partner") return LANDING.partner;
  return live ? "/app/live" : LANDING[role];
}

export type Access = "full" | "read" | "none";

export function accessFor(page: PageDef, role: Role): Access {
  if (page.roles.includes(role)) return "full";
  if (page.readOnly?.includes(role)) return "read";
  return "none";
}

/** Access for a signed-in account: a read-only account (Guest Judge) never gets more than view. */
export function accessForUser(page: PageDef, user: Pick<User, "role" | "readOnly">): Access {
  const a = accessFor(page, user.role);
  return a === "full" && user.readOnly && page.id !== "PG-20" ? "read" : a;
}

export function pageById(id: string): PageDef {
  const p = PAGES.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown page ${id}`);
  return p;
}

export function normalizePath(p: string): string {
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

export function pageForPath(pathname: string): PageDef | undefined {
  const p = normalizePath(pathname);
  // Longest route match first (/app/referral/new before /app/referral; /app/x before /app).
  return [...PAGES].sort((a, b) => b.route.length - a.route.length).find((pg) => p === pg.route || (pg.route !== "/app" && p.startsWith(pg.route + "/")));
}

export function rolesThatCanOpen(page: PageDef): string {
  return [...page.roles, ...(page.readOnly ?? [])].map((r) => ROLE_LABEL[r]).join(", ");
}

/** Link helper: static export uses trailing slashes. */
export function href(route: string, query?: Record<string, string>): string {
  const base = route.endsWith("/") ? route : route + "/";
  if (!query) return base;
  const qs = new URLSearchParams(query).toString();
  return qs ? `${base}?${qs}` : base;
}

export const isStaff = (role: Role) => role !== "partner" && role !== "judge";
