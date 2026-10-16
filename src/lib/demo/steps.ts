// The 14-step guided story (step 2 'Where referrals come from' added Oct 17, 2026) (User Journey workbook › Guided Demo, JR-13). `target` matches a data-guide attribute on the page.
// LATEST resolves to the referral the partner (or presenter) just submitted through the partner form.
export interface DemoStep {
  n: number;
  title: string;
  route: string;
  query?: Record<string, string>;
  userId: string | null; // null = public page, no account change
  target: string;
  narration: string; // "Say" (short)
  click: string; // "Click / show"
  notes: string[];
  time: string;
  fallback: string;
  does?: string; // journey tour: what this person does with the referral
  short: boolean; // part of the 3-minute cut (steps 3, 5, 7-9, 11, 14)
}

export const STEPS: DemoStep[] = [
  { n: 1, title: "Before and after", route: "/story", userId: null, target: "before-after", time: "0:00–0:20", short: false,
    narration: "Today a referral is a name, an email and a message. We cannot tell who sent it, and the referrer never hears back.",
    click: "Toggle 'With Co-Pilot'.", notes: ["Land 0% → 100% known source.", "The bottleneck is the handoff, not the families."], fallback: "Skip to step 2." },
  { n: 2, title: "Where referrals come from", route: "/app/sources", userId: "u-maria", target: "referral-sources", time: "0:20–0:50", short: false,
    narration: "Where do Clarvida's clients come from? Almost all are referred: by schools, county caseworkers, hospitals, doctors, Medicaid care managers, courts, community groups and families. Today it starts with a visit and a flyer, then a generic web form, so the source is lost. In the Co-Pilot every channel lands in one queue with its source.",
    click: "Scroll from 'Who refers' to 'How a referral starts today' and the channels table.", notes: ["A referral = a professional saying 'this person needs Clarvida'.", "Five ways in (link/QR, phone, fax/email, statewide platform, walk-in), one queue out.", "Ambassadors don't make referrals; they win and keep the people who do."], fallback: "Use the deck slides 2-3." },
  { n: 3, title: "Maria's week", route: "/app", userId: "u-maria", target: "alerts", time: "0:50–1:15", short: true,
    narration: "Maria is a Brand Ambassador in Gastonia. She signs in with her own account and her week is already planned, including a health-plan merger that reset her contacts.",
    click: "Point at the merger alert and tasks.", notes: ["Her own account, her territory, her tasks.", "'Last signed in' and team activity make it feel lived-in."], fallback: "Use Switch account > Maria." },
  { n: 4, title: "Find the gatekeepers", route: "/app/finder", userId: "u-maria", target: "finder", time: "1:15–1:40", short: false,
    narration: "Who actually sends referrals here? On a real map of her territory, ranked from public data, with drive times, and every score explains itself.",
    click: "Show the 10-mile ring; click 'Why' on Gaston County DHHS.", notes: ["Click a pin: its row lights up.", "Open the score breakdown: a formula, not a black box."], fallback: "Show the list view (map offline fallback)." },
  { n: 5, title: "Brief, draft, approve", route: "/app/organization", query: { id: "o1", tab: "outreach" }, userId: "u-maria", target: "outreach", time: "1:40–2:20", short: true,
    narration: "The AI drafts from organization data only. Watch what happens if someone pastes client details. Maria edits a line and approves; nothing sends without a person.",
    click: "'Draft outreach' > 'Try pasting client details' > blocked; remove it; amber 'Approve and queue'.", notes: ["Say: AI drafts, a person decides.", "Approved email lands in the Demo Inbox, queued in the approved CRM."], fallback: "Pre-generated draft loads instantly." },
  { n: 6, title: "Partner kit", route: "/app/kits", userId: "u-maria", target: "kit", time: "2:20–2:35", short: false,
    narration: "Every partner gets a coded link and QR, so every referral carries its source.",
    click: "Show the QR.", notes: ["Invite a judge to scan it (hosted build only)."], fallback: "Copy link instead." },
  { n: 7, title: "A partner refers", route: "/partner/refer", query: { code: "GCS-NC-2026" }, userId: null, target: "refer-form", time: "2:35–2:55", short: true,
    narration: "This is the coded link from the kit. A school counselor refers in under a minute. Who sent it is captured, there are no trackers, and she gets a reference number. Phone, fax and walk-in referrals are typed in by intake and land in the same queue.",
    click: "Click 'Send referral' (ideally in the partner window, or hand a judge the tablet).", notes: ["Organization is prefilled and locked from the code.", "'Fill a sample referral' is the fast path."], fallback: "Use 'Fill sample referral'." },
  { n: 8, title: "It lands in intake", route: "/app/intake", userId: "u-dana", target: "queue", time: "2:55–3:10", short: true,
    narration: "It lands in the Gastonia queue in under a second, with the 1-business-day clock already running.",
    click: "Point at the highlighted row.", notes: ["'Just arrived' and the teal clock badge.", "Next best call suggests who to ring first.", "Every row shows its source and channel, whatever way it came in."], fallback: "Refresh the queue." },
  { n: 9, title: "Dana closes the loop", route: "/app/referral", query: { id: "LATEST" }, userId: "u-dana", target: "actions", time: "3:10–3:30", short: true,
    narration: "Dana logs the call. The clock stops, the tracker moves, and the counselor is told automatically, with no client details.",
    click: "'Log contact attempt' > 'Accept'; show the Demo Inbox notice.", notes: ["Partner window's status page updates live."], fallback: "Use seeded referral REF-NC-24811." },
  { n: 10, title: "What can the referrer see?", route: "/app/referral", query: { id: "LATEST", panel: "consent" }, userId: "u-dana", target: "consent-sim", time: "3:30–3:50", short: false,
    narration: "Consent rules decide what each referrer may see. Try it yourself.",
    click: "Consent simulator: school vs hospital.", notes: ["Let a judge drive it.", "Part 2 locks Tier 2."], fallback: "Describe the two cases." },
  { n: 11, title: "Connected, not just closed", route: "/app/impact", userId: "u-alex", target: "impact", time: "3:50–4:15", short: true,
    narration: "For the first time, marketing sees which relationships produce clients, including the referral you just watched.",
    click: "Toggle Today vs With; ask one question.", notes: ["Ask 'Show me Avery's referral' to show the refusal."], fallback: "Show the pre-loaded answer." },
  { n: 12, title: "Capacity pause", route: "/app/capacity", userId: "u-priya", target: "capacity", time: "4:15–4:30", short: false,
    narration: "When a program is full, outreach pauses automatically, so we never push families into waitlists.",
    click: "Set ABA to Waitlist (or point at it).", notes: ["Ambassadors are notified by name; journeys pause."], fallback: "Show the banner." },
  { n: 13, title: "Privacy X-ray and audit", route: "/app/referral", query: { id: "LATEST", xray: "1" }, userId: "u-sam", target: "xray", time: "4:30–5:00", short: false,
    narration: "One switch shows what marketing ever sees: a single count. Everything we just did is in the audit log.",
    click: "Toggle X-ray; then Audit Log filtered by 'blocked'.", notes: ["Maria's blocked paste is there, with no client text."], fallback: "Open Trust and Security." },
  { n: 14, title: "Impact and the ask", route: "/app/pilot", userId: "u-alex", target: "the-ask", time: "5:00–5:30", short: true,
    narration: "Here is what we will prove in 90 days in North Carolina and Colorado, and what we are asking for.",
    click: "Move one ROI slider; land on 'The ask'.", notes: ["Close: funding for a 90-day pilot on Clarvida's existing AWS, SSO and CRM."], fallback: "Read the ask from the presenter window." },
];

export const SHORT_CUT = STEPS.filter((s) => s.short).map((s) => s.n);

// ---------------------------------------------------------------------------------------------------------------
// "Follow one referral" tour (Oct 17, 2026): one referral from the counselor who sends it through every demo account,
// so each screen shows what that person sees and does. LATEST is the referral sent at step 1.
export type Tour = "pitch" | "journey";
const j = (n: number, title: string, route: string, userId: string | null, target: string, does: string, narration: string, click: string, query?: Record<string, string>): DemoStep =>
  ({ n, title, route, query, userId, target, does, narration, click, notes: [], time: "", fallback: "Use 'Go to this step'.", short: false });
export const JOURNEY: DemoStep[] = [
  j(1, "The referral starts here", "/partner/refer", "u-jordan", "refer-form", "Sends the referral",
    "Jordan Carter, a school counselor, sees a student who needs help. She opens her school's own link and refers the family in about a minute. Everything else follows from this.",
    "Click 'Fill a sample referral', then 'Send referral'.", { code: "GCS-NC-2026" }),
  j(2, "It arrives in intake", "/app/intake", "u-dana", "queue", "Receives it in her queue",
    "Seconds later the referral is in Dana's Gastonia queue, with the school as its source and the 1-business-day clock running.", "Point at the highlighted row and its clock."),
  j(3, "Dana calls the family", "/app/referral", "u-dana", "actions", "Calls the family and accepts",
    "Dana calls the family, logs the contact and accepts the referral. The clock stops and the counselor is told automatically.", "'Log contact attempt', then 'Accept'.", { id: "LATEST" }),
  j(4, "Ray watches the clock", "/app", "u-ray", "kpis", "Makes sure nobody waits",
    "Ray supervises intake for North Carolina. If Dana had not called in time, this referral would have escalated to him by name to reassign.", "Point at the team's response-time numbers."),
  j(5, "Priya keeps capacity honest", "/app/capacity", "u-priya", "capacity", "Keeps program openings current",
    "Priya manages the programs. If the program were full, intake would offer a warm redirect and outreach for it would pause.", "Point at the program's capacity status."),
  j(6, "Jordan hears back", "/partner/hub", "u-jordan", "hub", "Sees the status, never client details",
    "Back in Jordan's partner hub, her referral now shows 'Contacted' with its reference number. She never sees client details.", "Point at the newest referral's status."),
  j(7, "Maria gets the credit", "/app", "u-maria", "plan", "Owns the relationship that produced it",
    "Maria is the Brand Ambassador who won Gaston County Schools as a partner. The referral counts toward her partners, and her week includes thank-you and follow-up tasks.", "Point at this week's tasks."),
  j(8, "Lena sees the team", "/app", "u-lena", "kpis", "Coaches the ambassadors",
    "Lena, the Ambassador Lead, sees which partners across North Carolina and Colorado are producing referrals and where coverage is thin.", "Point at the team numbers."),
  j(9, "Jon never sees it", "/app", "u-jon", "kpis", "Different state: no access",
    "Jon is an ambassador in Colorado. He never sees this North Carolina referral or Maria's partners: teams are kept apart by territory.", "Point out that everything here is Colorado."),
  j(10, "Alex sees what works", "/app/impact", "u-alex", "impact", "Sees attribution, not clients",
    "In marketing, Alex sees this referral counted to Gaston County Schools: which relationships produce clients, with no client details.", "Point at referrals by source."),
  j(11, "Sam checks the record", "/app/audit", "u-sam", "audit", "Audits every step",
    "Sam, the Compliance Officer, can see every step of this referral in the audit log: who viewed it, who changed it and when.", "Point at the latest entries."),
  j(12, "Chris controls access", "/app/teams", "u-chris", "teams-preview", "Manages who can see what",
    "Chris, the Administrator, manages users and teams. Teams and Access shows exactly who could see this referral and who could not.", "Pick Maria, then Kim, in 'See what someone sees'."),
  j(13, "Leadership sees the whole picture", "/app", "u-judge", "kpis", "Sees totals across the company",
    "Leaders see the company in aggregate: referrals by source, speed to first contact and the pilot scorecard. That is one referral, start to finish, through every account.", "Finish."),
];
export const stepsFor = (t?: Tour): DemoStep[] => (t === "journey" ? JOURNEY : STEPS);
