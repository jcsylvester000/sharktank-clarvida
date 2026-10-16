// Time-saved model (Oct 16, 2026): hours and dollars of staff time saved per role, per state and company-wide.
// Pure functions, no imports. Cost and pricing are not part of the prototype.
// Facts carry their source; everything else is marked as a judgment or placeholder until Clarvida confirms.

/** Wages are 70.0% of total compensation in private industry (BLS ECEC, June 2026), so loaded cost = wage / 0.70. */
export const LOADED_MULTIPLIER = 1 / 0.7;
export const LOADED_SOURCE = "BLS Employer Costs for Employee Compensation, June 2026 (released Sep 9, 2026): wages 70.0% of total compensation";
export const WEEKS_PER_YEAR = 48; // judgment: 52 weeks less holidays, leave and training
export const MILEAGE_RATE = 0.725; // IRS 2026 business standard mileage rate (IR-2025-128)
export const CONSERVATIVE_FACTOR = 0.5; // judgment: only half of the modeled time is actually realized

export type Level = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Seat = "full" | "view" | "free";
export interface Task { label: string; oldHrs: number; newHrs: number; how: string }
export interface EconRole {
  key: string;
  label: string;
  level: Level; // 0 = outside partner ... 6 = national leadership
  where: "City office" | "State" | "Region" | "National" | "Outside";
  seat: Seat;
  appRole?: string; // matching prototype role, when there is one
  wage: number; // US median hourly wage, BLS OEWS May 2025
  wageSource: string;
  perState: number; // default people per state
  national: number; // default people at national / regional level
  milesSavedPerWeek?: number;
  sees: string; // what this level can see
  tasks: Task[];
}

const OEWS = "BLS OEWS May 2025 median";
export const ECON_ROLES: EconRole[] = [
  {
    key: "partner", label: "Referral Partner (school counselor, caseworker, hospital discharge planner)", level: 0, where: "Outside", seat: "free", appRole: "partner",
    wage: 0, wageSource: "Not counted (outside Clarvida)", perState: 0, national: 0,
    sees: "Only the referrals their own organization sent: reference number and status words (received, contacted, closed). Never client details.",
    tasks: [],
  },
  {
    key: "ambassador", label: "Brand Ambassador", level: 1, where: "City office", seat: "full", appRole: "ambassador",
    wage: 24.93, wageSource: `${OEWS}, Community Health Workers 21-1094`, perState: 3, national: 0, milesSavedPerWeek: 25,
    sees: "Organizations, contacts and outreach in their own territory (state, or city counties when the city level is turned on). No client records.",
    tasks: [
      { label: "Finding referral sources (Google searches, websites, news)", oldHrs: 5, newHrs: 1.5, how: "Gatekeeper Finder ranks sources with reasons; Monday briefing" },
      { label: "Finding the right contact and cold calling gatekeepers", oldHrs: 4, newHrs: 2.5, how: "AI brief per organization, named contacts, warm hand-off from nurture journeys" },
      { label: "Writing outreach emails and follow-ups", oldHrs: 3, newHrs: 1.25, how: "AI drafts; the ambassador edits and approves" },
      { label: "Planning field visits and extra driving", oldHrs: 2, newHrs: 0.75, how: "Map Explorer: radius, drive-time rings, field-day route" },
      { label: "Logging visits and calls, weekly report to the lead", oldHrs: 2.5, newHrs: 0.75, how: "One-tap check-in and visit log; team dashboard builds the report" },
      { label: "Answering partners who ask what happened to a referral", oldHrs: 1, newHrs: 0.25, how: "Automatic PHI-free status notices and partner hub" },
    ],
  },
  {
    key: "intake", label: "Intake Coordinator", level: 1, where: "City office", seat: "full", appRole: "intake",
    wage: 22.08, wageSource: `${OEWS}, Social and Human Service Assistants 21-1093`, perState: 4, national: 0,
    sees: "Client referrals in their own state's queues (Care Zone). Outreach data only as counts.",
    tasks: [
      { label: "Re-keying referrals from email, fax, voicemail", oldHrs: 4, newHrs: 1.5, how: "Structured partner form lands in the queue already filled in" },
      { label: "Working out the right program, office and capacity", oldHrs: 3, newHrs: 0.75, how: "Routing rules and live Capacity Board" },
      { label: "Status calls and emails back to referrers", oldHrs: 2, newHrs: 0.25, how: "Automatic notices with signed status links" },
      { label: "Chasing missing information", oldHrs: 2, newHrs: 1, how: "Required fields and specific error messages on the form" },
    ],
  },
  {
    key: "amb_lead", label: "Ambassador Lead (team lead)", level: 2, where: "State", seat: "full", appRole: "amb_lead",
    wage: 35.94, wageSource: `${OEWS}, Public Relations Specialists 27-3031`, perState: 1, national: 0,
    sees: "Every ambassador on their team, all outreach in their states, team coverage and approvals.",
    tasks: [
      { label: "Building team activity reports", oldHrs: 3, newHrs: 0.5, how: "Team dashboard and Impact Dashboard" },
      { label: "Reviewing outreach and coaching preparation", oldHrs: 2, newHrs: 1, how: "Approvals queue, visit history per organization" },
      { label: "Tracking relationship events (mergers, new directors)", oldHrs: 2, newHrs: 0.5, how: "Relationship Events turns public updates into tasks" },
    ],
  },
  {
    key: "intake_sup", label: "Intake Supervisor (team lead)", level: 2, where: "State", seat: "full", appRole: "intake_sup",
    wage: 32.63, wageSource: `${OEWS}, Healthcare Social Workers 21-1022`, perState: 1, national: 0,
    sees: "All referrals and coordinators in their state; response-time breaches escalate to them.",
    tasks: [
      { label: "Watching response times and reassigning work", oldHrs: 3, newHrs: 1, how: "1-business-day clock with automatic escalation" },
      { label: "Weekly response-time report", oldHrs: 2, newHrs: 0.25, how: "Team SLA dashboard" },
    ],
  },
  {
    key: "program_mgr", label: "Program Manager", level: 3, where: "City office", seat: "view", appRole: "program_mgr",
    wage: 59.55, wageSource: `${OEWS}, Medical and Health Services Managers 11-9111`, perState: 3, national: 0,
    sees: "Programs, capacity and waitlists for their offices; referral counts, not client details.",
    tasks: [
      { label: "Capacity calls and waitlist questions", oldHrs: 2.5, newHrs: 0.75, how: "Capacity Board; outreach pauses itself when a program is full" },
      { label: "Keeping program information current", oldHrs: 1, newHrs: 0.5, how: "Program Catalog with verification dates" },
    ],
  },
  {
    key: "state_dir", label: "State Director", level: 4, where: "State", seat: "view",
    wage: 59.55, wageSource: `${OEWS}, Medical and Health Services Managers 11-9111 (conservative for a director)`, perState: 1, national: 0,
    sees: "Everything in their state: every city office, team and relationship; client details only through Care roles.",
    tasks: [{ label: "Assembling monthly referral and growth reports", oldHrs: 3, newHrs: 0.5, how: "State roll-up on Teams and Access and the Impact Dashboard" }],
  },
  {
    key: "regional_vp", label: "Regional Vice President (several states)", level: 5, where: "Region", seat: "view",
    wage: 59.55, wageSource: `${OEWS}, Medical and Health Services Managers 11-9111 (conservative for a VP)`, perState: 0, national: 3,
    sees: "Every state in their region, compared side by side (aggregates).",
    tasks: [{ label: "Rolling up several states for leadership", oldHrs: 3, newHrs: 0.5, how: "Region roll-up and state comparison" }],
  },
  {
    key: "marketing", label: "Marketing Lead (national)", level: 6, where: "National", seat: "full", appRole: "marketing",
    wage: 37.87, wageSource: `${OEWS}, Market Research Analysts and Marketing Specialists 13-1161`, perState: 0, national: 2,
    sees: "All states, aggregate only (counts under 11 hidden).",
    tasks: [
      { label: "Attribution reporting across states", oldHrs: 6, newHrs: 1.5, how: "Every referral carries its source; attribution dashboard" },
      { label: "Researching content and webinar topics", oldHrs: 2, newHrs: 1, how: "Content and Webinar Ideas" },
    ],
  },
  {
    key: "compliance", label: "Compliance Officer (national)", level: 6, where: "National", seat: "full", appRole: "compliance",
    wage: 59.55, wageSource: `${OEWS}, Medical and Health Services Managers 11-9111`, perState: 0, national: 2,
    sees: "All states, including the audit log and AI governance; client records for audit only.",
    tasks: [{ label: "Audit sampling and evidence for reviews", oldHrs: 4, newHrs: 1.5, how: "Audit Log with filters and export; AI Governance" }],
  },
  {
    key: "admin", label: "Administrator (national IT)", level: 6, where: "National", seat: "full", appRole: "admin",
    wage: 33.54, wageSource: "BLS OEWS May 2025 mean, all occupations (placeholder for IT staff)", perState: 0, national: 2,
    sees: "All users, teams, roles and settings in every state; changes to routing need a second approver.",
    tasks: [{ label: "Access requests and team changes across states", oldHrs: 3, newHrs: 1, how: "Teams and Access; Administration" }],
  },
  {
    key: "executive", label: "Executive (CEO, COO, CGO)", level: 6, where: "National", seat: "view", appRole: "judge",
    wage: 59.55, wageSource: `${OEWS}, Medical and Health Services Managers 11-9111 (very conservative)`, perState: 0, national: 3,
    sees: "The whole company in aggregate: states, regions, growth and the pilot scorecard.",
    tasks: [{ label: "Asking teams for growth numbers", oldHrs: 1, newHrs: 0.25, how: "Executive overview" }],
  },
];

export const savedHours = (r: EconRole) => r.tasks.reduce((s, t) => s + (t.oldHrs - t.newHrs), 0);
export const oldHours = (r: EconRole) => r.tasks.reduce((s, t) => s + t.oldHrs, 0);
export const loadedRate = (r: EconRole) => r.wage * LOADED_MULTIPLIER;

/** Dollars saved per person per year (time at loaded cost plus mileage). */
export function valuePerUser(r: EconRole, factor = 1): { hours: number; dollars: number; mileage: number } {
  const hours = savedHours(r) * WEEKS_PER_YEAR * factor;
  const mileage = (r.milesSavedPerWeek ?? 0) * WEEKS_PER_YEAR * MILEAGE_RATE * factor;
  return { hours, mileage, dollars: hours * loadedRate(r) + mileage };
}

export type Headcount = Record<string, number>;
export const defaultPerState = (): Headcount => Object.fromEntries(ECON_ROLES.map((r) => [r.key, r.perState]));
export const defaultNational = (): Headcount => Object.fromEntries(ECON_ROLES.map((r) => [r.key, r.national]));

export function valueForTeam(head: Headcount, factor = 1) {
  let hours = 0, dollars = 0, people = 0;
  for (const r of ECON_ROLES) {
    const n = head[r.key] ?? 0;
    const v = valuePerUser(r, factor);
    hours += n * v.hours;
    dollars += n * v.dollars;
    people += n;
  }
  return { hours, dollars, people };
}

export function valueForCompany(states: number, perState = defaultPerState(), national = defaultNational(), factor = 1) {
  const s = valueForTeam(perState, factor);
  const n = valueForTeam(national, factor);
  return { perState: s, national: n, hours: s.hours * states + n.hours, dollars: s.dollars * states + n.dollars, people: s.people * states + n.people };
}

export const usd = (n: number, digits = 0) => `$${n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
export const compact = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `$${Math.round(n / 1e3)}k` : usd(n));
