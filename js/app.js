(() => {
  "use strict";

  const { CHART_TYPES, REPORT_SIDES } = window.MemReport.Config;
  const { buildAssetDiff, buildDirectoryDiff } = window.MemReport.Diff;
  const { assetsUnderNode, resolveSectionPath } = window.MemReport.Queries;
  const { parentPath } = window.MemReport.Paths;
  const { LocalFileReportProvider } = window.MemReport.LocalFileReportProvider;
  const { createAppState, dispatch, subscribe } = window.MemReport.Store;
  const { buildHeader, renderAssetTable } = window.MemReport.Table;
  const { hideTooltip, renderSunburst } = window.MemReport.Sunburst;
  const { displayValue, nextSort, sortRows } = window.MemReport.Display;
  const { formatBytes, formatDelta, formatNullableBytes } = window.MemReport.Filesize;
  const { matchesFuzzySearch, nameFromPath } = window.MemReport.Search;

  const state = createAppState();
  const localReportProvider = new LocalFileReportProvider();
  const statusEl = document.getElementById("status");
  const tooltip = document.getElementById("tooltip");
  const diffSection = document.getElementById("diffSection");
  const diffTable = document.getElementById("diffTable");
  const diffSummary = document.getElementById("diffSummary");
  const diffTypeFilter = document.getElementById("diffTypeFilter");
  const diffSearchInput = document.getElementById("diffSearch");
  const syncNavigationInput = document.getElementById("syncNavigation");

  buildReportColumns();
  wireReportInput("A");
  wireReportInput("B");
  syncDiffFilterControls();

  document.getElementById("clearB").addEventListener("click", () => clearReport("B"));
  syncNavigationInput.addEventListener("change", () => {
    dispatch({ type: "SYNC_NAVIGATION_CHANGED", enabled: syncNavigationInput.checked });
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
    dispatch({ type: "DIFF_TYPE_SELECTED", assetType: diffTypeFilter.value });
    renderDiff();
  });

  diffSearchInput.addEventListener("input", () => {
    dispatch({ type: "DIFF_SEARCH_CHANGED", query: diffSearchInput.value });
    renderDiff();
  });

  document.querySelectorAll("[data-diff-filter]").forEach((input) => {
    input.addEventListener("change", () => {
      dispatch({ type: "DIFF_FILTER_CHANGED", filter: input.dataset.diffFilter, enabled: input.checked });
      syncDiffFilterControls();
      renderDiff();
    });
  });

  document.querySelectorAll("[data-diff-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.diffTab = button.dataset.diffTab;
      state.diffSort = { key: "deltaBytes", direction: -1 };
      document.querySelectorAll("[data-diff-tab]").forEach((item) => item.classList.toggle("active", item === button));
      renderDiff();
    });
  });

  subscribe((_, action) => {
    if (action.type === "COMPARISON_TYPE_SELECTED") {
      renderNavigationControlsForType(state.activeComparisonType);
    }
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
            <div class="table-toolbar">
              <div class="table-title"><span data-role="table-title">Assets in current section</span><span data-role="table-count"></span></div>
              <label class="table-search">
                <span>Search</span>
                <input data-role="table-search" type="search" placeholder="Fuzzy search name or path" autocomplete="off">
              </label>
            </div>
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
          searchInput: card.querySelector('[data-role="table-search"]'),
          searchQuery: "",
          currentRoot: null,
          missingPath: null,
          selectedAssetPath: null,
          history: [],
          sort: { key: "bytes", direction: -1 },
        };

        view.back.addEventListener("click", () => navigateBack(view));
        view.home.addEventListener("click", () => navigateHome(view));
        view.searchInput.addEventListener("input", () => {
          view.searchQuery = view.searchInput.value;
          renderAssetTableForView(view);
        });
        state.views.set(`${side}:${type}`, view);
        renderView(view);
      }
    });
  }

  function wireReportInput(side) {
    const input = document.getElementById(`report${side}Input`);
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;
      loadReport(side, localReportProvider, file, localReportProvider.describe(file));
    });
  }

  async function loadReport(side, provider, reportReference, descriptor) {
    dispatch({ type: "REPORT_LOAD_STARTED", side, fileName: descriptor.name });
    setStatus(`Loading ${descriptor.name}…`);

    try {
      const report = await provider.loadReport(reportReference);
      dispatch({ type: "REPORT_LOAD_SUCCEEDED", side, report });
      document.getElementById(`report${side}Name`).textContent = descriptor.name;
      document.getElementById(`column${side}Name`).textContent = descriptor.name;
      resetAllViews();
      updateStatus();
      renderDiff();
    } catch (error) {
      console.error(error);
      dispatch({ type: "REPORT_LOAD_FAILED", side, fileName: descriptor.name, error: error.message });
      const retained = state.reports[side]?.name;
      const suffix = retained ? ` Keeping ${retained} loaded.` : "";
      setStatus(`Could not load ${descriptor.name}: ${error.message}.${suffix}`, true);
    }
  }

  function clearReport(side) {
    dispatch({ type: "REPORT_CLEARED", side });
    document.getElementById(`report${side}Input`).value = "";
    document.getElementById(`report${side}Name`).textContent = side === "A" ? "No report selected" : "Optional comparison report";
    document.getElementById(`column${side}Name`).textContent = `Report ${side}`;
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
      for (const side of REPORT_SIDES) {
        const view = state.views.get(`${side}:${type}`);
        const section = state.reports[side]?.sections[type];
        view.currentRoot = section?.root || null;
        view.missingPath = null;
        view.selectedAssetPath = null;
        view.history = [];
        view.sort = { key: "bytes", direction: -1 };
        view.searchQuery = "";
        view.searchInput.value = "";
        renderView(view);
      }
    }
  }

  function currentPath(view) {
    return view?.missingPath || view?.currentRoot?.canonicalPath || "/";
  }

  function applyPathToView(view, path, selectedAssetPath = null) {
    const resolved = resolveSectionPath(state.reports[view.side], view.type, path);
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
    for (const side of REPORT_SIDES) {
      applyPathToView(state.views.get(`${side}:${type}`), path, selectedAssetPath);
    }
  }

  function navigateBack(view) {
    clearDiffSelection();
    if (isComparing() && state.syncNavigation) {
      const history = state.jointHistory.get(view.type);
      if (!history.length) return;
      navigateJoint(view.type, history.pop(), { recordHistory: false });
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
    for (const side of REPORT_SIDES) {
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
    dispatch({ type: "COMPARISON_TYPE_SELECTED", assetType: row.assetType });

    let targetPath = row.canonicalPath;
    let selectedAssetPath = null;
    if (state.diffTab === "assets") {
      selectedAssetPath = row.canonicalPath;
      targetPath = parentPath(row.canonicalPath);
    }

    if (state.syncNavigation) {
      navigateJoint(row.assetType, targetPath, { selectedAssetPath });
    } else {
      for (const side of REPORT_SIDES) {
        const view = state.views.get(`${side}:${row.assetType}`);
        const previous = currentPath(view);
        if (previous !== targetPath) view.history.push(previous);
        applyPathToView(view, targetPath, selectedAssetPath);
      }
    }
    renderDiff();
  }

  function renderView(view) {
    view.host.replaceChildren();
    view.tableHost.replaceChildren();
    hideTooltip(tooltip);
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
    renderSunburst(view, { onNavigate: (path) => navigateFromView(view, path), tooltip });
    renderAssetTable(view, assets);
  }

  function renderAssetTableForView(view) {
    const section = state.reports[view.side]?.sections[view.type];
    if (!section?.root || view.missingPath || !view.currentRoot) return;
    renderAssetTable(view, assetsUnderNode(section.assets, view.currentRoot));
  }

  function renderDiff() {
    const a = state.reports.A;
    const b = state.reports.B;
    diffSection.hidden = !(a && b);
    if (!a || !b) return;
    const rows = state.diffTab === "directories" ? buildDirectoryDiff(a, b) : buildAssetDiff(a, b);
    const typeFiltered = state.diffType === "all" ? rows : rows.filter((row) => row.assetType === state.diffType);
    const filtered = typeFiltered.filter((row) => {
      const name = nameFromPath(row.canonicalPath);
      return matchesFuzzySearch(state.diffSearch, name, row.canonicalPath) && matchesDiffFilters(row);
    });
    const sorted = sortRows(filtered, state.diffSort);
    const counts = filtered.reduce((acc, row) => ((acc[row.status] = (acc[row.status] || 0) + 1), acc), {});
    diffSummary.textContent = `${filtered.length} difference${filtered.length === 1 ? "" : "s"}: ${counts.Added || 0} added, ${counts.Removed || 0} removed, ${counts.Changed || 0} changed.`;
    renderDiffTable(sorted);
  }

  function matchesDiffFilters(row) {
    const filters = state.diffFilters;
    const statusKey = row.status.toLowerCase();
    if (!filters[statusKey]) return false;
    if (row.status !== "Changed") return true;

    const directionFilterActive = filters.increased || filters.decreased;
    if (!directionFilterActive) return true;
    return (filters.increased && row.deltaBytes > 0) || (filters.decreased && row.deltaBytes < 0);
  }

  function syncDiffFilterControls() {
    document.querySelectorAll("[data-diff-filter]").forEach((input) => {
      const filter = input.dataset.diffFilter;
      input.checked = Boolean(state.diffFilters[filter]);
      if (filter === "increased" || filter === "decreased") input.disabled = !state.diffFilters.changed;
    });
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
        if (column.key === "deltaBytes") {
          const deltaClass = row.deltaBytes > 0 ? "delta-positive" : row.deltaBytes < 0 ? "delta-negative" : null;
          if (deltaClass) td.classList.add(deltaClass);
        }
        td.textContent = column.format ? column.format(row[column.key], row) : displayValue(row[column.key]);
        td.title = column.key === "canonicalPath" ? row.canonicalPath : "";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    diffTable.replaceChildren(table);
  }

  function formatType(value) {
    return CHART_TYPES[value]?.title || value;
  }

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }
})();
