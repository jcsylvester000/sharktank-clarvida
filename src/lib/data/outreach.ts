// B3 seed: visits, nurture journeys and content ideas (all synthetic, relative to "now").
import type { ContentIdea, NurtureEnrollment, NurtureStep, Visit } from "@/lib/domain/types";

const H = 3_600_000;
const D = 24 * H;

export function seedVisits(now: number): Visit[] {
  const v = (id: string, orgId: string, userId: string, daysAgo: number, outcome: string, distanceMi: number | null, method: Visit["method"] = "location"): Visit => ({ id, orgId, userId, at: now - daysAgo * D - 3 * H, method, distanceMi, outcome });
  return [
    v("vi1", "o3", "u-maria", 6, "Met lead counselor; left partner kits for 3 schools", 0.05),
    v("vi2", "o6", "u-maria", 14, "Presented family treatment outcomes to court counselors", 0.08),
    v("vi3", "o18", "u-maria", 18, "Joined the county early-childhood network meeting", 0.12),
    v("vi4", "o2", "u-maria", 20, "Quarterly check-in with care management", null, "address"),
    v("vi5", "o3", "u-maria", 9, "Dropped off Spanish-language referral cards", 0.04),
    v("vi6", "o11", "u-maria", 4, "Introduced Clarvida to a Head Start family services coordinator", 0.1),
    v("vi7", "o10", "u-maria", 11, "Spoke at a family ministry leaders' breakfast", 0.06),
    v("vi8", "o1", "u-maria", 2, "Stopped by front desk; program manager out, left card", 0.03),
    v("vi9", "o13", "u-jon", 8, "Quarterly placement meeting", 0.07),
    v("vi10", "o14", "u-jon", 12, "Student wellness team meeting", 0.09),
    v("vi11", "o15", "u-jon", 3, "Coffee with the care coordination lead", null, "address"),
  ];
}

export const NURTURE_TEMPLATES: Record<NurtureEnrollment["template"], { kind: NurtureStep["kind"]; day: number; subject: string }[]> = {
  "Clinic intro": [
    { kind: "Intro email", day: 0, subject: "Clarvida in-home and outpatient options for your patients" },
    { kind: "Resource", day: 4, subject: "One-page guide: when to refer a family to Clarvida" },
    { kind: "Webinar invite", day: 9, subject: "Invitation: 30-minute briefing for care teams" },
    { kind: "Check-in", day: 14, subject: "Can we help with your next referral?" },
  ],
  "School intro": [
    { kind: "Intro email", day: 0, subject: "Supporting students and families with Clarvida" },
    { kind: "Resource", day: 4, subject: "Counselor's referral card (English and Spanish)" },
    { kind: "Webinar invite", day: 9, subject: "Invitation: back-to-school mental health briefing" },
    { kind: "Check-in", day: 14, subject: "Quick check-in from your Clarvida ambassador" },
  ],
  "Agency re-engage": [
    { kind: "Intro email", day: 0, subject: "What's new at Clarvida this season" },
    { kind: "Resource", day: 4, subject: "Updated program list and openings" },
    { kind: "Webinar invite", day: 9, subject: "Invitation: partner update session" },
    { kind: "Check-in", day: 14, subject: "Let's reconnect" },
  ],
};

export function makeSteps(template: NurtureEnrollment["template"], sentThrough: number, enrolledAt: number, by: string): NurtureStep[] {
  return NURTURE_TEMPLATES[template].map((s, i) => ({
    ...s,
    status: i <= sentThrough ? "Sent" : "Scheduled",
    sentAt: i <= sentThrough ? enrolledAt + s.day * D : undefined,
    approvedBy: i === 0 && sentThrough >= 0 ? by : undefined,
  }));
}

export function seedNurture(now: number): NurtureEnrollment[] {
  return [
    { id: "nj1", orgId: "o11", ownerId: "u-maria", template: "School intro", programId: "p-nc-fct", enrolledAt: now - 6 * D, steps: makeSteps("School intro", 1, now - 6 * D, "Maria Reyes"), signals: [{ kind: "Opened", at: now - 6 * D + 3 * H, step: "Intro email" }, { kind: "Opened", at: now - 2 * D + 2 * H, step: "Resource" }], warmScore: 34, status: "Active", firstApproved: true },
    { id: "nj2", orgId: "o10", ownerId: "u-maria", template: "Agency re-engage", programId: "p-nc-fc", enrolledAt: now - 10 * D, steps: makeSteps("Agency re-engage", 2, now - 10 * D, "Maria Reyes"), signals: [{ kind: "Opened", at: now - 10 * D + 5 * H, step: "Intro email" }, { kind: "Clicked", at: now - 6 * D, step: "Resource" }, { kind: "Opened", at: now - 1 * D, step: "Webinar invite" }], warmScore: 52, status: "Active", firstApproved: true },
    { id: "nj3", orgId: "o12", ownerId: "u-maria", template: "Agency re-engage", programId: "p-nc-iih", enrolledAt: now - 2 * D, steps: makeSteps("Agency re-engage", 0, now - 2 * D, "Maria Reyes"), signals: [], warmScore: 8, status: "Active", firstApproved: true },
    { id: "nj4", orgId: "o16", ownerId: "u-jon", template: "Agency re-engage", programId: "p-co-keep", enrolledAt: now - 5 * D, steps: makeSteps("Agency re-engage", 1, now - 5 * D, "Jon Whitaker"), signals: [{ kind: "Opened", at: now - 5 * D + H, step: "Intro email" }], warmScore: 22, status: "Active", firstApproved: true },
  ];
}

export function seedIdeas(): ContentIdea[] {
  return [
    { id: "id1", audience: "Schools", title: "Webinar: spotting when a student needs more than a counselor visit", whyNow: "Referrals from schools peak 6 to 8 weeks into the semester.", format: "Webinar", status: "Approved", scheduledFor: "Nov 12", approvedBy: "Alex Morgan" },
    { id: "id2", audience: "Schools", title: "Spanish and English referral card for counselors", whyNow: "1 in 4 Gaston County referrals prefer Spanish (synthetic).", format: "One-pager", status: "Suggested" },
    { id: "id3", audience: "Clinics", title: "Briefing: integrated behavioral health referrals after the Vaya Partners merger", whyNow: "Care managers' contacts changed on Oct 1.", format: "Webinar", status: "Suggested" },
    { id: "id4", audience: "Child welfare", title: "Foster care openings this month: one-page update", whyNow: "Licensed homes are open for ages 6 to 17.", format: "Email", status: "Suggested" },
    { id: "id5", audience: "Faith and community", title: "Family ministry leaders' breakfast: how to refer a family", whyNow: "Faith partners asked for a simple guide at the last visit.", format: "Event", status: "Suggested" },
    { id: "id6", audience: "Clinics", title: "Pediatric practices: 10-minute guide to Clarvida programs", whyNow: "Pediatric referrals have been quiet for 63 days.", format: "One-pager", status: "Suggested" },
  ];
}
