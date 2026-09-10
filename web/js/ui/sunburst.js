(() => {
  "use strict";

  const { CHART_TYPES } = window.MemReport.Config;
  const { layoutChildren, treeDepth } = window.MemReport.Tree;
  const { displayValue } = window.MemReport.Display;
  const { formatBytes } = window.MemReport.Filesize;

  function renderSunburst(view, { onNavigate, tooltip }) {
    const root = view.currentRoot;
    const svg = svgEl("svg", { viewBox: "0 0 520 520", role: "img", "aria-label": `${CHART_TYPES[view.type].title} memory hierarchy` });
    const centerX = 260;
    const centerY = 260;
    const innerRadius = 64;
    const outerRadius = 235;
    const maxDepth = Math.max(1, treeDepth(root));
    const visibleDepth = Math.min(maxDepth, 7);
    const ringWidth = (outerRadius - innerRadius) / visibleDepth;

    for (const segment of layoutChildren(root, -Math.PI / 2, Math.PI * 1.5, 0, visibleDepth)) {
      if (segment.node.bytes <= 0 || segment.end - segment.start < 0.001) continue;
      const path = svgEl("path", {
        d: donutArc(centerX, centerY, innerRadius + segment.depth * ringWidth, innerRadius + (segment.depth + 1) * ringWidth, segment.start, segment.end),
        fill: colorForPath(segment.node.canonicalPath),
        class: `arc${segment.node.children.length ? " clickable" : ""}`,
        tabindex: segment.node.children.length ? "0" : null,
      });
      path.addEventListener("pointermove", (event) => showTooltip(tooltip, event, segment.node));
      path.addEventListener("pointerleave", () => hideTooltip(tooltip));
      if (segment.node.children.length) {
        const drill = () => onNavigate(segment.node.canonicalPath);
        path.addEventListener("click", drill);
        path.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            drill();
          }
        });
      }
      svg.appendChild(path);
    }
    svg.appendChild(svgText(centerX, centerY - 5, trimLabel(root.name, 20), "center-label"));
    svg.appendChild(svgText(centerX, centerY + 17, formatBytes(root.bytes), "center-value"));
    view.host.appendChild(svg);
  }

  function hideTooltip(tooltip) {
    tooltip.hidden = true;
  }

  function showTooltip(tooltip, event, node) {
    tooltip.textContent = buildNodeDescription(node);
    tooltip.hidden = false;
    const margin = 14;
    const left = Math.min(event.clientX + 16, window.innerWidth - tooltip.offsetWidth - margin);
    const top = Math.min(event.clientY + 16, window.innerHeight - tooltip.offsetHeight - margin);
    tooltip.style.left = `${Math.max(margin, left)}px`;
    tooltip.style.top = `${Math.max(margin, top)}px`;
  }

  function buildNodeDescription(node) {
    const lines = [node.canonicalPath || "/", `Size: ${formatBytes(node.bytes)}`];
    if (node.asset?.type === "textures") {
      const asset = node.asset;
      lines.push(`Dimensions: ${asset.dimensions}`, `Format: ${asset.format}`, `LOD Group: ${asset.lodGroup}`, `Streaming: ${displayValue(asset.streaming)}`, `VT: ${displayValue(asset.virtualTexture)}`, `Usage: ${asset.usageCount}`);
    }
    if (node.children.length) lines.push("Click to drill down");
    return lines.join("\n");
  }

  function colorForPath(path) {
    let hash = 2166136261;
    for (let i = 0; i < path.length; i += 1) {
      hash ^= path.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const hue = ((hash >>> 0) % 360 + 360) % 360;
    const saturation = 54 + ((hash >>> 8) % 18);
    const lightness = 43 + ((hash >>> 16) % 14);
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }

  function trimLabel(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function donutArc(cx, cy, inner, outer, start, end) {
    const large = end - start > Math.PI ? 1 : 0;
    const p1 = polar(cx, cy, outer, start);
    const p2 = polar(cx, cy, outer, end);
    const p3 = polar(cx, cy, inner, end);
    const p4 = polar(cx, cy, inner, start);
    return `M ${p1.x} ${p1.y} A ${outer} ${outer} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${inner} ${inner} 0 ${large} 0 ${p4.x} ${p4.y} Z`;
  }

  function polar(cx, cy, radius, angle) {
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  }

  function svgEl(name, attrs = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attrs)) {
      if (value !== null && value !== undefined) element.setAttribute(key, value);
    }
    return element;
  }

  function svgText(x, y, text, className) {
    const element = svgEl("text", { x, y, class: className });
    element.textContent = text;
    return element;
  }

  window.MemReport.Sunburst = { renderSunburst, hideTooltip };
})();
