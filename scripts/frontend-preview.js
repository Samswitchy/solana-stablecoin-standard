#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import http from "node:http";

const PORT = Number(process.env.PORT ?? 4173);
const ROOT = path.resolve("examples/frontend");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

function resolvePath(urlPath) {
  const requestPath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(ROOT, requestPath));
  if (!filePath.startsWith(ROOT)) {
    throw new Error("Invalid path");
  }
  return filePath;
}

const server = http.createServer((req, res) => {
  try {
    const filePath = resolvePath(new URL(req.url, "http://localhost").pathname);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found\n");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "content-type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end("Bad request\n");
  }
});

server.listen(PORT, () => {
  console.log(`SSS frontend preview running at http://127.0.0.1:${PORT}`);
});
