# Clarvida Referral Co-Pilot — Shark Tank prototype v3

Branded, account-based prototype for Clarvida's internal Shark Tank (pitch **Wed Oct 21, 2026**, freeze **Mon Oct 19, 5 pm**).
No database: everything runs in the browser on **synthetic data**, but the business rules run for real.
Built on the v2 prototype (`5 - Final Application/Clarivida Prototype`, kept untouched as the fallback).

Build documents (the checklist): `3 - Data intake/Shark Tank - Clarivida Build out documents/` — BRD, User Journey Workflow (Word + Excel), Acceptance Criteria workbook.

## Run it

Requires Node.js 22+.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static site in ./out (works offline)
npm start          # serves ./out at http://localhost:3000
```

Deploy: Netlify via GitHub. `netlify.toml` is included (build `npm run build`, publish `out`, Node 22).

## Demo accounts

All accounts use the password **Brighter2026!** (shown only here and on the sign-in page's Demo accounts card).
MFA codes come from the in-app **Demo Authenticator** (new code every 30 seconds).
Emails use the reserved `.example` domain, so nothing can reach a real inbox.

| ID | Name | Role | Email | Lands on |
|---|---|---|---|---|
| ACC-01 | Maria Reyes | Brand Ambassador (NC) | maria.reyes@clarvida.example | My Week |
| ACC-02 | Jon Whitaker | Brand Ambassador (CO) | jon.whitaker@clarvida.example | My Week |
| ACC-03 | Lena Ortiz | Ambassador Lead | lena.ortiz@clarvida.example | Team |
| ACC-04 | Dana Kim | Intake Coordinator | dana.kim@clarvida.example | Today's queue |
| ACC-05 | Ray Mendez | Intake Supervisor | ray.mendez@clarvida.example | Team SLA |
| ACC-06 | Priya Shah | Program Manager | priya.shah@clarvida.example | Capacity |
| ACC-07 | Alex Morgan | Marketing Lead | alex.morgan@clarvida.example | Impact |
| ACC-08 | Sam Patel | Compliance Officer | sam.patel@clarvida.example | Governance |
| ACC-09 | Chris Lee | Administrator | chris.lee@clarvida.example | System |
| ACC-10 | Jordan Carter | Referral Partner | jordan.carter@gcs.example | Partner hub |
| ACC-11 | Guest Judge | Shark Tank Judge (read-only) | judge@clarvida.example | Executive overview |

## Using the demo

- **Sign in** at `/` with email + password (or "Sign in with Clarvida SSO"), then the 6-digit code. Tick "Remember this device" to skip the code for 30 days.
- **First sign-in** shows a 3-step welcome once per account (replay from Profile and Settings).
- **Guided demo:** "Run the guided demo" on the sign-in page or the **Demo** menu in the top bar.
- **Switch account:** avatar menu → Switch account (2 clicks, no MFA; demo convenience).
- **Reset:** "Reset demo" on the sign-in page or Demo menu resets everything. Profile and Settings → Demo account → "Reset my account" resets only your preferences.
- **Idle test:** Demo menu → Idle test shows the automatic sign-out warning.
- **Explain mode:** Demo menu → shows page and feature IDs (hidden by default).
- Data lives in browser storage (`cv-proto-v3`); each browser has its own copy. Two windows of the same browser stay in sync within a second.

## Maps

Maps use **OpenStreetMap** through Leaflet: street tiles load from `tile.openstreetmap.org` (needs internet; light, interactive use with the required "© OpenStreetMap contributors" attribution). Everything on top of the map is prototype data: organization pins, offices, rings, routes, visits and county demand. Organization positions are illustrative and placed from each organization's stored distance and bearing from its office. Without internet the map shows a notice and the markers still work. Client locations are never mapped.

## Project layout

| Path | What |
|---|---|
| `src/app/(entry)` | Sign-in `/`, MFA `/login/verify`, reset `/login/forgot`, welcome `/welcome`, opening scene `/story`, sandbox `/live` |
| `src/app/(app)/app` | Signed-in pages; `/app` is the role-aware dashboard |
| `src/app/(partner)/partner` | Partner portal: refer, confirmation, status, hub |
| `src/mock-api/` | Simulated REST API (latency 150–600 ms, scope filter, `useApi`) — swap for the Laravel API in production |
| `src/lib/services/` | Business actions (auth, account, referrals, outreach, admin) |
| `src/lib/rules/` | Business rules with unit tests |
| `src/lib/data/` | Synthetic seed (accounts, inbox, activity, organizations, referrals) |
| `src/lib/access.ts` | Page registry = Access Matrix (User Journey workbook) |
| `src/lib/dashboard.ts` | Role dashboard KPIs, alerts and tasks |
| `src/lib/rules/economics.ts` | Time-saved model behind Time and Value and Teams and Access (no cost or pricing in the app) |
| `src/lib/data/org.ts` | Company structure (16 states, regions, city offices), positions and `visibleTo()` for Teams and Access |
| `public/brand/` | Clarvida logos and Brand Kit photo (bundled; no external requests) |
| `qa/` | Browser checks (Playwright) |

## Checks

```bash
npm test              # unit tests
npm run typecheck
npm run build
cd qa && npm install  # first time
node server.js ../out 4310 &   # serve the build
node b1-accounts.js            # Batch 1: accounts, sign-in, MFA, welcome, dashboards, lockout, reset, access
node b2-care.js                # Batch 2: partner form → intake → referral → status, consent, X-ray, redirect, escalation
node b3-outreach.js            # Batch 3: Map Explorer, finder map, brief/draft/PHI/approve, nurture, content, scope
node b4-insights.js            # Batch 4: story, 14-step guided demo, presenter window, impact Ask/X-ray, pilot, admin approvals, audit
node b5-acceptance.js          # Batch 5: 45 pages × 3 screens, axe, 5 timed handoffs, 5 guided runs offline, reset, privacy, storage, brand
node b5-features.js            # Batch 5: feature spot checks (capacity pause, fax entry, duplicates, Spanish, settings, idle, live map)
node b7-journey.js              # Batch 8: 'Follow one referral' tour through all 11 accounts (page, account, chip, highlight); screenshots in qa/shots/b7
node b6-management.js          # Batch 6/7: Teams and Access, Time and Value (no pricing), Where Referrals Come From, Questions and Answers ('Show me'), axe, phone, role gates
```

Or run everything in one go (starts its own server): `cd qa && npm run qa` (about 15 minutes).
`qa/fill_ac.py` writes the results into a copy of the Acceptance Criteria workbook. Old v2 scripts are in `qa/legacy-v2/` for reference only.

## Build status

| Batch | Scope | Status |
|---|---|---|
| B1 | Foundation: brand system, 11 accounts, sign-in, SSO chooser, MFA + Demo Authenticator, remembered devices, lockout, password reset, welcome, role dashboards, mock API, notifications, Demo Inbox, settings, partner hub, reset | Done (Oct 14) |
| B2 | Care loop: branded partner form (specific errors, nearest office, sample fill), reference-only confirmation, signed status links, live handoff, intake queue with next best call, brand response clock, referral detail, warm redirect, escalation + reassign, referrer notices and team activity | Done (Oct 14) |
| B3 | Outreach and maps: OpenStreetMap Map Explorer (POIs by stage, clustering, 5/10/25-mile rings, drive times, route planner, location check-in, referral heat, coverage gaps, need vs capacity), finder with map, organization (log visit/call, check-in, approvals in Demo Inbox), Nurture Journeys with warm handoff, Content and Webinar Ideas | Done (Oct 14) |
| B4 | Insights, governance and presentation: Before/After story, guided demo with account switching (14 steps since B7), presenter window (timer, 3-minute cut, fallbacks), Impact Dashboard (Privacy X-ray, source-to-intake flow, Ask refusal), Impact and Pilot (ROI sliders the judge can move, scorecard, the ask, readiness gates, sources), Trust and Security (what is simulated), two-person approval with notifications | Done (Oct 14) |
| B5 | QA against the Acceptance Criteria workbook: 170 automated checks, filled AC workbook, release candidate 3.0.0-rc1 | Done (Oct 14) |
| B6 | Management Q&A: Teams and Access PG-36 (hierarchy bottom up, 16 states / 3 regions / city offices, see-what-someone-sees, visibility matrix) and Time and Value PG-37 (time saved per role/user/state) | Done (Oct 16) |
| B7 | Referral origin and Q&A: Where Referrals Come From PG-38 (who refers, how a referral starts today from Clarvida's own materials, 5 channels into one queue, lifecycle, ambassador's role), guided demo step 2 (now 14 steps, 5:30), Questions and Answers PG-39 (20 questions with 'Show me' as the right account), Demo menu scenarios (phone referral, who sees what); pricing removed from the app | Done (Oct 17) |
| B8 | It starts with a referral: opening page shows a partner referral being filled in and sent (animated, reduced-motion safe); 'Follow one referral through every account' tour (13 steps, Jordan > Dana > Ray > Priya > Jordan > Maria > Lena > Jon > Alex > Sam > Chris > leadership); 'Now viewing as' chip and account strip in the demo bar for both tours; fix: page state reset when the account changes (an ambassador briefly kept the previous ambassador's plan) | Done (Oct 17) |

## Before the pitch (people, not code)

Open items from the Acceptance Criteria workbook that need the team or Clarvida: funding amount (OQ-02), the three baselines, trademark ® vs ℠, hallway test (Oct 18-19), three timed rehearsals by two presenters, Q&A rehearsal, backup video, second device, a manual pass on Edge / Safari iOS / Chrome Android, and a look at the street tiles on the hosted build.
