(() => {
  "use strict";

  const CHART_TYPES = Object.freeze({
    textures: { title: "Textures" },
    sounds: { title: "Sounds" },
    animsequences: { title: "Animations" },
  });

  const REPORT_SIDES = Object.freeze(["A", "B"]);

  window.MemReport = window.MemReport || {};
  window.MemReport.Config = { CHART_TYPES, REPORT_SIDES };
})();
