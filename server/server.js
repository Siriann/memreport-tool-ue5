"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { FileSystemReportSource, ReportSourceError } = require("./report-source");

const projectRoot = path.resolve(__dirname, "..");
const port = Number.parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";
const reportDirectories = parseReportDirectories(process.env.MEMREPORT_DIRS);
const reportSource = new FileSystemReportSource(reportDirectories);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
]);

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (request.method === "GET" && url.pathname === "/api/reports") {
      return sendJson(response, 200, { reports: await reportSource.listReports() });
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/reports/")) {
      const reportId = decodeURIComponent(url.pathname.slice("/api/reports/".length));
      const report = await reportSource.resolveReport(reportId);
      response.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Length": report.size,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(report.name)}`,
        "Cache-Control": "no-store",
      });
      fs.createReadStream(report.absolutePath).pipe(response);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return sendJson(response, 405, { error: "Method not allowed." });
    }

    return serveStatic(url.pathname, request.method, response);
  } catch (error) {
    const statusCode = error instanceof ReportSourceError ? error.statusCode : 500;
    if (statusCode === 500) console.error(error);
    if (!response.headersSent) sendJson(response, statusCode, { error: statusCode === 500 ? "Internal server error." : error.message });
    else response.destroy(error);
  }
});

server.listen(port, host, () => {
  console.log(`MemReport server listening on http://${host}:${port}`);
  console.log("Report directories:");
  for (const directory of reportDirectories) console.log(`  - ${directory}`);
});

function parseReportDirectories(configuredDirectories) {
  if (!configuredDirectories) return [path.join(projectRoot, "sample_reports")];
  const directories = configuredDirectories
    .split(path.delimiter)
    .map((directory) => directory.trim())
    .filter(Boolean);
  return directories.length ? directories : [path.join(projectRoot, "sample_reports")];
}

async function serveStatic(requestPath, method, response) {
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  if (!isPublicAsset(relativePath)) return sendText(response, 404, "Not found");

  const absolutePath = path.resolve(projectRoot, relativePath);
  if (!isPathWithin(projectRoot, absolutePath)) return sendText(response, 403, "Forbidden");

  let stats;
  try {
    stats = await fsp.stat(absolutePath);
  } catch (error) {
    if (error.code === "ENOENT") return sendText(response, 404, "Not found");
    throw error;
  }

  if (!stats.isFile()) return sendText(response, 404, "Not found");

  response.writeHead(200, {
    "Content-Type": MIME_TYPES.get(path.extname(absolutePath).toLowerCase()) || "application/octet-stream",
    "Content-Length": stats.size,
    "Cache-Control": "no-cache",
  });
  if (method === "HEAD") return response.end();
  fs.createReadStream(absolutePath).pipe(response);
}

function isPublicAsset(relativePath) {
  if (relativePath === "index.html") return true;
  if (!(relativePath.startsWith("css/") || relativePath.startsWith("js/"))) return false;
  return MIME_TYPES.has(path.extname(relativePath).toLowerCase());
}

function isPathWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function sendJson(response, statusCode, value) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}
