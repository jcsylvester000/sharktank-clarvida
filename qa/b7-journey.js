// Batch 7: "Follow one referral" tour. One referral from the partner through every demo account; checks the right page,
// the right account, the highlighted target and the "Now viewing as" chip at each step. Saves one screenshot per step
// (qa/shots/b7/) for the Referral Journey document.
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.argv[2] || "http://localhost:4310";
const SHOTS = __dirname + "/shots/b7";
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const ok = (name, pass, detail = "") => { results.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`); };
const EXPECT = [
  [1, /\/partner\/refer/, "refer-form", "u-jordan", "Jordan Carter"], [2, /\/app\/intake/, "queue", "u-dana", "Dana Kim"], [3, /\/app\/referral/, "actions", "u-dana", "Dana Kim"],
  [4, /\/app\/$/, "kpis", "u-ray", "Ray Mendez"], [5, /\/app\/capacity/, "capacity", "u-priya", "Priya Shah"], [6, /\/partner\/hub/, "hub", "u-jordan", "Jordan Carter"],
  [7, /\/app\/$/, "plan", "u-maria", "Maria Reyes"], [8, /\/app\/$/, "kpis", "u-lena", "Lena Ortiz"], [9, /\/app\/$/, "kpis", "u-jon", "Jon Whitaker"],
  [10, /\/app\/impact/, "impact", "u-alex", "Alex Morgan"], [11, /\/app\/audit/, "audit", "u-sam", "Sam Patel"], [12, /\/app\/teams/, "teams-preview", "u-chris", "Chris Lee"], [13, /\/app\/$/, "kpis", "u-judge", "Guest Judge"],
];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, reducedMotion: "reduce" });
  await ctx.route("https://tile.openstreetmap.org/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64") }));
  const errors = [];
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await p.goto(BASE + "/"); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.reload();
  await p.waitForSelector('[data-guide="referral-showcase"]');
  await p.screenshot({ path: SHOTS + "/00-opening.png" });
  await p.click('[data-guide="journey-start"]');
  const bar = p.locator('[role=region][aria-label="Guided demo"]');
  await bar.waitFor({ timeout: 8000 });
  const fails = [];
  for (const [n, url, target, user, name] of EXPECT) {
    if (n > 1) {
      if (n === 2) {
        await p.click('[data-guide="fill-sample"]'); await p.click('[data-guide="send-referral"]');
        await p.waitForURL(/partner\/confirmation/, { timeout: 8000 });
        await p.waitForTimeout(500);
        await p.screenshot({ path: SHOTS + "/01b-confirmation.png" });
      }
      if (n === 4) {
        // Step 3: Dana logs the call and accepts, so later screens show the referral as contacted.
        const log = p.locator('button:has-text("Log contact attempt")').first();
        if (await log.count()) { await log.click(); await p.waitForTimeout(400); const reached = p.locator('button:has-text("Reached")').first(); if (await reached.count()) { await reached.click(); await p.waitForTimeout(300); } const save = p.locator('[role=dialog] button:has-text("Save"), [role=dialog] button:has-text("Log")').first(); if (await save.count()) { await save.click(); await p.waitForTimeout(400); } }
        const acc = p.locator('button:has-text("Accept")').first();
        if (await acc.count()) { await acc.click(); await p.waitForTimeout(400); const conf = p.locator('[role=dialog] button:has-text("Accept")').first(); if (await conf.count()) { await conf.click(); await p.waitForTimeout(400); } }
        await p.screenshot({ path: SHOTS + "/03b-after-actions.png" });
      }
      await bar.locator('button:has-text("Next")').click();
    }
    try {
      await p.waitForURL(url, { timeout: 8000 });
      await p.waitForSelector(`[data-guide="${target}"]`, { timeout: 6000 });
      await p.waitForTimeout(1200);
      const txt = await bar.textContent();
      const sess = await p.evaluate(() => JSON.parse(sessionStorage.getItem("cv-session") || "null"));
      const hl = await p.locator(`[data-guide="${target}"].guide-highlight`).count();
      const why = !txt.includes(`${n} / 13`) ? "bar" : sess?.userId !== user ? "user=" + sess?.userId : !txt.includes(name) ? "chip" : !hl ? "nohl" : "";
      if (why) fails.push(`${n}:${why}`);
    } catch (e) { fails.push(`${n}:${String(e).slice(0, 80)}`); }
    await p.screenshot({ path: SHOTS + `/${String(n).padStart(2, "0")}-${user}.png` });
  }
  ok("Follow one referral: 13 steps through all 11 accounts, right page, right account, chip and highlight", fails.length === 0, fails.join(", "));
  const last = await p.evaluate(() => JSON.parse(localStorage.getItem("cv-proto-v3") || "{}").demo?.lastPartnerRef);
  ok("The tour follows the referral sent at step 1", Boolean(last), last);
  await bar.locator('button:has-text("Finish")').click();
  ok("Finish exits the tour", (await bar.count()) === 0);
  ok("No console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\nb7: ${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
