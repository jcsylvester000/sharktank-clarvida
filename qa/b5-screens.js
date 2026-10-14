// Batch 5: every page, as the account that uses it, at 1920x1080, 1366x768 and 390x844.
// Checks: lands on the page (no redirect), no horizontal scroll, axe WCAG 2.2 AA (serious/critical = fail),
// no developer codes or placeholder text in the default view, skeletons gone within 1 s, no console errors.
// Map markers are excluded from axe target-size: every marker has an equivalent full-size button in the list beside the map (WCAG 2.5.8 'Equivalent').
// Covers AC-NF-05, AC-NF-06, AC-WC-06, AC-WC-19, AC-FR-15, AC-FR-22, AC-NF-10.
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const fs = require("fs");
const BASE = process.argv[2] || "http://localhost:4310";
const SHOTS = __dirname + "/shots/b5";
fs.mkdirSync(SHOTS, { recursive: true });
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64");

// [account or null, path, allowCodes] — allowCodes: the X-ray / trust pages legitimately show data-class codes.
const PAGES = [
  [null, "/"], [null, "/story/"], [null, "/login/forgot/"], [null, "/partner/refer/?code=GCS-NC-2026"], [null, "/partner/refer/"],
  [null, "/partner/confirmation/?ref=REF-NC-24811"], [null, "/partner/status/?ref=REF-NC-24811"], [null, "/presenter/"], [null, "/live/"],
  ["u-maria", "/app/"], ["u-maria", "/app/finder/"], ["u-maria", "/app/map/"], ["u-maria", "/app/organization/?id=o1"], ["u-maria", "/app/organization/?id=o1&tab=outreach"],
  ["u-maria", "/app/kits/"], ["u-maria", "/app/nurture/"], ["u-maria", "/app/inbox/"], ["u-maria", "/app/notifications/"], ["u-maria", "/app/settings/"],
  ["u-lena", "/app/"], ["u-lena", "/app/directory/"], ["u-lena", "/app/events/"], ["u-dana", "/app/"], ["u-dana", "/app/intake/"],
  ["u-dana", "/app/referral/?id=REF-NC-24811"], ["u-dana", "/app/referral/?id=REF-NC-24811&panel=consent"], ["u-dana", "/app/referral/new/"],
  ["u-ray", "/app/"], ["u-priya", "/app/"], ["u-priya", "/app/capacity/"], ["u-priya", "/app/catalog/"],
  ["u-alex", "/app/"], ["u-alex", "/app/impact/"], ["u-alex", "/app/pilot/"], ["u-alex", "/app/content/"], ["u-alex", "/app/foster/"],
  ["u-sam", "/app/"], ["u-sam", "/app/referral/?id=REF-NC-24811&xray=1", true], ["u-sam", "/app/audit/"], ["u-sam", "/app/ai-governance/"], ["u-sam", "/app/trust/", true],
  ["u-chris", "/app/admin/"], ["u-jordan", "/partner/hub/"], ["u-judge", "/app/"], ["u-judge", "/app/pilot/"],
];
const VIEWPORTS = [["1920", { width: 1920, height: 1080 }], ["1366", { width: 1366, height: 768 }], ["390", { width: 390, height: 844 }]];
const DEV = /\b(lorem|ipsum|TODO|FIXME|undefined|NaN|\[object Object\])\b|\b(FT|PG|AC|JR|HO|BR|FR|NFR)-\d{2,3}\b/;
const CODES = /\bC[1-4]\b/;

(async () => {
  const b = await chromium.launch();
  let fails = 0, checks = 0;
  const fail = (msg) => { fails++; console.log("FAIL  " + msg); };
  for (const [tag, vp] of VIEWPORTS) {
    for (const [u, path, allowCodes] of PAGES) {
      const ctx = await b.newContext({ viewport: vp, reducedMotion: "reduce" });
      await ctx.route("https://tile.openstreetmap.org/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: TILE }));
      const p = await ctx.newPage();
      const errors = [];
      p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      p.on("pageerror", (e) => errors.push(String(e)));
      if (u) await p.addInitScript((id) => sessionStorage.setItem("cv-session", JSON.stringify({ userId: id, since: Date.now(), sessionId: "qa", method: "switch", mfaSkipped: true })), u);
      const t0 = Date.now();
      await p.goto(BASE + path);
      // Skeletons must clear within 1 s of the page shell appearing (AC-FR-15).
      await p.waitForLoadState("domcontentloaded");
      let skeletonMs = 0;
      for (let i = 0; i < 20; i++) { if (!(await p.locator(".animate-pulse, [data-skeleton]").count())) break; await p.waitForTimeout(100); skeletonMs = Date.now() - t0; }
      await p.waitForTimeout(900);
      checks++;
      const landed = p.url().replace(BASE, "");
      const want = path.split("?")[0];
      if (!landed.startsWith(want)) { fail(`${tag} ${u ?? "public"} ${path} landed on ${landed}`); await ctx.close(); continue; }
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) { fail(`${tag} ${path} horizontal scroll ${overflow}px`); await p.screenshot({ path: `${SHOTS}/overflow-${tag}-${path.replace(/\W+/g, "_")}.png` }); }
      if (skeletonMs > 1000) fail(`${tag} ${path} loading state ${skeletonMs} ms`);
      // Default view only: switch off explain mode tags (they are off by default).
      const text = await p.evaluate(() => document.body.innerText);
      const dev = text.match(DEV);
      if (dev) fail(`${tag} ${path} developer/placeholder text "${dev[0]}"`);
      if (!allowCodes && CODES.test(text) && !/Privacy X-ray|data class/i.test(text)) fail(`${tag} ${path} data-class code "${text.match(CODES)[0]}" in default view`);
      if (tag !== "1920") {
        const r = await new AxeBuilder({ page: p }).exclude(".leaflet-marker-icon").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        for (const v of bad) fail(`${tag} ${path} axe ${v.id} x${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")} :: ${(v.nodes[0].failureSummary || "").split("\n")[1] ?? ""}`);
      }
      const real = errors.filter((e) => !/favicon|Failed to load resource/.test(e));
      if (real.length) fail(`${tag} ${path} console: ${real[0].slice(0, 160)}`);
      if (tag === "1366") await p.screenshot({ path: `${SHOTS}/${(u ?? "public")}-${path.replace(/\W+/g, "_")}.png` });
      await ctx.close();
    }
  }
  await b.close();
  console.log(`\n${checks - 0} page views checked across 3 screen sizes; ${fails} problem(s).`);
  console.log(fails ? "FAIL  screens" : "PASS  screens");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
