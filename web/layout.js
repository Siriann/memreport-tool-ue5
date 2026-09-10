(() => {
  "use strict";

  const { getAppState, subscribe, dispatch } = window.MemReport.Store;
  const state = getAppState();

  const comparisonToolbar = document.getElementById("comparisonToolbar");
  const comparisonTabs = document.getElementById("comparisonTabs");
  const clearB = document.getElementById("clearB");
  const diffTypeFilter = document.getElementById("diffTypeFilter");
  const reportsGrid = document.querySelector(".reports-grid");
  const reportAColumn = document.querySelector('.report-column[data-side="A"]');
  const reportBColumn = document.querySelector('.report-column[data-side="B"]');
  const comparisonButtons = Array.from(document.querySelectorAll("[data-comparison-type]"));

  comparisonButtons.forEach((button) => {
    button.addEventListener("click", () => {
      dispatch({ type: "COMPARISON_TYPE_SELECTED", assetType: button.dataset.comparisonType });
      diffTypeFilter.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  subscribe(renderLayout);

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

  function renderLayout() {
    const comparing = Boolean(state.reports.A && state.reports.B);
    const activeType = state.activeComparisonType;

    document.body.classList.toggle("comparison-mode", comparing);
    document.body.classList.toggle("single-report-mode", !comparing);
    comparisonToolbar.hidden = !comparing;
    comparisonTabs.hidden = !comparing;
    reportBColumn.hidden = !comparing;
    clearB.disabled = !state.reports.B;

    comparisonButtons.forEach((button) => {
      const selected = button.dataset.comparisonType === activeType;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });

    if (diffTypeFilter.value !== state.diffType) diffTypeFilter.value = state.diffType;

    if (comparing) {
      reportsGrid.classList.add("comparison-grid");
      reportsGrid.classList.remove("single-grid");
      setVisibleChart(reportAColumn, activeType);
      setVisibleChart(reportBColumn, activeType);
    } else {
      reportsGrid.classList.add("single-grid");
      reportsGrid.classList.remove("comparison-grid");
      showAllCharts(reportAColumn);
      showAllCharts(reportBColumn);
    }
  }

  renderLayout();
})();
