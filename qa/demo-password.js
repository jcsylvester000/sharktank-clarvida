// The shared demo password lives in one place for people (README) and one for the app (the Demo accounts card).
// QA reads it from the README so it is never repeated in test code.
const fs = require("fs"), path = require("path");
const m = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8").match(/use the password \*\*(.+?)\*\*/);
if (!m) throw new Error("Demo password not found in README.md");
module.exports = m[1];
