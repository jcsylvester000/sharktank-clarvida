// The 13-step guided story (User Journey workbook › Guided Demo, JR-13). `target` matches a data-guide attribute on the page.
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
  short: boolean; // part of the 3-minute cut (steps 2, 4, 6-8, 10, 13)
}

export const STEPS: DemoStep[] = [
  { n: 1, title: "Before and after", route: "/story", userId: null, target: "before-after", time: "0:00–0:20", short: false,
    narration: "Today a referral is a name, an email and a message. We cannot tell who sent it, and the referrer never hears back.",
    click: "Toggle 'With Co-Pilot'.", notes: ["Land 0% → 100% known source.", "The bottleneck is the handoff, not the families."], fallback: "Skip to step 2." },
  { n: 2, title: "Maria's week", route: "/app", userId: "u-maria", target: "alerts", time: "0:20–0:45", short: true,
    narration: "Maria is a Brand Ambassador in Gastonia. She signs in with her own account and her week is already planned, including a health-plan merger that reset her contacts.",
    click: "Point at the merger alert and tasks.", notes: ["Her own account, her territory, her tasks.", "'Last signed in' and team activity make it feel lived-in."], fallback: "Use Switch account > Maria." },
  { n: 3, title: "Find the gatekeepers", route: "/app/finder", userId: "u-maria", target: "finder", time: "0:45–1:10", short: false,
    narration: "Who actually sends referrals here? On a real map of her territory, ranked from public data, with drive times, and every score explains itself.",
    click: "Show the 10-mile ring; click 'Why' on Gaston County DHHS.", notes: ["Click a pin: its row lights up.", "Open the score breakdown: a formula, not a black box."], fallback: "Show the list view (map offline fallback)." },
  { n: 4, title: "Brief, draft, approve", route: "/app/organization", query: { id: "o1", tab: "outreach" }, userId: "u-maria", target: "outreach", time: "1:10–1:50", short: true,
    narration: "The AI drafts from organization data only. Watch what happens if someone pastes client details. Maria edits a line and approves; nothing sends without a person.",
    click: "'Draft outreach' > 'Try pasting client details' > blocked; remove it; amber 'Approve and queue'.", notes: ["Say: AI drafts, a person decides.", "Approved email lands in the Demo Inbox, queued in the approved CRM."], fallback: "Pre-generated draft loads instantly." },
  { n: 5, title: "Partner kit", route: "/app/kits", userId: "u-maria", target: "kit", time: "1:50–2:05", short: false,
    narration: "Every partner gets a coded link and QR, so every referral carries its source.",
    click: "Show the QR.", notes: ["Invite a judge to scan it (hosted build only)."], fallback: "Copy link instead." },
  { n: 6, title: "A partner refers", route: "/partner/refer", query: { code: "GCS-NC-2026" }, userId: null, target: "refer-form", time: "2:05–2:25", short: true,
    narration: "A school counselor refers in under a minute. Who sent it is captured, there are no trackers, and she gets a reference number.",
    click: "Click 'Send referral' (ideally in the partner window, or hand a judge the tablet).", notes: ["Organization is prefilled and locked from the code.", "'Fill a sample referral' is the fast path."], fallback: "Use 'Fill sample referral'." },
  { n: 7, title: "It lands in intake", route: "/app/intake", userId: "u-dana", target: "queue", time: "2:25–2:40", short: true,
    narration: "It lands in the Gastonia queue in under a second, with the 1-business-day clock already running.",
    click: "Point at the highlighted row.", notes: ["'Just arrived' and the teal clock badge.", "Next best call suggests who to ring first."], fallback: "Refresh the queue." },
  { n: 8, title: "Dana closes the loop", route: "/app/referral", query: { id: "LATEST" }, userId: "u-dana", target: "actions", time: "2:40–3:00", short: true,
    narration: "Dana logs the call. The clock stops, the tracker moves, and the counselor is told automatically, with no client details.",
    click: "'Log contact attempt' > 'Accept'; show the Demo Inbox notice.", notes: ["Partner window's status page updates live."], fallback: "Use seeded referral REF-NC-24811." },
  { n: 9, title: "What can the referrer see?", route: "/app/referral", query: { id: "LATEST", panel: "consent" }, userId: "u-dana", target: "consent-sim", time: "3:00–3:20", short: false,
    narration: "Consent rules decide what each referrer may see. Try it yourself.",
    click: "Consent simulator: school vs hospital.", notes: ["Let a judge drive it.", "Part 2 locks Tier 2."], fallback: "Describe the two cases." },
  { n: 10, title: "Connected, not just closed", route: "/app/impact", userId: "u-alex", target: "impact", time: "3:20–3:45", short: true,
    narration: "For the first time, marketing sees which relationships produce clients, including the referral you just watched.",
    click: "Toggle Today vs With; ask one question.", notes: ["Ask 'Show me Avery's referral' to show the refusal."], fallback: "Show the pre-loaded answer." },
  { n: 11, title: "Capacity pause", route: "/app/capacity", userId: "u-priya", target: "capacity", time: "3:45–4:00", short: false,
    narration: "When a program is full, outreach pauses automatically, so we never push families into waitlists.",
    click: "Set ABA to Waitlist (or point at it).", notes: ["Ambassadors are notified by name; journeys pause."], fallback: "Show the banner." },
  { n: 12, title: "Privacy X-ray and audit", route: "/app/referral", query: { id: "LATEST", xray: "1" }, userId: "u-sam", target: "xray", time: "4:00–4:30", short: false,
    narration: "One switch shows what marketing ever sees: a single count. Everything we just did is in the audit log.",
    click: "Toggle X-ray; then Audit Log filtered by 'blocked'.", notes: ["Maria's blocked paste is there, with no client text."], fallback: "Open Trust and Security." },
  { n: 13, title: "Impact and the ask", route: "/app/pilot", userId: "u-alex", target: "the-ask", time: "4:30–5:00", short: true,
    narration: "Here is what we will prove in 90 days in North Carolina and Colorado, and what we are asking for.",
    click: "Move one ROI slider; land on 'The ask'.", notes: ["Close: funding for a 90-day pilot on Clarvida's existing AWS, SSO and CRM."], fallback: "Read the ask from the presenter window." },
];

export const SHORT_CUT = STEPS.filter((s) => s.short).map((s) => s.n);
