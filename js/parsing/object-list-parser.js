(() => {
  "use strict";

  const { parseResourcePath, toCanonicalPath } = window.MemReport.Paths;
  const { parseSize } = window.MemReport.Filesize;

  function parseObjectList(lines, engineClassName, fileSizeIndex) {
    const token = `Obj List: class=${engineClassName}`;
    const start = lines.findIndex((line) => line.startsWith(token));
    if (start < 0) throw new Error(`${engineClassName} section not found`);

    const assets = [];
    let contentFound = false;
    for (let i = start + 4; i < lines.length; i += 1) {
      const line = lines[i];
      if (contentFound && !line.trim()) break;
      if (!line.trim()) continue;
      const items = line.trim().split(/\s+/);
      if (items.length <= fileSizeIndex) throw new Error(`Unexpected ${engineClassName} row: ${line}`);
      const pathText = items[1];
      const path = parseResourcePath(pathText);
      assets.push({
        name: path[path.length - 1] || pathText,
        path,
        canonicalPath: toCanonicalPath(path),
        bytes: parseSize(`${items[fileSizeIndex]}KB`),
        className: engineClassName,
      });
      contentFound = true;
    }
    if (!assets.length) throw new Error(`No ${engineClassName} entries found`);
    return assets;
  }

  window.MemReport.ObjectListParser = { parseObjectList };
})();
