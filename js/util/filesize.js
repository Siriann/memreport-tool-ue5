(() => {
  "use strict";

  function parseSize(text) {
    const match = String(text).trim().match(/^([0-9.]+)\s*(B|KB|MB|GB)?$/i);
    if (!match) throw new Error(`Could not parse size: ${text}`);
    const multiplier = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }[(match[2] || "B").toUpperCase()];
    return Math.trunc(Number.parseFloat(match[1]) * multiplier);
  }

  function formatBytes(bytes) {
    const units = [[1024 ** 3, "GB"], [1024 ** 2, "MB"], [1024, "KB"]];
    for (const [size, unit] of units) {
      if (bytes >= size) {
        const value = Math.round((bytes / size) * 100) / 100;
        return `${Number.isInteger(value) ? value.toFixed(0) : value}${unit}`;
      }
    }
    return `${bytes}B`;
  }

  function formatBytesSigned(bytes) {
    const sign = bytes < 0 ? "-" : "";
    return `${sign}${formatBytes(Math.abs(bytes))}`;
  }

  function formatNullableBytes(value) {
    return value == null ? "—" : formatBytes(value);
  }

  function formatDelta(value) {
    return `${value > 0 ? "+" : ""}${formatBytesSigned(value)}`;
  }

  window.MemReport = window.MemReport || {};
  window.MemReport.Filesize = { parseSize, formatBytes, formatBytesSigned, formatNullableBytes, formatDelta };
})();
