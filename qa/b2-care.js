// Batch 2 checks: the care loop (partner form → intake → referral detail → referrer status), consent, X-ray, redirect, escalation.
// Usage: node b2-care.js [baseUrl]   (serve ../out first: node server.js ../out 4310)
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.argv[2] || "http://localhost:4310";
const SHOTS = __dirname + "/shots/b2";
fs.mkdirSync(SHOTS, { recursive: true });
const PW = require("./demo-password");
const results = [];
const ok = (name, pass, detail = "") => { results.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`); };

async function signIn(p, email) {
  await p.evaluate(() => sessionStorage.removeItem("cv-session")).catch(() => {});
  await p.goto(BASE + "/");
  await p.fill("#email", email);
  await p.fill("#password", PW);
  await p.click('button[type=submit]:has-text("Sign in")');
  await p.waitForURL(/login\/verify|\/app\/|\/welcome|\/partner\/hub/, { timeout: 8000 });
  if (p.url().includes("/login/verify")) {
    await p.click("text=Open the Demo Authenticator");
    await p.click('button:has-text("Use this code")');
    await p.waitForURL(/\/app\/|\/welcome|\/partner\/hub/, { timeout: 8000 });
  }
  if (p.url().includes("/welcome")) {
    await p.click('button:has-text("That\'s me")');
    await p.click('button:has-text("Save and continue")');
    await p.check("text=I agree to the privacy pledge.");
    await p.click('button:has-text("Go to my")');
    await p.waitForURL(/\/app\/|\/partner\/hub/, { timeout: 8000 });
  }
  await p.waitForTimeout(700);
}
const ls = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("cv-proto-v3") || "{}"));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const errors = [];
  const external = [];
  ctx.on("page", (pg) => {
    pg.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    pg.on("pageerror", (e) => errors.push(String(e)));
    pg.on("request", (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:")) external.push(u); });
  });
  const intake = await ctx.newPage();
  await intake.goto(BASE + "/");
  await intake.evaluate(() => localStorage.clear());
  await signIn(intake, "dana.kim@clarvida.example");
  await intake.goto(BASE + "/app/intake/");
  await intake.waitForSelector('[data-guide="queue"]');
  await intake.screenshot({ path: SHOTS + "/01-queue.png", fullPage: true });
  ok("FT-096 next best call shown", (await intake.locator('[data-guide="next-best-call"]').count()) === 1);

  // Partner window
  const partner = await ctx.newPage();
  await partner.goto(BASE + "/partner/refer/?code=GCS-NC-2026");
  await partner.waitForSelector('[data-guide="refer-form"]');
  // AC-FR-25: specific inline errors
  await partner.click('[data-guide="send-referral"]');
  await partner.waitForTimeout(300);
  const errs = await partner.locator('[role=alert]').allTextContents();
  ok("AC-FR-25 errors are specific, never 'Required'", errs.length > 2 && !errs.some((e) => e.trim() === "Required") && errs.some((e) => /10-digit/.test(e) || /age/.test(e)), errs.slice(0, 4).join(" | "));
  await partner.screenshot({ path: SHOTS + "/02-form-errors.png", fullPage: true });
  ok("AC-PF-02 organization prefilled and locked from code", (await partner.locator("text=Referring from Gaston County Schools").count()) > 0);
  await partner.click('[data-guide="fill-sample"]');
  ok("FT-179 nearest office shown for county", (await partner.locator("text=Nearest Clarvida office").count()) > 0);
  await partner.screenshot({ path: SHOTS + "/03-form-filled.png", fullPage: true });
  const t0 = Date.now();
  await partner.click('[data-guide="send-referral"]');
  await intake.waitForSelector("text=REF-NC-24818", { timeout: 5000 });
  const dt = Date.now() - t0;
  ok("AC-PF-04 referral lands in the intake queue within ~1 s", dt < 1500, `${dt} ms incl. simulated network`);
  ok("FT-084 'Just arrived' highlight", (await intake.locator("text=Just arrived").count()) > 0);
  await intake.screenshot({ path: SHOTS + "/04-arrived.png", fullPage: true });

  await partner.waitForURL(/confirmation/);
  await partner.waitForTimeout(400);
  const conf = await partner.textContent("main");
  ok("FT-083 confirmation shows reference only, no client details", /REF-NC-24818/.test(conf) && !/010-0388/.test(conf) && !/\bAlex\b/.test(conf));
  await partner.screenshot({ path: SHOTS + "/05-confirmation.png", fullPage: true });

  let db = await ls(intake);
  const mail = (db.outbox || []).find((m) => m.relatedId === "REF-NC-24818");
  ok("AC-PF-16 PHI-free confirmation in Demo Inbox with signed link", Boolean(mail) && /token=/.test(mail.link) && !/Alex|010-0388/.test(mail.body), mail && mail.subject);

  // Status page needs the signed link
  await partner.goto(BASE + "/partner/status/?ref=REF-NC-24818");
  await partner.waitForTimeout(500);
  ok("FT-091 status without signed link asks to verify", (await partner.locator("text=Confirm it's you").count()) > 0);
  await partner.goto(BASE + mail.link);
  await partner.waitForSelector('[data-guide="status"]');
  ok("PG-32 status opens with the signed link (Received)", (await partner.locator("text=Opened with a secure link").count()) > 0);

  // Dana logs the call
  await intake.goto(BASE + "/app/referral/?id=REF-NC-24818");
  await intake.waitForSelector('[data-guide="actions"]');
  await intake.click('button:has-text("Log contact attempt")');
  await intake.click('[role=dialog] button:has-text("Log attempt")');
  await intake.waitForTimeout(700);
  await intake.click('[data-guide="actions"] button:has-text("Accept")');
  await intake.waitForTimeout(700);
  await intake.screenshot({ path: SHOTS + "/06-referral-contacted.png", fullPage: true });
  ok("AC-PF-06 clock stopped after first contact", (await intake.locator("text=First contact in").count()) > 0);
  await partner.waitForTimeout(1200);
  const st = await partner.textContent('[data-guide="status"]');
  ok("AC-PF-17 referrer status updates live to Contacted; Tier 2 locked for a school", /Contacted/.test(st) && /Not shared/.test(st), "");
  await partner.screenshot({ path: SHOTS + "/07-status-contacted.png", fullPage: true });
  db = await ls(intake);
  ok("FT-094 'family contacted' notice in Demo Inbox", (db.outbox || []).some((m) => m.relatedId === "REF-NC-24818" && /family contacted/.test(m.subject)));
  ok("FT-044 team activity line (PHI-free)", (db.activity || []).some((a) => /Dana made first contact/.test(a.text)));

  // Consent simulator and X-ray
  await intake.goto(BASE + "/app/referral/?id=REF-NC-24818&panel=consent");
  await intake.waitForSelector('[data-guide="consent-sim"]');
  await intake.selectOption("#sim-src", "Hospital / clinician");
  ok("AC-PF-17 consent simulator: hospital unlocks Tier 2", (await intake.locator('[data-guide="consent-sim"] >> text=Unlocked').count()) > 0);
  await intake.locator('[data-guide="consent-sim"] label:has-text("Part 2")').first().click();
  ok("AC-PF-17 Part 2 program locks Tier 2", (await intake.locator('[data-guide="consent-sim"] >> text=Locked').count()) > 0);
  await intake.locator('[data-guide="xray"] button[role=switch]').click();
  await intake.waitForTimeout(300);
  ok("AC-PF-25 Privacy X-ray shows what marketing sees", (await intake.locator("text=This is all marketing ever sees").count()) > 0);
  await intake.screenshot({ path: SHOTS + "/08-xray-consent.png", fullPage: true });

  // Warm redirect (FT-098, AC-PF-08)
  await intake.goto(BASE + "/app/referral/?id=REF-NC-24802");
  await intake.waitForSelector('[data-guide="warm-redirect"]', { timeout: 5000 }).catch(() => {});
  const hasRedirect = (await intake.locator('[data-guide="warm-redirect"]').count()) > 0;
  if (hasRedirect) {
    await intake.locator('[data-guide="warm-redirect"]').first().click();
    await intake.click('[role=dialog] button:has-text("Redirect")');
    await intake.waitForTimeout(700);
  }
  db = await ls(intake);
  const red = (db.referrals || []).find((r) => r.id === "REF-NC-24802");
  ok("AC-PF-08 warm redirect in two clicks with honest notice", hasRedirect && red.status === "Redirected" && (db.outbox || []).some((m) => m.relatedId === "REF-NC-24802" && /connected the family/.test(m.body)), red && red.status);

  // Escalation: Ray sees it and reassigns (AC-PF-05)
  await signIn(intake, "ray.mendez@clarvida.example");
  ok("AC-PF-05 Ray has an escalation notification", /Overdue|overdue/.test(await intake.textContent("body")));
  await intake.goto(BASE + "/app/referral/?id=REF-NC-24806");
  await intake.waitForTimeout(900);
  const reassign = intake.locator('button:has-text("Reassign to Dana")');
  ok("FT-087 reassign offer on escalated referral", (await reassign.count()) > 0);
  if (await reassign.count()) { await reassign.click(); await intake.waitForTimeout(600); }
  db = await ls(intake);
  ok("HO-04 Dana notified of reassignment", (db.notifications || []).some((n) => n.toUserId === "u-dana" && /assigned REF-NC-24806/.test(n.text)));
  await intake.screenshot({ path: SHOTS + "/09-escalation.png", fullPage: true });

  // Alex can't open a referral (AC-PF-03)
  await signIn(intake, "alex.morgan@clarvida.example");
  await intake.goto(BASE + "/app/referral/?id=REF-NC-24811");
  await intake.waitForTimeout(900);
  ok("AC-PF-03 marketing sees Access restricted on a referral", (await intake.locator("text=Access restricted").count()) > 0);

  // Partner hub
  await signIn(partner, "jordan.carter@gcs.example");
  await partner.waitForTimeout(500);
  ok("AC-PF-18 partner hub lists referrals incl. the new one", (await partner.locator("text=REF-NC-24818").count()) > 0);
  await partner.screenshot({ path: SHOTS + "/10-hub.png", fullPage: true });

  // Phone width partner form
  const ph = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pp = await ph.newPage();
  await pp.goto(BASE + "/partner/refer/?code=GCS-NC-2026");
  await pp.waitForSelector('[data-guide="refer-form"]');
  const sw = await pp.evaluate(() => document.documentElement.scrollWidth);
  await pp.screenshot({ path: SHOTS + "/11-phone-form.png", fullPage: true });
  ok("NF-03 partner form at 390 px without sideways scroll", sw <= 390, String(sw));

  ok("NF-10 no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  ok("NF-02 no external requests", external.length === 0, external.slice(0, 3).join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
