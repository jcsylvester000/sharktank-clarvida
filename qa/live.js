// Live sandbox: separate data, simulated clock, engine in one tab, feed privacy, pause, cross-tab sync, demo isolation.
const { chromium } = require("playwright");
const BASE = process.env.QA_BASE || "http://localhost:4310";
const res = []; const ok = (n, c, d = "") => { res.push(!!c); console.log(`${c ? "PASS" : "FAIL"} ${n} ${d}`); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const errors = [], external = [];
  ctx.on("request", r => { const u = r.url(); if (!u.startsWith(BASE) && !/^(data|blob):/.test(u)) external.push(u); });
  const watch = (p, tag) => { p.on("console", m => m.type() === "error" && errors.push(`${tag} ${m.text()}`)); p.on("pageerror", e => errors.push(`${tag} PAGEERROR ${e.message}`)); };
  const p = await ctx.newPage(); watch(p, "main");
  const LS = (pg, k) => pg.evaluate(k => localStorage.getItem(k), k);

  // Demo first, so we can prove the sandbox never touches it.
  await p.goto(BASE + "/"); await p.waitForTimeout(800);
  const demoBefore = await LS(p, "rcp-demo-v2");
  ok("opening page offers the sandbox", await p.getByRole("link", { name: "Live sandbox" }).isVisible());
  await p.getByRole("link", { name: "Live sandbox" }).click(); await p.waitForURL(/\/live\/$/); await p.waitForTimeout(1200);
  ok("entry page shows simulated time and speed", /Simulated time/.test(await p.locator("main").innerText()) && await p.getByRole("group", { name: "Simulation speed" }).isVisible());
  await p.screenshot({ path: "shots/live-entry.png" });
  await p.getByRole("button", { name: /Enter the sandbox|Resume the sandbox/ }).click(); await p.waitForURL(/sign-in/);
  ok("sign-in shows the sandbox banner, no guided demo button", /Live sandbox/.test(await p.locator("body").innerText()) && !(await p.getByRole("button", { name: "Run the guided demo" }).count()));
  await p.getByRole("button", { name: /Clarvida SSO/ }).click(); await p.waitForTimeout(900);
  await p.getByLabel("6-digit code").fill("123456"); await p.getByRole("button", { name: "Verify" }).click();
  const personas = await p.locator("main ul button, section ul button").allInnerTexts();
  ok("simulated teammates are not sign-in personas", personas.length >= 10 && !personas.some(t => /Noor|Diego|Hannah|Marcus/.test(t)), `${personas.length} personas`);
  await p.getByRole("button", { name: /Dana Kim/ }).click(); await p.waitForURL(/\/app\/live\//); await p.waitForTimeout(1000);
  ok("lands on Live Operations", /Live Operations/.test(await p.locator("h1").innerText()));
  ok("no guided-demo bar in the sandbox", !(await p.getByRole("region", { name: "Guided demo" }).count()));

  // Run fast and watch things happen.
  await p.getByRole("group", { name: "Simulation speed" }).first().getByRole("button", { name: "60x" }).click();
  const t0 = await p.evaluate(() => JSON.parse(localStorage.getItem("rcp-live-v1")).live.totals);
  await p.waitForTimeout(45_000);
  const db = await p.evaluate(() => JSON.parse(localStorage.getItem("rcp-live-v1")));
  const t1 = db.live.totals;
  ok("referrals arrive on their own", t1.arrivals > t0.arrivals, `${t0.arrivals} -> ${t1.arrivals}`);
  ok("simulated teammates act", t1.simActions + t1.aiDrafts > t0.simActions + t0.aiDrafts, JSON.stringify(t1));
  ok("audit log records simulated teammates", db.audit.some(a => /^u-sim-/.test(a.actorId)));
  const c = db.live.clock; const simMin = ((c.paused ? c.anchorSim : c.anchorSim + (Date.now() - c.anchorReal) * c.speed) - db.live.startedAt) / 60000;
  ok("simulated time runs faster than real time", simMin > 20, `${simMin.toFixed(0)} simulated minutes in ~50 s`);
  const main = await p.locator("main").innerText();
  ok("dashboard tiles render", /Referrals received today/.test(main) && /Waiting for first contact/.test(main) && /Simulated teammates/.test(main));
  ok("intake role sees referral IDs in feed", /REF-(NC|CO)-\d+/.test(await p.getByRole("list", { name: "Live activity" }).innerText()));
  await p.screenshot({ path: "shots/live-ops.png", fullPage: true });

  // Second tab: sees the same world, but does not run a second engine.
  const [p2] = await Promise.all([ctx.waitForEvent("page"), p.evaluate(() => window.open("/app/intake/", "_blank"))]); watch(p2, "tab2"); await p2.waitForLoadState(); await p2.waitForTimeout(2000);
  const before2 = await p.evaluate(() => JSON.parse(localStorage.getItem("rcp-live-v1")).live);
  await p.waitForTimeout(12_000);
  const after2 = await p.evaluate(() => JSON.parse(localStorage.getItem("rcp-live-v1")).live);
  const ids = after2.feed.map(f => f.id); ok("two tabs never double the activity (unique feed ids)", new Set(ids).size === ids.length);
  ok("second tab shows sandbox queue", /Intake Queue/.test(await p2.locator("h1").innerText()) && /REF-/.test(await p2.locator("main").innerText()));
  await p2.close();

  // Pause stops time.
  await p.getByRole("group", { name: "Simulation speed" }).first().getByRole("button", { name: /Pause/ }).click(); await p.waitForTimeout(500);
  const pa = await p.locator("section[aria-label='Simulated time'] p.font-display").innerText(); await p.waitForTimeout(4000);
  ok("pause freezes the simulated clock", pa === await p.locator("section[aria-label='Simulated time'] p.font-display").innerText(), pa);
  await p.getByRole("group", { name: "Simulation speed" }).first().getByRole("button", { name: "30x" }).click();

  // Marketing sees counts-only lines.
  await p.getByRole("button", { name: "Switch persona" }).click(); await p.getByRole("button", { name: /Alex Morgan/ }).click(); await p.waitForTimeout(800);
  await p.goto(BASE + "/app/live/"); await p.waitForTimeout(1200);
  const mk = await p.getByRole("list", { name: "Live activity" }).innerText();
  ok("marketing feed has no referral IDs", !/REF-(NC|CO)-\d+/.test(mk) && /\+1 referral from/.test(mk));
  const names = db.referrals.map(r => r.guardianFirstName.replace(/\s*\(.*\)$/, "")), phones = db.referrals.map(r => r.phone);
  ok("no client names or phones in any feed text", !db.live.feed.some(f => names.some(n => new RegExp(`\\b${n}\\b`).test(f.text)) || phones.some(ph => f.text.includes(ph))));

  // Partner form submitted in the sandbox lands in the sandbox, not the demo.
  const w = await ctx.newPage(); watch(w, "partner"); await w.goto(BASE + "/partner/refer/?code=GCS-NC-2026"); await w.waitForTimeout(800);
  const f = w.locator("form"); const sel = async (i, v) => { const s = f.locator("select").nth(i); const o = await s.locator("option").allInnerTexts(); await s.selectOption({ label: o.find(x => x.includes(v)) }); };
  await sel(0, "School"); await f.locator('input[placeholder^="e.g. School"]').fill("School counselor"); await f.locator("#email").fill("c@example.org");
  await sel(2, "Gaston"); await w.waitForTimeout(200); const pr = await f.locator("select").nth(3).locator("option").allInnerTexts(); await f.locator("select").nth(3).selectOption({ label: pr.find(o => /In-home/.test(o)) || pr[1] });
  await f.locator("#age").fill("11"); await sel(4, "Medicaid"); await f.locator("#guardian").fill("Rosa"); await f.locator("#famPhone").fill("7045550101");
  const bx = f.locator("input[type=checkbox]"); for (let i = 0; i < await bx.count(); i++) { const l = await bx.nth(i).evaluate(e => e.closest("label")?.innerText || document.querySelector(`label[for="${e.id}"]`)?.innerText || ""); if (/agree|consent/i.test(l)) await bx.nth(i).check(); }
  await f.getByRole("button", { name: "Send referral" }).click(); await w.waitForTimeout(1500);
  const ref = (await w.locator("body").innerText()).match(/REF-[A-Z]{2}-\d+/)?.[0];
  const liveRefs = await p.evaluate(() => JSON.parse(localStorage.getItem("rcp-live-v1")).referrals.map(r => r.id));
  ok("partner referral lands in the sandbox", ref && liveRefs.includes(ref), ref);
  ok("pitch demo data untouched by the sandbox", demoBefore === null || (await LS(p, "rcp-demo-v2")) === demoBefore);
  await w.close();

  // Switching back to the demo restores the scripted world.
  await p.goto(BASE + "/"); await p.waitForTimeout(800);
  ok("opening page switches back to demo mode", (await p.evaluate(() => sessionStorage.getItem("rcp-mode"))) === "demo");
  await p.goto(BASE + "/sign-in/"); await p.waitForTimeout(800);
  ok("demo sign-in shows the guided demo again", await p.getByRole("button", { name: "Run the guided demo" }).isVisible());

  ok("no console errors", errors.length === 0, errors.slice(0, 6).join("\n   "));
  ok("no external requests", external.length === 0, [...new Set(external)].join(", "));
  console.log(`${res.filter(Boolean).length}/${res.length}`); await b.close();
})();
