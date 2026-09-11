(() => {
  "use strict";

  const LOCAL_REPORT_VALUE = "__local__";
  const statusEl = document.getElementById("status");
  const refreshButton = document.getElementById("refreshReports");
  const selectors = {
    A: document.getElementById("serverReportASelect"),
    B: document.getElementById("serverReportBSelect"),
  };
  let reportsById = new Map();

  for (const side of ["A", "B"]) {
    selectors[side].addEventListener("change", () => selectReport(side));
  }
  refreshButton.addEventListener("click", refreshReports);
  document.getElementById("clearB").addEventListener("click", () => {
    selectors.B.value = "";
  });

  if (window.location.protocol === "file:") {
    enableLocalFileMode();
  } else {
    refreshReports();
  }

  function enableLocalFileMode() {
    refreshButton.hidden = true;
    for (const side of ["A", "B"]) {
      const select = selectors[side];
      select.hidden = true;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "file-button";
      button.textContent = side === "A" ? "Choose report A" : "Choose report B";
      button.addEventListener("click", () => openLocalFilePicker(side));
      select.before(button);
    }

    const subtitle = document.querySelector(".app-header p");
    if (subtitle) subtitle.textContent = "Local, browser-only Unreal Engine memreport visualizer and comparer.";
    statusEl.textContent = "Choose report A to begin. Report B is optional.";
    statusEl.classList.remove("error");
  }

  async function refreshReports() {
    setLoading(true);
    try {
      const response = await fetch("/api/reports", { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = await response.json();
      const reports = Array.isArray(payload.reports) ? payload.reports : [];
      reportsById = new Map(reports.map((report) => [report.id, report]));
      populateSelectors(reports);
      statusEl.classList.remove("error");
      if (!reports.length) {
        statusEl.textContent = "No server reports were found. You can still choose Local report… from either dropdown.";
      }
    } catch (error) {
      console.error(error);
      reportsById = new Map();
      populateSelectors([]);
      statusEl.textContent = `Could not list server reports: ${error.message}. Local reports are still available.`;
      statusEl.classList.add("error");
    } finally {
      setLoading(false);
    }
  }

  function populateSelectors(reports) {
    for (const side of ["A", "B"]) {
      const select = selectors[side];
      const previousValue = select.value;
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = side === "A" ? "Choose report A" : "Choose optional report B";
      select.replaceChildren(placeholder);

      const localOption = document.createElement("option");
      localOption.value = LOCAL_REPORT_VALUE;
      localOption.textContent = "Local report…";
      select.appendChild(localOption);

      for (const report of reports) {
        const option = document.createElement("option");
        option.value = report.id;
        option.textContent = report.relativePath || report.name;
        select.appendChild(option);
      }

      if (reportsById.has(previousValue)) select.value = previousValue;
    }
  }

  async function selectReport(side) {
    const reportId = selectors[side].value;
    if (reportId === LOCAL_REPORT_VALUE) {
      selectors[side].value = "";
      openLocalFilePicker(side);
      return;
    }

    if (!reportId) {
      if (side === "B") document.getElementById("clearB").click();
      return;
    }

    const descriptor = reportsById.get(reportId);
    if (!descriptor) return;

    selectors[side].disabled = true;
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response));

      const blob = await response.blob();
      const file = new File([blob], descriptor.name, { type: "text/plain", lastModified: Date.parse(descriptor.modifiedAt) || Date.now() });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.getElementById(`report${side}Input`);
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (error) {
      console.error(error);
      statusEl.textContent = `Could not load ${descriptor.name}: ${error.message}`;
      statusEl.classList.add("error");
    } finally {
      selectors[side].disabled = false;
    }
  }

  function openLocalFilePicker(side) {
    const input = document.getElementById(`report${side}Input`);
    input.value = "";
    input.click();
  }

  function setLoading(loading) {
    refreshButton.disabled = loading;
    for (const select of Object.values(selectors)) select.disabled = loading;
  }

  async function responseError(response) {
    try {
      const payload = await response.json();
      return payload.error || `${response.status} ${response.statusText}`;
    } catch {
      return `${response.status} ${response.statusText}`;
    }
  }
})();
