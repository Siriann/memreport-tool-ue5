# Browser MVP

This folder contains a dependency-free browser port of the MemReport viewer.

## Run it

1. Open `index.html` directly in a modern Chromium-based browser (Chrome, Edge, etc.).
2. Click **Choose reports folder**.
3. Select a folder containing one or more `.memreport` files.
4. Pick a report from the dropdown.

The selected report is read locally in the browser. Nothing is uploaded and no local web server is required.

## MVP features

- Reads `.memreport` files from a user-selected folder.
- Populates a report dropdown from the selected files.
- Parses texture, sound-wave and animation-sequence detailed sections independently.
- Supports the dynamic UE4/UE5 `ListTextures` column layout used by the Python parser.
- Shows all three memory hierarchies at once as interactive nested donut/sunburst charts.
- Hover shows path, size and asset details.
- Click a folder wedge to drill down; **Back** navigates to the previous root.
- No npm, build step, framework, CDN or server.

## Notes

Browsers intentionally do not let a local `file://` page silently enumerate sibling folders. The folder picker is therefore the permission boundary: once the user selects a folder, the page can enumerate and read the chosen `.memreport` files locally.

The Python implementation remains the reference implementation while this MVP is validated against the sample reports.
