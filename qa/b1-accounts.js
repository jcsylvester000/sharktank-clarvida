// Batch 1 checks: accounts, sign-in, MFA, welcome, dashboards, lockout, reset, access, read-only judge.
// Usage: node b1-accounts.js [baseUrl]   (serve ../out first: node server.js ../out 4310)
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.argv[2] || "http://localhost:4310";
const SHOTS = __dirname + "/shots/b1";
fs.mkdirSync(SHOTS, { recursive: true });
const PW = "Brighter2026!";
const results = [];
const ok = (name, pass, detail = "") => { results.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`); };

const ACCOUNTS = [
  ["maria.reyes@clarvida.example", "/app/", "My Week"],
  ["jon.whitaker@clarvida.example", "/app/", "My Week"],
  ["lena.ortiz@clarvida.example", "/app/", "Team"],
  ["dana.kim@clarvida.example", "/app/", "Today's queue"],
  ["ray.mendez@clarvida.example", "/app/", "Team SLA"],
  ["priya.shah@clarvida.example", "/app/", "Capacity"],
  ["alex.morgan@clarvida.example", "/app/", "Impact"],
  ["sam.patel@clarvida.example", "/app/", "Governance"],
  ["chris.lee@clarvida.example", "/app/", "System"],
  ["jordan.carter@gcs.example", "/partner/hub/", "My referrals"],
  ["judge@clarvida.example", "/app/", "Executive overview"],
];

async function signIn(p, email, password = PW, { remember = false, welcome = true } = {}) {
  await p.goto(BASE + "/");
  await p.fill("#email", email);
  await p.fill("#password", password);
  await p.click('button[type=submit]:has-text("Sign in")');
  await p.waitForURL(/login\/verify|\/app\/|\/welcome|\/partner\/hub/, { timeout: 8000 });
  if (p.url().includes("/login/verify")) {
    if (!remember) { const cb = p.getByLabel("Remember this device for 30 days"); if (await cb.isChecked()) await cb.uncheck(); }
    await p.click("text=Open the Demo Authenticator");
    await p.click('button:has-text("Use this code")');
    await p.waitForURL(/\/app\/|\/welcome|\/partner\/hub/, { timeout: 8000 });
  }
  if (welcome && p.url().includes("/welcome")) {
    await p.click('button:has-text("That\'s me")');
    await p.click('button:has-text("Save and continue")');
    await p.check('text=I agree to the privacy pledge.');
    await p.click('button:has-text("Go to my")');
    await p.waitForURL(/\/app\/|\/partner\/hub/, { timeout: 8000 });
  }
  await p.waitForTimeout(900);
}

async function signOut(p) {
  await p.evaluate(() => { sessionStorage.removeItem("cv-session"); });
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  const errors = [];
  const external = [];
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("request", (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:")) external.push(u); });

  // 1. Sign-in page renders with brand and demo accounts
  await p.goto(BASE + "/");
  await p.waitForSelector("#email");
  await p.screenshot({ path: SHOTS + "/01-sign-in.png", fullPage: true });
  ok("PG-01 sign-in shows 11 demo accounts", (await p.locator("#demo-accounts-list li").count()) === 11);

  // 2. Wrong password and unknown email give the same message (AC-FR-02)
  await p.fill("#email", "nobody@clarvida.example"); await p.fill("#password", "x"); await p.click('button[type=submit]:has-text("Sign in")');
  await p.waitForSelector("#signin-error");
  const m1 = await p.textContent("#signin-error");
  await p.fill("#email", "maria.reyes@clarvida.example"); await p.fill("#password", "wrong-one"); await p.click('button[type=submit]:has-text("Sign in")');
  await p.waitForTimeout(800);
  const m2 = await p.textContent("#signin-error");
  ok("AC-FR-02 non-revealing message", m1 === m2 && /incorrect/i.test(m1), m1);

  // 3. Maria: password + MFA + welcome + dashboard (AC-FR-01, 07, 08)
  await p.fill("#email", "maria.reyes@clarvida.example"); await p.fill("#password", PW);
  await p.click('button[type=submit]:has-text("Sign in")');
  await p.waitForURL(/login\/verify/);
  await p.click("text=Open the Demo Authenticator");
  await p.waitForTimeout(500);
  await p.screenshot({ path: SHOTS + "/02-mfa.png" });
  // old code rejected
  await p.locator('input[aria-label="Digit 1 of 6"]').fill("0");
  for (let i = 2; i <= 6; i++) await p.locator(`input[aria-label="Digit ${i} of 6"]`).fill("0");
  await p.waitForTimeout(900);
  ok("AC-FR-03 wrong MFA code rejected", (await p.locator("text=didn't match").count()) > 0);
  await p.click('button:has-text("Use this code")');
  await p.waitForURL(/welcome/);
  await p.screenshot({ path: SHOTS + "/03-welcome-1.png" });
  await p.click('button:has-text("That\'s me")');
  await p.screenshot({ path: SHOTS + "/04-welcome-2.png" });
  await p.click('button:has-text("Save and continue")');
  await p.check("text=I agree to the privacy pledge.");
  await p.screenshot({ path: SHOTS + "/05-welcome-3.png" });
  await p.click('button:has-text("Go to my dashboard")');
  await p.waitForURL(/\/app\/$/);
  await p.waitForSelector("text=Last signed in", { timeout: 5000 });
  await p.waitForTimeout(600);
  await p.screenshot({ path: SHOTS + "/06-dashboard-maria.png", fullPage: true });
  const greet = await p.textContent("h1");
  ok("AC-FR-08 greeting by first name", /Maria/.test(greet), greet);
  ok("FT-013 last sign-in line", (await p.locator("text=Last signed in").count()) > 0);

  // 4. Access restricted for Maria on the audit log (AC-FR-19)
  await p.goto(BASE + "/app/audit/");
  await p.waitForSelector("text=Access restricted", { timeout: 5000 }).catch(() => {});
  ok("AC-FR-19 locked page shows Access restricted", (await p.locator("text=Access restricted").count()) > 0);

  // 5. Sign out, Back does not show the app (AC-FR-18); remember device skips MFA; welcome not shown again (AC-FR-07)
  await p.goto(BASE + "/app/");
  await p.waitForTimeout(700);
  await p.click('button[aria-label="Account menu"]');
  await p.click("text=Sign out");
  await p.waitForURL(/\/\?signedout/);
  await p.goBack();
  await p.waitForTimeout(1200);
  ok("AC-FR-18 Back after sign-out returns to sign-in", !/\/app\//.test(new URL(p.url()).pathname) || (await p.locator("#email").count()) > 0, p.url());
  await signIn(p, "maria.reyes@clarvida.example", PW, { remember: true, welcome: false });
  ok("AC-FR-07 welcome shown only once", /\/app\/$/.test(p.url()), p.url());
  await p.click('button[aria-label="Account menu"]'); await p.click("text=Sign out"); await p.waitForURL(/signedout/);
  await p.fill("#email", "maria.reyes@clarvida.example"); await p.fill("#password", PW); await p.click('button[type=submit]:has-text("Sign in")');
  await p.waitForURL(/\/app\/$|login\/verify/, { timeout: 8000 });
  ok("FT-004 remembered device skips MFA", /\/app\/$/.test(p.url()), p.url());

  // 6. All 11 accounts land on their own dashboard variant (AC-FR-01, AC-FR-09)
  for (const [email, landing, label] of ACCOUNTS) {
    await signOut(p);
    await signIn(p, email);
    const path = new URL(p.url()).pathname;
    const hasLabel = (await p.locator(`text=${label}`).count()) > 0;
    ok(`AC-FR-01 ${email} lands on ${label}`, path === landing && hasLabel, path);
    await p.screenshot({ path: `${SHOTS}/10-land-${email.split("@")[0]}.png`, fullPage: false });
  }

  // 7. Judge is read-only: dashboard shows the badge
  ok("FT-165 judge sees read-only badge", (await p.locator("text=Read-only guest").count()) > 0);

  // 8. Lockout after 5 wrong passwords (AC-FR-04)
  await signOut(p);
  await p.goto(BASE + "/");
  for (let i = 0; i < 5; i++) {
    await p.fill("#email", "jon.whitaker@clarvida.example"); await p.fill("#password", "nope" + i);
    await p.click('button[type=submit]:has-text("Sign in")'); await p.waitForTimeout(750);
  }
  const lockMsg = await p.textContent("#signin-error");
  ok("AC-FR-04 lockout after 5 failures with countdown", /locked/i.test(lockMsg) && /Try again in \d:\d\d/.test(lockMsg), lockMsg);

  // 9. Forgot password via Demo Inbox; new works, old doesn't (AC-FR-05)
  await p.goto(BASE + "/login/forgot/");
  await p.fill("#fp-email", "priya.shah@clarvida.example");
  await p.click('button:has-text("Send reset link")');
  await p.waitForSelector("text=Set a new password");
  await p.screenshot({ path: SHOTS + "/20-forgot-inbox.png" });
  await p.click('a:has-text("Set a new password")');
  await p.waitForSelector("#np");
  await p.fill("#np", "NewBrighter2027"); await p.fill("#np2", "NewBrighter2027");
  await p.click('button:has-text("Save new password")');
  await p.waitForSelector("text=Your password was changed.");
  await p.goto(BASE + "/");
  await p.fill("#email", "priya.shah@clarvida.example"); await p.fill("#password", PW); await p.click('button[type=submit]:has-text("Sign in")');
  await p.waitForTimeout(900);
  const oldFails = (await p.locator("text=incorrect").count()) > 0;
  await signIn(p, "priya.shah@clarvida.example", "NewBrighter2027", { welcome: false });
  ok("AC-FR-05 reset: new password works, old doesn't", oldFails && /\/app\/|welcome/.test(p.url()), p.url());

  // 10. SSO chooser (AC-FR-06)
  await signOut(p);
  await p.goto(BASE + "/");
  await p.click('button:has-text("Sign in with Clarvida SSO")');
  await p.waitForSelector("text=Clarvida single sign-on");
  await p.screenshot({ path: SHOTS + "/21-sso.png" });
  await p.locator('[role=dialog] button:has-text("Alex Morgan")').click();
  await p.waitForURL(/login\/verify/, { timeout: 6000 }).catch(() => {});
  ok("AC-FR-06 SSO chooser continues to MFA", /login\/verify/.test(p.url()), p.url());

  // 11. Demo Inbox, notifications, settings render (Maria)
  await signOut(p);
  await signIn(p, "maria.reyes@clarvida.example", PW, { welcome: false });
  for (const [path, text] of [["/app/inbox/", "Demo Inbox"], ["/app/notifications/", "Notifications"], ["/app/settings/", "Profile and Settings"]]) {
    await p.goto(BASE + path);
    await p.waitForSelector(`h1:has-text("${text}")`, { timeout: 6000 }).catch(() => {});
    ok(`${path} renders`, (await p.locator(`h1:has-text("${text}")`).count()) > 0);
    await p.screenshot({ path: `${SHOTS}/30-${path.split("/")[2]}.png`, fullPage: true });
  }

  // 12. Phone width: no sideways scroll on sign-in and dashboard
  const ph = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pp = await ph.newPage();
  await pp.goto(BASE + "/"); await pp.waitForSelector("#email");
  const sw1 = await pp.evaluate(() => document.documentElement.scrollWidth);
  await pp.screenshot({ path: SHOTS + "/40-phone-sign-in.png", fullPage: true });
  await signIn(pp, "dana.kim@clarvida.example");
  const sw2 = await pp.evaluate(() => document.documentElement.scrollWidth);
  await pp.screenshot({ path: SHOTS + "/41-phone-dashboard.png", fullPage: true });
  ok("NF-03 390 px: no horizontal scroll", sw1 <= 390 && sw2 <= 390, `${sw1}, ${sw2}`);

  ok("NF-10 no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  ok("NF-02 no external requests", external.length === 0, external.slice(0, 3).join(" | "));

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
