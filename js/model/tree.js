(() => {
  "use strict";

  function buildTree(assets) {
    const root = newNode("Root", null, "");
    for (const asset of assets) {
      root.bytes += asset.bytes;
      let parent = root;
      for (let i = 0; i < asset.path.length; i += 1) {
        const name = asset.path[i];
        const canonicalPath = `${parent.canonicalPath}/${name}`;
        let child = parent.children.find((candidate) => candidate.name === name);
        if (!child) {
          child = newNode(name, parent, canonicalPath);
          parent.children.push(child);
        }
        child.bytes += asset.bytes;
        if (i === asset.path.length - 1) child.asset = asset;
        parent = child;
      }
    }
    sortTree(root);
    return root;
  }

  function newNode(name, parent, canonicalPath) {
    return { name, parent, canonicalPath, children: [], bytes: 0, asset: null };
  }

  function sortTree(node) {
    node.children.sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
    node.children.forEach(sortTree);
  }

  function indexNodes(root) {
    const map = new Map();
    const visit = (node) => {
      map.set(node.canonicalPath || "/", node);
      node.children.forEach(visit);
    };
    visit(root);
    return map;
  }

  function treeDepth(node) {
    if (!node.children.length) return 0;
    return 1 + Math.max(...node.children.map(treeDepth));
  }

  function layoutChildren(parent, start, end, depth, depthLimit) {
    if (depth >= depthLimit || !parent.children.length || parent.bytes <= 0) return [];
    const result = [];
    let angle = start;
    for (const child of parent.children) {
      const span = (end - start) * (child.bytes / parent.bytes);
      const childEnd = angle + span;
      result.push({ node: child, start: angle, end: childEnd, depth });
      result.push(...layoutChildren(child, angle, childEnd, depth + 1, depthLimit));
      angle = childEnd;
    }
    return result;
  }

  window.MemReport = window.MemReport || {};
  window.MemReport.Tree = { buildTree, indexNodes, treeDepth, layoutChildren };
})();
