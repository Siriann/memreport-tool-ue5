(() => {
  "use strict";

  const { buildTree, indexNodes } = window.MemReport.Tree;

  function buildReportSection(type, parser) {
    try {
      const assets = parser().map((asset) => ({ ...asset, type }));
      const root = buildTree(assets);
      return {
        type,
        assets,
        root,
        assetsByPath: new Map(assets.map((asset) => [asset.canonicalPath, asset])),
        nodesByPath: indexNodes(root),
        error: null,
      };
    } catch (error) {
      return {
        type,
        assets: [],
        root: null,
        assetsByPath: new Map(),
        nodesByPath: new Map(),
        error: error.message,
      };
    }
  }

  function buildReportModel(name, sections) {
    return { name, sections };
  }

  window.MemReport.ReportModel = { buildReportSection, buildReportModel };
})();
