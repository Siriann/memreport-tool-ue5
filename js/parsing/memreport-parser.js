(() => {
  "use strict";

  const { buildReportModel, buildReportSection } = window.MemReport.ReportModel;
  const { parseObjectList } = window.MemReport.ObjectListParser;
  const { parseTextures } = window.MemReport.TextureParser;

  function parseMemReport(text, name) {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    return buildReportModel(name, {
      textures: buildReportSection("textures", () => parseTextures(lines)),
      sounds: buildReportSection("sounds", () => parseObjectList(lines, "SoundWave", 4)),
      animsequences: buildReportSection("animsequences", () => parseObjectList(lines, "AnimSequence", 3)),
    });
  }

  window.MemReport.MemreportParser = { parseMemReport };
})();
