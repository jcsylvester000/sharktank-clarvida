const { chromium } = require("playwright"); const { AxeBuilder } = require("@axe-core/playwright");
const BASE = process.env.QA_BASE || "http://localhost:4310";
const P = [
 [null, "/"], [null, "/sign-in/"], [null, "/partner/refer/?code=GCS-NC-2026"], [null, "/partner/refer/"], [null, "/partner/confirmation/?ref=REF-NC-24811"], [null, "/partner/status/?ref=REF-NC-24811"], [null, "/presenter/"],
 ["u-maria", "/app/home/"], ["u-maria", "/app/finder/"], ["u-maria", "/app/organization/?id=o1&tab=brief"], ["u-maria", "/app/organization/?id=o1&tab=outreach"], ["u-maria", "/app/organization/?id=o1&tab=history"],
 ["u-lena", "/app/directory/"], ["u-lena", "/app/events/"], ["u-maria", "/app/kits/"], ["u-dana", "/app/intake/"], ["u-dana", "/app/referral/?id=REF-NC-24811"],
 ["u-dana", "/app/referral/?id=REF-NC-24811&panel=consent"], ["u-sam", "/app/referral/?id=REF-NC-24811&xray=1"], ["u-dana", "/app/referral/new/"], ["u-priya", "/app/capacity/"], ["u-priya", "/app/catalog/"],
 ["u-alex", "/app/impact/"], ["u-alex", "/app/pilot/"], ["u-maria", "/app/foster/"], ["u-sam", "/app/audit/"], ["u-alex", "/app/ai-governance/"], ["u-maria", "/app/trust/"], ["u-chris", "/app/admin/"],
 // Live sandbox (the "live:" prefix enters the sandbox first)
 [null, "live:/live/"], ["u-dana", "live:/app/live/"], ["u-alex", "live:/app/live/"], ["u-dana", "live:/app/intake/"], ["u-maria", "live:/app/home/"], ["u-dana", "live:/sign-in/"],
];
(async () => {
  const b = await chromium.launch(); const tally = {}; let total = 0;
  for (const [vp, tag] of [[{ width: 1440, height: 900 }, "desktop"], [{ width: 390, height: 844 }, "mobile"]]) {
    for (let [u, path] of P) {
      const ctx = await b.newContext({ viewport: vp, reducedMotion: "reduce" });
      const p = await ctx.newPage();
      const isLive = path.startsWith("live:"); path = path.replace(/^live:/, "");
      if (isLive) { await p.goto(BASE + "/live/"); await p.waitForTimeout(600); }
      if (u) { await p.goto(BASE + "/sign-in/"); await p.waitForTimeout(500); await p.evaluate(id => sessionStorage.setItem("rcp-session", JSON.stringify({ userId: id, since: Date.now() })), u); }
      await p.goto(BASE + path); await p.waitForTimeout(1000);
      const landed = p.url().replace(BASE, "");
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      let line = `${tag} ${path}${landed !== path ? "  ->LANDED " + landed : ""}${overflow > 1 ? "  H-OVERFLOW " + overflow + "px" : ""}`;
      if (tag === "desktop" || overflow > 1) {
        const r = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        for (const v of r.violations) { total += v.nodes.length; (tally[v.id] ??= []).push(`${tag} ${path} x${v.nodes.length}: ${v.nodes.slice(0, 3).map(n => n.target.join(" ")).join(" | ")} :: ${v.nodes[0].failureSummary.split("\n").slice(1, 2).join("")}`); }
        line += `  axe=${r.violations.map(v => v.id + ":" + v.nodes.length).join(",") || "clean"}`;
      }
      if (tag === "desktop" || overflow > 1 || landed !== path) console.log(line);
      if (overflow > 1) await p.screenshot({ path: `shots/m-${path.replace(/\W+/g, "_")}.png` });
      await ctx.close();
    }
  }
  console.log("\nTOTAL nodes", total); for (const [k, v] of Object.entries(tally)) { console.log(`\n## ${k} (${v.length} pages)`); v.slice(0, 6).forEach(x => console.log("  ", x.slice(0, 300))); }
  await b.close();
})();
