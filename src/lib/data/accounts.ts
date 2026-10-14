// The 11 demo accounts (ACC-01..ACC-11). All names are fictional; emails use the reserved .example domain,
// so nothing can ever reach a real inbox. Shared demo password: see README (never shown in the app except
// on the Demo accounts card on the sign-in page).
import type { AccountState, ActivityItem, Credential, DB, NotifType, Notification, OutboxMessage, User } from "@/lib/domain/types";
import { hashPassword } from "@/lib/auth/crypto";
import { statusLink } from "@/lib/rules/status-link";

export const DEMO_PASSWORD = "Brighter2026!";

const H = 3_600_000;
const D = 24 * H;

export const ACCOUNTS: User[] = [
  { id: "u-maria", accId: "ACC-01", name: "Maria Reyes", firstName: "Maria", initials: "MR", role: "ambassador", scope: ["NC"], office: "Gastonia office", territory: "Gaston, Lincoln and Cleveland counties", counties: ["Gaston", "Lincoln", "Cleveland"], email: "maria.reyes@clarvida.example", title: "Brand Ambassador", managerId: "u-lena", mfa: true, active: true, avatarTone: "teal" },
  { id: "u-jon", accId: "ACC-02", name: "Jon Whitaker", firstName: "Jon", initials: "JW", role: "ambassador", scope: ["CO"], office: "Colorado Springs office", territory: "El Paso and Teller counties", counties: ["El Paso", "Teller"], email: "jon.whitaker@clarvida.example", title: "Brand Ambassador", managerId: "u-lena", mfa: true, active: true, avatarTone: "sky" },
  { id: "u-lena", accId: "ACC-03", name: "Lena Ortiz", firstName: "Lena", initials: "LO", role: "amb_lead", scope: ["NC", "CO"], office: "Pilot states", territory: "North Carolina and Colorado pilot", email: "lena.ortiz@clarvida.example", title: "Ambassador Lead", mfa: true, active: true, avatarTone: "navy" },
  { id: "u-dana", accId: "ACC-04", name: "Dana Kim", firstName: "Dana", initials: "DK", role: "intake", scope: ["NC"], office: "Gastonia office", territory: "Gastonia intake queues", email: "dana.kim@clarvida.example", title: "Intake Coordinator", managerId: "u-ray", mfa: true, active: true, avatarTone: "teal" },
  { id: "u-ray", accId: "ACC-05", name: "Ray Mendez", firstName: "Ray", initials: "RM", role: "intake_sup", scope: ["NC"], office: "Gastonia office", territory: "North Carolina intake team", email: "ray.mendez@clarvida.example", title: "Intake Supervisor", mfa: true, active: true, avatarTone: "navy" },
  { id: "u-priya", accId: "ACC-06", name: "Priya Shah", firstName: "Priya", initials: "PS", role: "program_mgr", scope: ["NC", "CO"], office: "Gastonia office", territory: "North Carolina programs (Gastonia)", email: "priya.shah@clarvida.example", title: "Program Manager", mfa: true, active: true, avatarTone: "sky" },
  { id: "u-alex", accId: "ACC-07", name: "Alex Morgan", firstName: "Alex", initials: "AM", role: "marketing", scope: ["ALL"], office: "Clarvida Marketing", territory: "All states (aggregate only)", email: "alex.morgan@clarvida.example", title: "Marketing Lead", mfa: true, active: true, avatarTone: "amber" },
  { id: "u-sam", accId: "ACC-08", name: "Sam Patel", firstName: "Sam", initials: "SP", role: "compliance", scope: ["ALL"], office: "Compliance and Privacy", territory: "All states", email: "sam.patel@clarvida.example", title: "Compliance Officer", mfa: true, active: true, avatarTone: "navy" },
  { id: "u-chris", accId: "ACC-09", name: "Chris Lee", firstName: "Chris", initials: "CL", role: "admin", scope: ["ALL"], office: "Clarvida IT", territory: "All states", email: "chris.lee@clarvida.example", title: "Administrator", mfa: true, active: true, avatarTone: "teal" },
  { id: "u-jordan", accId: "ACC-10", name: "Jordan Carter", firstName: "Jordan", initials: "JC", role: "partner", scope: ["NC"], office: "Gaston County Schools", territory: "Student Services (lead counselor)", email: "jordan.carter@gcs.example", title: "Lead School Counselor", orgId: "o3", orgName: "Gaston County Schools, Student Services", mfa: true, active: true, avatarTone: "sky" },
  { id: "u-judge", accId: "ACC-11", name: "Guest Judge", firstName: "Judge", initials: "GJ", role: "judge", scope: ["ALL"], office: "Shark Tank panel", territory: "Read-only, all states (aggregate)", email: "judge@clarvida.example", title: "Shark Tank Judge (guest)", readOnly: true, mfa: true, active: true, avatarTone: "amber" },
];

/** Where each account was last seen signing in from (simulated, for the "Last signed in" line). */
const LAST_FROM: Record<string, string> = {
  "u-maria": "Gastonia office", "u-jon": "Colorado Springs office", "u-lena": "Charlotte (remote)", "u-dana": "Gastonia office", "u-ray": "Gastonia office",
  "u-priya": "Gastonia office", "u-alex": "Fredericksburg, VA", "u-sam": "Fredericksburg, VA", "u-chris": "Fredericksburg, VA", "u-jordan": "Gaston County Schools", "u-judge": "Guest device",
};
const EARLIER_DEVICE: Record<string, string> = {
  "u-maria": "iPhone, Gastonia", "u-jon": "iPad, Colorado Springs", "u-dana": "Edge on Windows, Gastonia", "u-ray": "Edge on Windows, Gastonia", "u-jordan": "Chromebook, Gaston County Schools",
};

export const DEFAULT_PREFS: Record<NotifType, AccountState["prefs"][NotifType]> = {
  escalation: "in-app", handoff: "in-app", approval: "in-app", capacity: "in-app", task: "in-app", event: "digest", system: "in-app",
};

export function blankAccount(): AccountState {
  return {
    onboardedAt: null, pledgeAt: null, prefs: { ...DEFAULT_PREFS }, mondayBriefing: true, language: "en", lastPage: null,
    lastSignInAt: null, lastSignInFrom: null, currentSignInAt: null, sessions: [], devices: [], filters: {}, dismissed: [], snoozed: {},
  };
}

export function seedAccounts(now: number): Pick<DB, "credentials" | "accounts"> {
  const credentials: Record<string, Credential> = {};
  const accounts: Record<string, AccountState> = {};
  ACCOUNTS.forEach((u, i) => {
    const salt = `cv3-${u.id}-${(i * 7919 + 104729).toString(36)}`;
    credentials[u.id] = { userId: u.id, salt, hash: hashPassword(salt, DEMO_PASSWORD), failed: 0, lockedUntil: null, changedAt: now - (40 + i * 3) * D };
    const last = now - (14 + i * 2.5) * H; // "Last signed in yesterday / 2 days ago", never "never" (FT-013)
    accounts[u.id] = {
      ...blankAccount(),
      lastSignInAt: last,
      lastSignInFrom: LAST_FROM[u.id] ?? "Clarvida office",
      sessions: EARLIER_DEVICE[u.id] ? [{ id: `ss-${u.id}-1`, device: EARLIER_DEVICE[u.id], place: LAST_FROM[u.id] ?? "", startedAt: last, lastSeenAt: last + 50 * 60_000 }] : [],
    };
  });
  return { credentials, accounts };
}

// ---------------------------------------------------------------- Personal notifications (3-6 unread per account)
export function seedPersonalNotifications(now: number): Notification[] {
  const n = (toUserId: string, type: NotifType, text: string, link: string, hoursAgo: number, read = false): Notification => ({
    id: `pn-${toUserId}-${Math.round(hoursAgo * 10)}-${type}`, toUserId, type, text, link, at: now - hoursAgo * H, readBy: read ? [toUserId] : [],
  });
  return [
    n("u-maria", "event", "Vaya Partners merger: your contacts at 1 organization may have changed", "/app/events/", 2),
    n("u-maria", "task", "New task: re-introduce Clarvida to Gaston County DHHS (quiet 44 days)", "/app/", 5),
    n("u-maria", "approval", "Your intro email to Gaston County Schools was queued in the approved CRM", "/app/inbox/", 30, true),
    n("u-maria", "capacity", "Developmental services (ABA) is on a waitlist: outreach for it is paused", "/app/capacity/", 26),
    n("u-jon", "task", "New task: book a back-to-school check-in with D11 Student Wellness", "/app/", 4),
    n("u-jon", "event", "Colorado Medicaid rate change: check in with care coordination leads", "/app/events/", 50),
    n("u-jon", "system", "Monday briefing is ready in your Demo Inbox", "/app/inbox/", 8),
    n("u-lena", "approval", "1 configuration change is waiting for a second approver", "/app/admin/", 3),
    n("u-lena", "event", "Draft relationship event needs confirmation: new Director of Student Services", "/app/events/", 6),
    n("u-lena", "handoff", "Maria logged a visit at Gaston County Schools", "/app/directory/", 20),
    n("u-dana", "task", "New referral REF-XX-24816 needs triage", "/app/intake/", 0.5),
    n("u-dana", "escalation", "REF-NC-24811 is due soon: about 2 business hours left", "/app/intake/", 1),
    n("u-dana", "system", "Ray reassigned 1 referral to you", "/app/intake/", 28, true),
    n("u-ray", "escalation", "Overdue referral in NC-Gastonia-Child: escalated to you", "/app/intake/", 1.5),
    n("u-ray", "task", "Weekly response-time report is ready", "/app/impact/", 9),
    n("u-ray", "system", "Dana has 7 open referrals; Noor is out today", "/app/intake/", 22),
    n("u-priya", "capacity", "Adolescent outpatient capacity not confirmed in 9 days", "/app/capacity/", 24),
    n("u-priya", "task", "Re-verify the Adolescent Substance Use catalog entry", "/app/catalog/", 25),
    n("u-priya", "system", "ABA waitlist: 3 referrals redirected this month", "/app/capacity/", 48, true),
    n("u-alex", "system", "Attribution report for last month is ready", "/app/impact/", 6),
    n("u-alex", "approval", "2 webinar ideas are waiting for your approval", "/app/content/", 12),
    n("u-alex", "task", "Pilot scorecard: add the 3 Clarvida baselines", "/app/pilot/", 30),
    n("u-sam", "system", "PHI guard blocked 1 outreach draft yesterday", "/app/ai-governance/", 20),
    n("u-sam", "task", "Quarterly audit-log review is due Friday", "/app/audit/", 26),
    n("u-sam", "approval", "Prompt 'Event summary' v0.9 is waiting for review", "/app/ai-governance/", 40),
    n("u-chris", "approval", "Your routing change is waiting for a second approver", "/app/admin/", 3),
    n("u-chris", "system", "1 account was locked after failed sign-ins yesterday", "/app/audit/", 21),
    n("u-chris", "task", "Review send caps before the pilot", "/app/admin/", 50),
    n("u-judge", "system", "Welcome to the Shark Tank preview. You can explore everything; changes stay on this device.", "/app/", 0.2),
    n("u-judge", "system", "Start with Impact and Pilot to see the 90-day plan and the ask", "/app/pilot/", 0.2),
    n("u-judge", "system", "Trust and Security shows exactly what is simulated today", "/app/trust/", 0.2),
  ];
}

// ---------------------------------------------------------------- Demo Inbox (8-12 seeded emails, PHI-free)
export function seedOutbox(now: number): OutboxMessage[] {
  const m = (x: Omit<OutboxMessage, "readBy" | "from"> & { from?: string; read?: boolean }): OutboxMessage => {
    const { read, ...rest } = x;
    return { from: "Clarvida Referral Co-Pilot <no-reply@clarvida.example>", readBy: read && x.toUserId ? [x.toUserId] : [], ...rest };
  };
  const SIM = "Simulated email (Demo Inbox)";
  const CRM = "Queued in approved CRM (simulated)";
  return [
    m({ id: "mail-brief-maria", at: now - 3 * H, type: "briefing", toUserId: "u-maria", to: "maria.reyes@clarvida.example", toName: "Maria Reyes", subject: "Your Monday briefing: 6 actions, 1 relationship reset, 2 quiet sources", sentVia: SIM, link: "/app/", linkLabel: "Open My Week",
      body: "Good morning, Maria.\n\nTop actions this week\n1. Call Vaya Partners care management: the Oct 1 merger may have changed your contacts.\n2. Re-introduce Clarvida to Gaston County DHHS, Social Services (quiet for 44 days).\n3. Send the partner kit to Gaston County Schools, Student Services.\n4. Introduce Clarvida to CaroMont ED discharge planning (new, high fit).\n5. Visit Juvenile Court Counselors on Thursday at 2 pm.\n6. Thank Gaston County Schools for this month's referrals.\n\nRelationship events\n- Vaya Health and Partners Health Management merged into Vaya Partners (NC DHHS public notice).\n\nQuiet sources\n- Gaston County DHHS: used to send about 5 a month; none in 44 days.\n- Pediatric practices in Gastonia: none in 63 days.\n\nThis briefing uses organization data only. No client information is included." }),
    m({ id: "mail-brief-jon", at: now - 8 * H, type: "briefing", toUserId: "u-jon", to: "jon.whitaker@clarvida.example", toName: "Jon Whitaker", subject: "Your Monday briefing: 3 actions in El Paso County", sentVia: SIM, link: "/app/", linkLabel: "Open My Week",
      body: "Good morning, Jon.\n\n1. Book a back-to-school check-in with D11 Student Wellness.\n2. Check in with the El Paso care coordination lead about wait times after the rate change.\n3. Introduce Clarvida to military family support groups near Fort Carson.\n\nThis briefing uses organization data only." }),
    m({ id: "mail-out-gcs", at: now - 30 * H, type: "outreach", fromUserId: "u-maria", from: "Maria Reyes <maria.reyes@clarvida.example>", to: "jordan.carter@gcs.example", toName: "Jordan Carter, Gaston County Schools", subject: "Thank you, and a quicker way to refer families", sentVia: CRM, relatedId: "o3", toUserId: "u-jordan",
      body: "Hi Jordan,\n\nThank you for the families your team has connected with Clarvida this fall. To make the next referral faster, your school now has its own referral link and QR code. It takes about a minute, and you will get a reference number and status updates without any client details.\n\nWarmly,\nMaria Reyes\nBrand Ambassador, Clarvida (Gastonia)\n\nClarvida, 513 Prince Edward Street, Suite 101, Fredericksburg, VA 22401. You are receiving this because you work with Clarvida as a referral partner. Unsubscribe: reply STOP." }),
    m({ id: "mail-ref-24799", at: now - 3 * D + 4 * H, type: "referrer-notice", to: "a.lewis@dss.example", toName: "A. Lewis, Gaston County DHHS", subject: "Update on referral REF-NC-24799", sentVia: SIM, relatedId: "REF-NC-24799", link: statusLink("REF-NC-24799"), linkLabel: "View status",
      body: "Your referral REF-NC-24799 was updated: Contacted.\n\nWe reached the family within 1 business day. For privacy, this message does not include any client details. Use the secure link to see the current status." }),
    m({ id: "mail-ref-24811", at: now - 6.5 * H + 60_000, type: "referrer-notice", toUserId: "u-jordan", to: "jordan.carter@gcs.example", toName: "Jordan Carter", subject: "We received your referral REF-NC-24811", sentVia: SIM, relatedId: "REF-NC-24811", link: statusLink("REF-NC-24811"), linkLabel: "View status",
      body: "Thank you. Your referral REF-NC-24811 was received and routed to our Gastonia team. We will contact the family within 1 business day.\n\nFor privacy, this message does not include any client details." }),
    m({ id: "mail-esc-ray", at: now - 1.5 * H, type: "escalation", toUserId: "u-ray", to: "ray.mendez@clarvida.example", toName: "Ray Mendez", subject: "Overdue referral in NC-Gastonia-Child", sentVia: SIM, link: "/app/intake/", linkLabel: "Open the Intake Queue",
      body: "One referral in NC-Gastonia-Child passed its 1-business-day response target and was escalated to you. Open the Intake Queue to reassign it.\n\nThis notice contains no client details." }),
    m({ id: "mail-sec-chris", at: now - 21 * H, type: "security", toUserId: "u-chris", to: "chris.lee@clarvida.example", toName: "Chris Lee", subject: "Security notice: 1 account locked after 5 failed sign-ins", sentVia: SIM, link: "/app/audit/", linkLabel: "Open the audit log",
      body: "An account was locked for 5 minutes after 5 failed sign-in attempts yesterday. The event is recorded in the audit log. No action is needed unless the user asks for help." }),
    m({ id: "mail-digest-alex", at: now - 6 * H, type: "digest", toUserId: "u-alex", to: "alex.morgan@clarvida.example", toName: "Alex Morgan", subject: "Weekly attribution digest: 100% of referrals with a known source", sentVia: SIM, link: "/app/impact/", linkLabel: "Open the Impact Dashboard",
      body: "This week in the pilot counties: every referral carried its source. Schools and child welfare sent the most referrals; median time to first contact stayed inside 1 business day.\n\nAggregate counts only; counts under 11 are suppressed." }),
    m({ id: "mail-sam-ai", at: now - 20 * H, type: "digest", toUserId: "u-sam", to: "sam.patel@clarvida.example", toName: "Sam Patel", subject: "AI governance: 1 blocked attempt, 0 issues", sentVia: SIM, link: "/app/ai-governance/", linkLabel: "Open AI Governance",
      body: "The PHI guard blocked 1 outreach draft that contained a date of birth. Nothing reached the simulated model. All prompt versions in use are approved." }),
    m({ id: "mail-welcome-judge", at: now - 0.2 * H, type: "welcome", toUserId: "u-judge", to: "judge@clarvida.example", toName: "Guest Judge", subject: "Welcome to the Clarvida Referral Co-Pilot preview", sentVia: SIM, link: "/app/pilot/", linkLabel: "See the 90-day pilot",
      body: "Thank you for judging. This preview runs on synthetic data. You can explore the executive overview, impact, trust and the pilot plan. Anything you change stays on your device." }),
  ];
}

// ---------------------------------------------------------------- Team activity (FT-044), PHI-free
export function seedActivity(now: number): ActivityItem[] {
  const a = (id: string, minsAgo: number, actorId: string, text: string, states: string[], zone: ActivityItem["zone"], link?: string): ActivityItem => ({ id, at: now - minsAgo * 60_000, actorId, text, states, zone, link });
  return [
    a("act1", 25, "u-dana", "Dana accepted a referral from Gaston County Schools", ["NC"], "Care", "/app/intake/"),
    a("act2", 70, "u-maria", "Maria logged a visit at Gaston County Schools, Student Services", ["NC"], "Outreach", "/app/organization/?id=o3"),
    a("act3", 140, "u-priya", "Priya confirmed capacity for Foster Care (Gastonia): Open", ["NC"], "Both", "/app/capacity/"),
    a("act4", 210, "u-jon", "Jon approved an outreach email to D11 Student Wellness", ["CO"], "Outreach", "/app/organization/?id=o14"),
    a("act5", 300, "u-ray", "Ray reassigned 1 referral to Dana", ["NC"], "Care", "/app/intake/"),
    a("act6", 420, "u-lena", "Lena published the Vaya Partners merger event", ["NC"], "Outreach", "/app/events/"),
    a("act7", 600, "u-alex", "Alex approved a webinar idea for school counselors", ["ALL"], "Outreach", "/app/content/"),
    a("act8", 900, "u-sam", "Sam reviewed the audit log (no issues)", ["ALL"], "Both", "/app/audit/"),
    a("act9", 1300, "u-maria", "Maria created a partner kit for Gaston County DHHS", ["NC"], "Outreach", "/app/kits/"),
    a("act10", 1500, "u-jon", "Jon logged a call with El Paso County DHS", ["CO"], "Outreach", "/app/organization/?id=o13"),
    a("act11", 1700, "u-chris", "Chris proposed a routing change (waiting for approval)", ["ALL"], "Both", "/app/admin/"),
  ];
}
