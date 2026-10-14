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
```

## Build status

| Batch | Scope | Status |
|---|---|---|
| B1 | Foundation: brand system, 11 accounts, sign-in, SSO chooser, MFA + Demo Authenticator, remembered devices, lockout, password reset, welcome, role dashboards, mock API, notifications, Demo Inbox, settings, partner hub, reset | Done (Oct 14) |
| B2 | Care loop: partner form, confirmation, status, intake queue, referral detail, clock, consent simulator, X-ray, referrer notices | Next |
| B3 | Outreach and maps: Map Explorer (OpenStreetMap), finder, directory, organization, nurture, kits, capacity, events | |
| B4 | Insights, governance, opening scene, guided demo, presenter window | |
| B5 | QA against the Acceptance Criteria workbook and freeze | |
