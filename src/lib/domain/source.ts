// Maps an organization type to the referral source type recorded on the referral (BR01).
import type { OrgType, SourceType } from "./types";

export const ORG_TO_SRC: Partial<Record<OrgType, SourceType>> = {
  "Child welfare": "Child welfare", "Health plan care managers": "Health plan care manager", "School district": "School", Hospital: "Hospital / clinician",
  "Primary care": "Primary care", Pediatrics: "Primary care", "Public health": "Primary care", "Juvenile justice": "Court / legal", "Child advocacy": "Court / legal",
  "Crisis services": "Hospital / clinician", "Faith / community": "Community / faith", "Early childhood": "Community / faith", "Community nonprofit": "Community / faith",
};
