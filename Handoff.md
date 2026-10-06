# Frame / Field handoff

## Delivered

A separate application at `C:/Users/chris/OneDrive/Documents/GitHub/fmv-visualizer`, derived from the clean local `cboler/angular-pwa-starter` checkout. The original starter is untouched. Origin is configured for the public [cboler/fmv-visualizer](https://github.com/cboler/fmv-visualizer) repository. [Frame / Field](https://cboler.github.io/fmv-visualizer/) is published with GitHub Actions Pages and verified in live Chromium.

The header uses the brand to return home; the redundant Workspace link and global Local-first indicator are removed. Diagnostics remains available in the footer. Mission wording accommodates aerial and aquatic vehicles. Synchronized 3D vehicle rendering is deferred to the next discussion.

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
- Builds emit CommonJS optimization warnings from PapaParse and the Turf umbrella package. Initial bundle is approximately 393 kB (under the original 500 kB warning budget); MapLibre loads separately.

## Publication evidence

The application at source commit `bee1eccc01fd897f32264c8d61ba3f6d23de318b` deployed successfully in [Pages run 37420643246](https://github.com/cboler/fmv-visualizer/actions/runs/37420643246). Public verification at 2026-10-06T05:54:34Z returned HTTP 200 and passed desktop/phone rendering, both themes without overflow, playback, seek-to-15-second telemetry, diagnostic route reload, healthy service-worker state and controlled offline sample playback. No page errors were recorded. See `docs/evidence/publication-verification.json` and `deployed-*.png`.

Live verification found a media-prefetch race: HTTP 206 range responses could degrade Angular's worker before the demo was cached. The bundled 3 MB sample now uses a complete native fetch and Blob URL, with stale completion and URL cleanup guards. Large imported videos continue using File object URLs. Local and public offline checks passed after the correction.

The initial push's Gitleaks action failed on a nonexistent parent of the root commit. [Full-history run 37420249922](https://github.com/cboler/fmv-visualizer/actions/runs/37420249922) scanned all six initial commits and found no leaks; [the subsequent push scan](https://github.com/cboler/fmv-visualizer/actions/runs/37420643254) also passed. No secret-scanning exclusions or workflow bypasses were introduced.

The final documentation/evidence commit retains the verified runtime and triggers the normal Pages workflow.

## Run and review

`npm start` serves http://localhost:4200/. The local development server remains available at delivery. `npm run build:pages` and `npm run preview` serve production at http://localhost:4300/. `npm run check:pwa` uses a temporary server on port 4301 and closes it afterward.

Read `README.md` for file formats, offset semantics, privacy, PWA setup, and commands. The Pages workflow publishes main to https://cboler.github.io/fmv-visualizer/.

## Limits and next input

The FOV is an adjustable horizontal sector; terrain/lens projection is not modeled. SRT firmware and Autel variations may require CSV conversion; no real drone/ROV/robot file was provided. Missing camera fields are reported, not silently treated as measured attitude. Latitude is limited by Web Mercator. Telemetry is in memory, capped at 32 MB / 200,000 records; display decimates to ~2,000 breadcrumbs while keeping full interpolation data. Offline street coverage includes viewed tiles only; outside the bundled SF schematic uncached regions show overlays on a plain background. Files require reselection after reload or leaving the workspace. Physical-device/other-browser proof remains future validation.

The next discussion is selectable vehicle type and a synchronized 3D model. Confirm body versus gimbal attitude fields before connecting model tilt to telemetry. Representative local video/sidecar acceptance and synchronization adjustment remain useful. Retain the current published implementation.
