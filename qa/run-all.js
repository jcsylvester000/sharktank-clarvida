// Runs every release check against the static build in ../out.
// Usage: from the project root run `npm run build`, then in this folder `npm install` (first time) and `npm run qa`.
// First time on a new computer also run: npx playwright install chromium
const { spawn, spawnSync } = require("child_process");
const fs = require("fs"), path = require("path");
fs.mkdirSync(path.join(__dirname, "shots"), { recursive: true });
const out = path.join(__dirname, "..", "out");
if (!fs.existsSync(out)) { console.error("No build found. Run `npm run build` in the project root first."); process.exit(1); }
const server = spawn(process.execPath, [path.join(__dirname, "server.js"), out, "4310"], { stdio: "ignore" });
setTimeout(() => {
  let failed = 0;
  for (const s of ["scenario.js", "speaker.js", "privacy.js", "a11y.js", "kb.js", "live.js", "live-a11y.js"]) {
    console.log(`\n=== ${s}`);
    const r = spawnSync(process.execPath, [path.join(__dirname, s)], { cwd: __dirname, encoding: "utf8" });
    const text = (r.stdout || "") + (r.stderr || "");
    process.stdout.write(text);
    if (r.status !== 0 || /\bFAIL\b|H-OVERFLOW|axe=(?!clean)|NO VISIBLE FOCUS/.test(text)) failed++;
  }
  server.kill();
  console.log(failed ? `\n${failed} check group(s) need attention.` : "\nAll release checks passed.");
  process.exit(failed ? 1 : 0);
}, 800);
