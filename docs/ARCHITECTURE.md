# Frame / Field architecture

A standalone Angular 22.2 application with signals and a native HTML video clock. It runs in the browser on static hosting. No backend, authentication, remote file storage, or upload endpoint is required.

## Boundaries

- `telemetry.ts`: typed frames, CSV/JSON/DJI SRT ingestion, validation, deduplication, angular interpolation and singleton timeline state. Imports stage before replacing active state.
- `workspace.component.ts` / `workspace.html`: mission imports, session object URLs, feedback, synchronization offset and the responsive workspace.
- `video-player.component.ts` / `video-player.html`: native decoding, playback controls, decoded-frame timestamps, requestAnimationFrame fallback and callback cleanup.
- `attitude-hud.component.ts`: Canvas 2D ladder, horizon, reticle and compass. Device-pixel-ratio-aware sizing via ResizeObserver. Available log attitude is illustrative rather than a calibrated flight instrument.
- `map-viewer.component.ts`: lazy MapLibre initialization, explicit same-origin worker URL, Turf sector, separate route/trail/cone/point sources, heading marker, follow/fit controls, optional online vector layer and cleanup.
- `app.ts` / `app.html`: navigation, network status, theme and native PWA install prompt.
- `app.config.ts`, `ngsw-config.json`, manifest and `scripts/prepare-pages.mjs`: preserved service worker and dynamic subpath hosting infrastructure.

## Clock and rendering

The current video media time plus the user offset samples the telemetry timeline using binary search. Linear values interpolate between adjacent records; heading, roll and longitude take the shortest angular arc. Outside coverage, endpoint values are held and the UI identifies the coverage state. Unknown altitude remains unknown unless both bracketing records provide it.

The HUD follows each decoded video frame. Map source updates cap at ~15 Hz and render ~2,000 breadcrumbs at most; backwards seeks rebuild the traveled prefix correctly. Full-resolution telemetry remains available for interpolation. The camera cone radius is user-selected and is not derived from pitch/altitude or terrain.

## Offline boundary

Production caches the shell, map lazy chunk, MapLibre's ESM worker/shared assets, synthetic WebM and sample CSV, plus a self-authored SF schematic. Optional OpenFreeMap streets use a bounded Angular service-worker data cache (256 tiles, seven days). No region download or full-world offline basemap is claimed. Local videos/logs are session-only; returning to the workspace resets to the sample. Theme uses localStorage if available.

## Static hosting and verification

All source asset URLs resolve against document.baseURI. The Pages workflow supplies the repository base href; `prepare-pages.mjs` generates the SPA fallback. `preview.mjs` provides a local production server with video byte ranges, and `check-pwa.mjs` verifies offline shell/video/map/import/deep links against the compiled build. Unit tests cover mathematical and parsing boundaries; E2E tests exercise visible behavior across four viewports and two themes.
