"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const REPORT_EXTENSION = ".memreport";

class FileSystemReportSource {
  constructor(reportDirectories) {
    if (!Array.isArray(reportDirectories) || reportDirectories.length === 0) {
      throw new TypeError("At least one report directory must be configured.");
    }

    this.roots = reportDirectories.map((directory) => path.resolve(directory));
  }

  async listReports() {
    const reports = [];

    for (const [rootIndex, root] of this.roots.entries()) {
      const rootReports = await this.#scanDirectory(root, root, rootIndex);
      reports.push(...rootReports);
    }

    reports.sort((left, right) => {
      const timeDelta = right.modifiedAt.localeCompare(left.modifiedAt);
      return timeDelta || left.relativePath.localeCompare(right.relativePath);
    });

    return reports;
  }

  async resolveReport(reportId) {
    const reference = decodeReportId(reportId);
    const root = this.roots[reference.rootIndex];
    if (!root) throw new ReportSourceError("Unknown report source.", 404);

    const candidate = path.resolve(root, reference.relativePath);
    if (!isPathWithin(root, candidate) || path.extname(candidate).toLowerCase() !== REPORT_EXTENSION) {
      throw new ReportSourceError("Invalid report path.", 400);
    }

    let stats;
    try {
      stats = await fs.stat(candidate);
    } catch (error) {
      if (error.code === "ENOENT") throw new ReportSourceError("Report not found.", 404);
      throw error;
    }

    if (!stats.isFile()) throw new ReportSourceError("Report not found.", 404);

    return {
      absolutePath: candidate,
      name: path.basename(candidate),
      relativePath: normalizeRelativePath(path.relative(root, candidate)),
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
    };
  }

  async #scanDirectory(root, directory, rootIndex) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }

    const reports = [];
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        reports.push(...await this.#scanDirectory(root, absolutePath, rootIndex));
        continue;
      }

      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== REPORT_EXTENSION) continue;

      const stats = await fs.stat(absolutePath);
      const relativePath = normalizeRelativePath(path.relative(root, absolutePath));
      reports.push({
        id: encodeReportId(rootIndex, relativePath),
        name: entry.name,
        relativePath,
        sourceIndex: rootIndex,
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
      });
    }

    return reports;
  }
}

class ReportSourceError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "ReportSourceError";
    this.statusCode = statusCode;
  }
}

function encodeReportId(rootIndex, relativePath) {
  return Buffer.from(JSON.stringify({ rootIndex, relativePath }), "utf8").toString("base64url");
}

function decodeReportId(reportId) {
  try {
    const reference = JSON.parse(Buffer.from(reportId, "base64url").toString("utf8"));
    if (!Number.isInteger(reference.rootIndex) || typeof reference.relativePath !== "string") throw new Error();
    return reference;
  } catch {
    throw new ReportSourceError("Invalid report id.", 400);
  }
}

function isPathWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function normalizeRelativePath(relativePath) {
  return relativePath.split(path.sep).join("/");
}

module.exports = { FileSystemReportSource, ReportSourceError };
