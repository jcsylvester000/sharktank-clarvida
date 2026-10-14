// Batch 3 checks: Map Explorer (OpenStreetMap), finder map, organization brief/draft/PHI/approve, nurture, content, scope.
// OSM tiles are stubbed with a blank tile here (the QA sandbox has no internet); in the browser they load from tile.openstreetmap.org.
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.argv[2] || "http://localhost:4310";
const SHOTS = __dirname + "/shots/b3";
fs.mkdirSync(SHOTS, { recursive: true });
const PW = "Brighter2026!";
const results = [];
const ok = (name, pass, detail = "") => { results.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`); };
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64");

async function signIn(p, email) {
  await p.evaluate(() => sessionStorage.removeItem("cv-session")).catch(() => {});
  await p.goto(BASE + "/");
  await p.fill("#email", email);
  await p.fill("#password", PW);
  await p.click('button[type=submit]:has-text("Sign in")');
  await p.waitForURL(/login\/verify|\/app\/|\/welcome/, { timeout: 8000 });
  if (p.url().includes("/login/verify")) { await p.click("text=Open the Demo Authenticator"); await p.click('button:has-text("Use this code")'); await p.waitForURL(/\/app\/|\/welcome/, { timeout: 8000 }); }
  if (p.url().includes("/welcome")) {
    await p.click('button:has-text("That\'s me")'); await p.click('button:has-text("Save and continue")');
    await p.check("text=I agree to the privacy pledge."); await p.click('button:has-text("Go to my")'); await p.waitForURL(/\/app\//, { timeout: 8000 });
  }
  await p.waitForTimeout(600);
}
const ls = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("cv-proto-v3") || "{}"));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, geolocation: { latitude: 35.2621, longitude: -81.1873 }, permissions: ["geolocation"] });
  let tiles = 0;
  await ctx.route("https://tile.openstreetmap.org/**", (r) => { tiles++; r.fulfill({ status: 200, contentType: "image/png", body: TILE }); });
  const errors = [], external = [];
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("request", (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith("https://tile.openstreetmap.org/")) external.push(u); });

  await p.goto(BASE + "/"); await p.evaluate(() => localStorage.clear());
  await signIn(p, "maria.reyes@clarvida.example");

  // Map Explorer
  await p.goto(BASE + "/app/map/");
  await p.waitForSelector(".leaflet-container", { timeout: 8000 });
  await p.waitForTimeout(1200);
  const pins = await p.locator(".cv-pin, .cv-cluster").count();
  ok("FT-172 organizations plotted as POIs (pins or clusters)", pins >= 6, `${pins}`);
  ok("FT-170 OpenStreetMap tiles requested with attribution", tiles > 0 && (await p.locator(".leaflet-control-attribution:has-text('OpenStreetMap')").count()) > 0, `${tiles} tiles`);
  ok("FT-179 Clarvida office on the map", (await p.locator(".cv-office-badge").count()) >= 1);
  ok("FT-173 radius rings drawn and labelled", (await p.locator(".cv-ring-label:has-text('10 mi')").count()) > 0);
  await p.screenshot({ path: SHOTS + "/01-map.png" });

  // Open a POI from the list (Gaston County DHHS)
  await p.click('aside button:has-text("Gaston County DHHS")');
  await p.waitForSelector('[data-guide="poi-card"]');
  const card = await p.textContent('[data-guide="poi-card"]');
  ok("JR-02.06 POI card: fit, 8-minute drive, last touch, owner", /Fit score/.test(card) && /8\s*min/.test(card) && /Maria Reyes/.test(card), "");
  await p.screenshot({ path: SHOTS + "/02-poi.png" });

  // Route: add 4 stops
  for (const name of ["Gaston County DHHS", "Kintegra Health", "Juvenile Court Counselors", "Head Start"]) {
    await p.click('[role=tab]:has-text("Explore")');
    const close = p.locator('[data-guide="poi-card"] button[aria-label="Close"]');
    if (await close.count()) await close.click();
    await p.click(`aside button:has-text("${name}")`);
    await p.click('[data-guide="poi-card"] button:has-text("Add to route")');
  }
  await p.click('[role=tab]:has-text("Route")');
  await p.click('button:has-text("Plan route")');
  await p.waitForTimeout(600);
  const mins = await p.textContent('[data-testid="route-minutes"]');
  ok("AC-PF-29 4-stop route ordered from the office with total drive time", (await p.locator('[data-guide="route"] li').count()) === 4 && /\d+ min/.test(mins), mins);
  ok("FT-176 route line and stop numbers on the map", (await p.locator(".cv-pin-order").count()) >= 4);
  await p.click('button:has-text("Save as field day")');
  await p.waitForTimeout(400);
  await p.screenshot({ path: SHOTS + "/03-route.png" });

  // Check in with real geolocation (granted, near office → far from DHHS) then demo location
  await p.click('[data-guide="route"] button[aria-label^="Check in at Gaston County DHHS"]');
  await p.click('button:has-text("Use my location")');
  await p.waitForTimeout(800);
  const geoMsg = await p.locator("[role=dialog] [role=status]").textContent();
  ok("FT-175 location read once and compared to the site", /miles/.test(geoMsg), geoMsg.slice(0, 80));
  await p.click('[data-guide="demo-location"]');
  await p.fill("#ci-note", "Met new care manager; send program list");
  await p.click('[role=dialog] button:has-text("Check in")');
  await p.waitForTimeout(600);
  let db = await ls(p);
  ok("AC-FR-27 visit recorded with distance from site", db.visits[0].orgId === "o1" && db.visits[0].distanceMi < 0.25);
  ok("JR-15.03 visit on the timeline + activity for Lena", db.touches[0].type === "Visit" && db.activity[0].text.includes("checked in"));

  // Layers
  await p.click('[role=tab]:has-text("Layers")');
  await p.locator('label:has-text("Referral heat by county")').click();
  await p.locator('label:has-text("Coverage gaps")').click();
  await p.locator('label:has-text("Need vs capacity")').click();
  await p.waitForTimeout(700);
  ok("FT-177 referral heat shows counties with small counts suppressed", /<11 referrals/.test(await p.textContent("main")));
  ok("FT-180 coverage gap named", /No pediatrics engaged within 10 miles of Gastonia/.test(await p.textContent('[data-guide="gaps"]')));
  await p.screenshot({ path: SHOTS + "/04-layers.png" });

  // Finder with map
  await p.goto(BASE + "/app/finder/");
  await p.waitForSelector(".leaflet-container", { timeout: 8000 });
  await p.waitForTimeout(800);
  ok("FT-052 finder shows an OpenStreetMap panel beside the ranked list", (await p.locator(".cv-pin").count()) > 3 && (await p.locator('[data-guide="finder"] tbody tr').count()) > 3);
  ok("FT-051 hide paused programs (ABA-only pediatrics hidden)", /hidden\)/.test(await p.textContent("main")));
  await p.screenshot({ path: SHOTS + "/05-finder.png" });

  // Organization: brief, draft, PHI block, approve
  await p.goto(BASE + "/app/organization/?id=o1");
  await p.waitForSelector("text=AI brief");
  await p.waitForTimeout(2500);
  ok("FT-054 brief with Simulated model label", (await p.locator("text=Simulated model").count()) > 0);
  await p.click('[role=tab]:has-text("Outreach")');
  await p.click('button:has-text("Draft outreach")');
  await p.waitForTimeout(4500);
  await p.click('[data-guide="paste-phi"]');
  await p.waitForTimeout(500);
  ok("FT-057 PHI guard blocks pasted client details", (await p.locator("text=Blocked: possible client details").count()) > 0);
  await p.screenshot({ path: SHOTS + "/06-phi.png", fullPage: true });
  const body = await p.inputValue("#o-body");
  await p.fill("#o-body", body.replace(/^Avery.*\n\n/, "").replace(/\n?Avery, age 9[^\n]*\n?/, ""));
  await p.waitForTimeout(300);
  await p.click('[data-guide="approve"]');
  await p.waitForTimeout(500);
  db = await ls(p);
  ok("FT-056 approval recorded and email in Demo Inbox (queued in approved CRM)", db.drafts.length === 1 && db.outbox.some((m) => m.type === "outreach" && /approved CRM/.test(m.sentVia) && m.relatedId === "o1"));
  ok("AC-PF-23 blocked attempt in audit log", db.audit.some((a) => a.category === "blocked" && a.actorId === "u-maria"));

  // Nurture
  await p.goto(BASE + "/app/nurture/");
  await p.click('[data-guide="enroll"]');
  await p.selectOption("#nj-org", "o5");
  await p.selectOption("#nj-prog", "p-nc-fct");
  await p.click('[role=dialog] button:has-text("Enroll")');
  await p.waitForTimeout(500);
  await p.locator('[data-guide="approve-step"]').first().click();
  await p.waitForTimeout(400);
  await p.locator('[data-guide="journey"]:has-text("Kintegra") [data-guide="fast-forward"]').click();
  await p.waitForTimeout(600);
  ok("AC-PF-13 Kintegra turns warm with talking points", (await p.locator('[data-guide="warm"]:has-text("Kintegra")').count()) === 1 && (await p.locator("text=Talking points for your call").count()) > 0);
  await p.screenshot({ path: SHOTS + "/07-nurture.png", fullPage: true });

  // Content (as Alex)
  await signIn(p, "alex.morgan@clarvida.example");
  await p.goto(BASE + "/app/content/");
  await p.waitForSelector('[data-guide="ideas"]');
  await p.locator('[data-guide="ideas"] button:has-text("Approve to calendar")').first().click();
  await p.waitForTimeout(300);
  ok("AC-PF-22 content idea approved into calendar", (await p.locator("text=approved by Alex Morgan").count()) > 0);
  await p.screenshot({ path: SHOTS + "/08-content.png", fullPage: true });

  // Scope: Jon sees CO only (AC-PF-28)
  await signIn(p, "jon.whitaker@clarvida.example");
  await p.goto(BASE + "/app/map/");
  await p.waitForSelector(".leaflet-container"); await p.waitForTimeout(800);
  const txt = await p.textContent("main");
  ok("AC-PF-28 Jon's map has no North Carolina organizations", !/Gaston/.test(txt) && /Colorado Springs/.test(txt));

  // Lena dashboard shows coverage gap alert and Maria's activity
  await signIn(p, "lena.ortiz@clarvida.example");
  const lt = await p.textContent("main");
  ok("FT-180 lead dashboard shows a coverage gap", /Coverage gap/.test(lt));
  ok("FT-044 Maria's actions in Lena's team activity", /Maria (checked in|approved an outreach|enrolled)/.test(lt), lt.match(/Recent team activity.{0,200}/)?.[0]);

  // Phone width map
  const ph = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ph.route("https://tile.openstreetmap.org/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: TILE }));
  const pp = await ph.newPage();
  await pp.goto(BASE + "/"); await signIn(pp, "maria.reyes@clarvida.example");
  await pp.goto(BASE + "/app/map/"); await pp.waitForSelector(".leaflet-container"); await pp.waitForTimeout(800);
  const sw = await pp.evaluate(() => document.documentElement.scrollWidth);
  await pp.screenshot({ path: SHOTS + "/09-phone-map.png", fullPage: true });
  ok("FT-028 map at 390 px without sideways scroll", sw <= 390, String(sw));

  ok("NF-10 no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  ok("NF-05 no third-party requests other than OpenStreetMap tiles", external.length === 0, external.slice(0, 3).join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
