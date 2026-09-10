(() => {
  "use strict";

  function parseResourcePath(text) {
    const raw = String(text);
    const chunks = raw.split("/").slice(1);
    if (!chunks.length) return [raw];
    const last = chunks[chunks.length - 1].split(".");
    if (last.length >= 2 && last[0] === last[1]) chunks[chunks.length - 1] = last[0];
    return chunks.filter(Boolean);
  }

  function toCanonicalPath(pathParts) {
    return `/${pathParts.join("/")}`;
  }

  function parentPath(path) {
    const slash = path.lastIndexOf("/");
    return slash <= 0 ? "/" : path.slice(0, slash);
  }

  window.MemReport = window.MemReport || {};
  window.MemReport.Paths = { parseResourcePath, toCanonicalPath, parentPath };
})();
