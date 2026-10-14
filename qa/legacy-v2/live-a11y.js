// Accessibility of the sandbox popovers (controls and activity feed), opened.
const { chromium } = require("playwright"); const { AxeBuilder } = require("@axe-core/playwright");
const BASE = process.env.QA_BASE || "http://localhost:4310";
(async () => { const b = await chromium.launch(); let bad = 0;
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const p = await (await b.newContext({ viewport: vp })).newPage();
    await p.goto(BASE + "/live/"); await p.waitForTimeout(600);
    await p.goto(BASE + "/sign-in/"); await p.waitForTimeout(400); await p.evaluate(() => sessionStorage.setItem("rcp-session", JSON.stringify({ userId: "u-dana", since: Date.now() })));
    await p.goto(BASE + "/app/live/"); await p.waitForTimeout(1500);
    for (const name of [/Live sandbox controls/, "Live activity feed"]) {
      await p.getByRole("button", { name }).click(); await p.waitForTimeout(400);
      const r = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      bad += r.violations.length + (over > 1 ? 1 : 0);
      console.log(`${vp.width}px ${name} popover: axe=${r.violations.map(v => v.id + ":" + v.nodes.length + " " + v.nodes[0].target.join(" ")).join(",") || "clean"}${over > 1 ? " H-OVERFLOW " + over : ""}`);
      await p.screenshot({ path: `shots/live-popover-${vp.width}-${String(name).replace(/\W+/g, "")}.png` });
      await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    }
  }
  console.log(bad ? "FAIL live popovers" : "PASS live popovers accessible"); await b.close(); })();
