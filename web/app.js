(() => {
  "use strict";

  const CHART_TYPES = {
    textures: { title: "Textures" },
    sounds: { title: "Sounds" },
    animsequences: { title: "Animations" },
  };

  const folderInput = document.getElementById("folderInput");
  const reportSelect = document.getElementById("reportSelect");
  const statusEl = document.getElementById("status");
  const tooltip = document.getElementById("tooltip");
  const chartViews = new Map();
  const reports = new Map();

  document.querySelectorAll(".chart-card").forEach((card) => {
    const type = card.dataset.chart;
    chartViews.set(type, {
      type,
      host: card.querySelector('[data-role="chart"]'),
      breadcrumb: card.querySelector('[data-role="breadcrumb"]'),
      summary: card.querySelector('[data-role="summary"]'),
      back: card.querySelector('[data-role="back"]'),
      root: null,
      currentRoot: null,
      history: [],
    });
  });

  folderInput.addEventListener("change", async () => {
    const files = [...folderInput.files]
      .filter((file) => file.name.toLowerCase().endsWith(".memreport"))
      .sort((a, b) => displayPath(a).localeCompare(displayPath(b)));

    reports.clear();
    reportSelect.innerHTML = "";

    if (!files.length) {
      reportSelect.disabled = true;
      reportSelect.innerHTML = "<option>No .memreport files found</option>";
      setStatus("The selected folder does not contain any .memreport files.", true);
      clearCharts();
      return;
    }

    for (const file of files) reports.set(displayPath(file), file);
    for (const name of reports.keys()) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      reportSelect.appendChild(option);
    }

    reportSelect.disabled = false;
    setStatus(`Found ${files.length} memreport file${files.length === 1 ? "" : "s"}.`);
    await loadSelectedReport();
  });

  reportSelect.addEventListener("change", loadSelectedReport);

  chartViews.forEach((view) => {
    view.back.addEventListener("click", () => {
      if (!view.history.length) return;
      view.currentRoot = view.history.pop();
      renderView(view);
    });
  });

  function displayPath(file) {
    return file.webkitRelativePath || file.name;
  }

  async function loadSelectedReport() {
    const file = reports.get(reportSelect.value);
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseMemReport(text);
      let available = 0;

      chartViews.forEach((view, type) => {
        const result = parsed[type];
        view.history = [];
        view.root = result.root;
        view.currentRoot = result.root;
        view.error = result.error;
        if (result.root) available += 1;
        renderView(view);
      });

      if (available) {
        setStatus(`${file.name} loaded locally. ${available}/3 detailed asset sections found.`);
      } else {
        setStatus(`${file.name} does not contain any supported detailed asset sections.`, true);
      }
    } catch (error) {
      console.error(error);
      clearCharts();
      setStatus(`Could not parse ${file.name}: ${error.message}`, true);
    }
  }

  function clearCharts() {
    chartViews.forEach((view) => {
      view.root = null;
      view.currentRoot = null;
      view.history = [];
      view.error = null;
      renderView(view);
    });
  }

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function parseMemReport(text) {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    return {
      textures: parseSection(() => parseTextures(lines)),
      sounds: parseSection(() => parseObjectList(lines, "SoundWave", 4)),
      animsequences: parseSection(() => parseObjectList(lines, "AnimSequence", 3)),
    };
  }

  function parseSection(parser) {
    try {
      const assets = parser();
      return { root: buildTree(assets), error: null };
    } catch (error) {
      return { root: null, error: error.message };
    }
  }

  function parseTextures(lines) {
    const start = lines.findIndex((line) => line.startsWith("Listing all textures"));
    if (start < 0) throw new Error("ListTextures section not found");
    if (start + 1 >= lines.length) throw new Error("ListTextures header not found");

    const header = splitTextureColumns(lines[start + 1]);
    const indexes = new Map(header.map((column, index) => [normalizeTextureColumnName(column), index]));
    const required = ["current/inmem", "format", "lodgroup", "name", "streaming", "usagecount"];
    const missing = required.filter((name) => !indexes.has(name));
    if (missing.length) throw new Error(`ListTextures header is missing columns: ${missing.join(", ")}`);

    const assets = [];
    for (let i = start + 2; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.startsWith("Total")) break;
      if (!line.trim()) continue;

      const items = splitTextureColumns(line);
      const maxIndex = Math.max(...required.map((name) => indexes.get(name)));
      if (items.length <= maxIndex) throw new Error(`Unexpected ListTextures row: ${line}`);

      const current = items[indexes.get("current/inmem")];
      const match = current.match(/\(([0-9.]+)\s*(B|KB|MB|GB)\)/i);
      if (!match) throw new Error(`Could not parse texture size: ${current}`);

      const dimensions = current.split(" ", 1)[0];
      const pathText = items[indexes.get("name")];
      const streaming = items[indexes.get("streaming")].toUpperCase() === "YES";
      const vtIndex = indexes.get("vt");
      const virtualTexture = vtIndex !== undefined && vtIndex < items.length && items[vtIndex].toUpperCase() === "YES";
      const bytes = parseSize(`${match[1]}${match[2]}`);

      assets.push({
        path: parseResourcePath(pathText),
        bytes,
        description: [
          `Name: ${assetName(pathText)}`,
          `Dimensions: ${dimensions}`,
          `Size: ${formatBytes(bytes)}`,
          `Format: ${items[indexes.get("format")]}`,
          `TexGroup: ${items[indexes.get("lodgroup")]}`,
          `Streaming: ${streaming ? "Yes" : "No"}`,
          `Virtual texture: ${virtualTexture ? "Yes" : "No"}`,
          `Usages: ${items[indexes.get("usagecount")]}`,
        ].join("\n"),
      });
    }

    if (!assets.length) throw new Error("No texture entries found");
    return assets;
  }

  function parseObjectList(lines, engineClassName, fileSizeIndex) {
    const token = `Obj List: class=${engineClassName}`;
    const start = lines.findIndex((line) => line.startsWith(token));
    if (start < 0) throw new Error(`${engineClassName} section not found`);

    const assets = [];
    let contentFound = false;
    const firstDataIndex = start + 4;

    for (let i = firstDataIndex; i < lines.length; i += 1) {
      const line = lines[i];
      if (contentFound && !line.trim()) break;
      if (!line.trim()) continue;

      const items = line.trim().split(/\s+/);
      if (items.length <= fileSizeIndex) throw new Error(`Unexpected ${engineClassName} row: ${line}`);

      const pathText = items[1];
      const bytes = parseSize(`${items[fileSizeIndex]}KB`);
      assets.push({
        path: parseResourcePath(pathText),
        bytes,
        description: `Name: ${assetName(pathText)}\nSize: ${formatBytes(bytes)}`,
      });
      contentFound = true;
    }

    if (!assets.length) throw new Error(`No ${engineClassName} entries found`);
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
      } else {
        current += char;
      }
    }
    columns.push(current.trim());
    return columns;
  }

  function normalizeTextureColumnName(name) {
    return name.split(":", 1)[0].toLowerCase().replace(/\s+/g, "");
  }

  function parseSize(text) {
    const match = String(text).trim().match(/^([0-9.]+)\s*(B|KB|MB|GB)?$/i);
    if (!match) throw new Error(`Could not parse size: ${text}`);
    const multiplier = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }[(match[2] || "B").toUpperCase()];
    return Math.trunc(Number.parseFloat(match[1]) * multiplier);
  }

  function parseResourcePath(text) {
    let chunks = String(text).split("/").slice(1);
    if (!chunks.length) return [String(text)];
    const last = chunks[chunks.length - 1].split(".");
    if (last.length >= 2 && last[0] === last[1]) chunks[chunks.length - 1] = last[0];
    return chunks.filter(Boolean);
  }

  function assetName(pathText) {
    const chunks = parseResourcePath(pathText);
    return chunks[chunks.length - 1] || pathText;
  }

  function buildTree(assets) {
    let nextId = 0;
    const root = newNode("Root", null, nextId++);
    for (const asset of assets) {
      root.bytes += asset.bytes;
      let parent = root;
      for (let i = 0; i < asset.path.length; i += 1) {
        const name = asset.path[i];
        let child = parent.children.find((candidate) => candidate.name === name);
        if (!child) {
          child = newNode(name, parent, nextId++);
          parent.children.push(child);
        }
        child.bytes += asset.bytes;
        if (i === asset.path.length - 1) child.description = asset.description;
        parent = child;
      }
    }
    sortTree(root);
    return root;
  }

  function newNode(name, parent, id) {
    return { id, name, parent, children: [], bytes: 0, description: "" };
  }

  function sortTree(node) {
    node.children.sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
    node.children.forEach(sortTree);
  }

  function renderView(view) {
    view.host.replaceChildren();
    hideTooltip();

    if (!view.currentRoot) {
      view.breadcrumb.textContent = "—";
      view.summary.textContent = view.error || "No report loaded.";
      view.back.disabled = true;
      const empty = document.createElement("div");
      empty.className = "chart-empty";
      empty.textContent = view.error || "Choose a reports folder to begin.";
      view.host.appendChild(empty);
      return;
    }

    view.back.disabled = view.history.length === 0;
    view.breadcrumb.textContent = buildNodePath(view.currentRoot) || "/";
    const leaves = countLeaves(view.currentRoot);
    view.summary.textContent = `${formatBytes(view.currentRoot.bytes)} · ${leaves} asset${leaves === 1 ? "" : "s"}`;

    const svg = svgEl("svg", { viewBox: "0 0 520 520", role: "img", "aria-label": `${CHART_TYPES[view.type].title} memory hierarchy` });
    const centerX = 260;
    const centerY = 260;
    const innerRadius = 64;
    const outerRadius = 235;
    const maxDepth = Math.max(1, treeDepth(view.currentRoot));
    const visibleDepth = Math.min(maxDepth, 7);
    const ringWidth = (outerRadius - innerRadius) / visibleDepth;

    layoutChildren(view.currentRoot, -Math.PI / 2, Math.PI * 1.5, 0, visibleDepth).forEach((segment) => {
      if (segment.node.bytes <= 0 || segment.end - segment.start < 0.001) return;
      const path = svgEl("path", {
        d: donutArc(centerX, centerY, innerRadius + segment.depth * ringWidth, innerRadius + (segment.depth + 1) * ringWidth, segment.start, segment.end),
        fill: colorForNode(segment.node, segment.depth),
        class: `arc${segment.node.children.length ? " clickable" : ""}`,
        tabindex: segment.node.children.length ? "0" : null,
      });

      path.addEventListener("pointermove", (event) => showTooltip(event, segment.node));
      path.addEventListener("pointerleave", hideTooltip);
      if (segment.node.children.length) {
        const drill = () => {
          view.history.push(view.currentRoot);
          view.currentRoot = segment.node;
          renderView(view);
        };
        path.addEventListener("click", drill);
        path.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            drill();
          }
        });
      }
      svg.appendChild(path);
    });

    svg.appendChild(svgText(centerX, centerY - 5, trimLabel(view.currentRoot.name, 20), "center-label"));
    svg.appendChild(svgText(centerX, centerY + 17, formatBytes(view.currentRoot.bytes), "center-value"));
    view.host.appendChild(svg);
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

  function treeDepth(node) {
    if (!node.children.length) return 0;
    return 1 + Math.max(...node.children.map(treeDepth));
  }

  function countLeaves(node) {
    if (!node.children.length) return 1;
    return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
  }

  function buildNodePath(node) {
    const chunks = [];
    let current = node;
    while (current && current.parent) {
      chunks.unshift(current.name);
      current = current.parent;
    }
    return chunks.length ? `/${chunks.join("/")}` : "";
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

  function colorForNode(node, depth) {
    const key = buildNodePath(node) || node.name;
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    const lightness = Math.max(38, 60 - depth * 3);
    return `hsl(${hue} 58% ${lightness}%)`;
  }

  function trimLabel(text, length) {
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
  }

  function showTooltip(event, node) {
    const path = buildNodePath(node) || "/";
    const detail = node.description ? `\n${node.description}` : "";
    tooltip.textContent = `${path}\n${formatBytes(node.bytes)}${detail}`;
    tooltip.hidden = false;
    const margin = 14;
    const rect = tooltip.getBoundingClientRect();
    let left = event.clientX + 14;
    let top = event.clientY + 14;
    if (left + rect.width > window.innerWidth - margin) left = event.clientX - rect.width - 14;
    if (top + rect.height > window.innerHeight - margin) top = event.clientY - rect.height - 14;
    tooltip.style.left = `${Math.max(margin, left)}px`;
    tooltip.style.top = `${Math.max(margin, top)}px`;
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  function donutArc(cx, cy, innerR, outerR, start, end) {
    if (end - start >= Math.PI * 2 - 1e-6) end = start + Math.PI * 2 - 1e-6;
    const p1 = polar(cx, cy, outerR, start);
    const p2 = polar(cx, cy, outerR, end);
    const p3 = polar(cx, cy, innerR, end);
    const p4 = polar(cx, cy, innerR, start);
    const large = end - start > Math.PI ? 1 : 0;
    return [`M ${p1.x} ${p1.y}`, `A ${outerR} ${outerR} 0 ${large} 1 ${p2.x} ${p2.y}`, `L ${p3.x} ${p3.y}`, `A ${innerR} ${innerR} 0 ${large} 0 ${p4.x} ${p4.y}`, "Z"].join(" ");
  }

  function polar(cx, cy, radius, angle) {
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  }

  function svgEl(name, attrs = {}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attrs)) {
      if (value !== null && value !== undefined) el.setAttribute(key, value);
    }
    return el;
  }

  function svgText(x, y, text, className) {
    const el = svgEl("text", { x, y, class: className });
    el.textContent = text;
    return el;
  }

  clearCharts();
})();
