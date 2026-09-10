(() => {
  "use strict";

  const { displayValue, nextSort, sortRows } = window.MemReport.Display;
  const { formatBytes } = window.MemReport.Filesize;
  const { matchesFuzzySearch } = window.MemReport.Search;

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

  function renderAssetTable(view, assets) {
    const columns = tableColumnsForType(view.type);
    const query = view.searchQuery || "";
    const filtered = assets.filter((asset) => matchesFuzzySearch(query, asset.name, asset.canonicalPath));
    const rows = sortRows(filtered, view.sort);
    view.tableTitle.textContent = `Assets under ${view.currentRoot.canonicalPath || "/"}`;
    view.tableCount.textContent = query
      ? `${rows.length} of ${assets.length} rows`
      : `${rows.length} row${rows.length === 1 ? "" : "s"}`;
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

  window.MemReport.Table = { tableColumnsForType, buildHeader, renderAssetTable };
})();
