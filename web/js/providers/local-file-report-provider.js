(() => {
  "use strict";

  const { parseMemReport } = window.MemReport.MemreportParser;

  class LocalFileReportProvider {
    describe(file) {
      return {
        name: file.name,
        source: "local-file",
      };
    }

    async loadReport(file) {
      if (!file || typeof file.text !== "function") {
        throw new TypeError("LocalFileReportProvider requires a browser File-like object.");
      }

      return parseMemReport(await file.text(), file.name);
    }
  }

  window.MemReport.LocalFileReportProvider = { LocalFileReportProvider };
})();
