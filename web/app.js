(() => {
  "use strict";

  const CHART_TYPES = {
    textures: { title: "Textures" },
    sounds: { title: "Sounds" },
    animsequences: { title: "Animations" },
  };

  const state = {
    reports: { A: null, B: null },
    views: new Map(),
    diffTab: "directories",
    diffType: "all",
    diffSort: { key: "deltaBytes", direction: -1 },
    activeComparisonType: "textures",
    selectedDiff: null,
    syncNavigation: true,
    jointHistory: new Map(Object.keys(CHART_TYPES).map((type) => [type, []])),
    jointCurrentPath: new Map(Object.keys(CHART_TYPES).map((type) => [type, "/"])),
  };

  const statusEl = document.getElementById("status");
  const tooltip = document.getElementById("tooltip");
  const diffSection = document.getElementById("diffSection");
  const diffTable = document.getElementById("diffTable");
  const diffSummary = document.getElementById("diffSummary");
  const diffTypeFilter = document.getElementById("diffTypeFilter");
  const syncNavigationInput = document.getElementById("syncNavigation");

  buildReportColumns();
  wireReportInput("A");
  wireReportInput("B");

  document.getElementById("clearB").addEventListener("click", () => clearReport("B"));
  syncNavigationInput.addEventListener("change", () => {
    state.syncNavigation = syncNavigationInput.checked;
    clearDiffSelection();
    if (state.syncNavigation && isComparing()) {
      const type = state.activeComparisonType;
      const source = state.views.get(`A:${type}`);
      const path = currentPath(source);
      state.jointHistory.set(type, []);
      navigateJoint(type, path, { recordHistory: false });
    } else {
      renderNavigationControlsForType(state.activeComparisonType);
    }
  });

  diffTypeFilter.addEventListener("change", () => {
    state.diffType = diffTypeFilter.value;
    renderDiff();
  });

  document.querySelectorAll("[data-diff-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.diffTab = button.dataset.diffTab;
      state.diffSort = { key: "deltaBytes", direction: -1 };
      document.querySelectorAll("[data-diff-tab]").forEach((item) => item.classList.toggle("active", item === button));
      renderDiff();
    });
  });

  window.addEventListener("memreport:comparison-type-changed", (event) => {
    const type = event.detail?.type;
    if (!CHART_TYPES[type]) return;
    state.activeComparisonType = type;
    renderNavigationControlsForType(type);
  });

  function buildReportColumns() {
    document.querySelectorAll(".report-column").forEach((column) => {
      const side = column.dataset.side;
      const stack = column.querySelector('[data-role="stack"]');
      for (const [type, config] of Object.entries(CHART_TYPES)) {
        const card = document.createElement("article");
        card.className = "chart-card";
        card.dataset.chart = type;
        card.innerHTML = `
          <div class="chart-heading">
            <div><h2>${config.title}</h2><div class="breadcrumb" data-role="breadcrumb">—</div></div>
            <div class="chart-actions">
              <button class="home-button" data-role="home" disabled>⌂ Home</button>
              <button class="back-button" data-role="back" disabled>← Back</button>
            </div>
          </div>
          <div class="chart-host" data-role="chart"></div>
          <div class="chart-footer" data-role="summary"></div>
          <div class="asset-table-panel">
            <div class="table-title"><span data-role="table-title">Assets in current section</span><span data-role="table-count"></span></div>
            <div class="table-wrap" data-role="table"></div>
          </div>`;
        stack.appendChild(card);

        const view = {
          side,
          type,
          host: card.querySelector('[data-role="chart"]'),
          breadcrumb: card.querySelector('[data-role="breadcrumb"]'),
          summary: card.querySelector('[data-role="summary"]'),
          back: card.querySelector('[data-role="back"]'),
          home: card.querySelector('[data-role="home"]'),
          tableHost: card.querySelector('[data-role="table"]'),
          tableTitle: card.querySelector('[data-role="table-title"]'),
          tableCount: card.querySelector('[data-role="table-count"]'),
          currentRoot: null,
          missingPath: null,
          selectedAssetPath: null,
          history: [],
          sort: { key: "bytes", direction: -1 },
        };

        view.back.addEventListener("click", () => navigateBack(view));
        view.home.addEventListener("click", () => navigateHome(view));
        state.views.set(`${side}:${type}`, view);
        renderView(view);
      }
    });
  }

  function wireReportInput(side) {
    const input = document.getElementById(`report${side}Input`);
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        setStatus(`Parsing ${file.name} locally…`);
        const model = parseMemReport(await file.text(), file.name);
        state.reports[side] = model;
        document.getElementById(`report${side}Name`).textContent = file.name;
        document.getElementById(`column${side}Name`).textContent = file.name;
        if (side === "B") document.getElementById("clearB").disabled = false;
        resetAllViews();
        updateStatus();
        renderDiff();
      } catch (error) {
        console.error(error);
        setStatus(`Could not parse ${file.name}: ${error.message}`, true);
      }
    });
  }

  function clearReport(side) {
    state.reports[side] = null;
    document.getElementById(`report${side}Input`).value = "";
    document.getElementById(`report${side}Name`).textContent = side === "A" ? "No report selected" : "Optional comparison report";
    document.getElementById(`column${side}Name`).textContent = `Report ${side}`;
    if (side === "B") document.getElementById("clearB").disabled = true;
    resetAllViews();
    updateStatus();
    renderDiff();
  }

  function updateStatus() {
    const a = state.reports.A;
    const b = state.reports.B;
    if (!a) return setStatus("Choose report A to begin. Report B is optional.");
    const aCount = Object.values(a.sections).filter((section) => section.root).length;
    if (!b) return setStatus(`${a.name} loaded locally. ${aCount}/3 detailed asset sections found.`);
    const bCount = Object.values(b.sections).filter((section) => section.root).length;
    setStatus(`Comparing ${a.name} with ${b.name}. Detailed sections: A ${aCount}/3, B ${bCount}/3.`);
  }

  function isComparing() {
    return Boolean(state.reports.A && state.reports.B);
  }

  function resetAllViews() {
    state.selectedDiff = null;
    for (const type of Object.keys(CHART_TYPES)) {
      state.jointHistory.set(type, []);
      state.jointCurrentPath.set(type, "/");
      for (const side of ["A", "B"]) {
        const view = state.views.get(`${side}:${type}`);
        const section = state.reports[side]?.sections[type];
        view.currentRoot = section?.root || null;
        view.missingPath = null;
        view.selectedAssetPath = null;
        view.history = [];
        view.sort = { key: "bytes", direction: -1 };
        renderView(view);
      }
    }
  }

  function currentPath(view) {
    return view?.missingPath || view?.currentRoot?.canonicalPath || "/";
  }

  function resolvePath(side, type, path) {
    const section = state.reports[side]?.sections[type];
    if (!section?.root) return { node: null, missing: false };
    const node = path === "/" ? section.root : section.nodesByPath.get(path) || null;
    return { node, missing: !node };
  }

  function applyPathToView(view, path, selectedAssetPath = null) {
    const resolved = resolvePath(view.side, view.type, path);
    view.currentRoot = resolved.node;
    view.missingPath = resolved.missing ? path : null;
    view.selectedAssetPath = selectedAssetPath;
    renderView(view);
  }

  function navigateFromView(view, path, options = {}) {
    const { selectedAssetPath = null, preserveDiffSelection = false } = options;
    if (!preserveDiffSelection) clearDiffSelection();
    if (isComparing() && state.syncNavigation) {
      navigateJoint(view.type, path, { selectedAssetPath });
      return;
    }
    const previous = currentPath(view);
    if (previous !== path) view.history.push(previous);
    applyPathToView(view, path, selectedAssetPath);
  }

  function navigateJoint(type, path, options = {}) {
    const { recordHistory = true, selectedAssetPath = null } = options;
    const previous = state.jointCurrentPath.get(type) || "/";
    if (recordHistory && previous !== path) state.jointHistory.get(type).push(previous);
    state.jointCurrentPath.set(type, path);
    for (const side of ["A", "B"]) {
      applyPathToView(state.views.get(`${side}:${type}`), path, selectedAssetPath);
    }
  }

  function navigateBack(view) {
    clearDiffSelection();
    if (isComparing() && state.syncNavigation) {
      const history = state.jointHistory.get(view.type);
      if (!history.length) return;
      const path = history.pop();
      navigateJoint(view.type, path, { recordHistory: false });
      return;
    }
    if (!view.history.length) return;
    applyPathToView(view, view.history.pop());
  }

  function navigateHome(view) {
    clearDiffSelection();
    if (currentPath(view) === "/") return;
    if (isComparing() && state.syncNavigation) {
      navigateJoint(view.type, "/");
      return;
    }
    view.history.push(currentPath(view));
    applyPathToView(view, "/");
  }

  function clearDiffSelection() {
    if (!state.selectedDiff && !Array.from(state.views.values()).some((view) => view.selectedAssetPath)) return;
    state.selectedDiff = null;
    for (const view of state.views.values()) view.selectedAssetPath = null;
    renderDiff();
  }

  function renderNavigationControlsForType(type) {
    for (const side of ["A", "B"]) {
      const view = state.views.get(`${side}:${type}`);
      if (view) updateNavigationControls(view);
    }
  }

  function updateNavigationControls(view) {
    const hasRoot = Boolean(state.reports[view.side]?.sections[view.type]?.root);
    if (!hasRoot) {
      view.back.disabled = true;
      view.home.disabled = true;
      return;
    }
    if (isComparing() && state.syncNavigation) {
      view.back.disabled = state.jointHistory.get(view.type).length === 0;
      view.home.disabled = state.jointCurrentPath.get(view.type) === "/";
    } else {
      view.back.disabled = view.history.length === 0;
      view.home.disabled = currentPath(view) === "/";
    }
  }

  function focusDiffRow(row) {
    state.selectedDiff = { tab: state.diffTab, assetType: row.assetType, canonicalPath: row.canonicalPath };
    window.dispatchEvent(new CustomEvent("memreport:select-comparison-type", { detail: { type: row.assetType } }));

    let targetPath = row.canonicalPath;
    let selectedAssetPath = null;
    if (state.diffTab === "assets") {
      selectedAssetPath = row.canonicalPath;
      targetPath = parentPath(row.canonicalPath);
    }

    if (state.syncNavigation) {
      navigateJoint(row.assetType, targetPath, { selectedAssetPath });
    } else {
      for (const side of ["A", "B"]) {
        const view = state.views.get(`${side}:${row.assetType}`);
        const previous = currentPath(view);
        if (previous !== targetPath) view.history.push(previous);
        applyPathToView(view, targetPath, selectedAssetPath);
      }
    }
    renderDiff();
  }

  function parentPath(path) {
    const slash = path.lastIndexOf("/");
    return slash <= 0 ? "/" : path.slice(0, slash);
  }

  function parseMemReport(text, name) {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    return {
      name,
      sections: {
        textures: parseSection("textures", () => parseTextures(lines)),
        sounds: parseSection("sounds", () => parseObjectList(lines, "SoundWave", 4)),
        animsequences: parseSection("animsequences", () => parseObjectList(lines, "AnimSequence", 3)),
      },
    };
  }

  function parseSection(type, parser) {
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
      return { type, assets: [], root: null, assetsByPath: new Map(), nodesByPath: new Map(), error: error.message };
    }
  }

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
        canonicalPath: `/${path.join("/")}`,
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
        canonicalPath: `/${path.join("/")}`,
        bytes: parseSize(`${items[fileSizeIndex]}KB`),
        className: engineClassName,
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
      } else current += char;
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

  function renderView(view) {
    view.host.replaceChildren();
    view.tableHost.replaceChildren();
    hideTooltip();
    const section = state.reports[view.side]?.sections[view.type];
    updateNavigationControls(view);

    if (!section?.root) {
      view.breadcrumb.textContent = "—";
      view.summary.textContent = section?.error || "No report loaded.";
      view.tableTitle.textContent = "Assets in current section";
      view.tableCount.textContent = "";
      const empty = document.createElement("div");
      empty.className = "chart-empty";
      empty.textContent = section?.error || `Choose report ${view.side} to begin.`;
      view.host.appendChild(empty);
      return;
    }

    if (view.missingPath) {
      view.breadcrumb.textContent = view.missingPath;
      view.summary.textContent = `${view.missingPath} is not present in Report ${view.side}.`;
      view.tableTitle.textContent = `Assets under ${view.missingPath}`;
      view.tableCount.textContent = "0 rows";
      const empty = document.createElement("div");
      empty.className = "chart-empty missing-path";
      empty.textContent = `This path is not present in Report ${view.side}.`;
      view.host.appendChild(empty);
      return;
    }

    view.breadcrumb.textContent = view.currentRoot.canonicalPath || "/";
    const assets = assetsUnderNode(section.assets, view.currentRoot);
    view.summary.textContent = `${formatBytes(view.currentRoot.bytes)} · ${assets.length} asset${assets.length === 1 ? "" : "s"}`;
    renderSunburst(view);
    renderAssetTable(view, assets);
  }

  function renderSunburst(view) {
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
      path.addEventListener("pointermove", (event) => showTooltip(event, segment.node));
      path.addEventListener("pointerleave", hideTooltip);
      if (segment.node.children.length) {
        const drill = () => navigateFromView(view, segment.node.canonicalPath);
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

  function assetsUnderNode(assets, node) {
    if (!node.canonicalPath) return assets.slice();
    const prefix = `${node.canonicalPath}/`;
    return assets.filter((asset) => asset.canonicalPath === node.canonicalPath || asset.canonicalPath.startsWith(prefix));
  }

  function renderAssetTable(view, assets) {
    const columns = tableColumnsForType(view.type);
    const rows = sortRows(assets, view.sort);
    view.tableTitle.textContent = `Assets under ${view.currentRoot.canonicalPath || "/"}`;
    view.tableCount.textContent = `${rows.length} row${rows.length === 1 ? "" : "s"}`;
    const table = document.createElement("table");
    table.appendChild(buildHeader(columns, view.sort, (key) => {
      view.sort = nextSort(view.sort, key);
      renderAssetTable(view, assets);
    }));
    const tbody = document.createElement("tbody");
    for (const asset of rows) {
      const tr = document.createElement("tr");
      if (asset.canonicalPath === view.selectedAssetPath) tr.classList.add("asset-selected");
      for (const column of columns) {
        const td = document.createElement("td");
        if (column.numeric) td.classList.add("number");
        if (column.key === "canonicalPath") td.classList.add("path-cell");
        td.textContent = column.format ? column.format(asset[column.key], asset) : displayValue(asset[column.key]);
        td.title = column.key === "canonicalPath" ? asset.canonicalPath : "";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    view.tableHost.replaceChildren(table);
    if (view.selectedAssetPath) {
      const selected = tbody.querySelector("tr.asset-selected");
      if (selected) queueMicrotask(() => selected.scrollIntoView({ block: "nearest" }));
    }
  }

  function tableColumnsForType(type) {
    const common = [
      { key: "name", label: "Name" },
      { key: "canonicalPath", label: "Path" },
      { key: "bytes", label: "Size", numeric: true, format: formatBytes },
    ];
    if (type !== "textures") return common;
    return [
      ...common,
      { key: "dimensions", label: "Dimensions" },
      { key: "format", label: "Format" },
      { key: "lodGroup", label: "LOD Group" },
      { key: "streaming", label: "Streaming" },
      { key: "virtualTexture", label: "VT" },
      { key: "usageCount", label: "Usage" },
      { key: "unknownRef", label: "Unknown Ref" },
    ];
  }

  function buildHeader(columns, sort, onSort) {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    for (const column of columns) {
      const th = document.createElement("th");
      th.className = `sortable${column.numeric ? " number" : ""}`;
      th.textContent = `${column.label}${sort.key === column.key ? (sort.direction > 0 ? " ▲" : " ▼") : ""}`;
      th.addEventListener("click", () => onSort(column.key));
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    return thead;
  }

  function nextSort(sort, key) {
    if (sort.key === key) return { key, direction: -sort.direction };
    return { key, direction: key === "bytes" || key === "deltaBytes" ? -1 : 1 };
  }

  function sortRows(rows, sort) {
    return rows.slice().sort((a, b) => compareValues(a[sort.key], b[sort.key]) * sort.direction);
  }

  function compareValues(a, b) {
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
    return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });
  }

  function renderDiff() {
    const a = state.reports.A;
    const b = state.reports.B;
    diffSection.hidden = !(a && b);
    if (!a || !b) return;
    const rows = state.diffTab === "directories" ? buildDirectoryDiff(a, b) : buildAssetDiff(a, b);
    const filtered = state.diffType === "all" ? rows : rows.filter((row) => row.assetType === state.diffType);
    const sorted = sortRows(filtered, state.diffSort);
    const counts = filtered.reduce((acc, row) => ((acc[row.status] = (acc[row.status] || 0) + 1), acc), {});
    diffSummary.textContent = `${filtered.length} difference${filtered.length === 1 ? "" : "s"}: ${counts.Added || 0} added, ${counts.Removed || 0} removed, ${counts.Changed || 0} changed.`;
    renderDiffTable(sorted);
  }

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

  function renderDiffTable(rows) {
    const columns = state.diffTab === "directories"
      ? [
          { key: "status", label: "Status" },
          { key: "assetType", label: "Type", format: formatType },
          { key: "canonicalPath", label: "Directory" },
          { key: "aBytes", label: "A", numeric: true, format: formatNullableBytes },
          { key: "bBytes", label: "B", numeric: true, format: formatNullableBytes },
          { key: "deltaBytes", label: "Δ", numeric: true, format: formatDelta },
        ]
      : [
          { key: "status", label: "Status" },
          { key: "assetType", label: "Type", format: formatType },
          { key: "canonicalPath", label: "Asset" },
          { key: "aBytes", label: "A", numeric: true, format: formatNullableBytes },
          { key: "bBytes", label: "B", numeric: true, format: formatNullableBytes },
          { key: "deltaBytes", label: "Δ", numeric: true, format: formatDelta },
          { key: "changes", label: "Changed fields" },
        ];
    const table = document.createElement("table");
    table.appendChild(buildHeader(columns, state.diffSort, (key) => {
      state.diffSort = nextSort(state.diffSort, key);
      renderDiff();
    }));
    const tbody = document.createElement("tbody");
    for (const row of rows) {
      const tr = document.createElement("tr");
      tr.classList.add("diff-row");
      tr.tabIndex = 0;
      const selected = state.selectedDiff
        && state.selectedDiff.tab === state.diffTab
        && state.selectedDiff.assetType === row.assetType
        && state.selectedDiff.canonicalPath === row.canonicalPath;
      if (selected) tr.classList.add("diff-row-selected");
      tr.addEventListener("click", () => focusDiffRow(row));
      tr.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          focusDiffRow(row);
        }
      });
      for (const column of columns) {
        const td = document.createElement("td");
        if (column.numeric) td.classList.add("number");
        if (column.key === "canonicalPath") td.classList.add("path-cell");
        if (column.key === "status") td.classList.add(`diff-${row.status.toLowerCase()}`);
        if (column.key === "deltaBytes") td.classList.add(row.deltaBytes > 0 ? "delta-positive" : row.deltaBytes < 0 ? "delta-negative" : "");
        td.textContent = column.format ? column.format(row[column.key], row) : displayValue(row[column.key]);
        td.title = column.key === "canonicalPath" ? row.canonicalPath : "";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    diffTable.replaceChildren(table);
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

  function buildNodeDescription(node) {
    const lines = [node.canonicalPath || "/", `Size: ${formatBytes(node.bytes)}`];
    if (node.asset?.type === "textures") {
      const asset = node.asset;
      lines.push(`Dimensions: ${asset.dimensions}`, `Format: ${asset.format}`, `LOD Group: ${asset.lodGroup}`, `Streaming: ${displayValue(asset.streaming)}`, `VT: ${displayValue(asset.virtualTexture)}`, `Usage: ${asset.usageCount}`);
    }
    if (node.children.length) lines.push("Click to drill down");
    return lines.join("\n");
  }

  function showTooltip(event, node) {
    tooltip.textContent = buildNodeDescription(node);
    tooltip.hidden = false;
    const margin = 14;
    const left = Math.min(event.clientX + 16, window.innerWidth - tooltip.offsetWidth - margin);
    const top = Math.min(event.clientY + 16, window.innerHeight - tooltip.offsetHeight - margin);
    tooltip.style.left = `${Math.max(margin, left)}px`;
    tooltip.style.top = `${Math.max(margin, top)}px`;
  }

  function hideTooltip() { tooltip.hidden = true; }
  function formatType(value) { return CHART_TYPES[value]?.title || value; }
  function formatNullableBytes(value) { return value == null ? "—" : formatBytes(value); }
  function formatDelta(value) { return `${value > 0 ? "+" : ""}${formatBytesSigned(value)}`; }

  function formatBytesSigned(bytes) {
    const sign = bytes < 0 ? "-" : "";
    return `${sign}${formatBytes(Math.abs(bytes))}`;
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

  function displayValue(value) {
    if (value === true) return "Yes";
    if (value === false) return "No";
    if (value == null || value === "") return "—";
    return String(value);
  }

  function trimLabel(text, max) { return text.length > max ? `${text.slice(0, max - 1)}…` : text; }

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
    for (const [key, value] of Object.entries(attrs)) if (value !== null && value !== undefined) element.setAttribute(key, value);
    return element;
  }

  function svgText(x, y, text, className) {
    const element = svgEl("text", { x, y, class: className });
    element.textContent = text;
    return element;
  }

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }
})();
