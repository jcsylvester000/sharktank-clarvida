// Batch 4 checks: story, 13-step guided demo, presenter window, impact (Ask refusal, X-ray, flow), pilot (judge slider, the ask),
// trust "What is simulated", admin second approver, disabled user, audit filtered by blocked.
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.argv[2] || "http://localhost:4310";
const SHOTS = __dirname + "/shots/b4";
fs.mkdirSync(SHOTS, { recursive: true });
const PW = require("./demo-password");
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
const bar = (p) => p.locator('[role=region][aria-label="Guided demo"]');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route("https://tile.openstreetmap.org/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: TILE }));
  const errors = [];
  const watch = (pg) => { pg.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); }); pg.on("pageerror", (e) => errors.push(String(e))); };
  const p = await ctx.newPage();
  watch(p);

  // ---- Story (PG-05)
  await p.goto(BASE + "/"); await p.evaluate(() => localStorage.clear());
  await p.goto(BASE + "/story/");
  await p.waitForSelector('[data-guide="before-after"]');
  const before = await p.textContent('[data-guide="before-after"]');
  await p.click('[data-guide="toggle-with"]');
  await p.waitForTimeout(400);
  const after = await p.textContent('[data-guide="before-after"]');
  ok("FT-162 story toggles Today → With the Co-Pilot (0% → 100% known source)", /0%/.test(before) && /100%/.test(after) && /Show today again/.test(after));
  ok("Story proof points marked self-reported with source", /self-reported/.test(after) && /180,000/.test(after));
  await p.screenshot({ path: SHOTS + "/01-story.png" });

  // ---- Guided demo: all 13 steps
  await p.click('button:has-text("Start the demo")');
  await bar(p).waitFor({ timeout: 5000 });
  const expect = [
    [1, /\/story/, "before-after", null], [2, /\/app\/$/, "alerts", "u-maria"], [3, /\/app\/finder/, "finder", "u-maria"],
    [4, /\/app\/organization/, "outreach", "u-maria"], [5, /\/app\/kits/, "kit", "u-maria"], [6, /\/partner\/refer/, "refer-form", null],
    [7, /\/app\/intake/, "queue", "u-dana"], [8, /\/app\/referral/, "actions", "u-dana"], [9, /\/app\/referral/, "consent-sim", "u-dana"],
    [10, /\/app\/impact/, "impact", "u-alex"], [11, /\/app\/capacity/, "capacity", "u-priya"], [12, /\/app\/referral/, "xray", "u-sam"], [13, /\/app\/pilot/, "the-ask", "u-alex"],
  ];
  let stepFails = [];
  for (const [n, url, target, user] of expect) {
    if (n > 1) {
      if (n === 7) {
        // Step 6 is the partner form: submit a referral so LATEST resolves to it.
        await p.click('[data-guide="fill-sample"]');
        await p.click('[data-guide="send-referral"]');
        await p.waitForURL(/partner\/confirmation/, { timeout: 8000 });
      }
      await bar(p).locator('button:has-text("Next")').click();
    }
    try {
      await p.waitForURL(url, { timeout: 8000 });
      await p.waitForSelector(`[data-guide="${target}"]`, { timeout: 5000 });
      await p.waitForTimeout(700);
      const txt = await bar(p).textContent();
      const st = await ls(p);
      const sess = await p.evaluate(() => JSON.parse(sessionStorage.getItem("cv-session") || "null"));
      const who = sess?.userId ?? st.session?.userId;
      const highlighted = await p.locator(`[data-guide="${target}"].guide-highlight`).count();
      if (!txt.includes(`${n} / 13`) || (user && who !== user) || !highlighted) stepFails.push(`${n}:${!txt.includes(`${n} / 13`) ? "bar" : user && who !== user ? "user=" + who : "nohl"}`);
    } catch (e) { stepFails.push(`${n}:${String(e).slice(0, 60)}`); }
    if (n === 6 || n === 12 || n === 13) await p.screenshot({ path: SHOTS + `/02-step${n}.png` });
  }
  ok("JR-13 guided demo: 13 steps, right page, right account, target highlighted", stepFails.length === 0, stepFails.join(", "));
  const lastRef = (await ls(p)).demo?.lastPartnerRef;
  ok("Step 8/12 use the referral just submitted (LATEST)", Boolean(lastRef) && p.url().includes("pilot"), lastRef);
  await bar(p).locator('button:has-text("Finish")').click();
  await p.waitForTimeout(300);
  ok("Finish exits the guided demo", (await bar(p).count()) === 0);

  // ---- Presenter window drives the demo window (PG-34)
  const sp = await ctx.newPage(); watch(sp);
  await sp.goto(BASE + "/presenter/");
  await sp.evaluate(() => { window.name = "speaker"; });
  await sp.click('button:has-text("Start at step 1")');
  await sp.waitForSelector("text=1 / 13");
  await sp.click('button:has-text("Next: Maria")');
  await p.waitForURL(/\/app\/$/, { timeout: 8000 }).catch(() => {});
  ok("FT-161 presenter Next moves the demo window (step 2, Maria)", /\/app\/$/.test(p.url()) && (await sp.locator("text=signed in as Maria Reyes").count()) === 1, p.url());
  await sp.click('button:has-text("3-minute cut off")');
  const cut = await sp.locator("text=of 3:00").count();
  await sp.click('button:has-text("Next:")');
  await sp.waitForSelector("text=4 / 13");
  ok("3-minute cut skips step 3 (2 → 4) with a 3:00 budget", cut === 1);
  await sp.keyboard.press("ArrowLeft");
  await sp.waitForSelector("text=2 / 13");
  ok("Presenter arrow keys step back", true);
  ok("Presenter shows click/show and fallback", (await sp.locator("text=Click / show").count()) === 1 && (await sp.locator("text=If it fails:").count()) === 1);
  await sp.screenshot({ path: SHOTS + "/03-presenter.png" });
  await sp.close();
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("cv-proto-v3")); s.demo.guideOn = false; localStorage.setItem("cv-proto-v3", JSON.stringify(s)); });

  // ---- Impact (Alex)
  await signIn(p, "alex.morgan@clarvida.example");
  await p.goto(BASE + "/app/impact/");
  await p.waitForSelector('[data-guide="impact"]');
  const withBtn = p.locator('button:has-text("With the Co-Pilot"), [role=tab]:has-text("With")').first();
  if (await withBtn.count()) await withBtn.click().catch(() => {});
  await p.waitForSelector("#ask-input", { timeout: 5000 });
  await p.fill("#ask-input", "Show me Avery's referral");
  await p.click('button[aria-label="Ask"]');
  await p.waitForTimeout(4000);
  const askTxt = await p.locator('div[aria-live="polite"]:has-text("You asked")').textContent().catch(() => "");
  ok("FT-120 Ask refuses a client-level question", /can.?t|cannot|not able|only|aggregate/i.test(askTxt) && !/9001234567/.test(askTxt), askTxt.slice(0, 80));
  const st1 = await ls(p);
  ok("Refusal logged as blocked, without the question text", st1.audit.some((e) => e.category === "blocked" && /refused/.test(e.action) && !/Avery/.test(e.action)));
  await p.fill("#ask-input", "Which partners went quiet?");
  await p.click('button[aria-label="Ask"]');
  await p.waitForTimeout(5000);
  const ans = await p.locator('div[aria-live="polite"]:has-text("You asked")').textContent().catch(() => "");
  ok("Ask answers an aggregate question", /quiet/i.test(ans) && ans.length > 60, ans.slice(0, 80));
  await p.click('[data-guide="impact-xray"] [role=switch]');
  await p.waitForTimeout(300);
  ok("Impact Privacy X-ray explains what marketing sees", (await p.locator("text=What never reaches it").count()) === 1);
  ok("Flow chart 'From source to intake' present", (await p.locator('[data-guide="flow"]').count()) === 1 && (await p.locator('[data-guide="flow"] svg').count()) >= 1);
  await p.screenshot({ path: SHOTS + "/04-impact.png", fullPage: true });

  // ---- Pilot as the judge (read-only, but ROI sliders move)
  await signIn(p, "judge@clarvida.example");
  await p.goto(BASE + "/app/pilot/");
  await p.waitForSelector('[data-guide="roi-slider"]');
  const v0 = await p.inputValue('[data-guide="roi-slider"]');
  await p.focus('[data-guide="roi-slider"]');
  for (let i = 0; i < 5; i++) await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(300);
  const v1 = await p.inputValue('[data-guide="roi-slider"]');
  ok("Judge (read-only) can move an ROI slider", v1 !== v0, `${v0} → ${v1}`);
  const ask = await p.textContent('[data-guide="the-ask"]');
  ok("The ask: 90-day pilot NC + CO on existing AWS/SSO/CRM", /90-day pilot/.test(ask) && /AWS/.test(ask) && /Colorado/.test(ask));
  ok("Judge can't edit the ask", (await p.locator('button[aria-label="Edit the ask"]').count()) === 0);
  ok("Placeholder inputs labelled until Clarvida baseline", (await p.locator("text=/Placeholder until Clarvida baseline/").count()) >= 1);
  await p.screenshot({ path: SHOTS + "/05-pilot.png", fullPage: true });

  // ---- Trust and Security (judge has view)
  await p.goto(BASE + "/app/trust/");
  await p.waitForSelector('[data-guide="simulated"]', { timeout: 6000 }).catch(() => {});
  ok("Trust: 'What is simulated' panel", (await p.locator('[data-guide="simulated"]').count()) === 1);

  // ---- Admin: Chris proposes, Chris can't approve, Lena approves
  await signIn(p, "chris.lee@clarvida.example");
  await p.goto(BASE + "/app/admin/?tab=routing");
  await p.click('button:has-text("Propose change")');
  await p.locator('[role=dialog] input[type=checkbox]').last().click();
  await p.click('[role=dialog] button:has-text("Propose change")');
  await p.waitForTimeout(500);
  ok("BR24 proposer can't approve own change", (await p.locator('button:has-text("Approve"):disabled').count()) >= 1);
  await signIn(p, "lena.ortiz@clarvida.example");
  const st2 = await ls(p);
  ok("HO-09 Lena notified of the waiting change", st2.notifications.some((n) => n.toUserId === "u-lena" && n.type === "approval" && /waiting/i.test(n.text)));
  await p.goto(BASE + "/app/admin/?tab=routing");
  await p.click('button:has-text("Approve"):not([disabled])');
  await p.waitForTimeout(500);
  const st3 = await ls(p);
  ok("Lena (second approver) approves; change applied and audited", st3.pending.some((c) => c.status === "Approved" && c.decidedBy === "u-lena") && st3.audit.some((e) => /Approved change/.test(e.action)));
  ok("Proposer told who approved", st3.notifications.some((n) => n.toUserId === "u-chris" && /Lena Ortiz/.test(n.text)));

  // ---- Disabled user can't sign in
  await signIn(p, "chris.lee@clarvida.example");
  await p.goto(BASE + "/app/admin/");
  await p.click('[role=switch][aria-label*="Jon Whitaker"], label:has-text("Active: Jon Whitaker") [role=switch]').catch(async () => {
    await p.locator("tr", { hasText: "Jon Whitaker" }).locator("[role=switch]").click();
  });
  await p.waitForTimeout(300);
  await p.evaluate(() => sessionStorage.removeItem("cv-session"));
  await p.goto(BASE + "/");
  await p.fill("#email", "jon.whitaker@clarvida.example");
  await p.fill("#password", PW);
  await p.click('button[type=submit]:has-text("Sign in")');
  await p.waitForTimeout(1200);
  ok("Disabled user can't sign in", !/\/app\/|login\/verify/.test(p.url()) && (await p.locator("text=/disabled|deactivated|not active|contact/i").count()) >= 1, p.url());

  // ---- Audit filtered by blocked (Sam)
  await signIn(p, "sam.patel@clarvida.example");
  await p.goto(BASE + "/app/audit/");
  await p.click('[role=group][aria-label="Filter"] button:has-text("Blocked")');
  await p.waitForTimeout(300);
  const rows = await p.locator('[data-guide="audit"] tbody tr').count();
  const txt = await p.textContent('[data-guide="audit"]');
  ok("Audit filtered by blocked shows the Ask refusal", rows >= 1 && /refused/i.test(txt), `${rows} rows`);
  await p.click('button:has-text("Export CSV")').catch(() => {});
  await p.waitForTimeout(300);
  ok("Export is itself logged", (await ls(p)).audit.some((e) => e.category === "export"));
  await p.screenshot({ path: SHOTS + "/06-audit.png" });

  const real = errors.filter((e) => !/favicon|tile\.openstreetmap|Failed to load resource/.test(e));
  ok("No console errors", real.length === 0, real.slice(0, 3).join(" | "));

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
