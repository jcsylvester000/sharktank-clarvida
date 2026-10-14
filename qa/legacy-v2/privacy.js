const { chromium } = require("playwright"); const BASE = process.env.QA_BASE || "http://localhost:4310";
const res = []; const ok = (n, c, d = "") => { res.push(c); console.log(`${c ? "PASS" : "FAIL"} ${n} ${d}`); };
const as = async (b, u, path) => { const ctx = await b.newContext(); const p = await ctx.newPage(); await p.goto(BASE + "/sign-in/"); await p.waitForTimeout(400);
  if (u) await p.evaluate(id => sessionStorage.setItem("rcp-session", JSON.stringify({ userId: id, since: Date.now() })), u); await p.goto(BASE + path); await p.waitForTimeout(1000); return p; };
(async () => { const b = await chromium.launch();
  // Role gating: marketing and ambassadors never reach client records.
  for (const [u, path] of [["u-alex", "/app/referral/?id=REF-NC-24811"], ["u-maria", "/app/referral/?id=REF-NC-24811"], ["u-alex", "/app/intake/"], ["u-maria", "/app/intake/"], ["u-priya", "/app/referral/?id=REF-NC-24811"]]) {
    const p = await as(b, u, path); const t = await p.locator("body").innerText();
    const seed = JSON.parse(await p.evaluate(() => localStorage.getItem("rcp-demo-v2"))); const r = seed.referrals.find(x => x.id === "REF-NC-24811");
    ok(`gate ${u} ${path}`, !t.includes(r.guardianFirstName + "\n") && !t.includes(r.phone) && /access|not available|permission|don't have|cannot/i.test(t), `guardian=${r.guardianFirstName}`);
    await p.context().close(); }
  // Outreach zone pages never render client contact fields.
  const p = await as(b, "u-maria", "/app/home/"); const db = JSON.parse(await p.evaluate(() => localStorage.getItem("rcp-demo-v2")));
  const phones = db.referrals.map(r => r.phone).filter(Boolean); const staff = db.users.map(u => u.name).join(" "); const names = [...new Set(db.referrals.map(r => (r.guardianFirstName || "").replace(/\s*\(.*\)$/, "")).filter(n => n && !staff.includes(n)))];
  console.log("checking", phones.length, "phones,", names.length, "guardian names");
  for (const [u, path] of [["u-maria", "/app/home/"], ["u-maria", "/app/finder/"], ["u-maria", "/app/organization/?id=o1&tab=history"], ["u-lena", "/app/directory/"], ["u-alex", "/app/impact/"], ["u-alex", "/app/pilot/"], ["u-maria", "/app/foster/"], ["u-alex", "/app/ai-governance/"]]) {
    const q = await as(b, u, path); const t = await q.locator("body").innerText();
    const leak = phones.filter(x => t.includes(x)).concat(names.filter(n => new RegExp(`\\b${n}\\b`).test(t)));
    ok(`outreach no client data ${path}`, leak.length === 0, leak.slice(0, 3).join(",")); await q.context().close(); }
  // AI log entries hold no client identifiers.
  const ai = JSON.stringify(db.aiLog ?? db.ai ?? Object.entries(db).filter(([k]) => /ai/i.test(k)));
  ok("AI log free of client phones/names", !phones.some(x => ai.includes(x)) && !names.some(n => new RegExp(`\\b${n}\\b`).test(ai)), `keys=${Object.keys(db).filter(k => /ai/i.test(k)).join(",")}`);
  // Small-cell suppression on impact (<11) present.
  const im = await as(b, "u-alex", "/app/impact/"); ok("small-cell suppression marker present", /fewer than 11|<\s?11|suppress/i.test(await im.locator("body").innerText())); await im.context().close();
  console.log(`${res.filter(Boolean).length}/${res.length}`); await b.close(); })();
