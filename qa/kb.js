const { chromium } = require("playwright"); const BASE = process.env.QA_BASE || "http://localhost:4310";
(async () => { const b = await chromium.launch(); let bad = [];
 for (const path of ["/", "/sign-in/", "/partner/refer/?code=GCS-NC-2026"]) { const p = await b.newPage(); await p.goto(BASE + path); await p.waitForTimeout(800);
  for (let i = 0; i < 25; i++) { await p.keyboard.press("Tab"); const r = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const s = getComputedStyle(e); const vis = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none"; return { vis, d: e.tagName + " " + (e.getAttribute("aria-label") || e.innerText || e.id || "").slice(0, 30) }; });
   if (r && !r.vis) bad.push(path + " " + r.d); }
  await p.close(); }
 console.log(bad.length ? "NO VISIBLE FOCUS:\n  " + [...new Set(bad)].join("\n  ") : "PASS focus visible on every tabbable element checked"); await b.close(); })();
