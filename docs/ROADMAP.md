# Frame / Field roadmap

## Implemented

- [x] Separate derivation from the clean Angular PWA starter.
- [x] MP4/WebM local video and CSV/JSON/DJI SRT import.
- [x] Validated timeline, duplicate handling, shortest-arc interpolation, offset and coverage feedback.
- [x] Native playback controls and decoded-frame/fallback clock.
- [x] Canvas attitude HUD, numerical telemetry and compass.
- [x] MapLibre marker, Turf FOV, seek-safe breadcrumbs, follow/fit/pan/zoom and optional OpenFreeMap streets.
- [x] Dark/light responsive workspace with keyboard and touch controls.
- [x] Synthetic demo video, sample CSV, bundled schematic and branded install assets.
- [x] Preserved service worker, subpath deployment and SPA fallback.
- [x] Unit, lint, format, build, multi-viewport browser and production offline verification.

## Explicit limits

The synthetic sample is not camera-calibrated real-world proof. SRT support covers common labeled DJI and GPS cue forms; other firmware variants may require conversion. The FOV is an illustrative horizontal sector. Offline streets cover cached tiles only. Video/telemetry are in memory and require reselection after reload. Physical-device/browser compatibility beyond desktop Chromium remains unverified. Publishing to a new repository is a separate action.
