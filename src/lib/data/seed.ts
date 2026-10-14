// Synthetic seed data. ALL DATA IS SYNTHETIC: every person, contact, referral and number is invented.
// Organization names are illustrative public institutions. Times are relative to "now" so the demo stays current.
// Ported from the Sharktank prototype (assets/js/data.js) and extended for the Next.js build.
import type { DB, Organization, Program, Referral, User, ContactAttempt, StatusEvent, ReferrerNotice } from "@/lib/domain/types";
import { ACCOUNTS, seedAccounts, seedActivity, seedOutbox, seedPersonalNotifications } from "@/lib/data/accounts";

export const SCHEMA_VERSION = 4; // v3 build (accounts, inbox, activity). Bump to force a clean re-seed (NF-07).
export const FIRST_REF_SEQ = 24818; // first live referral is REF-NC-24818 (JR-05.02)

const H = 3_600_000;
const D = 24 * H;

export function makeSeed(now: number = Date.now()): DB {
  const users: User[] = ACCOUNTS.map((u) => ({ ...u, scope: [...u.scope], counties: u.counties ? [...u.counties] : undefined }));

  const prog = (p: Omit<Program, "description"> & { description?: string }): Program => ({ description: "", ...p });
  const programs: Program[] = [
    prog({ id: "p-nc-fc", state: "NC", office: "Gastonia", name: "Foster Care", partnerLabel: "Foster care", family: "child", ageMin: 0, ageMax: 21, payers: "Medicaid, county", counties: ["Gaston", "Lincoln", "Cleveland"], ownerId: "u-priya", verifiedAt: now - 12 * D, part2: false, queue: "NC-Gastonia-Child", capacity: "Open", capacityNote: "Licensed homes available for ages 6–17", capacityUpdatedAt: now - 2 * D, capacityUpdatedBy: "u-priya", expectedReopen: "", description: "Placement and support for children in foster care, with licensed foster families." }),
    prog({ id: "p-nc-fct", state: "NC", office: "Gastonia", name: "Family Centered Treatment", partnerLabel: "In-home family treatment", family: "child", ageMin: 3, ageMax: 21, payers: "Medicaid (Tailored Plan)", counties: ["Gaston", "Lincoln"], ownerId: "u-priya", verifiedAt: now - 20 * D, part2: false, queue: "NC-Gastonia-Child", capacity: "Open", capacityNote: "", capacityUpdatedAt: now - 1 * D, capacityUpdatedBy: "u-priya", expectedReopen: "", description: "Intensive in-home family therapy that keeps children safely at home." }),
    prog({ id: "p-nc-iih", state: "NC", office: "Gastonia", name: "Intensive In-Home", partnerLabel: "In-home services", family: "child", ageMin: 3, ageMax: 21, payers: "Medicaid", counties: ["Gaston", "Lincoln", "Cleveland"], ownerId: "u-priya", verifiedAt: now - 30 * D, part2: false, queue: "NC-Gastonia-Child", capacity: "Limited", capacityNote: "2 openings this month", capacityUpdatedAt: now - 3 * D, capacityUpdatedBy: "u-priya", expectedReopen: "", description: "Team-based in-home services for youth at risk of out-of-home placement." }),
    prog({ id: "p-nc-aba", state: "NC", office: "Gastonia", name: "ABA (autism)", partnerLabel: "Developmental services", family: "child", ageMin: 2, ageMax: 21, payers: "Medicaid, private", counties: ["Gaston"], ownerId: "u-priya", verifiedAt: now - 45 * D, part2: false, queue: "NC-Gastonia-Child", capacity: "Waitlist", capacityNote: "Waitlist about 6 weeks", capacityUpdatedAt: now - 2 * D, capacityUpdatedBy: "u-priya", expectedReopen: "Jan 2027", description: "Applied behavior analysis for children with autism." }),
    prog({ id: "p-nc-act", state: "NC", office: "Gastonia", name: "ACT (adults)", partnerLabel: "Adult community team", family: "adult", ageMin: 18, ageMax: 99, payers: "Medicaid", counties: ["Gaston"], ownerId: "u-priya", verifiedAt: now - 60 * D, part2: false, queue: "NC-Gastonia-Adult", capacity: "Open", capacityNote: "", capacityUpdatedAt: now - 5 * D, capacityUpdatedBy: "u-priya", expectedReopen: "", description: "Assertive community treatment for adults with serious mental illness." }),
    prog({ id: "p-nc-sud", state: "NC", office: "Gastonia", name: "Adolescent Substance Use", partnerLabel: "Adolescent outpatient", family: "child", ageMin: 12, ageMax: 17, payers: "Medicaid", counties: ["Gaston"], ownerId: "u-priya", verifiedAt: now - 95 * D, part2: true, queue: "NC-Gastonia-Child", capacity: "Limited", capacityNote: "", capacityUpdatedAt: now - 9 * D, capacityUpdatedBy: "u-priya", expectedReopen: "", description: "Outpatient program for teens. Covered by 42 CFR Part 2." }),
    prog({ id: "p-co-fc", state: "CO", office: "Colorado Springs", name: "Foster Care", partnerLabel: "Foster care", family: "child", ageMin: 0, ageMax: 21, payers: "County", counties: ["El Paso", "Teller"], ownerId: "u-priya", verifiedAt: now - 15 * D, part2: false, queue: "CO-Springs-Child", capacity: "Open", capacityNote: "", capacityUpdatedAt: now - 1 * D, capacityUpdatedBy: "u-priya", expectedReopen: "", description: "Placement and support for children in foster care." }),
    prog({ id: "p-co-keep", state: "CO", office: "Colorado Springs", name: "KEEP / KEEP Teen", partnerLabel: "Foster parent support", family: "child", ageMin: 0, ageMax: 21, payers: "County", counties: ["El Paso"], ownerId: "u-priya", verifiedAt: now - 40 * D, part2: false, queue: "CO-Springs-Child", capacity: "Open", capacityNote: "", capacityUpdatedAt: now - 4 * D, capacityUpdatedBy: "u-priya", expectedReopen: "", description: "Group support for foster and kinship caregivers." }),
    prog({ id: "p-co-op", state: "CO", office: "Denver", name: "Outpatient Therapy", partnerLabel: "Counseling", family: "all", ageMin: 0, ageMax: 99, payers: "Medicaid, private", counties: ["Denver", "Arapahoe"], ownerId: "u-priya", verifiedAt: now - 70 * D, part2: false, queue: "CO-Denver-All", capacity: "Limited", capacityNote: "", capacityUpdatedAt: now - 6 * D, capacityUpdatedBy: "u-priya", expectedReopen: "", description: "Individual and family counseling." }),
  ];

  const o = (x: Omit<Organization, "contacts" | "monthly"> & { contacts?: Organization["contacts"]; monthly?: number[] }): Organization => ({ contacts: [], monthly: [0, 0, 0, 0, 0, 0], ...x });
  const orgs: Organization[] = [
    o({ id: "o1", state: "NC", county: "Gaston", name: "Gaston County DHHS, Social Services", type: "Child welfare", stage: "Quiet", ownerId: "u-maria", sources: ["NC DHHS county list"], identifiers: "Curated state list", distanceMiles: 2, bearing: 300, referrals90d: 9, lastReferralAt: now - 44 * D, lastTouchAt: now - 50 * D, monthly: [5, 6, 4, 3, 0, 0],
      summary: "County agency responsible for child protective services, foster care placement and family preservation in Gaston County.", bestContactRole: "Foster care / CPS program manager",
      contacts: [
        { id: "c-o1-1", name: "T. Alvarez", role: "Foster Care Program Manager", workEmail: "t.alvarez@dss.example", workPhone: "(555) 010-2001", source: "Met at county provider meeting", verifiedAt: now - 40 * D, optOut: false },
        { id: "c-o1-2", name: "R. Boyd", role: "CPS In-Home Supervisor", workEmail: "r.boyd@dss.example", source: "Referred by T. Alvarez", verifiedAt: now - 200 * D, optOut: false },
      ] }),
    o({ id: "o2", state: "NC", county: "Gaston", name: "Vaya Partners, Care Management (Gaston region)", type: "Health plan care managers", stage: "At risk", ownerId: "u-maria", sources: ["NC DHHS notice"], identifiers: "Curated state list", distanceMiles: 1, bearing: 40, referrals90d: 14, lastReferralAt: now - 9 * D, lastTouchAt: now - 35 * D, monthly: [5, 5, 6, 5, 4, 2],
      summary: "Regional Medicaid behavioral health plan (Tailored Plan) formed when Vaya Health and Partners Health Management merged on Oct 1, 2026.", bestContactRole: "Care management supervisor, child and family",
      contacts: [{ id: "c-o2-1", name: "K. Nguyen", role: "Care Management Supervisor (former Partners)", workEmail: "k.nguyen@plan.example", source: "Prior partner meeting", verifiedAt: now - 120 * D, optOut: false }] }),
    o({ id: "o3", state: "NC", county: "Gaston", name: "Gaston County Schools, Student Services", type: "School district", stage: "Active", ownerId: "u-maria", sources: ["NCES CCD"], identifiers: "NCES district ID (demo)", distanceMiles: 3, bearing: 200, referrals90d: 21, lastReferralAt: now - 3 * D, lastTouchAt: now - 6 * D, monthly: [2, 1, 3, 6, 8, 7],
      summary: "Public school district; student services coordinates counselors, social workers and psychologists across 54 schools.", bestContactRole: "Director of student services / lead counselor",
      contacts: [
        { id: "c-o3-1", name: "J. Carter", role: "Lead School Counselor", workEmail: "jordan.carter@gcs.example", workPhone: "(555) 010-2301", source: "School visit", verifiedAt: now - 20 * D, optOut: false },
        { id: "c-o3-2", name: "M. Ellis", role: "Director of Student Services", workEmail: "m.ellis@schools.example", source: "District directory", verifiedAt: now - 60 * D, optOut: false },
      ] }),
    o({ id: "o4", state: "NC", county: "Gaston", name: "CaroMont Regional Medical Center, ED and Behavioral Health", type: "Hospital", stage: "New", ownerId: "u-maria", sources: ["NPPES NPI-2"], identifiers: "NPI (demo)", distanceMiles: 4, bearing: 120, referrals90d: 2, lastReferralAt: now - 70 * D, lastTouchAt: null, monthly: [1, 0, 1, 0, 0, 0],
      summary: "Regional hospital serving Gaston County; emergency department and behavioral health discharge planning.", bestContactRole: "ED social work / discharge planning lead" }),
    o({ id: "o5", state: "NC", county: "Gaston", name: "Kintegra Health (FQHC), Gastonia", type: "Primary care", stage: "New", ownerId: "u-maria", sources: ["NPPES NPI-2"], identifiers: "NPI (demo)", distanceMiles: 6, bearing: 160, referrals90d: 1, lastReferralAt: now - 80 * D, lastTouchAt: null, monthly: [0, 1, 0, 0, 0, 0],
      summary: "Federally qualified health center network with integrated behavioral health.", bestContactRole: "Integrated behavioral health manager" }),
    o({ id: "o6", state: "NC", county: "Gaston", name: "Gaston County Juvenile Court Counselors", type: "Juvenile justice", stage: "Active", ownerId: "u-maria", sources: ["NC courts directory"], identifiers: "Curated state list", distanceMiles: 2, bearing: 250, referrals90d: 5, lastReferralAt: now - 12 * D, lastTouchAt: now - 14 * D, monthly: [1, 2, 1, 2, 2, 1],
      summary: "Juvenile court counselors supervise youth and recommend services to the court.", bestContactRole: "Chief court counselor",
      contacts: [{ id: "c-o6-1", name: "D. Price", role: "Chief Court Counselor", workEmail: "d.price@courts.example", source: "Presentation to court counselors", verifiedAt: now - 30 * D, optOut: false }] }),
    o({ id: "o7", state: "NC", county: "Gaston", name: "Guardian ad Litem program (Gaston)", type: "Child advocacy", stage: "New", ownerId: "u-maria", sources: ["NC courts directory"], identifiers: "Curated state list", distanceMiles: 3, bearing: 330, referrals90d: 0, lastReferralAt: null, lastTouchAt: null,
      summary: "Court program that advocates for children in abuse and neglect cases.", bestContactRole: "District administrator" }),
    o({ id: "o8", state: "NC", county: "Gaston", name: "Pediatric practices in Gastonia (4)", type: "Pediatrics", stage: "Quiet", ownerId: "u-maria", sources: ["NPPES NPI-1/2"], identifiers: "NPI (demo)", distanceMiles: 5, bearing: 80, referrals90d: 0, lastReferralAt: now - 63 * D, lastTouchAt: now - 90 * D, monthly: [2, 1, 1, 0, 0, 0],
      summary: "Group of pediatric practices identified from the federal provider registry.", bestContactRole: "Practice manager",
      contacts: [{ id: "c-o8-1", name: "L. Harper", role: "Practice Manager", workEmail: "l.harper@peds.example", source: "Practice website", verifiedAt: now - 300 * D, optOut: true }] }),
    o({ id: "o9", state: "NC", county: "Gaston", name: "Mobile crisis team (regional provider)", type: "Crisis services", stage: "New", ownerId: "u-maria", sources: ["NC DHHS crisis list"], identifiers: "Curated state list", distanceMiles: 12, bearing: 20, referrals90d: 0, lastReferralAt: null, lastTouchAt: null,
      summary: "Regional mobile crisis provider covering Gaston County.", bestContactRole: "Clinical director" }),
    o({ id: "o10", state: "NC", county: "Gaston", name: "Faith communities with family ministries (6)", type: "Faith / community", stage: "New", ownerId: "u-maria", sources: ["Google Places (place_id)", "IRS EO BMF"], identifiers: "place_id only", distanceMiles: 8, bearing: 230, referrals90d: 1, lastReferralAt: now - 88 * D, lastTouchAt: null, monthly: [0, 0, 1, 0, 0, 0],
      summary: "Congregations near the Gastonia office with active family or youth ministries.", bestContactRole: "Pastor or family ministry lead" }),
    o({ id: "o11", state: "NC", county: "Gaston", name: "Head Start and early childhood centers (5)", type: "Early childhood", stage: "New", ownerId: "u-maria", sources: ["HHS Head Start locator"], identifiers: "Curated", distanceMiles: 7, bearing: 280, referrals90d: 0, lastReferralAt: null, lastTouchAt: null,
      summary: "Early childhood programs serving low-income families.", bestContactRole: "Family services coordinator" }),
    o({ id: "o12", state: "NC", county: "Gaston", name: "Family resource and housing nonprofits (3)", type: "Community nonprofit", stage: "New", ownerId: "u-maria", sources: ["IRS EO BMF", "NC 211"], identifiers: "EIN (demo)", distanceMiles: 9, bearing: 140, referrals90d: 0, lastReferralAt: null, lastTouchAt: null,
      summary: "Community nonprofits providing housing, food and family support.", bestContactRole: "Program director" }),
    o({ id: "o17", state: "NC", county: "Lincoln", name: "Lincoln County DSS, Children's Services", type: "Child welfare", stage: "Dormant", ownerId: "u-maria", sources: ["NC DHHS county list"], identifiers: "Curated state list", distanceMiles: 19, bearing: 10, referrals90d: 0, lastReferralAt: now - 120 * D, lastTouchAt: now - 150 * D, monthly: [1, 0, 0, 0, 0, 0],
      summary: "County social services for Lincoln County, including foster care and in-home services.", bestContactRole: "Children's services supervisor" }),
    o({ id: "o18", state: "NC", county: "Gaston", name: "Gaston County Public Health, Care Coordination for Children", type: "Public health", stage: "Engaged", ownerId: "u-maria", sources: ["NC DHHS county list"], identifiers: "Curated state list", distanceMiles: 2, bearing: 100, referrals90d: 3, lastReferralAt: now - 25 * D, lastTouchAt: now - 18 * D, monthly: [0, 1, 0, 1, 1, 0],
      summary: "Public health nurses who coordinate care for young children with health or developmental needs.", bestContactRole: "Care coordination supervisor" }),
    o({ id: "o19", state: "NC", county: "Cleveland", name: "Cleveland County Schools, Student Support", type: "School district", stage: "New", ownerId: "u-maria", sources: ["NCES CCD"], identifiers: "NCES district ID (demo)", distanceMiles: 23, bearing: 255, referrals90d: 0, lastReferralAt: null, lastTouchAt: null,
      summary: "Public school district in neighboring Cleveland County; served by the Gastonia in-home team.", bestContactRole: "Student support services director" }),
    o({ id: "o13", state: "CO", county: "El Paso", name: "El Paso County DHS, Child and Family Services", type: "Child welfare", stage: "Active", ownerId: "u-jon", sources: ["CO county list"], identifiers: "Curated state list", distanceMiles: 3, bearing: 60, referrals90d: 17, lastReferralAt: now - 4 * D, lastTouchAt: now - 8 * D, monthly: [4, 5, 6, 5, 6, 6],
      summary: "County human services department responsible for child welfare in El Paso County.", bestContactRole: "Placement supervisor",
      contacts: [{ id: "c-o13-1", name: "S. Romero", role: "Placement Supervisor", workEmail: "s.romero@county.example", source: "Quarterly placement meeting", verifiedAt: now - 25 * D, optOut: false }] }),
    o({ id: "o14", state: "CO", county: "El Paso", name: "Colorado Springs School District 11, Student Wellness", type: "School district", stage: "Engaged", ownerId: "u-jon", sources: ["NCES CCD"], identifiers: "NCES district ID (demo)", distanceMiles: 4, bearing: 200, referrals90d: 6, lastReferralAt: now - 15 * D, lastTouchAt: now - 20 * D, monthly: [1, 0, 1, 2, 2, 2],
      summary: "Public school district student wellness and counseling services.", bestContactRole: "Student wellness coordinator" }),
    o({ id: "o15", state: "CO", county: "El Paso", name: "Regional health plan care coordination (El Paso region)", type: "Health plan care managers", stage: "Engaged", ownerId: "u-jon", sources: ["CO HCPF list"], identifiers: "Curated state list", distanceMiles: 5, bearing: 300, referrals90d: 8, lastReferralAt: now - 10 * D, lastTouchAt: now - 30 * D, monthly: [2, 3, 2, 3, 3, 2],
      summary: "Regional Medicaid care coordination team serving El Paso County.", bestContactRole: "Care coordination lead" }),
    o({ id: "o16", state: "CO", county: "El Paso", name: "Military family support groups (Fort Carson area)", type: "Faith / community", stage: "New", ownerId: "u-jon", sources: ["Google Places (place_id)"], identifiers: "place_id only", distanceMiles: 9, bearing: 170, referrals90d: 0, lastReferralAt: null, lastTouchAt: null,
      summary: "Family support groups serving military families near Fort Carson.", bestContactRole: "Family readiness coordinator" }),
  ];

  const gatekeeperWeights: DB["gatekeeperWeights"] = {
    "NC|child": { "Child welfare": 30, "Health plan care managers": 28, "School district": 24, Hospital: 20, "Juvenile justice": 18, "Child advocacy": 16, "Public health": 16, "Primary care": 15, Pediatrics: 14, "Crisis services": 14, "Faith / community": 10, "Early childhood": 9, "Community nonprofit": 8 },
    "CO|child": { "Child welfare": 30, "Health plan care managers": 26, "School district": 22, "Faith / community": 12 },
    "NC|adult": { Hospital: 28, "Health plan care managers": 26, "Crisis services": 24, "Primary care": 20, "Community nonprofit": 14, "Faith / community": 10 },
  };

  // ----- Referrals (Care Zone, synthetic) -----
  const refBase = (r: Partial<Referral> & Pick<Referral, "id" | "programId" | "srcType" | "referrerRole" | "age" | "guardianFirstName" | "phone" | "receivedAt" | "status" | "queue">): Referral => ({
    state: "NC", county: "Gaston", channel: "Web form", referrerOrgId: null, coverage: "Medicaid", language: "English", times: ["Weekdays after 3:30 pm"],
    consentAgreement: true, signedRelease: false, part2Consent: false, attempts: [], history: [], notices: [], dupOf: null, ...r,
  });
  const referrals: Referral[] = [
    refBase({ id: "REF-NC-24806", programId: "p-nc-fct", referrerOrgId: "o1", srcType: "Child welfare", referrerName: "A. Lewis", referrerRole: "Caseworker", referrerEmail: "a.lewis@dss.example", age: 9, guardianFirstName: "Avery (synthetic)", phone: "(555) 010-0311", receivedAt: now - 9.5 * H, escalatedAt: now - 1.5 * H, status: "New", queue: "NC-Gastonia-Child" }),
    refBase({ id: "REF-NC-24811", programId: "p-nc-iih", referrerOrgId: "o3", srcType: "School", partnerCode: "GCS-NC-2026", referrerName: "J. Carter", referrerRole: "Lead School Counselor", referrerEmail: "jordan.carter@gcs.example", age: 12, guardianFirstName: "Morgan (synthetic)", phone: "(555) 010-0388", receivedAt: now - 6.5 * H, status: "New", queue: "NC-Gastonia-Child", times: ["Weekday mornings"] }),
    refBase({ id: "REF-NC-24813", programId: "p-nc-sud", referrerOrgId: "o6", srcType: "Court / legal", referrerName: "D. Price", referrerRole: "Court counselor", referrerEmail: "d.price@courts.example", age: 16, guardianFirstName: "Riley (synthetic)", phone: "(555) 010-0412", receivedAt: now - 3 * H, status: "New", queue: "NC-Gastonia-Child" }),
    refBase({ id: "REF-NC-24814", programId: "p-nc-iih", referrerOrgId: null, referrerOrgName: "Parent (self-referral)", srcType: "Family / self", referrerRole: "Parent", channel: "Phone", age: 10, guardianFirstName: "Casey (synthetic)", phone: "(555) 010-0388", receivedAt: now - 1 * H, status: "New", queue: "NC-Gastonia-Child", dupOf: "REF-NC-24811" }),
    refBase({ id: "REF-NC-24802", programId: "p-nc-aba", referrerOrgId: "o4", srcType: "Hospital / clinician", referrerName: "P. Grant", referrerRole: "Discharge planner", referrerEmail: "p.grant@hospital.example", age: 5, guardianFirstName: "Jordan (synthetic)", phone: "(555) 010-0199", receivedAt: now - 2 * D, status: "Hold", statusReason: "Waitlist", queue: "NC-Gastonia-Child", ownerId: "u-dana" }),
    refBase({ id: "REF-NC-24799", programId: "p-nc-fc", referrerOrgId: "o1", srcType: "Child welfare", referrerName: "A. Lewis", referrerRole: "Caseworker", referrerEmail: "a.lewis@dss.example", age: 15, guardianFirstName: "Taylor (synthetic)", phone: "(555) 010-0172", receivedAt: now - 3 * D, status: "Intake scheduled", firstContactAt: now - 3 * D + 4 * H, queue: "NC-Gastonia-Child", signedRelease: true, ownerId: "u-dana" }),
    refBase({ id: "REF-NC-24795", programId: "p-nc-fct", referrerOrgId: "o2", srcType: "Health plan care manager", referrerName: "K. Nguyen", referrerRole: "Care manager", referrerEmail: "k.nguyen@plan.example", age: 13, guardianFirstName: "Quinn (synthetic)", phone: "(555) 010-0150", receivedAt: now - 5 * D, status: "Intake completed", firstContactAt: now - 5 * D + 2 * H, queue: "NC-Gastonia-Child", signedRelease: true, ownerId: "u-dana" }),
    refBase({ id: "REF-XX-24816", programId: null, referrerOrgId: null, referrerOrgName: "Youth ministry (not listed)", srcType: "Community / faith", referrerRole: "Youth pastor", county: "Not sure", age: 11, guardianFirstName: "Sky (synthetic)", phone: "(555) 010-0222", receivedAt: now - 0.5 * H, status: "New", queue: "Triage (NC)" }),
    // Gaston County Schools (ACC-10 Jordan's organization): referrals earlier this term, for the partner hub (FT-097).
    refBase({ id: "REF-NC-24771", programId: "p-nc-iih", referrerOrgId: "o3", partnerCode: "GCS-NC-2026", srcType: "School", referrerName: "J. Carter", referrerRole: "Lead School Counselor", referrerEmail: "jordan.carter@gcs.example", age: 11, guardianFirstName: "Drew (synthetic)", phone: "(555) 010-0441", receivedAt: now - 24 * D, status: "Intake completed", firstContactAt: now - 24 * D + 3.2 * H, queue: "NC-Gastonia-Child", ownerId: "u-dana" }),
    refBase({ id: "REF-NC-24779", programId: "p-nc-fct", referrerOrgId: "o3", partnerCode: "GCS-NC-2026", srcType: "School", referrerName: "J. Carter", referrerRole: "Lead School Counselor", referrerEmail: "jordan.carter@gcs.example", age: 14, guardianFirstName: "Emery (synthetic)", phone: "(555) 010-0452", receivedAt: now - 19 * D, status: "Intake scheduled", firstContactAt: now - 19 * D + 1.4 * H, queue: "NC-Gastonia-Child", ownerId: "u-dana" }),
    refBase({ id: "REF-NC-24786", programId: "p-nc-iih", referrerOrgId: "o3", partnerCode: "GCS-NC-2026", srcType: "School", referrerName: "J. Carter", referrerRole: "Lead School Counselor", referrerEmail: "jordan.carter@gcs.example", age: 9, guardianFirstName: "Harper (synthetic)", phone: "(555) 010-0463", receivedAt: now - 12 * D, status: "Closed", statusReason: "Served elsewhere", firstContactAt: now - 12 * D + 5.5 * H, queue: "NC-Gastonia-Child", ownerId: "u-dana" }),
    refBase({ id: "REF-NC-24793", programId: "p-nc-fc", referrerOrgId: "o3", partnerCode: "GCS-NC-2026", srcType: "School", referrerName: "J. Carter", referrerRole: "Lead School Counselor", referrerEmail: "jordan.carter@gcs.example", age: 15, guardianFirstName: "Kai (synthetic)", phone: "(555) 010-0474", receivedAt: now - 7 * D, status: "Contacted", firstContactAt: now - 7 * D + 2.1 * H, queue: "NC-Gastonia-Child", ownerId: "u-dana" }),
    refBase({ id: "REF-CO-31207", state: "CO", county: "El Paso", programId: "p-co-fc", referrerOrgId: "o13", srcType: "Child welfare", referrerName: "S. Romero", referrerRole: "Placement worker", referrerEmail: "s.romero@county.example", age: 8, guardianFirstName: "Rowan (synthetic)", phone: "(555) 010-0601", receivedAt: now - 4 * H, status: "New", queue: "CO-Springs-Child" }),
  ];
  for (const r of referrals) {
    const h: StatusEvent[] = [{ at: r.receivedAt, to: "Received", by: r.channel === "Web form" ? "Partner portal" : "Dana Kim", note: `Routed to ${r.queue}` }];
    const n: ReferrerNotice[] = [{ at: r.receivedAt + 60_000, type: "Received", to: r.referrerEmail ?? "referrer", subject: `Your referral ${r.id} was received`, text: `Your referral ${r.id} was received. We will contact the family within 1 business day.` }];
    const a: ContactAttempt[] = [];
    if (r.firstContactAt) {
      a.push({ at: r.firstContactAt, method: "Phone", outcome: "Reached guardian", by: "Dana Kim" });
      h.push({ at: r.firstContactAt, to: "Contacted", from: "New", by: "Dana Kim", note: "Phone: Reached guardian" });
      n.push({ at: r.firstContactAt + 60_000, type: "Contacted", to: r.referrerEmail ?? "referrer", subject: `Update on referral ${r.id}`, text: `Your referral ${r.id} was updated: Contacted.` });
    }
    if (r.status === "Hold") h.push({ at: r.receivedAt + 1 * H, from: "New", to: "Hold", by: "Dana Kim", note: "Waitlist" });
    if (r.status === "Intake scheduled" || r.status === "Intake completed") h.push({ at: r.receivedAt + 6 * H, from: "Contacted", to: "Intake scheduled", by: "Dana Kim" });
    if (r.status === "Closed") h.push({ at: (r.firstContactAt ?? r.receivedAt) + 1 * D, from: "Contacted", to: "Closed", by: "Dana Kim", note: r.statusReason });
    if (r.status === "Intake completed") h.push({ at: r.receivedAt + 3 * D, from: "Intake scheduled", to: "Intake completed", by: "Dana Kim", note: "Recorded manually (EHR feed in R2)" });
    r.history = h;
    r.notices = n;
    r.attempts = a;
  }

  // ----- Weekly trend (12 weeks, illustrative) -----
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now - (11 - i) * 7 * D);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const referred = [11, 13, 12, 14, 12, 13, 15, 13, 14, 12, 13, 14][i];
    const connected = [6, 7, 7, 8, 7, 8, 9, 8, 9, 7, 8, 9][i];
    return { week: label, referred, connected };
  });

  return {
    version: SCHEMA_VERSION,
    seededAt: now,
    refSeq: FIRST_REF_SEQ,
    session: null,
    users,
    locations: [
      { id: "loc-gastonia", name: "Gastonia, NC", state: "NC", timezone: "America/New_York" },
      { id: "loc-springs", name: "Colorado Springs, CO", state: "CO", timezone: "America/Denver" },
      { id: "loc-denver", name: "Denver, CO", state: "CO", timezone: "America/Denver" },
    ],
    programs,
    orgs,
    gatekeeperWeights,
    tasks: [
      { id: "t1", ownerId: "u-maria", orgId: "o2", text: "Call Vaya Partners care management: confirm new Gaston contacts", reason: "event", minutes: 10, dueAt: now + 1 * D, done: false, source: "plan" },
      { id: "t2", ownerId: "u-maria", orgId: "o1", text: "Email Gaston County DHHS Social Services to re-open referrals", reason: "quiet", minutes: 5, dueAt: now + 1 * D, done: false, source: "plan" },
      { id: "t3", ownerId: "u-maria", orgId: "o3", text: "Send the partner kit to Gaston County Schools student services", reason: "kit", minutes: 2, dueAt: now + 2 * D, done: false, source: "plan" },
      { id: "t4", ownerId: "u-maria", orgId: "o4", text: "Introduce Clarvida to CaroMont ED discharge planning", reason: "new_high_fit", minutes: 5, dueAt: now + 3 * D, done: false, source: "plan" },
      { id: "t5", ownerId: "u-maria", orgId: "o6", text: "Visit Juvenile Court counselors Thursday at 2 pm", reason: "visit", minutes: 45, dueAt: now + 2 * D, done: false, source: "plan" },
      { id: "t6", ownerId: "u-maria", orgId: "o3", text: "Thank Gaston County Schools for this month's referrals", reason: "thank_you", minutes: 2, dueAt: now + 4 * D, done: false, source: "plan" },
      { id: "t7", ownerId: "u-jon", orgId: "o14", text: "Book a back-to-school check-in with D11 Student Wellness", reason: "new_high_fit", minutes: 5, dueAt: now + 2 * D, done: false, source: "plan" },
    ],
    touches: [
      { id: "tc1", orgId: "o3", byUserId: "u-maria", type: "Visit", note: "Met lead counselor; left partner kits for 3 schools", at: now - 6 * D },
      { id: "tc2", orgId: "o3", byUserId: "u-maria", type: "Email", note: "Back-to-school referral guide sent", at: now - 30 * D },
      { id: "tc3", orgId: "o1", byUserId: "u-maria", type: "Call", note: "Spoke with program manager about foster capacity", at: now - 50 * D },
      { id: "tc4", orgId: "o2", byUserId: "u-maria", type: "Email", note: "Quarterly program update to care managers", at: now - 35 * D },
      { id: "tc5", orgId: "o6", byUserId: "u-maria", type: "Visit", note: "Presented family treatment outcomes to court counselors", at: now - 14 * D },
      { id: "tc6", orgId: "o18", byUserId: "u-maria", type: "Event", note: "Joined county early-childhood network meeting", at: now - 18 * D },
    ],
    events: [
      { id: "ev1", state: "NC", date: isoDaysAgo(now, 10), type: "Health plan merger", title: "Vaya Health and Partners Health Management merged into Vaya Partners", sourceUrl: "https://www.ncdhhs.gov/", sourceLabel: "NC DHHS public notice", summary: "Two regional Medicaid behavioral health plans combined. Care management teams and contacts in Gaston, Lincoln and Cleveland counties may have changed. Confirm referral contacts and share an updated program list.", orgIds: ["o2"], counties: ["Gaston", "Lincoln", "Cleveland"], status: "Published", confirmedBy: "Lena Ortiz" },
      { id: "ev2", state: "CO", date: isoDaysAgo(now, 100), type: "Rate change", title: "Colorado Medicaid behavioral health safety-net rate change (2% reduction)", sourceUrl: "https://hcpf.colorado.gov/", sourceLabel: "CO HCPF bulletin", summary: "A rate change may affect partner capacity in El Paso and Denver. Check in with care coordination leads about wait times.", orgIds: ["o15"], counties: ["El Paso", "Denver"], status: "Published", confirmedBy: "Lena Ortiz" },
      { id: "ev3", state: "NC", date: isoDaysAgo(now, -3), type: "Staff change", title: "Gaston County Schools names a new Director of Student Services", sourceUrl: "https://www.gaston.k12.nc.us/", sourceLabel: "District board agenda (to verify)", summary: "", orgIds: ["o3"], counties: ["Gaston"], status: "Draft", confirmedBy: "" },
    ],
    referrals,
    kits: [
      { id: "kit-gcs", code: "GCS-NC-2026", orgId: "o3", state: "NC", programIds: ["p-nc-iih", "p-nc-fct", "p-nc-fc"], language: "en", scans: 12, referrals: 6, createdBy: "u-maria", createdAt: now - 30 * D },
      { id: "kit-dss", code: "DSS-NC-2026", orgId: "o1", state: "NC", programIds: ["p-nc-fc", "p-nc-fct"], language: "en", scans: 3, referrals: 2, createdBy: "u-maria", createdAt: now - 60 * D },
    ],
    drafts: [],
    ailog: [
      { id: "ai1", at: now - 2 * D, userId: "u-maria", feature: "AI02", templateId: "PT-email", templateVersion: "v2.1", modelId: "Simulated model (production: AWS Bedrock)", objectId: "o3", result: "Approved and queued" },
      { id: "ai2", at: now - 2 * D + H, userId: "u-maria", feature: "AI01", templateId: "PT-brief", templateVersion: "v1.3", modelId: "Simulated model (production: AWS Bedrock)", objectId: "o4", result: "Viewed" },
      { id: "ai3", at: now - 1 * D, userId: "u-jon", feature: "AI02", templateId: "PT-email", templateVersion: "v2.1", modelId: "Simulated model (production: AWS Bedrock)", objectId: "o14", result: "Edited and approved" },
      { id: "ai4", at: now - 20 * H, userId: "u-jon", feature: "AI02", templateId: "PT-email", templateVersion: "v2.1", modelId: "—", objectId: "o13", result: "Blocked", blockedCategory: "Date of birth" },
    ],
    prompts: [
      { id: "PT-brief", name: "Organization brief", version: "v1.3", status: "Approved", approvedBy: "Alex Morgan, Sam Patel", updatedAt: now - 12 * D, allowedInputs: "Organization record, program catalog, published relationship events", body: "Write a short brief about {organization.name} for a Clarvida Brand Ambassador. Use only these facts: {organization.summary}; type {organization.type}; distance {organization.distance}; matching programs {programs}; events {events}. Do not invent people or numbers." },
      { id: "PT-email", name: "First outreach email", version: "v2.1", status: "Approved", approvedBy: "Alex Morgan, Sam Patel", updatedAt: now - 6 * D, allowedInputs: "Organization record, matching program (not paused), contact role, published events", body: "Draft a {stage}-appropriate email from {ambassador} to {contact.role} at {organization.name} about {program.partnerLabel}. Keep it under 180 words. End with the standard footer and unsubscribe line." },
      { id: "PT-points", name: "Call talking points", version: "v1.0", status: "Approved", approvedBy: "Alex Morgan, Sam Patel", updatedAt: now - 20 * D, allowedInputs: "Organization record, programs", body: "List 3 to 5 talking points for a call with {organization.name} about {program.partnerLabel}." },
      { id: "PT-plan", name: "Weekly plan wording", version: "v1.0", status: "Approved", approvedBy: "Alex Morgan, Sam Patel", updatedAt: now - 15 * D, allowedInputs: "Task reason code, organization stage, days quiet, event title", body: "Turn reason {reason} for {organization.name} into one plain sentence telling the ambassador what to do and why." },
      { id: "PT-event", name: "Event summary for analysts", version: "v0.9", status: "In review", approvedBy: "Alex Morgan", updatedAt: now - 2 * D, allowedInputs: "Public source title and link", body: "Summarize the public source {source} in three sentences for ambassadors. Mark the summary as needing confirmation." },
      { id: "PT-ask", name: "Ask the Co-Pilot", version: "v1.0", status: "Approved", approvedBy: "Alex Morgan, Sam Patel", updatedAt: now - 8 * D, allowedInputs: "Aggregate attribution facts, organization stages, capacity, response-time metrics", body: "Answer the question using only the aggregate table provided. Refuse questions about individual people or referrals." },
    ],
    evals: [
      { suite: "Grounding: facts traceable to source data", cases: 120, passed: 118, threshold: 0.97 },
      { suite: "PHI guard: seeded client details blocked", cases: 80, passed: 80, threshold: 1 },
      { suite: "No invented contacts", cases: 60, passed: 60, threshold: 1 },
      { suite: "Tone and policy: no clinical claims or capacity promises", cases: 90, passed: 84, threshold: 0.95 },
    ],
    audit: [
      { id: "au-s1", at: now - 26 * H, actorId: "u-maria", actorName: "Maria Reyes", role: "ambassador", action: "Signed in (SSO + MFA)", zone: "Identity", device: "Chrome on Windows (simulated)", category: "sign-in" },
      { id: "au-s2", at: now - 26 * H + 60_000, actorId: "u-maria", actorName: "Maria Reyes", role: "ambassador", action: "Viewed My Week", zone: "Outreach", device: "Chrome on Windows (simulated)" },
      { id: "au-s3", at: now - 25 * H, actorId: "u-dana", actorName: "Dana Kim", role: "intake", action: "Signed in (SSO + MFA)", zone: "Identity", device: "Edge on Windows (simulated)", category: "sign-in" },
      { id: "au-s4", at: now - 25 * H + 120_000, actorId: "u-dana", actorName: "Dana Kim", role: "intake", action: "Viewed referral", objectId: "REF-NC-24799", zone: "Care", device: "Edge on Windows (simulated)", category: "care" },
      { id: "au-s5", at: now - 20 * H, actorId: "u-jon", actorName: "Jon Whitaker", role: "ambassador", action: "Blocked: possible client details (PHI guard)", objectId: "o13", zone: "Outreach", device: "Safari on iPad (simulated)", category: "blocked" },
    ],
    notifications: [
      ...seedPersonalNotifications(now),
    ],
    routing: [
      { id: "rt1", state: "NC", counties: ["Gaston", "Lincoln", "Cleveland"], family: "child", ages: "0–21", queue: "NC-Gastonia-Child", queueLabel: "Gastonia children and families" },
      { id: "rt2", state: "NC", counties: ["Gaston"], family: "adult", ages: "18+", queue: "NC-Gastonia-Adult", queueLabel: "Gastonia adults" },
      { id: "rt3", state: "CO", counties: ["El Paso", "Teller"], family: "child", ages: "0–21", queue: "CO-Springs-Child", queueLabel: "Colorado Springs children and families" },
      { id: "rt4", state: "CO", counties: ["Denver", "Arapahoe"], family: "all", ages: "All", queue: "CO-Denver-All", queueLabel: "Denver, all ages" },
      { id: "rt5", state: "*", counties: ["Unmatched"], family: "*", ages: "Any", queue: "Triage", queueLabel: "State triage" },
    ],
    sla: [
      { state: "NC", targetHours: 8, stretch: "Same business day", startHour: 8, endHour: 17, timezone: "America/New_York", holidays: ["2026-11-11", "2026-11-26", "2026-11-27", "2026-12-24", "2026-12-25", "2027-01-01"], dueSoonHours: 2 },
      { state: "CO", targetHours: 8, stretch: "Same business day", startHour: 8, endHour: 17, timezone: "America/Denver", holidays: ["2026-11-11", "2026-11-26", "2026-12-25", "2027-01-01"], dueSoonHours: 2 },
    ],
    pending: [
      { id: "chg1", area: "Routing table", change: "Add Cleveland County to the NC adult queue (NC-Gastonia-Adult)", proposedBy: "u-chris", proposedAt: now - 3 * H, status: "Waiting for second approver", payload: { kind: "routing", ruleId: "rt2", counties: ["Gaston", "Cleveland"] } },
    ],
    vendors: [
      { vendor: "AWS (RDS PostgreSQL, KMS, CloudTrail, S3, SES)", use: "Care Zone hosting, storage, referrer notices", phi: "Yes", baa: "Required: Clarvida AWS BAA", status: "To confirm in approvals phase" },
      { vendor: "AWS Bedrock", use: "AI gateway (organization data only)", phi: "No, by design", baa: "Covered under the AWS BAA (HIPAA-eligible)", status: "To confirm in approvals phase" },
      { vendor: "Clarvida identity provider", use: "Single sign-on with MFA", phi: "No", baa: "Existing Clarvida system", status: "Existing" },
      { vendor: "Approved CRM (GoHighLevel)", use: "Business email to partner organizations", phi: "No, by design", baa: "Not required while no PHI enters it", status: "Approved system" },
      { vendor: "Google Maps Platform (Places)", use: "Organization enrichment", phi: "No", baa: "Not required; store place_id only", status: "Terms reviewed" },
      { vendor: "NPPES, NCES, IRS public data", use: "Organization lists", phi: "No", baa: "Public data", status: "Not applicable" },
    ],
    funnel: [
      { src: "Child welfare", refs: 42, contacted: 40, scheduled: 33, completed: 28, closed: 37 },
      { src: "School", refs: 35, contacted: 32, scheduled: 25, completed: 21, closed: 30 },
      { src: "Health plan care manager", refs: 28, contacted: 27, scheduled: 23, completed: 20, closed: 25 },
      { src: "Hospital / clinician", refs: 14, contacted: 12, scheduled: 10, completed: 8, closed: 12 },
      { src: "Court / legal", refs: 9, contacted: 8, scheduled: 6, completed: 5, closed: 8 },
      { src: "Community / faith", refs: 6, contacted: 5, scheduled: 4, completed: 3, closed: 5 },
      { src: "Family / self", refs: 22, contacted: 17, scheduled: 11, completed: 9, closed: 16 },
    ],
    weekly,
    sendCounts: { "u-maria": 18, "u-jon": 9 },
    orgSendCounts: {},
    sendCap: 25,
    orgSendCap: 3,
    demo: { guideOn: false, step: 0, presenter: false, clockMode: "demo", idleMinutes: 15, showBrdTags: false, soundOn: false },
    roi: { referralsPerMonth: 150, lostShare: 0.3, reduction: 0.3, conversion: 0.6, ambassadors: 6, researchHours: 5, researchReduction: 0.3 },
    ask: "To confirm with Clarvida",
    ...seedAccounts(now),
    resetTokens: [],
    outbox: seedOutbox(now),
    activity: seedActivity(now),
  };
}

function isoDaysAgo(now: number, days: number): string {
  return new Date(now - days * D).toISOString().slice(0, 10);
}

// Ten seeded strings the PHI guard must block (presenter "paste a test example" + QA TC048).
export const PHI_TEST_STRINGS = [
  "client: J. Doe needs help after school",
  "DOB 04/12/2014",
  "born on 4/12/14",
  "diagnosed with ADHD last spring",
  "Medicaid ID 9001234567",
  "member ID 44-221-09",
  "SSN 123-45-6789",
  "patient: R. Lee was discharged",
  "history of depression and an overdose",
  "PTSD after placement",
];
