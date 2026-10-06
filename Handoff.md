# Frame / Field handoff

## Delivered

A separate application at `C:/Users/chris/OneDrive/Documents/GitHub/fmv-visualizer`, derived from the clean local `cboler/angular-pwa-starter` checkout. The original starter is untouched. The derivation has no configured origin and is not deployed.

Native MP4/WebM playback synchronizes a Canvas attitude HUD, numerical telemetry and MapLibre position/FOV/breadcrumb overlays. CSV worker parsing, JSON and labeled DJI SRT normalize into typed frames; binary search handles arbitrary seeking and shortest-arc heading/roll/longitude interpolation. Controls include seek/rate, HUD, follow/fit, map pan/zoom, cone range, and sync offset. Imports are staged and preserve the active mission on failure.

A self-authored 30-second synthetic coastal clip, sample CSV and SF schematic provide an immediately usable offline demonstration. Online streets use OpenFreeMap vector tiles with linked OpenStreetMap attribution. Live rendering and cached offline tiles were verified; the suggested CARTO endpoint displayed API-key-required imagery and was replaced.

## Validation

- Angular 22.2.1, Node 26.8.2, npm 11.19.1.
- 13 unit tests covering parsing, validation, deduplication, endpoint handling, angular interpolation, dateline, large-timeline seeking, and shell behavior.
- 24 Chromium E2E tests across phone portrait/landscape, tablet and desktop, including both themes, overflow, controls, local ingestion, seek synchronization, failure preservation, and fallback cleanup.
- Lint and Prettier checks; production build and Pages fallback generation.
- Service-worker-controlled production reload offline: sample video playback, bundled map and FOV, CSV worker import, and diagnostic deep linking.
- Live OpenFreeMap vector tiles, then cached tiles with the browser disconnected.
- Root and `/fmv-visualizer/` hosting paths checked. See `docs/evidence/pwa-verification.json` and `pwa-subpath-verification.json` for exact results and UTC timestamps.
- Real browser screenshots inspected across all four viewports and both themes; production screenshots include online streets and offline shell/map.
- npm audit reports zero vulnerabilities after compatible patches and matching Angular update.
- Builds emit CommonJS optimization warnings from PapaParse and the Turf umbrella package. Initial bundle is approximately 397 kB (under the original 500 kB warning budget); MapLibre loads separately.

## Run and review

`npm start` serves http://localhost:4200/. The local development server remains available at delivery. `npm run build:pages` and `npm run preview` serve production at http://localhost:4300/. `npm run check:pwa` uses a temporary server on port 4301 and closes it afterward.

Read `README.md` for file formats, offset semantics, privacy, PWA setup, and commands. The preserved Pages workflow can publish after a destination repository is configured. No publish operation was performed.

## Limits and next input

The FOV is an adjustable horizontal sector; terrain/lens projection is not modeled. SRT firmware and Autel variations may require CSV conversion; no real drone/ROV/robot file was provided. Missing camera fields are reported, not silently treated as measured attitude. Latitude is limited by Web Mercator. Telemetry is in memory, capped at 32 MB / 200,000 records; display decimates to ~2,000 breadcrumbs while keeping full interpolation data. Offline street coverage includes viewed tiles only; outside the bundled SF schematic uncached regions show overlays on a plain background. Files require reselection after reload or leaving the workspace. Physical-device/other-browser proof remains future validation.

The next useful acceptance step is opening a representative local video and sidecar, checking camera-versus-vehicle attitude fields, and adjusting sync offset. Retain the current working implementation.
