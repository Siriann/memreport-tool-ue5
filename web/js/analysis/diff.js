(() => {
  "use strict";

  const { CHART_TYPES } = window.MemReport.Config;
  const { formatBytes } = window.MemReport.Filesize;
  const { displayValue } = window.MemReport.Display;

  function buildDirectoryDiff(a, b) {
    const rows = [];
    for (const type of Object.keys(CHART_TYPES)) {
      const aNodes = a.sections[type].nodesByPath;
      const bNodes = b.sections[type].nodesByPath;
      const paths = new Set([...aNodes.keys(), ...bNodes.keys()]);
      paths.delete("/");
      for (const path of paths) {
        const an = aNodes.get(path);
        const bn = bNodes.get(path);
        if (an?.asset || bn?.asset) continue;
        const aBytes = an?.bytes ?? null;
        const bBytes = bn?.bytes ?? null;
        const status = !an ? "Added" : !bn ? "Removed" : aBytes !== bBytes ? "Changed" : null;
        if (!status) continue;
        rows.push({ status, assetType: type, canonicalPath: path, aBytes, bBytes, deltaBytes: (bBytes || 0) - (aBytes || 0) });
      }
    }
    return rows;
  }

  function buildAssetDiff(a, b) {
    const rows = [];
    for (const type of Object.keys(CHART_TYPES)) {
      const aa = a.sections[type].assetsByPath;
      const bb = b.sections[type].assetsByPath;
      const paths = new Set([...aa.keys(), ...bb.keys()]);
      for (const path of paths) {
        const av = aa.get(path);
        const bv = bb.get(path);
        const status = !av ? "Added" : !bv ? "Removed" : assetChanged(av, bv) ? "Changed" : null;
        if (!status) continue;
        rows.push({
          status,
          assetType: type,
          canonicalPath: path,
          aBytes: av?.bytes ?? null,
          bBytes: bv?.bytes ?? null,
          deltaBytes: (bv?.bytes || 0) - (av?.bytes || 0),
          changes: av && bv ? describeAssetChanges(av, bv) : "",
        });
      }
    }
    return rows;
  }

  function assetChanged(a, b) {
    const keys = a.type === "textures"
      ? ["bytes", "dimensions", "format", "lodGroup", "streaming", "virtualTexture", "usageCount", "unknownRef"]
      : ["bytes"];
    return keys.some((key) => a[key] !== b[key]);
  }

  function describeAssetChanges(a, b) {
    const labels = {
      bytes: "Size",
      dimensions: "Dimensions",
      format: "Format",
      lodGroup: "LOD Group",
      streaming: "Streaming",
      virtualTexture: "VT",
      usageCount: "Usage",
      unknownRef: "Unknown Ref",
    };
    const keys = a.type === "textures" ? Object.keys(labels) : ["bytes"];
    return keys.filter((key) => a[key] !== b[key]).map((key) => {
      const left = key === "bytes" ? formatBytes(a[key]) : displayValue(a[key]);
      const right = key === "bytes" ? formatBytes(b[key]) : displayValue(b[key]);
      return `${labels[key]}: ${left} → ${right}`;
    }).join("; ");
  }

  window.MemReport.Diff = { buildDirectoryDiff, buildAssetDiff };
})();
