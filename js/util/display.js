(() => {
  "use strict";

  function displayValue(value) {
    if (value === true) return "Yes";
    if (value === false) return "No";
    if (value == null || value === "") return "—";
    return String(value);
  }

  function compareValues(a, b) {
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
    return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });
  }

  function sortRows(rows, sort) {
    return rows.slice().sort((a, b) => compareValues(a[sort.key], b[sort.key]) * sort.direction);
  }

  function nextSort(sort, key) {
    if (sort.key === key) return { key, direction: -sort.direction };
    return { key, direction: key === "bytes" || key === "deltaBytes" ? -1 : 1 };
  }

  window.MemReport = window.MemReport || {};
  window.MemReport.Display = { displayValue, compareValues, sortRows, nextSort };
})();
