(() => {
  "use strict";

  function assetsUnderNode(assets, node) {
    if (!node.canonicalPath) return assets.slice();
    const prefix = `${node.canonicalPath}/`;
    return assets.filter((asset) => asset.canonicalPath === node.canonicalPath || asset.canonicalPath.startsWith(prefix));
  }

  function resolveSectionPath(report, type, path) {
    const section = report?.sections[type];
    if (!section?.root) return { node: null, missing: false };
    const node = path === "/" ? section.root : section.nodesByPath.get(path) || null;
    return { node, missing: !node };
  }

  window.MemReport.Queries = { assetsUnderNode, resolveSectionPath };
})();
