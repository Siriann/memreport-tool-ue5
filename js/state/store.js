(() => {
  "use strict";

  const { CHART_TYPES } = window.MemReport.Config;

  const listeners = new Set();
  let appState = null;

  function notify(action = { type: "STATE_CHANGED" }) {
    for (const listener of listeners) listener(appState, action);
  }

  function observableObject(target, actionType) {
    return new Proxy(target, {
      set(object, property, value) {
        if (object[property] === value) return true;
        object[property] = value;
        notify({ type: actionType, property, value });
        return true;
      },
    });
  }

  function createAppState() {
    if (appState) return appState;

    const reports = observableObject({ A: null, B: null }, "REPORT_CHANGED");
    const reportLoads = observableObject({
      A: { status: "idle", pendingFileName: null, error: null },
      B: { status: "idle", pendingFileName: null, error: null },
    }, "REPORT_LOAD_STATE_CHANGED");

    appState = observableObject({
      reports,
      reportLoads,
      views: new Map(),
      diffTab: "directories",
      diffType: "all",
      diffSort: { key: "deltaBytes", direction: -1 },
      diffSearch: "",
      diffFilters: {
        added: true,
        removed: true,
        changed: true,
        increased: false,
        decreased: false,
      },
      activeComparisonType: "textures",
      selectedDiff: null,
      syncNavigation: true,
      jointHistory: new Map(Object.keys(CHART_TYPES).map((type) => [type, []])),
      jointCurrentPath: new Map(Object.keys(CHART_TYPES).map((type) => [type, "/"])),
    }, "APP_STATE_CHANGED");

    return appState;
  }

  function getAppState() {
    return appState || createAppState();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function dispatch(action) {
    const state = getAppState();

    switch (action.type) {
      case "REPORT_LOAD_STARTED":
        state.reportLoads[action.side] = {
          status: "loading",
          pendingFileName: action.fileName,
          error: null,
        };
        break;
      case "REPORT_LOAD_SUCCEEDED":
        state.reports[action.side] = action.report;
        state.reportLoads[action.side] = {
          status: "loaded",
          pendingFileName: null,
          error: null,
        };
        break;
      case "REPORT_LOAD_FAILED":
        state.reportLoads[action.side] = {
          status: "failed",
          pendingFileName: action.fileName,
          error: action.error,
        };
        break;
      case "REPORT_CLEARED":
        state.reports[action.side] = null;
        state.reportLoads[action.side] = {
          status: "idle",
          pendingFileName: null,
          error: null,
        };
        break;
      case "COMPARISON_TYPE_SELECTED":
        if (!CHART_TYPES[action.assetType]) return;
        state.activeComparisonType = action.assetType;
        state.diffType = action.assetType;
        break;
      case "DIFF_TYPE_SELECTED":
        state.diffType = action.assetType;
        break;
      case "DIFF_SEARCH_CHANGED":
        state.diffSearch = String(action.query || "");
        break;
      case "DIFF_FILTER_CHANGED": {
        if (!(action.filter in state.diffFilters)) return;
        const next = { ...state.diffFilters, [action.filter]: Boolean(action.enabled) };
        if (action.filter === "changed" && !next.changed) {
          next.increased = false;
          next.decreased = false;
        }
        state.diffFilters = next;
        break;
      }
      case "SYNC_NAVIGATION_CHANGED":
        state.syncNavigation = Boolean(action.enabled);
        break;
      default:
        throw new Error(`Unknown application action: ${action.type}`);
    }

    notify(action);
  }

  window.MemReport.Store = {
    createAppState,
    getAppState,
    subscribe,
    dispatch,
  };
})();
