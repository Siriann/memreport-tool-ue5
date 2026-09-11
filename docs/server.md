# Node.js server

This branch adds a small Node.js boundary around the existing browser application. The browser still owns MemReport parsing, analysis, and rendering; the server owns report discovery and file delivery.

## Run locally

Node.js 20 or newer is required.

```bash
npm start
```

By default the server listens on port `3000` and scans `sample_reports/`. Open `http://localhost:3000` and select reports from the server-backed dropdowns.

## Configuration

- `PORT` — HTTP port, default `3000`.
- `HOST` — listen address, default `0.0.0.0`.
- `MEMREPORT_DIRS` — one or more report roots separated with the operating-system path delimiter (`:` on Linux/macOS, `;` on Windows).

Examples:

```bash
MEMREPORT_DIRS=/srv/builds npm start
MEMREPORT_DIRS=/srv/builds:/srv/archive npm start
```

The source recursively discovers `.memreport` files below each configured root. It does not currently interpret folder names as changelist/platform metadata; paths are treated as opaque report locations. This keeps the first server boundary independent of the eventual Jenkins/build-directory convention.

## API

- `GET /api/reports` returns the available reports and opaque IDs.
- `GET /api/reports/:id` streams one report.

Clients never send filesystem paths to the report endpoint. IDs are decoded and validated against configured roots before a file is opened, preventing traversal outside those roots.

## Docker

A minimal Dockerfile is included so the same server can later be deployed next to Jenkins or another report producer. Mount reports into the container and configure that mount as a source:

```bash
docker build -t memreport-tool .
docker run --rm -p 3000:3000 -v /srv/builds:/reports:ro -e MEMREPORT_DIRS=/reports memreport-tool
```

## Next server-side steps

The current `FileSystemReportSource` is deliberately isolated from HTTP routing. Future work can add build/changelist metadata, indexing/persistence, ingestion state, deduplication, retention, or alternate report sources without coupling those concerns to the browser parser or UI.
