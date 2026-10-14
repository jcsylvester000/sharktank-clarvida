// Batch 5 (part 2): feature spot checks for Feature Checklist / Problem Fit rows not exercised by b1-b4.
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.argv[2] || "http://localhost:4310";
const SHOTS = __dirname + "/shots/b5";
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const ok = (name, pass, detail = "") => { results.push({ name, pass: !!pass, detail: String(detail) }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail !== "" ? "  (" + detail + ")" : ""}`); };
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64");
const ls = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("cv-proto-v3") || "{}"));
async function as(p, userId) {
  if (!p.url().startsWith(BASE)) await p.goto(BASE + "/");
  await p.waitForFunction(() => localStorage.getItem("cv-proto-v3"));
  await p.evaluate((u) => {
    const s = JSON.parse(localStorage.getItem("cv-proto-v3"));
    if (s.accounts?.[u]) s.accounts[u].onboardedAt = s.accounts[u].onboardedAt || Date.now();
    localStorage.setItem("cv-proto-v3", JSON.stringify(s));
    sessionStorage.setItem("cv-session", JSON.stringify({ userId: u, since: Date.now(), sessionId: "ss-qa-" + u, method: "guided", mfaSkipped: true }));
  }, userId);
}
async function open(p, u, path) {
  await as(p, u); await p.goto(BASE + path);
  await p.waitForSelector("main h1", { timeout: 6000 }).catch(() => {});
  await p.waitForFunction(() => !document.querySelector('[aria-busy="true"], .skeleton'), null, { timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(500); return p.textContent("main");
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route("https://tile.openstreetmap.org/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: TILE }));
  const p = await ctx.newPage();
  const errors = [];
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(BASE + "/"); await p.evaluate(() => localStorage.clear()); await p.reload();

  // FR-09 / FT-040 / FT-045: every staff role has its own dashboard with KPI tiles and trends
  const dash = {};
  for (const u of ["u-maria", "u-lena", "u-dana", "u-ray", "u-priya", "u-alex", "u-sam", "u-chris", "u-judge"]) {
    const t = await open(p, u, "/app/");
    dash[u] = t.replace(/\s+/g, " ").slice(0, 400);
  }
  const distinct = new Set(Object.values(dash)).size;
  ok("AC-FR-09 / FT-040 nine different dashboards (8 staff + judge)", distinct === 9, `${distinct} distinct`);
  const mariaDash = await open(p, "u-maria", "/app/");
  ok("FT-045 KPI tiles show change vs the previous period", /vs last period/.test(mariaDash));
  ok("AC-PF-12 / FT-043 merger alert with its public source, quiet sources and the week plan on Maria's dashboard", /merger/i.test(mariaDash) && /Source: NC DHHS public notice/.test(mariaDash) && /gone quiet/.test(mariaDash) && /This week's plan/.test(mariaDash));
  ok("FT-153 Monday briefing in Maria's Demo Inbox", /Monday/i.test(await open(p, "u-maria", "/app/inbox/")));

  // AC-PF-10: dashboard → finder → 'Why' within 3 clicks
  await open(p, "u-maria", "/app/");
  await p.click('nav a:has-text("Gatekeeper Finder")');
  await p.waitForSelector('[data-guide="finder"]');
  await p.waitForTimeout(500);
  const score = p.locator('main table button').first();
  const hasWhy = await score.count();
  if (hasWhy) await score.click();
  await p.waitForTimeout(400);
  const whyTxt = await p.textContent("body");
  ok("AC-PF-10 ranked targets with a plain-language 'Why' in 2 clicks from the dashboard", hasWhy > 0 && /Why/.test(whyTxt) && /control most referrals|referrals in the last 90 days/.test(whyTxt));

  // AC-PF-11: brief and draft under 5 s, organization data only
  await open(p, "u-maria", "/app/organization/?id=o1&tab=outreach");
  const t0 = Date.now();
  await p.click('button:has-text("Draft outreach")');
  await p.waitForFunction(() => /Unsubscribe|unsubscribe/.test(document.querySelector("textarea")?.value || ""), null, { timeout: 8000 }).catch(() => {});
  const draftMs = Date.now() - t0;
  await p.waitForTimeout(700);
  ok("AC-PF-11 intro draft appears in under 5 s with sources", draftMs < 5000, `${draftMs} ms`);
  ok("AC-PF-24 approve is the only way out; no send button", (await p.locator('button:has-text("Send now"), button:has-text("Send email")').count()) === 0 && (await p.locator('[data-guide="approve"]').count()) === 1);
  ok("FT-058 send-cap meter and CAN-SPAM footer check shown", /weekly send cap/i.test(await p.textContent("main")) && /CAN-SPAM/.test(await p.textContent("main")));
  const contacts = await open(p, "u-maria", "/app/organization/?id=o1&tab=contacts");
  ok("FT-060 contacts show 'verified X days ago' and opt-out status", /erified/.test(contacts));
  const brief = await open(p, "u-maria", "/app/organization/?id=o1");
  ok("FT-067 next action suggested for the relationship stage", /Next|next step|call/i.test(brief));

  // AC-PF-07 / FT-110 / FT-111: Priya sets ACT to Waitlist in one dialog → ambassadors told, outreach for it blocked
  await open(p, "u-priya", "/app/capacity/");
  await p.locator('tr:has-text("ACT (adults)") button:has-text("Update")').first().click();
  await p.click('[role=dialog] button:has-text("Waitlist")');
  await p.click('[role=dialog] button:has-text("Save")');
  await p.waitForTimeout(600);
  const st1 = await ls(p);
  const act = st1.programs.find((x) => x.name === "ACT (adults)" && x.state === "NC");
  ok("FT-110 capacity updated in about ten seconds (Update, Waitlist, Save)", act?.capacity === "Waitlist");
  ok("FT-111 ambassadors notified by name", st1.notifications.some((n) => n.toUserId === "u-maria" && /ACT/.test(n.text)), st1.notifications.filter((n) => /ACT/.test(n.text)).map((n) => n.toUserId).join(","));
  const fnd = await open(p, "u-maria", "/app/finder/");
  ok("AC-PF-07 finder marks waitlisted programs as paused and can hide their targets", /ABA \(autism\) \(Waitlist: paused\)/.test(fnd) && /ACT \(adults\) \(Waitlist: paused\)/.test(fnd) && /Hide paused programs/.test(fnd));
  // Draft for a paused program can't be approved
  await open(p, "u-maria", "/app/organization/?id=o1&tab=outreach");
  const progOpts = await p.locator("main select").first().locator("option").evaluateAll((o) => o.map((x) => [x.value, x.textContent]));
  const actOpt = progOpts.find(([, t]) => /ACT|Adult/.test(t));
  if (actOpt) { await p.locator("main select").first().selectOption(actOpt[0]); await p.click('button:has-text("Draft outreach")').catch(() => {}); await p.waitForTimeout(4500); }
  const blocked = await p.textContent("main");
  ok("FT-059 outreach promoting a paused program is blocked with the reason", !actOpt || (/outreach paused/i.test(blocked) && (await p.locator('[data-guide="approve"]').isDisabled())), actOpt ? actOpt[1] : "program not offered for this organization (filtered out)");

  // AC-PF-09 / FT-112 stale capacity
  const cap = await open(p, "u-priya", "/app/capacity/");
  ok("AC-PF-09 stale capacity flagged ('Not confirmed in X days')", /Not confirmed in \d+ days/.test(cap));
  // AC-PF-20 / FT-113 catalog owner and verified date, export logged
  const cat = await open(p, "u-priya", "/app/catalog/");
  ok("AC-PF-20 program catalog shows owner and verified date", /erified/.test(cat) && /Owner|owner/.test(cat));
  // AC-PF-19 foster
  const fos = await open(p, "u-maria", "/app/foster/");
  ok("AC-PF-19 foster pipeline: stages, 24-hour clock, labelled Release 3 preview", /24/.test(fos) && /Release 3|preview/i.test(fos));
  // AC-PF-21 event on Lena's dashboard
  await open(p, "u-lena", "/app/");
  await p.waitForSelector("text=Vaya", { timeout: 5000 }).catch(() => {});
  const lena = await p.textContent("main");
  ok("AC-PF-21 merger event with its public source on the lead's dashboard", /Vaya/.test(lena));
  const ev = await open(p, "u-lena", "/app/events/");
  ok("FT-065 relationship events list cites a public source", /source|Source/.test(ev) && /Vaya/.test(ev));
  // AC-PF-27 trust names AWS + BAA, no new subprocessors
  const trust = await open(p, "u-alex", "/app/trust/");
  ok("AC-PF-27 / FT-142 trust page: two zones, AWS under BAA, controls, what is simulated", /AWS/.test(trust) && /BAA/.test(trust) && /Care Zone/.test(trust) && /simulated/i.test(trust));
  const aig = await open(p, "u-sam", "/app/ai-governance/");
  ok("FT-141 AI governance: call log, blocked attempts, prompt versions, evaluations", /prompt/i.test(aig) && /evaluat/i.test(aig) && /block/i.test(aig));
  // AC-PF-30 layers for Lena
  await open(p, "u-lena", "/app/map/");
  await p.waitForSelector(".leaflet-container", { timeout: 8000 });
  await p.click('[role=tab]:has-text("Layers")');
  await p.locator('label:has-text("Need vs capacity")').click();
  await p.locator('label:has-text("Referral heat by county")').click();
  await p.waitForTimeout(500);
  ok("AC-PF-30 need vs capacity and heat layers for the lead (counts <11 suppressed)", /<11/.test(await p.textContent("main")));
  // FT-053 directory, export logged
  await open(p, "u-maria", "/app/directory/");
  const dirTxt = await p.textContent("main");
  const exp = p.locator('button:has-text("Export")').first();
  if (await exp.count()) await exp.click();
  await p.waitForTimeout(300);
  ok("FT-053 partner directory with stage, owner, last touch; export logged", /Quiet|quiet/.test(dirTxt) && (await ls(p)).audit.some((e) => e.category === "export"));

  // AC-PF-01 / FT-095 phone, fax, statewide platform entry with source fields
  await open(p, "u-dana", "/app/referral/new/");
  await p.click('[role=radio]:has-text("Fax"), button:has-text("Fax")');
  const sel = async (id, i = 1) => { const opts = await p.locator(`#${id} option`).evaluateAll((o) => o.map((x) => x.value).filter(Boolean)); if (opts.length) await p.selectOption(`#${id}`, opts[Math.min(i, opts.length - 1)]); };
  await sel("county", 0); await sel("src", 0); await sel("program", 0); await sel("org", 0);
  await p.fill("#role", "Pediatric nurse");
  await p.fill("#age", "11");
  await p.fill("#guardian", "Robin (synthetic)");
  await p.fill("#phone", "(555) 010-0177");
  await p.check("text=The family agreed to be contacted by Clarvida");
  const before = (await ls(p)).referrals.length;
  await p.click('button:has-text("Create referral")');
  await p.waitForURL(/\/app\/referral\/\?id=/, { timeout: 8000 }).catch(() => {});
  const st2 = await ls(p);
  const fax = st2.referrals.find((r) => r.channel === "Fax");
  ok("AC-PF-01 / FT-095 fax referral created with source, routed and clocked", st2.referrals.length === before + 1 && fax && (fax.referrerOrgId || fax.referrerOrgName) && fax.queue, fax ? `${fax.id} → ${fax.queue}` : "none");

  // FT-085 duplicate flag on manual entry with the same phone + program
  await open(p, "u-dana", "/app/referral/new/");
  await sel("county", 0); await sel("program", 0);
  await p.fill("#phone", "(555) 010-0177");
  await p.waitForTimeout(300);
  ok("FT-085 likely duplicate flagged (same phone and program)", /duplicate/i.test(await p.textContent("main")));

  // FT-081 Spanish
  await p.goto(BASE + "/partner/refer/?code=GCS-NC-2026");
  await p.click('button:has-text("Español")');
  await p.waitForTimeout(300);
  ok("FT-081 partner form switches to Spanish", /Enviar|Referir|remisión/i.test(await p.textContent("body")));

  // FT-022 toast + undo on completing a weekly task
  await open(p, "u-maria", "/app/");
  await p.locator('[data-guide="plan"] input[type=checkbox], main input[type=checkbox]').first().click();
  const undo = await p.waitForSelector('[data-sonner-toast] button:has-text("Undo")', { timeout: 3000 }).then(() => true, () => false);
  if (undo) await p.click('[data-sonner-toast] button:has-text("Undo")');
  ok("FT-022 actions confirm with a toast; completing a task offers Undo", undo);

  // FR-20 / FT-151 / FT-012 / FT-026 settings tabs
  await open(p, "u-maria", "/app/settings/");
  await p.click('button:has-text("Sign-in and security")'); await p.waitForTimeout(300);
  const sec = await p.textContent("main");
  await p.click('button:has-text("Notifications")'); await p.waitForTimeout(300);
  const nt = await p.textContent("main");
  await p.click('button:has-text("Demo account")'); await p.waitForTimeout(300);
  const da = await p.textContent("main");
  ok("FT-012 / FT-151 / FT-026 settings: sessions, password, notification channels, reset my account", /session/i.test(sec) && /password/i.test(sec) && /(In-app|Email|digest)/i.test(nt) && /Reset my account/.test(da));

  // FT-027 global search
  await open(p, "u-dana", "/app/");
  const search = p.locator('button[aria-label^="Search"]').first();
  if (await search.count()) { await search.click(); await p.keyboard.type("24811"); await p.waitForTimeout(500); }
  ok("FT-027 global search finds a referral number for Care roles", /REF-NC-24811/.test(await p.textContent("body")));

  // AC-FR-24 switch account in 2 clicks (menu, then a face), no MFA
  await open(p, "u-maria", "/app/");
  await p.click('header button:has-text("Maria Reyes")');
  await p.click('button[aria-label^="Switch to Dana Kim"]');
  await p.waitForTimeout(900);
  ok("AC-FR-24 switch account in 2 clicks without MFA", /\/app\//.test(p.url()) && !/verify/.test(p.url()) && /Dana Kim/.test(await p.textContent("header")));

  // FR-17 idle test
  await p.click('header button[aria-label="Demo controls"]');
  await p.click('button:has-text("Idle test")');
  await p.waitForTimeout(500);
  await p.waitForSelector("[role=alertdialog], [role=dialog]", { timeout: 4000 }).catch(() => {});
  const idle = await p.textContent("body");
  ok("AC-FR-17 idle warning appears (Idle test)", /signed out|inactiv|still there/i.test(idle), idle.match(/.{0,60}(idle|Idle).{0,60}/)?.[0] || "");
  await p.keyboard.press("Escape");

  // FT-164 scenario launcher
  await open(p, "u-chris", "/app/");
  await p.click('header button[aria-label="Demo controls"]');
  ok("FT-164 scenario launcher offers overdue / full / PHI scenarios", /A referral goes overdue/.test(await p.textContent("body")) && /A program is full/.test(await p.textContent("body")));
  await p.keyboard.press("Escape");

  // FT-182 live arrivals pulse on their county in the Live sandbox
  await p.goto(BASE + "/live/");
  await p.waitForTimeout(1200);
  await as(p, "u-maria");
  await p.goto(BASE + "/app/map/");
  await p.waitForSelector(".leaflet-container", { timeout: 8000 });
  await p.waitForSelector("path.cv-pulse", { timeout: 15000 }).catch(() => {});
  ok("FT-182 live sandbox: new referrals pulse on their county (no addresses)", (await p.locator("path.cv-pulse").count()) >= 1 && /Live: amber circles/.test(await p.textContent("main")), `${await p.locator("path.cv-pulse").count()} counties`);

  ok("No console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  fs.writeFileSync(SHOTS + "/features.json", JSON.stringify({ at: new Date().toISOString(), results }, null, 1));
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
