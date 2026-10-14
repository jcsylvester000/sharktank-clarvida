// Runs every v3 release check against the static build in ../out.
// Usage: from the project root run `npm run build`, then in this folder `npm install` (first time) and `npm run qa`.
// First time on a new computer also run: npx playwright install chromium
const { spawn, spawnSync } = require("child_process");
const fs = require("fs"), path = require("path");
fs.mkdirSync(path.join(__dirname, "shots"), { recursive: true });
const out = path.join(__dirname, "..", "out");
if (!fs.existsSync(out)) { console.error("No build found. Run `npm run build` in the project root first."); process.exit(1); }
const server = spawn(process.execPath, [path.join(__dirname, "server.js"), out, "4310"], { stdio: "ignore" });
const only = process.argv.slice(2);
setTimeout(() => {
  let failed = 0;
  const suites = ["b1-accounts.js", "b2-care.js", "b3-outreach.js", "b4-insights.js", "b5-acceptance.js", "b5-features.js", "kb.js"].filter((s) => !only.length || only.some((o) => s.startsWith(o)));
  for (const s of suites) {
    console.log(`\n=== ${s}`);
    const r = spawnSync(process.execPath, [path.join(__dirname, s)], { cwd: __dirname, encoding: "utf8", timeout: 900000 });
    const text = (r.stdout || "") + (r.stderr || "");
    process.stdout.write(text);
    if (r.status !== 0 || /\bFAIL\b|NO VISIBLE FOCUS/.test(text)) failed++;
  }
  server.kill();
  console.log(failed ? `\n${failed} check group(s) need attention.` : "\nAll release checks passed.");
  process.exit(failed ? 1 : 0);
}, 800);
