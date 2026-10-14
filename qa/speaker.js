const { chromium } = require("playwright"); const BASE = process.env.QA_BASE || "http://localhost:4310";
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
 const p = await ctx.newPage(); await p.goto(BASE + "/"); await p.getByRole("button", { name: /guided demo/i }).click(); await p.waitForTimeout(800);
 const s = await ctx.newPage(); await s.goto(BASE + "/presenter/"); await s.evaluate(() => { window.name = "speaker"; }); await s.reload(); await s.waitForTimeout(800);
 const nextBtn = s.getByRole("button", { name: /^Next/ }).first();
 for (let i = 0; i < 3; i++) { await nextBtn.click(); await p.waitForTimeout(900); }
 const url = p.url().replace(BASE, ""); const t = await s.locator("body").innerText();
 console.log(url.startsWith("/app/organization") ? "PASS" : "FAIL", "speaker window drives demo to step 4:", url, "| speaker shows", t.match(/\b4\s*\/\s*13|Step 4/)?.[0] ?? "?");
 await s.screenshot({ path: "shots/speaker.png" }); await b.close(); })();
