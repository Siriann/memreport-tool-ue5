(() => {
  "use strict";

  const comparisonToolbar = document.getElementById("comparisonToolbar");
  const comparisonTabs = document.getElementById("comparisonTabs");
  const reportBName = document.getElementById("reportBName");
  const clearB = document.getElementById("clearB");
  const diffTypeFilter = document.getElementById("diffTypeFilter");
  const reportsGrid = document.querySelector(".reports-grid");
  const reportAColumn = document.querySelector('.report-column[data-side="A"]');
  const reportBColumn = document.querySelector('.report-column[data-side="B"]');
  const comparisonButtons = Array.from(document.querySelectorAll("[data-comparison-type]"));

  let activeType = "textures";

  comparisonButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeType = button.dataset.comparisonType;
      syncComparisonSelection();
      applyLayout();
      emitComparisonType();
    });
  });

  window.addEventListener("memreport:select-comparison-type", (event) => {
    const requestedType = event.detail?.type;
    if (!comparisonButtons.some((button) => button.dataset.comparisonType === requestedType)) return;
    if (requestedType === activeType) {
      syncComparisonSelection();
      applyLayout();
      emitComparisonType();
      return;
    }
    activeType = requestedType;
    syncComparisonSelection();
    applyLayout();
    emitComparisonType();
  });

  new MutationObserver(applyLayout).observe(reportBName, { childList: true, characterData: true, subtree: true });
  new MutationObserver(applyLayout).observe(clearB, { attributes: true, attributeFilter: ["disabled"] });

  document.getElementById("reportAInput").addEventListener("change", () => queueMicrotask(applyLayout));
  document.getElementById("reportBInput").addEventListener("change", () => queueMicrotask(applyLayout));
  clearB.addEventListener("click", () => queueMicrotask(applyLayout));

  function hasReportB() {
    return !clearB.disabled;
  }

  function syncComparisonSelection() {
    comparisonButtons.forEach((button) => {
      const selected = button.dataset.comparisonType === activeType;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });

    if (diffTypeFilter.value !== activeType) {
      diffTypeFilter.value = activeType;
      diffTypeFilter.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function emitComparisonType() {
    window.dispatchEvent(new CustomEvent("memreport:comparison-type-changed", { detail: { type: activeType } }));
  }

  function setVisibleChart(column, type) {
    column.querySelectorAll(".chart-card").forEach((card) => {
      card.hidden = card.dataset.chart !== type;
    });
  }

  function showAllCharts(column) {
    column.querySelectorAll(".chart-card").forEach((card) => {
      card.hidden = false;
    });
  }

  function applyLayout() {
    const comparing = hasReportB();
    document.body.classList.toggle("comparison-mode", comparing);
    document.body.classList.toggle("single-report-mode", !comparing);
    comparisonToolbar.hidden = !comparing;
    comparisonTabs.hidden = !comparing;
    reportBColumn.hidden = !comparing;

    if (comparing) {
      reportsGrid.classList.add("comparison-grid");
      reportsGrid.classList.remove("single-grid");
      syncComparisonSelection();
      setVisibleChart(reportAColumn, activeType);
      setVisibleChart(reportBColumn, activeType);
    } else {
      reportsGrid.classList.add("single-grid");
      reportsGrid.classList.remove("comparison-grid");
      showAllCharts(reportAColumn);
      showAllCharts(reportBColumn);
    }
  }

  applyLayout();
  emitComparisonType();
})();
