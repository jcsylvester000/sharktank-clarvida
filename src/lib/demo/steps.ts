// The 13-step guided story (Build Breakdown › Demo Script). `target` matches a data-guide attribute on the page.
// LATEST resolves to the referral the judge (or presenter) just submitted through the partner form.
export interface DemoStep {
  n: number;
  title: string;
  route: string;
  query?: Record<string, string>;
  userId: string | null; // null = public page, no persona change
  target: string;
  narration: string;
  notes: string[];
  time: string;
  fallback: string;
}

export const STEPS: DemoStep[] = [
  { n: 1, title: "Before and after", route: "/story", userId: null, target: "before-after", time: "0:00–0:20", narration: "Today a referral is a name, an email and a message. We cannot tell who sent it.", notes: ["Click 'Show the difference'.", "Land the 0% → 100% number.", "Say: the bottleneck is the handoff."], fallback: "Static slide in the deck." },
  { n: 2, title: "Maria's week", route: "/app", userId: "u-maria", target: "plan", time: "0:20–0:45", narration: "Maria is a Brand Ambassador in Gastonia. She signs in with her own account and her week is already planned, including a health-plan merger that reset her contacts.", notes: ["Point at the merger alert.", "Six actions, each with a plain reason.", "Junior staff, no research needed."], fallback: "—" },
  { n: 3, title: "Find the gatekeepers", route: "/app/finder", userId: "u-maria", target: "finder", time: "0:45–1:10", narration: "The Gatekeeper Finder ranks the institutions that actually send referrals here, and every score explains itself.", notes: ["Switch to Map.", "Red pins: relationships at risk near the office.", "Open a score breakdown."], fallback: "List view." },
  { n: 4, title: "Brief, draft, approve", route: "/app/organization", query: { id: "o1", tab: "outreach" }, userId: "u-maria", target: "outreach", time: "1:10–1:50", narration: "AI drafts from organization data only. Client details are blocked. A person approves before anything is sent.", notes: ["Draft outreach; let it type.", "Paste a test example to show the block, then remove it.", "Approve: 19 of 25 sends this week."], fallback: "Pre-filled draft." },
  { n: 5, title: "Partner kit", route: "/app/kits", userId: "u-maria", target: "kit", time: "1:50–2:05", narration: "Every partner gets a coded link and QR code, so every referral carries its source.", notes: ["Invite a judge to scan the QR.", "Or open the form in a second window."], fallback: "Second window opens the form." },
  { n: 6, title: "A partner refers", route: "/partner/refer", query: { code: "GCS-NC-2026" }, userId: null, target: "refer-form", time: "2:05–2:25", narration: "A school counselor refers in under a minute. Who sent it and what it's for are captured. No trackers on this page.", notes: ["Organization is prefilled from the code.", "Press Send referral."], fallback: "Presenter submits in window 2." },
  { n: 7, title: "It lands in intake", route: "/app/intake", userId: "u-dana", target: "queue", time: "2:25–2:40", narration: "It lands in the Gastonia queue in under a second, with a one-business-day clock already running.", notes: ["Point at the highlighted row and 8:00:00.", "One older referral is overdue and escalated."], fallback: "Refresh the page." },
  { n: 8, title: "Dana closes the loop", route: "/app/referral", query: { id: "LATEST" }, userId: "u-dana", target: "actions", time: "2:40–3:00", narration: "Dana logs the call. The clock stops and the tracker moves on her screen and the counselor's.", notes: ["Log contact attempt: Reached guardian.", "Accept.", "Show the partner window update."], fallback: "—" },
  { n: 9, title: "What can the referrer see?", route: "/app/referral", query: { id: "LATEST", panel: "consent" }, userId: "u-dana", target: "consent-sim", time: "3:00–3:20", narration: "A hospital can see more, for treatment. A Part 2 program locks it. The rules decide, not the person.", notes: ["Pick Hospital: Tier 2 unlocks.", "Turn on Part 2: it locks."], fallback: "Status page with Tier 2 locked." },
  { n: 10, title: "Connected, not just closed", route: "/app/impact", userId: "u-alex", target: "impact", time: "3:20–3:45", narration: "Marketing finally sees which relationships produce clients. Ask in plain English; client-level questions are refused.", notes: ["Toggle Today / With the Co-Pilot.", "Click a suggested question.", "Type a client question to show the refusal."], fallback: "Skip the refusal." },
  { n: 11, title: "Capacity pause", route: "/app/capacity", userId: "u-priya", target: "capacity", time: "3:45–4:00", narration: "When a program is full, outreach pauses automatically, so we never push families toward a waitlist.", notes: ["Point at ABA on Waitlist.", "Optionally set another program to Waitlist."], fallback: "Seed already shows ABA on Waitlist." },
  { n: 12, title: "Privacy X-ray and audit", route: "/app/referral", query: { id: "LATEST" }, userId: "u-sam", target: "xray", time: "4:00–4:30", narration: "One switch shows what marketing ever sees: a single count. Everything you just watched is in the audit log.", notes: ["Flip Privacy X-ray.", "Open Audit Log from the menu."], fallback: "Trust & Security page." },
  { n: 13, title: "Impact and the ask", route: "/app/pilot", userId: "u-alex", target: "pilot", time: "4:30–5:00", narration: "Here is exactly what we will prove in 90 days, and what we are asking for.", notes: ["Move the referrals slider.", "Read the scorecard.", "Close on the ask."], fallback: "Deck slide." },
];
