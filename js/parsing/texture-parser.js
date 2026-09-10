(() => {
  "use strict";

  const { parseResourcePath, toCanonicalPath } = window.MemReport.Paths;
  const { parseSize } = window.MemReport.Filesize;

  function parseTextures(lines) {
    const start = lines.findIndex((line) => line.startsWith("Listing all textures"));
    if (start < 0) throw new Error("ListTextures section not found");
    if (start + 1 >= lines.length) throw new Error("ListTextures header not found");

    const header = splitTextureColumns(lines[start + 1]);
    const indexes = new Map(header.map((column, index) => [normalizeTextureColumnName(column), index]));
    const required = ["current/inmem", "format", "lodgroup", "name", "streaming", "usagecount"];
    const missing = required.filter((column) => !indexes.has(column));
    if (missing.length) throw new Error(`ListTextures header is missing columns: ${missing.join(", ")}`);

    const assets = [];
    for (let i = start + 2; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.startsWith("Total")) break;
      if (!line.trim()) continue;
      const items = splitTextureColumns(line);
      const maxIndex = Math.max(...required.map((column) => indexes.get(column)));
      if (items.length <= maxIndex) throw new Error(`Unexpected ListTextures row: ${line}`);

      const current = items[indexes.get("current/inmem")];
      const sizeMatch = current.match(/\(([0-9.]+)\s*(B|KB|MB|GB)\)/i);
      if (!sizeMatch) throw new Error(`Could not parse texture size: ${current}`);
      const pathText = items[indexes.get("name")];
      const path = parseResourcePath(pathText);
      const vtIndex = indexes.get("vt");
      const unknownRefIndex = indexes.get("unknownref");
      assets.push({
        name: path[path.length - 1] || pathText,
        path,
        canonicalPath: toCanonicalPath(path),
        bytes: parseSize(`${sizeMatch[1]}${sizeMatch[2]}`),
        dimensions: current.split(" ", 1)[0],
        format: items[indexes.get("format")],
        lodGroup: items[indexes.get("lodgroup")],
        streaming: items[indexes.get("streaming")].toUpperCase() === "YES",
        virtualTexture: vtIndex !== undefined && vtIndex < items.length && items[vtIndex].toUpperCase() === "YES",
        usageCount: items[indexes.get("usagecount")],
        unknownRef: unknownRefIndex !== undefined && unknownRefIndex < items.length ? items[unknownRefIndex] : "",
      });
    }
    if (!assets.length) throw new Error("No texture entries found");
    return assets;
  }

  function splitTextureColumns(text) {
    const columns = [];
    let current = "";
    let depth = 0;
    for (const char of text.trim()) {
      if (char === "(") depth += 1;
      else if (char === ")" && depth) depth -= 1;
      if (char === "," && depth === 0) {
        columns.push(current.trim());
        current = "";
      } else current += char;
    }
    columns.push(current.trim());
    return columns;
  }

  function normalizeTextureColumnName(name) {
    return name.split(":", 1)[0].toLowerCase().replace(/\s+/g, "");
  }

  window.MemReport.TextureParser = { parseTextures };
})();
