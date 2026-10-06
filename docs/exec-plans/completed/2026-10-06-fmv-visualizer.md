# Execution Plan: FMV & Telemetry Visualizer

- **Date**: 2026-10-06
- **Status**: Completed
- **Owner**: Codex

## 1. Goal & Objectives

Create a local-first Angular PWA for synchronized video, telemetry, attitude HUD, and geospatial playback, derived from cboler/angular-pwa-starter.

## 2. Context & Background

The clean starter is cloned into a separate fmv-visualizer directory; its original checkout is preserved. Retain service workers, subpath hosting, quality gates, and accessible touch controls.

## 3. Proposed Changes

Signals-based telemetry service and CSV/JSON/DJI SRT normalization; native video playback and canvas HUD; lazy-loaded MapLibre map with Turf FOV geometry; responsive mission workspace, sample timeline, error states, offline map, and documentation.

## 4. Implementation Steps

- [x] Implement parsing, validation, and interpolation.
- [x] Implement video synchronization, HUD, map, and import workspace.
- [x] Rebrand PWA, document assumptions and offline limits.
- [x] Validate quality gates and real browser rendering.

## 5. Verification Plan

- [x] Unit tests: npm test -- --watch=false
- [x] Lint: npm run lint
- [x] Formatter: npm run format and npm run format:check
- [x] Production and Pages builds
- [x] E2E across portrait, landscape, tablet, desktop, and themes
- [x] Inspect real browser screenshots; test offline production reload

## 6. Risks, Ceilings & Rollback

Telemetry is kept in memory with explicit size limits. SRT fields vary by firmware; unsupported records must fail visibly. FOV is an illustrative horizontal sector, not a terrain-projected camera footprint. Offline map includes a bundled sample-region schematic; online basemap tiles have bounded on-demand caching. Local media must be reselected after reload. Rollback by removing the new derivation directory; starter is untouched.
