# Browser MVP

This folder contains a dependency-free browser MemReport viewer and comparer.

## Run it

1. Open `index.html` directly in a modern browser.
2. Click **Choose report A** and select a `.memreport` file.
3. Optionally click **Choose report B** and select a second report to compare.

Reports are read locally in the browser. Nothing is uploaded to a server and no local web server is required.

## Features

- Selects individual `.memreport` files instead of loading an entire reports folder.
- Parses texture, sound-wave and animation-sequence detailed sections independently.
- Supports the dynamic UE4/UE5 `ListTextures` column layout used by real reports.
- Shows all three memory hierarchies as interactive nested donut/sunburst charts.
- Hover shows path, size and available asset details.
- Click a folder wedge to drill down; **Back** navigates to the previous root.
- Shows a sortable asset table below every chart for the currently viewed directory, sorted by size by default.
- Texture tables retain dimensions, format, LOD group, streaming, virtual-texture, usage and unknown-reference fields when present.
- Optional A/B comparison renders both reports side by side.
- Chart colors are derived deterministically from canonical Unreal paths so matching paths keep the same color between A and B.
- Comparison includes sortable directory and asset diff tables.
- Asset diffs report additions, removals, size changes and texture metadata changes such as dimensions, format/compression, LOD group and streaming state.
- No npm, build step, framework, CDN or server.

## Architecture

The JavaScript parser is the canonical MemReport parser. Parsing is kept independent of report acquisition and UI state so the same parser/domain code can later be reused by a Node.js service.

The current browser flow is:

```text
<input type="file">
        ↓
LocalFileReportProvider
        ↓
MemReport parser
        ↓
Report model
        ↓
Application state / UI
```

`LocalFileReportProvider` owns browser `File` handling. `app.js` loads reports through a provider interface rather than reading file contents or invoking the parser directly.

A future server-backed deployment can add an `ApiReportProvider` on the frontend without replacing the parser/domain model. On the Node.js side, ingestion sources such as Jenkins artifacts or filesystem directories should remain separate from persistent repository/indexing concerns. Those server abstractions are intentionally not implemented in the browser MVP.

Browser `File` objects and server filesystem paths must not become part of the parsed report model. Report/build identity, duplicate handling, retries, retention and filesystem security belong to the future server ingestion/repository layer.

## Comparison semantics

Report B is treated as the newer/target report and is compared against report A. A positive delta therefore means B uses more memory than A.

Directory diffs compare accumulated sizes for matching canonical paths. Asset diffs compare assets by canonical Unreal path. For textures, relevant parsed metadata is compared in addition to size; sound-wave and animation-sequence comparisons currently use the fields exposed by the existing parser (path and size).
