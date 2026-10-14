const http = require("http"), handler = require("serve-handler");
const dir = process.argv[2], port = +process.argv[3] || 4310;
http.createServer((req, res) => handler(req, res, { public: dir, trailingSlash: true })).listen(port, () => console.log("up", port));
