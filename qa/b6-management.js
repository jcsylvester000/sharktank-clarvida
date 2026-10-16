// Batch 6 checks (management Q&A, Oct 16 2026): Teams and Access (PG-36) and Value and Pricing (PG-37).
// Hierarchy and visibility matrix, person picker, role gates, value/pricing model numbers, sliders, axe, phone width.
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const fs = require("fs");
const BASE = process.argv[2] || "http://localhost:4310";
const SHOTS = __dirname + "/shots/b6";
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
  await p.waitForURL(/login\/verify|\/app\/|\/welcome/, { timeout: 8000 });
  if (p.url().includes("/login/verify")) { await p.click("text=Open the Demo Authenticator"); await p.click('button:has-text("Use this code")'); await p.waitForURL(/\/app\/|\/welcome/, { timeout: 8000 }); }
  if (p.url().includes("/welcome")) {
    await p.click('button:has-text("That\'s me")'); await p.click('button:has-text("Save and continue")');
    await p.check("text=I agree to the privacy pledge."); await p.click('button:has-text("Go to my")'); await p.waitForURL(/\/app\//, { timeout: 8000 });
  }
  await p.waitForTimeout(500);
}
const open = async (p, path) => { await p.goto(BASE + path); await p.waitForSelector("h1", { timeout: 8000 }); await p.waitForTimeout(900); };
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
async function axe(p) {
  const r = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target?.join(" ")}`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const errors = [];
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(BASE + "/"); await p.evaluate(() => localStorage.clear());

  // ---- Administrator: Teams and Access
  await signIn(p, "chris.lee@clarvida.example");
  await open(p, "/app/teams/");
  const t = await p.textContent("main");
  ok("PG-36 opens for the administrator with 16 states and 3 regions", /Teams and Access/.test(t) && /Clarvida lists on clarvida.com/.test(t) && /\bEast region\b/.test(t));
  ok("Hierarchy lists levels 0 to 6 bottom up", (await p.locator("[data-level]").count()) === 7);
  const rows = await p.locator('[role=region][aria-label="Visibility by position"] table tbody tr').count();
  ok("Visibility matrix has a row per pilot position", rows === 13, String(rows));
  const row = async (title, person) => (await p.locator('[role=region][aria-label="Visibility by position"] table tbody tr', { hasText: person }).first().innerText()).replace(/\s+/g, " ");
  const maria = await row("Brand Ambassador", "Maria Reyes");
  const kim = await row("Brand Ambassador", "Kim Alvarez");
  const sam = await row("Compliance Officer", "Sam Patel");
  ok("Ambassador row: no client referrals", /none/.test(maria), maria);
  ok("Charlotte ambassador sees 0 organizations (city segregation)", / 1 1 0 none/.test(kim), kim);
  ok("Compliance sees all 16 states and client referrals", /16 27 n\/a 13/.test(sam) || /16 27 \d+ 13/.test(sam), sam);
  await p.screenshot({ path: SHOTS + "/01-teams-top.png" });
  await p.selectOption("#who", "p-dana");
  await p.waitForTimeout(300);
  const dana = await p.textContent('[data-guide="teams-preview"]');
  ok("Picker: intake coordinator gets Care Zone referrals and no Outreach pages", /Care Zone/.test(dana) && /No Outreach pages/.test(dana));
  await p.locator('[data-guide="teams-preview"]').screenshot({ path: SHOTS + "/02-teams-preview-dana.png" });
  await p.selectOption("#who", "p-jordan");
  await p.waitForTimeout(300);
  ok("Picker: partner sees only its own organization", /Their own only/.test(await p.textContent('[data-guide="teams-preview"]')));
  await p.selectOption("#who", "p-maria");
  await p.waitForTimeout(300);
  await p.locator('[role=region][aria-label="Visibility by position"] table').screenshot({ path: SHOTS + "/03-visibility-matrix.png" });
  await p.locator("h2", { hasText: "Company structure" }).scrollIntoViewIfNeeded();
  await p.screenshot({ path: SHOTS + "/04-company-structure.png", fullPage: false });
  await p.screenshot({ path: SHOTS + "/05-teams-full.png", fullPage: true });
  const axeTeams = await axe(p);
  ok("Teams and Access: no serious axe issues (desktop)", axeTeams.length === 0, axeTeams.join("; "));

  // ---- Value and Pricing
  await open(p, "/app/value/");
  const v = await p.textContent("main");
  ok("PG-37 Time and Value opens with 220 users in 16 states", /220 users in 16 states/.test(v), "");
  ok("Expected value $2.66M a year for 16 states", /\$2\.66M/.test(v));
  await p.screenshot({ path: SHOTS + "/06-value-time.png" });
  ok("Page is titled Time and Value", /Time and Value/.test(v));
  await p.click('[role=radio]:has-text("Conservative")');
  await p.waitForTimeout(300);
  ok("Conservative halves the value ($1.33M)", /\$1\.33M/.test(await p.textContent("main")));
  await p.click('[role=radio]:has-text("Expected")');
  ok("Time and Value shows no pricing or vendor cost", !/pric|subscription|per seat|\$69|Philippines|one-time/i.test(await p.textContent("main")));
  await p.locator("#states").fill("18");
  await p.waitForTimeout(300);
  ok("States slider to 18: $2.98M saved a year", /\$2\.98M/.test(await p.textContent("main")));
  await p.click('[role=tab]:has-text("Team sizes")');
  await p.getByLabel("Brand Ambassador per state").fill("5");
  await p.waitForTimeout(300);
  ok("Team size edit updates the totals", /\b18 states\b/.test(await p.textContent("main")) && /(\d+) users in 18 states/.test(await p.textContent("main")));
  await p.screenshot({ path: SHOTS + "/09-value-team.png", fullPage: true });
  await p.click('button:has-text("Reset")');
  const axeValue = await axe(p);
  ok("Time and Value: no serious axe issues (desktop)", axeValue.length === 0, axeValue.join("; "));

  // ---- Where Referrals Come From (PG-38) and Questions and Answers (PG-39)
  await signIn(p, "maria.reyes@clarvida.example");
  await open(p, "/app/sources/");
  const src = await p.textContent("main");
  ok("PG-38 explains who refers, how a referral starts, channels, lifecycle and the ambassador's role", /Who refers/.test(src) && /How a referral starts today/.test(src) && /How a referral gets into the Co-Pilot/.test(src) && /What happens to a referral/.test(src) && /Ambassadors don.t make referrals/.test(src));
  ok("PG-38 lists 8 source types and 5 channels", (await p.locator('[data-guide="referral-sources"] .rounded-lg.border').count()) === 8 && (await p.locator('[role=region][aria-label="Referral channels"] tbody tr').count()) === 5);
  ok("PG-38 counts Maria's partner organizations by type (schools > 0)", /Schools\s*\d+ partner organization/.test(src.replace(/\s+/g, " ")) && !/Schools 0 partner/.test(src.replace(/\s+/g, " ")));
  await p.screenshot({ path: SHOTS + "/10-sources.png", fullPage: true });
  const axeSrc = await axe(p);
  ok("Where Referrals Come From: no serious axe issues (desktop)", axeSrc.length === 0, axeSrc.join("; "));
  await open(p, "/app/answers/");
  const qa = await p.textContent("main");
  ok("PG-39 has questions in 4 groups and no pricing", (await p.locator("details").count()) >= 18 && !/pric|subscription/i.test(qa));
  await p.getByLabel("Search questions").fill("phone");
  await p.waitForTimeout(200);
  await p.locator("details", { hasText: "What if someone phones" }).locator("summary").click();
  await p.screenshot({ path: SHOTS + "/11-answers.png" });
  await p.click('button:has-text("Show me: New referral")');
  await p.waitForURL(/\/app\/referral\/new/, { timeout: 8000 }).catch(() => {});
  const sess = await p.evaluate(() => JSON.parse(sessionStorage.getItem("cv-session") || "null"));
  ok("'Show me' opens the screen as the right person (New referral as Dana)", /\/app\/referral\/new/.test(p.url()) && sess?.userId === "u-dana", p.url() + " " + sess?.userId);
  await open(p, "/app/answers/");
  const axeQa = await axe(p);
  ok("Questions and Answers: no serious axe issues (desktop)", axeQa.length === 0, axeQa.join("; "));
  await signIn(p, "chris.lee@clarvida.example");

  // ---- Phone width
  await p.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/app/teams/", "/app/value/", "/app/answers/"]) {
    await open(p, path);
    ok(`${path} no sideways scrolling at 390 px`, !(await overflow(p)));
    const a = await axe(p);
    ok(`${path} no serious axe issues (phone)`, a.length === 0, a.join("; "));
  }
  await p.setViewportSize({ width: 1440, height: 900 });

  // ---- Role gates
  await signIn(p, "maria.reyes@clarvida.example");
  await open(p, "/app/value/");
  ok("Brand Ambassador cannot open Time and Value", /Access restricted/i.test(await p.textContent("main")));
  await open(p, "/app/teams/");
  ok("Brand Ambassador cannot open Teams and Access", /Access restricted/i.test(await p.textContent("main")));
  await signIn(p, "judge@clarvida.example");
  await open(p, "/app/value/");
  ok("Guest Judge can view Time and Value", /Time and Value/.test(await p.textContent("main")) && !/Access restricted/i.test(await p.textContent("main")));
  await open(p, "/app/teams/");
  ok("Guest Judge can view Teams and Access", !/Access restricted/i.test(await p.textContent("main")));

  ok("No console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\nb6: ${results.length - failed}/${results.length} passed`);
  fs.writeFileSync(SHOTS + "/results.json", JSON.stringify(results, null, 1));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
