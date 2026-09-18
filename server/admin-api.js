const fs = require("fs");
const http = require("http");
const path = require("path");
const env = require("./env");
const { handle } = require("./api");
const { rebuild } = require("./rebuild");

const SITE = path.join(env.ROOT, "_site");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function safeSiteFile(urlPath) {
  let pathname = decodeURIComponent(String(urlPath || "/").split("?")[0]).replace(/\\/g, "/");
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  if (pathname.endsWith("/")) pathname += "index.html";
  if (!path.posix.extname(pathname)) pathname += "/index.html";
  const rel = pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const file = path.normalize(path.join(SITE, ...rel));
  const root = path.normalize(SITE + path.sep);
  if (!file.startsWith(root)) return null;
  return file;
}

function serveSite(req, res) {
  const file = safeSiteFile(req.url || "/");
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, {
    "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-store, no-cache, must-revalidate"
  });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const handled = await handle(req, res);
    if (!handled) serveSite(req, res);
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    }
    res.end(JSON.stringify({ error: err.message || "Server error" }));
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${env.port} is already in use. Stop the other Node/Eleventy process, then run npm.cmd run start again.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

rebuild()
  .catch((err) => console.error("Initial rebuild failed:", err))
  .finally(() => {
    server.listen(env.port, () => {
      console.log(`Main website  http://localhost:${env.port}/`);
      console.log(`Admin         http://localhost:${env.port}/admin/`);
      console.log(`Blog          http://localhost:${env.port}/blog/`);
      console.log(`Journal       http://localhost:${env.port}/journal/`);
    });
  });

function shutdown() {
  server.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
