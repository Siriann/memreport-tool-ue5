(() => {
  "use strict";

  function normalize(value) {
    return String(value ?? "").trim().toLowerCase();
  }

  function isSubsequence(needle, haystack) {
    if (!needle) return true;
    let needleIndex = 0;
    for (let haystackIndex = 0; haystackIndex < haystack.length && needleIndex < needle.length; haystackIndex += 1) {
      if (haystack[haystackIndex] === needle[needleIndex]) needleIndex += 1;
    }
    return needleIndex === needle.length;
  }

  function matchesFuzzySearch(query, ...values) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const candidates = values.map(normalize).filter(Boolean);
    return terms.every((term) => candidates.some((candidate) => candidate.includes(term) || isSubsequence(term, candidate)));
  }

  function nameFromPath(path) {
    const normalized = String(path ?? "").replace(/\/+$/, "");
    const separator = normalized.lastIndexOf("/");
    return separator >= 0 ? normalized.slice(separator + 1) : normalized;
  }

  window.MemReport.Search = { matchesFuzzySearch, nameFromPath };
})();
