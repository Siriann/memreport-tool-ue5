(() => {
  "use strict";

  const { CHART_TYPES } = window.MemReport.Config;

  function createAppState() {
    return {
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
  }

  window.MemReport.Store = { createAppState };
})();
