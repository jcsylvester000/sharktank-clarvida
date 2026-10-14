import type { SourceType } from "@/lib/domain/types";

// BR11 Tier 2 disclosure. Illustrative rules for the prototype; Clarvida Legal approves production rules.
export const PROVIDER_TYPES: SourceType[] = ["Hospital / clinician", "Health plan care manager", "Primary care"];

export interface DisclosureInput {
  srcType: SourceType;
  signedRelease: boolean;
  part2Program: boolean;
  part2Consent: boolean;
}

export interface DisclosureResult {
  tier1: true;
  tier2: boolean;
  basis: string;
}

export function disclosure(i: DisclosureInput): DisclosureResult {
  if (i.part2Program) {
    return i.part2Consent
      ? { tier1: true, tier2: true, basis: "Part 2 consent is on file (42 CFR Part 2)." }
      : { tier1: true, tier2: false, basis: "This program is covered by 42 CFR Part 2 and no Part 2 consent is on file." };
  }
  if (i.signedRelease) return { tier1: true, tier2: true, basis: "A signed release is on file." };
  if (PROVIDER_TYPES.includes(i.srcType)) {
    return { tier1: true, tier2: true, basis: "The referrer is a health care provider and sharing is for treatment (45 CFR 164.506(c))." };
  }
  return { tier1: true, tier2: false, basis: `Referrer type "${i.srcType}" with no signed release on file.` };
}
