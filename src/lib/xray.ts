// Field metadata for the Privacy X-ray (E33). In production the same catalog drives encryption and access policy.
export interface FieldMeta {
  label: string;
  dataClass: "C0" | "C1" | "C2" | "C3" | "C4";
  zone: "Care" | "Outreach" | "Both";
  protection: string;
  whoCanSee: string;
  crosses: string; // what, if anything, reaches the Outreach Zone
}

const CARE_ROLES = "Intake Coordinator, Intake Supervisor (Compliance: read only)";

export const REFERRAL_FIELDS: Record<string, FieldMeta> = {
  guardian: { label: "Guardian first name", dataClass: "C3", zone: "Care", protection: "Encrypted field, never in logs or notices", whoCanSee: CARE_ROLES, crosses: "Never" },
  phone: { label: "Family phone", dataClass: "C3", zone: "Care", protection: "Encrypted, masked; every reveal is logged", whoCanSee: "Intake Coordinator, Intake Supervisor", crosses: "Never" },
  language: { label: "Language and call times", dataClass: "C3", zone: "Care", protection: "Care Zone only", whoCanSee: CARE_ROLES, crosses: "Never" },
  age: { label: "Age", dataClass: "C3", zone: "Care", protection: "Care Zone only", whoCanSee: CARE_ROLES, crosses: "Never (age bands only in production reports)" },
  coverage: { label: "Coverage", dataClass: "C3", zone: "Care", protection: "Care Zone only", whoCanSee: CARE_ROLES, crosses: "Never" },
  program: { label: "Program", dataClass: "C3", zone: "Care", protection: "Part 2 programs raise the record to C4", whoCanSee: CARE_ROLES, crosses: "Program name, as a count only" },
  county: { label: "County", dataClass: "C3", zone: "Care", protection: "Care Zone only", whoCanSee: CARE_ROLES, crosses: "County, as a count only" },
  source: { label: "Source type and organization", dataClass: "C2", zone: "Both", protection: "Business information, not client data", whoCanSee: "Intake roles; ambassadors see counts per organization", crosses: "Source type and organization, as counts (<11 suppressed)" },
  referrer: { label: "Referrer contact", dataClass: "C2", zone: "Care", protection: "Work contact only", whoCanSee: CARE_ROLES, crosses: "Never" },
  status: { label: "Status", dataClass: "C1", zone: "Both", protection: "Status codes only cross zones", whoCanSee: "Intake roles; partner sees Tier 1 words", crosses: "Status code, as a count only" },
  consent: { label: "Consent records", dataClass: "C3", zone: "Care", protection: "Care Zone only; drives disclosure rules", whoCanSee: CARE_ROLES, crosses: "Never" },
  notices: { label: "Referrer notices", dataClass: "C1", zone: "Care", protection: "PHI-free by design; scanned in QA", whoCanSee: CARE_ROLES, crosses: "Never" },
};
