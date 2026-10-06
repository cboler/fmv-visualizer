# Frame / Field

An Angular 22 PWA for **local full-motion video and geospatial telemetry playback**, derived from [cboler/angular-pwa-starter](https://github.com/cboler/angular-pwa-starter).

Open a video and its log to inspect synchronized position, heading, pitch, roll, altitude, and a camera FOV sector. The included 30-second **synthetic coastal survey** exercises the entire pipeline without your own files.

## Run

Requires a Node.js version supported by Angular 22 and npm; verified with Node 26.8.2 and npm 11.19.1.

```powershell
npm ci
npm start
```

Open http://localhost:4200/. Import one MP4/WebM video and one CSV/JSON/SRT log together, or add them individually. Drag and drop is supported. The video and telemetry stay in the browser; no server or upload endpoint is used. Online streets are optional and request map tiles from OpenFreeMap, which can reveal the viewed map region to the tile provider.

Controls: play/pause, seek, 0.5–4× speed, HUD toggle, map pan/zoom, follow vehicle, fit route, FOV range, and synchronization offset. Dark and light themes, keyboard focus, and touch controls are supported.

## Telemetry

CSV columns (and equivalent JSON keys):

```csv
timestamp,lat,lon,heading,pitch,roll,fov,altitude
0,37.805,-122.465,15,-8,0,75,84
5,37.80545,-122.46395,34,-1.35,10.1,75,89.24
```

- `timestamp` (or `time`): relative seconds from video start, or consistent ISO timestamps. ISO times are aligned to the first sample. Numeric seconds retain their original offset. Use **video time + sync offset = telemetry time** to align tracks.
- `lat`, `lon`: geographic degrees. Latitude must fit Web Mercator (±85.051129°).
- `heading`: degrees clockwise from north; normalized into [0, 360).
- `pitch`: ±90°, `roll`: ±180°. Missing fields default to zero and emit a warning.
- `fov`: between 0° and 180°, default 75°.
- `altitude`: optional meters. There is no assumption about sea-level versus relative-height reference.

JSON accepts an array of objects or `{ "frames": [...] }`. CSV supports quoting and streamed worker parsing. Logs sort by time; duplicate timestamps retain the last record. Invalid records are reported and skipped; an unusable file is rejected without replacing the active mission. Telemetry is capped at **32 MB / 200,000 records** in memory. Video is read through an object URL without loading the entire file into JavaScript memory.

SRT supports DJI-style `[latitude: ...]`, `[longitude: ...]`, `[gb_yaw: ...]` / `gimbal_yaw`, gimbal pitch/roll, relative altitude, and legacy `GPS(longitude, latitude, altitude)` cues. Camera yaw takes precedence over flight yaw. Missing yaw/attitude produces explicit warnings. Firmware-specific formats and Autel variants are not universally supported; convert unsupported logs to CSV/JSON. The synthetic sample and automated SRT fixtures are not real-device validation.

The FOV cone is an **illustrative horizontal sector**, with adjustable 50–2,000 m range. It does not project pitch onto terrain, account for lens calibration, or estimate ground coverage. The HUD uses the available log attitude (preferentially camera attitude for SRT); it is an analysis visualization, not a navigation instrument.

## Offline and PWA

A production service worker precaches the shell, lazy map code, MapLibre worker assets, synthetic video, sample CSV, and a **self-authored San Francisco schematic map**. Playback, import, attitude, and geospatial overlays work offline after initial installation. Outside the bundled sample region the offline view provides overlays on a plain background. Optional online streets cache up to 256 viewed tiles for seven days; uncached areas need a connection. This does not download an entire region.

Local files remain session-only and must be reselected after reload or leaving the workspace. Only the theme preference persists. Videos and telemetry are never written to an account or uploaded.

```powershell
npm run build:pages
npm run preview
```

Production preview is at http://localhost:4300/ (or the build's base path). The preview uses the native Node HTTP library. The service worker is enabled only in production; `npm start` is not an offline installation test.

For a Pages subpath:

```powershell
npm run build -- --base-href /fmv-visualizer/
node scripts/prepare-pages.mjs
npm run check:pwa
```

The GitHub Pages workflow computes base paths dynamically and preserves the `404.html` SPA fallback. Source is hosted at [cboler/fmv-visualizer](https://github.com/cboler/fmv-visualizer), with Actions deployment configured for [Frame / Field](https://cboler.github.io/fmv-visualizer/). Deployment verification is recorded in `Handoff.md`.

## Verification

```powershell
npm test -- --watch=false
npm run lint
npm run format
npm run format:check
npm run build:pages
npm run e2e
npm run check:pwa
```

The browser suite checks playback/seek synchronization, rate, HUD, CSV worker imports, JSON/SRT, failure preservation, file dropping, missing telemetry, sync offset, coverage status, animation fallback cleanup, diagnostic navigation, themes, touch targets, and overflow across four viewports. `check:pwa` serves the production build, installs its service worker, disconnects the browser, reloads, plays the sample, imports CSV, and verifies an offline diagnostic deep link. Evidence is saved under `docs/evidence/`.

The initial JS/CSS budget stays at 500 kB; MapLibre is a separate lazy chunk. Canvas is resized only when its dimensions change. Map GeoJSON updates are capped at ~15 Hz, and displayed breadcrumbs are limited to ~2,000 points; interpolation keeps the full-resolution timeline. Browser callbacks track decoded video frames, with requestAnimationFrame/timeupdate fallback.

Recreate the bundled synthetic video/icons with `node scripts/generate-sample.mjs` Requires Playwright Chromium and ffmpeg (`FFMPEG_PATH`, or the bundled Windows Playwright ffmpeg path). Generated assets are checked in, so ffmpeg is not required to build or run the app.

See `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, and `Handoff.md` for implementation boundaries and verification evidence.
