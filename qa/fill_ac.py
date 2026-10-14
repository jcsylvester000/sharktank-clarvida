"""Fill the Acceptance Criteria workbook (Status / Tester / Date / Evidence) from the B1-B5 QA results.
Usage: python3 fill_ac.py <source.xlsx> <out.xlsx>
Statuses are judged honestly: rows that need people (rehearsals, hallway test, client answers) stay open."""
import sys
import openpyxl

SRC, OUT = sys.argv[1], sys.argv[2]
DATE = "2026-10-14"
AUTO = "QA scripts (Claude)"
REVIEW = "Build review (Claude)"
P, IP, NS, BL, NA = "Pass", "In progress", "Not started", "Blocked", "N/A"

def r(status, evidence, tester=AUTO):
    return (status, tester, evidence)

PF = {
 "AC-PF-01": r(P, "b2: partner form + QR code carry source; b5-features: fax entry REF routed with source fields; b4: Impact shows 100% known source."),
 "AC-PF-02": r(P, "b2 'organization prefilled and locked from code' (GCS-NC-2026); b4 guided step 6."),
 "AC-PF-03": r(P, "b2 'marketing sees Access restricted on a referral' + audit entry; b4 Impact funnel by source (aggregates only)."),
 "AC-PF-04": r(P, "b5: 5/5 handoffs visible in Dana's queue in 365-469 ms (click to row), 'Just arrived' highlight (b2)."),
 "AC-PF-05": r(P, "b2: REF-NC-24806 overdue + Ray escalation notification + reassign offer; due-soon amber clock on REF-NC-24811."),
 "AC-PF-06": r(P, "b2 'clock stopped after first contact', tracker to Contacted, referrer notice."),
 "AC-PF-07": r(P, "b5-features: Priya sets ACT to Waitlist (Update > Waitlist > Save); Maria notified; finder marks '(Waitlist: paused)' and hides targets; b3 hide paused programs; nurture journeys pause."),
 "AC-PF-08": r(P, "b2 'warm redirect in two clicks with honest notice' (Demo Inbox)."),
 "AC-PF-09": r(P, "b5-features: Adolescent Substance Use shows 'Not confirmed in 9 days'."),
 "AC-PF-10": r(P, "b5-features: dashboard > Gatekeeper Finder > score opens plain-language Why (2 clicks)."),
 "AC-PF-11": r(P, "b5-features: draft in 3.8 s with organization sources; b3 brief with 'Simulated model' label."),
 "AC-PF-12": r(P, "b5-features: merger alert with 'Source: NC DHHS public notice', quiet sources and the week plan on Maria's dashboard."),
 "AC-PF-13": r(P, "b3 'Kintegra turns warm with talking points' (fast-forward, Warm: call now task + notification)."),
 "AC-PF-14": r(P, "b3 JR-15.03 visit on timeline + activity for Lena; b3 Maria's actions in Lena's team activity."),
 "AC-PF-15": r(NS, "Needs people: hallway test with 3 people on Oct 18-19 (DD-06).", ""),
 "AC-PF-16": r(P, "b2: confirmation shows reference only; PHI-free Demo Inbox email with signed status link."),
 "AC-PF-17": r(P, "b2: school sees Received/Contacted only; hospital with release unlocks Tier 2; Part 2 locks Tier 2 (consent simulator)."),
 "AC-PF-18": r(P, "b2 'partner hub lists referrals incl. the new one' with median time to first contact."),
 "AC-PF-19": r(P, "b5-features: Foster Pipeline shows stages, 24-hour clock, labelled Release 3 preview."),
 "AC-PF-20": r(P, "b5-features: Program Catalog shows owner and verified date; export logged (b5-features directory/catalog)."),
 "AC-PF-21": r(P, "b5-features: Vaya merger with public source on Lena's and Maria's dashboards; Relationship Events page cites source."),
 "AC-PF-22": r(P, "b3 'content idea approved into calendar' (audience ideas with why now)."),
 "AC-PF-23": r(P, "b3 PHI guard blocks pasted client details + audit; b4 Ask refuses 'Show me Avery's referral', logged as blocked without the text."),
 "AC-PF-24": r(P, "b5-features: no send button anywhere; amber 'Approve and queue' only, with name and time (b3)."),
 "AC-PF-25": r(P, "b2 Privacy X-ray on a referral; b4 Impact X-ray panel: counts and status codes only."),
 "AC-PF-26": r(P, "b5: after 5 guided runs the audit has sign-ins, views, changes, blocked attempts; scan for Avery / 555 / ages found 0."),
 "AC-PF-27": r(P, "b5-features: Trust and Security names AWS under the BAA, two zones, controls; b4 pilot 'Runs on what Clarvida already has'."),
 "AC-PF-28": r(P, "b3 'Jon's map has no North Carolina organizations'; b1 scope checks."),
 "AC-PF-29": r(P, "b3: 10-mile ring, POI card, 4-stop route with drive time, OSM attribution. Offline: map notice, pins/rings/list still work (b5). Tiles verified on a real browser via the hosted build."),
 "AC-PF-30": r(P, "b5-features + b3: need vs capacity and county heat for Lena; counts under 11 shown as '<11'; no point-level referral data."),
}

WC = {
 "AC-WC-01": r(P, "b4: pilot page R0 weeks 0-8, R1 6-16, 90-day pilot on existing AWS/SSO/CRM; Trust 'What is simulated'."),
 "AC-WC-02": r(P, "b5: handoff 5/5 under 1 s (365-469 ms); clock running and referrer notified (b2). Screen recording of rehearsal still to make (DD-08)."),
 "AC-WC-03": r(P, "Why breakdown (b5-features), blocked PHI paste (b3), named approval (b3), audit entries (b5)."),
 "AC-WC-04": r(IP, "Automated: 5 consecutive guided runs, each step ready in under 2 s, 3-minute cut and presenter window work (b4/b5). Open: 3 timed rehearsals by 2 presenters (DD-07)."),
 "AC-WC-05": r(P, "b4: ROI sliders each labelled with source or 'Placeholder until Clarvida baseline'; scorecard; tie to 180,000 by 2030."),
 "AC-WC-06": r(P, "b5: no developer codes, IDs or filler in the default UI on 45 pages; IDs only in Explain mode; switch/approve in 2-3 clicks."),
 "AC-WC-07": r(P, "Two zones, Privacy X-ray, consent simulator, synthetic notice on every page (b2, b4, b5)."),
 "AC-WC-08": r(P, "No send without approval (b5-features); warm handoff makes the call (b3); Trust page: no AI voice/SMS."),
 "AC-WC-09": r(P, "b4 pilot: readiness gates (Business Transformation, Compliance and Legal, Information Security) with signers."),
 "AC-WC-10": r(P, "Brand sheet rows pass (tokens, Montserrat, logo, amber CTA, chips, charts)."),
 "AC-WC-11": r(P, "Feels Real sheet: all Must rows pass."),
 "AC-WC-12": r(IP, "Built: judge presses Send referral (partner window), drives consent simulator, moves ROI slider as read-only Guest Judge (b4). Open: rehearse with a stand-in judge."),
 "AC-WC-13": r(BL, "Ask panel shows scope (NC + CO), metrics and go/no-go at pilot week 13. Funding amount waits for Clarvida (OQ-02, DD-02)."),
 "AC-WC-14": r(P, "Story opens with 'Referrals is already in Clarvida's main menu' and the 180,000-by-2030 goal (b4)."),
 "AC-WC-15": r(P, "Every figure sourced or labelled synthetic/placeholder; Sources list on the pilot page (b4); no uplift promised."),
 "AC-WC-16": r(IP, "Offline run and one-click reset pass (b5: 5 runs, reset 0.3-0.4 s, map offline notice). Open: backup video (DD-08) and second device (DD-14)."),
 "AC-WC-17": r(NS, "Proof screens exist for every question (see Judges Q&A sheet); rehearsal not yet done (DD-09).", ""),
 "AC-WC-18": r(P, "Guided story follows Maria and Jordan; family stays anonymous; Pace et al. 2018 line on the story page."),
 "AC-WC-19": r(P, "b5: no overflow at 1920x1080 / 1366x768 / 390 px, pages settle in 553 ms max, zero console errors, no placeholder text."),
 "AC-WC-20": r(P, "b4 pilot: 30-minute training, state champions, 80% weekly active use target."),
}

FR = {
 "AC-FR-01": r(P, "b5: all 11 accounts sign in with password + Demo Authenticator MFA; b1 dashboards per role."),
 "AC-FR-02": r(P, "b1 'non-revealing message'."),
 "AC-FR-03": r(P, "Unit test: current and previous 30 s code accepted, older rejected; b1 wrong code rejected."),
 "AC-FR-04": r(P, "b1 lockout after 5 failures with countdown + audit."),
 "AC-FR-05": r(P, "b1 reset via Demo Inbox; new password works, old doesn't."),
 "AC-FR-06": r(P, "b1 SSO chooser (Clarvida-branded) continues to MFA."),
 "AC-FR-07": r(P, "b1 welcome shown only once; replay in Settings."),
 "AC-FR-08": r(P, "b1 greeting by first name, office, territory, 'Last signed in'."),
 "AC-FR-09": r(P, "b5-features: 9 distinct dashboards (8 staff + judge)."),
 "AC-FR-10": r(P, "b3 Jon sees zero NC; b2 Alex blocked from referral records."),
 "AC-FR-11": r(P, "b5: 'Mark all read' and approvals persist after reload and sign-out/sign-in (b1 per-account memory)."),
 "AC-FR-12": r(P, "b2/b3: Maria's approval and visit appear in Lena's feed; cross-window handoff under 1 s (b5)."),
 "AC-FR-13": r(P, "b5: Maria's unread 4→0 persists; Dana's unread untouched; b2 escalation to Ray only."),
 "AC-FR-14": r(P, "b5: 11 system emails after a guided run, each addressed and labelled 'sent via'."),
 "AC-FR-15": r(P, "b5: every page settles from skeleton within 553 ms; mock API 150-600 ms."),
 "AC-FR-16": r(P, "b5: all seed timestamps relative to now; none older than 400 days."),
 "AC-FR-17": r(P, "b5-features: Idle test shows the warning; sign-in page explains (b1). Demo default 15 min (decision logged)."),
 "AC-FR-18": r(P, "b1 Back after sign-out returns to sign-in."),
 "AC-FR-19": r(P, "b1 Maria on /app/audit sees Access restricted + audit entry."),
 "AC-FR-20": r(P, "b5-features: profile, password, sessions, notification channels, reset my account."),
 "AC-FR-21": r(P, "b5: 'Your account is disabled. Contact your administrator.' shown; b4 admin disable."),
 "AC-FR-22": r(P, "b5 polish sweep of 45 pages: no lorem, TODO, IDs or developer codes in the default UI."),
 "AC-FR-23": r(P, "Seed review: first names marked (synthetic), 555-01xx phones, .example emails, organizations labelled illustrative."),
 "AC-FR-24": r(P, "b5-features: avatar menu > face = 2 clicks, no MFA; guided demo switches automatically (b4/b5)."),
 "AC-FR-25": r(P, "b2 specific inline errors ('Enter a 10-digit phone number')."),
 "AC-FR-26": r(P, "b3: OpenStreetMap tiles with clustering, zoom and attribution on Map Explorer and finder. Visual check of street tiles on the hosted build (QA sandbox has no internet)."),
 "AC-FR-27": r(P, "b3 location read once at check-in, distance to site; deny falls back to address/demo location."),
}

BR = {
 "AC-BR-01": r(P, "b5: all 11 brand tokens match the Brand Market Kit hex values."),
 "AC-BR-02": r(P, "b5: Montserrat 400/500/600/700 bundled locally, body 16 px / 1.5, headings weight 500, sentence case."),
 "AC-BR-03": r(P, "Visual review: colour logo on white (sign-in, partner, story), white logo on teal/navy bars only, 140 px minimum.", REVIEW),
 "AC-BR-04": r(P, "Amber pill with dark label and chevron for the main action (Sign in, Send referral, Approve and queue, Start the demo).", REVIEW),
 "AC-BR-05": r(P, "Status chips: Received light sky, In review sky, Contacted teal, Closed charcoal outline; amber only near breach (b2).", REVIEW),
 "AC-BR-06": r(P, "Charts use the blue ramp with one amber highlight for time to first contact; every chart has a Chart/Table switch.", REVIEW),
 "AC-BR-07": r(P, "40 px panels, 16 px cards, pill buttons; sun circle and sky shape as decoration only.", REVIEW),
 "AC-BR-08": r(P, "b5 axe (WCAG 2.2 AA) on 45 pages, desktop + phone: zero serious/critical issues including contrast."),
 "AC-BR-09": r(P, "Sun circle empty/success states with the hopeful line (notifications, queues).", REVIEW),
 "AC-BR-10": r(P, "Only Brand Kit photography (hero family); no client faces, names or case details.", REVIEW),
 "AC-BR-11": r(P, "Copy review: plain, hopeful, 'we'/'you', no acronyms in headlines.", REVIEW),
 "AC-BR-12": r(P, "Partner form: white 40 px card on Pale Ice, Montserrat labels, one amber 'Send referral ›' (b2).", REVIEW),
 "AC-BR-13": r(P, "Teal header with white logo; drafts on Pale Ice; amber Approve; Edit as a teal link (b3).", REVIEW),
 "AC-BR-14": r(P, "Story page: 54,000 clients, 4,600 employees, 16 states, 94%, 180,000 by 2030, marked self-reported with date."),
 "AC-BR-15": r(BL, "Waiting for the brand owner to confirm ® vs ℠ (DD-04); logo used as supplied.", ""),
 "AC-BR-16": r(P, "b5: no 'Claravida' or 'Clarivida' in the app source or UI."),
 "AC-BR-17": r(P, "Muted basemap filter, pins in the blue ramp by stage, amber selection, logo symbol for offices, Montserrat legend (b3).", REVIEW),
}

NF = {
 "AC-NF-01": r(P, "b5: page changes settle in 553 ms max incl. simulated latency; reset+first load 0.3-0.4 s (local build). Re-time on the pitch laptop."),
 "AC-NF-02": r(P, "b5: 5 timed handoffs 365-469 ms."),
 "AC-NF-03": r(P, "b5: 5 guided runs with map tiles failing: demo completes, zero other external requests. Only external host is tile.openstreetmap.org (user decision, B3)."),
 "AC-NF-04": r(IP, "Chromium (Chrome engine) automated. Open: manual pass on Edge, Safari iOS and Chrome Android.", ""),
 "AC-NF-05": r(P, "b5: 45 pages × 1920x1080, 1366x768, 390 px with no horizontal scroll."),
 "AC-NF-06": r(P, "b5 axe: zero serious/critical on 45 pages, desktop + phone; kb.js focus visible on every tabbable element."),
 "AC-NF-07": r(P, "b5 network log: no analytics, trackers, cookies or third-party scripts; synthetic data only."),
 "AC-NF-08": r(P, "b5 code search: demo password only on the Demo accounts card (and README); credentials stored as salted SHA-256 hashes."),
 "AC-NF-09": r(P, "b5: 5 consecutive guided runs without failures; reset 293-399 ms."),
 "AC-NF-10": r(P, "b5: zero console errors across all pages and 5 guided runs."),
 "AC-NF-11": r(P, "b5: storage blocked → app runs in memory and says so."),
 "AC-NF-12": r(P, "b5: older stored version re-seeds automatically."),
 "AC-NF-13": r(P, "README: npm install, npm run dev / npm run build + npm start; demo accounts, reset, guided demo, QA."),
 "AC-NF-14": r(IP, "tsc --strict clean, 55 unit tests; mock services in src/mock-api. Lint: 0 errors, 26 advisory React Compiler warnings left.", ""),
 "AC-NF-15": r(P, "b4/b5 Playwright: 13 guided steps (×5) and 11 sign-ins pass; run-all.js runs b1-b5."),
 "AC-NF-16": r(NA, "Superseded by user decision (Oct 14, B3): plain OpenStreetMap tiles, no bundled PMTiles extract. Attribution on every map; no bulk prefetch; offline shows a notice and pins/rings/list still work."),
 "AC-NF-17": r(P, "b3: location read only at check-in with permission; no background tracking; referrals shown as county aggregates only."),
}

QA_PROOF = {
 "Q-01": "PG-20 The ask + scorecard (b4).", "Q-02": "PG-20 timeline R0/R1 + PG-24 (b4).", "Q-03": "PG-09 blocked paste (b3), PG-15 X-ray (b2).",
 "Q-04": "PG-09 approval (b3), PG-23 prompt versions (b5-features).", "Q-05": "PG-06 My Week (b5-features).", "Q-06": "Story + pilot sources: Pace et al. 2018.",
 "Q-07": "PG-16 statewide platform channel (b5-features), PG-24.", "Q-08": "PG-15 consent simulator (b2).", "Q-09": "Synthetic notice on every page; PG-24.",
 "Q-10": "PG-20 go/no-go week 13.", "Q-11": "PG-25 routing table + second approver (b4).", "Q-12": "PG-09 send-cap meter + footer (b5-features).",
 "Q-13": "PG-20 adoption plan.", "Q-14": "PG-14 clock, PG-15 redirect (b2).", "Q-15": "PG-20 ask (amount placeholder, OQ-02).", "Q-16": "PG-35 check-in (b3), PG-24.",
}

DD = {
 "DD-05": r(IP, "Release candidate 3.0.0-rc1 built 2026-10-14; all automated checks pass. Formal freeze Oct 19, 5 pm.", ""),
 "DD-11": r(IP, "Offline behaviour verified by script (b5); repeat on the pitch laptop with Wi-Fi off.", ""),
 "DD-13": r(IP, "Reset demo verified (0.3-0.4 s, b5); do it again before going on stage.", ""),
}

FT_EVID = {
 "FT-001": "b1", "FT-002": "b1 SSO", "FT-003": "b1 + unit test", "FT-004": "b1 remembered device", "FT-005": "b1 lockout", "FT-006": "b1 reset",
 "FT-007": "b1 welcome once", "FT-008": "b1/b2 Access restricted + audit", "FT-009": "b3 Jon NC-free; b5 role pages", "FT-010": "b5-features Idle test (demo default 15 min, decision logged)",
 "FT-011": "b5-features switch in 2 clicks", "FT-012": "b5-features sessions list + sign out others", "FT-013": "b1 last sign-in line", "FT-014": "b1/b5 per-account memory persists",
 "FT-020": "visual review + b5 polish sweep", "FT-021": "src/mock-api latency 150-600 ms; b5 load timing", "FT-022": "b5-features toast + Undo", "FT-023": "b5 relative dates",
 "FT-024": "b5 handoff < 1 s", "FT-025": "notice on every page (b5 sweep)", "FT-026": "b5 reset 0.3 s; Settings > Reset my account", "FT-027": "b5-features search finds REF-NC-24811",
 "FT-028": "b5 390 px on 45 pages", "FT-029": "b5: fonts, logos, QR bundled; only OSM tiles external", "FT-030": "sun empty/success states (review)",
 "FT-040": "b5-features 9 dashboards", "FT-041": "b1 greeting", "FT-042": "b5-features tasks complete with Undo; snooze", "FT-043": "b5-features alerts", "FT-044": "b2/b3 team activity",
 "FT-045": "b5-features KPI trend", "FT-050": "b5-features Why", "FT-051": "b3 filters + hide paused", "FT-052": "b3 finder map panel", "FT-053": "b5-features directory + export logged",
 "FT-054": "b3 brief", "FT-055": "b5-features draft 3.8 s", "FT-056": "b3 approve + Demo Inbox", "FT-057": "b3/b4 PHI guard + Ask refusal", "FT-058": "b5-features send cap + footer",
 "FT-059": "b5-features paused program blocked", "FT-060": "b5-features contacts verified", "FT-061": "b3 log visit + follow-up task", "FT-062": "b3 nurture approve steps", "FT-063": "b3 warm handoff",
 "FT-064": "b3 content ideas", "FT-065": "b4 publish event; b5-features source", "FT-066": "b2 kit link/QR prefill", "FT-067": "b5-features next action",
 "FT-080": "b2 partner form", "FT-081": "b5-features Spanish", "FT-082": "b2 inline errors, no trackers", "FT-083": "b2 reference-only confirmation", "FT-084": "b2 routing; b5-features fax routed",
 "FT-085": "b5-features duplicate flag", "FT-086": "b2 clock states", "FT-087": "b2 escalation + reassign", "FT-088": "b2 contact attempts", "FT-089": "b2 status machine", "FT-090": "b2 tracker both sides",
 "FT-091": "b2 Tier 1/Tier 2", "FT-092": "b2 consent simulator", "FT-093": "b2/b4 X-ray", "FT-094": "b2 notices", "FT-095": "b5-features fax entry", "FT-096": "b2 next best call",
 "FT-097": "b2 partner hub", "FT-098": "b2 warm redirect", "FT-110": "b5-features one-dialog update", "FT-111": "b5-features pause + named notification", "FT-112": "b5-features stale flag",
 "FT-113": "b5-features catalog", "FT-120": "Impact: referred, first contact, intake scheduled, reached intake by source; NC/CO filter (table view + CSV)", "FT-121": "b4 Today vs With", "FT-122": "Impact: 'Reached intake 60% (94 of 156 families)' counts families who reached intake", "FT-123": "Impact source health: sparklines + 'Used to send about 5 a month; none since August'",
 "FT-124": "b3/b5 '<11'", "FT-125": "b4 Ask answers + refuses", "FT-126": "b4 ROI sliders with sources", "FT-127": "b4 scorecard + ask", "FT-128": "b4 amber time-to-first-contact",
 "FT-140": "b5 audit coverage", "FT-141": "b5-features AI governance", "FT-142": "b4/b5-features trust", "FT-143": "b4 enable/disable, routing, caps", "FT-144": "b4 second approver",
 "FT-150": "b5 notifications per account", "FT-151": "b5-features channels", "FT-152": "b5 Demo Inbox", "FT-153": "b5-features Monday briefing", "FT-160": "b4/b5 13 steps × 5",
 "FT-161": "b4 presenter window", "FT-162": "b4 story", "FT-163": "b5 live sandbox", "FT-164": "b5-features scenario launcher", "FT-165": "Guest Judge read-only (b1), moves ROI sliders (b4), judge pages pass at 390 px (b5). Hosting decision open (DD-03)",
 "FT-170": "b3 OSM tiles + attribution", "FT-172": "b3 POIs + clusters", "FT-173": "b3 rings + 10-mile filter", "FT-174": "b3 drive time + bands", "FT-175": "b3 check-in",
 "FT-176": "b3 route planner", "FT-177": "b3 heat", "FT-178": "b5-features need vs capacity", "FT-179": "b2/b3 offices + nearest office", "FT-180": "b3 coverage gaps", "FT-181": "b4 flow chart + table",
 "FT-182": "b5-features: in the Live sandbox, counties with new referrals pulse amber on the Map Explorer (county only)",
}
FT_SPECIAL = {
 "FT-171": r(NA, "Superseded by user decision (Oct 14, B3): plain OpenStreetMap tiles instead of an offline extract. Offline: notice shown; pins, rings, routes and the list still work (b5)."),
}

def fill(ws, status_col, mapping, default=None):
    hdr = [c.value for c in ws[4]]
    sc = hdr.index("Status") + 1
    rows = 0
    for row in ws.iter_rows(min_row=5):
        rid = row[0].value
        if not rid:
            continue
        val = mapping.get(rid) if mapping else None
        if val is None and default:
            val = default(rid)
        if val is None:
            continue
        status, tester, ev = val
        ws.cell(row=row[0].row, column=sc).value = status
        ws.cell(row=row[0].row, column=sc + 1).value = tester or None
        ws.cell(row=row[0].row, column=sc + 2).value = DATE if tester else None
        ws.cell(row=row[0].row, column=sc + 3).value = ev
        rows += 1
    return rows

wb = openpyxl.load_workbook(SRC)
n = {}
n["Problem Fit"] = fill(wb["Problem Fit"], None, PF)
n["Win Conditions"] = fill(wb["Win Conditions"], None, WC)
n["Feels Real"] = fill(wb["Feels Real"], None, FR)
n["Brand"] = fill(wb["Brand"], None, BR)
n["Non-Functional"] = fill(wb["Non-Functional"], None, NF)
n["Feature Checklist"] = fill(wb["Feature Checklist"], None, FT_SPECIAL, lambda rid: r(P, FT_EVID[rid]) if rid in FT_EVID else None)
n["Judges Q&A"] = fill(wb["Judges Q&A"], None, None, lambda rid: r(IP, f"Proof screen verified: {QA_PROOF[rid]} Open: rehearse the answer with its owner (DD-09).", AUTO) if rid in QA_PROOF else None)
n["Demo Day"] = fill(wb["Demo Day"], None, DD)
wb.save(OUT)
print(n)
