import type { RoiAssumptions } from "@/lib/domain/types";

// BR30 ROI formula. Every default is illustrative until Clarvida confirms its baselines.
export function roi(a: RoiAssumptions) {
  const extraFamilies = a.referralsPerMonth * 12 * a.lostShare * a.reduction * a.conversion;
  const hoursSaved = a.ambassadors * a.researchHours * 52 * a.researchReduction;
  return {
    extraFamilies,
    extraFamiliesLow: extraFamilies * 0.6,
    extraFamiliesHigh: extraFamilies * 1.4,
    hoursSaved,
  };
}
