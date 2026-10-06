# Execution Plan: Workspace cleanup and GitHub Pages publication

- **Date**: 2026-10-06
- **Status**: Complete
- **Owner**: Codex

## Goal and context

Apply the user's UI observations to the validated Frame / Field application and publish it using gh. Keep 3D vehicle rendering for the subsequent discussion.

## Changes and steps

- [x] Move Diagnostics to the footer, remove the redundant Workspace link and global Local-first badge with unused connection listeners, and use mission wording that includes aquatic vehicles.
- [x] Run formatter, unit tests, lint, production build, and four-viewport/two-theme browser verification. Also verified production offline playback, map/CSV workers and routing at the Pages subpath.
- [x] Create cboler/fmv-visualizer as a public repository, configure origin, enable GitHub Actions Pages deployment, and push main.
- [x] Confirm successful GitHub Actions deployment and render/play the public website; update documentation and delivery evidence.

## Verification and limits

Verify the published page and its assets at the real Pages subpath, playback, map overlays, and Diagnostics navigation. Preserve the original starter. Public source publication and Pages hosting are explicitly authorized by the user. Revert the UI commit to roll back the presentation changes; do not delete the repository or deployed site without a separate request.

Pages run 37420643246 deployed source commit bee1ecc. Public desktop/phone checks passed both themes, playback, seeking, routing and controlled offline playback with a healthy Angular worker. Verification exposed and fixed an HTTP 206 demo-prefetch race using a complete fetch/Blob URL for the small bundled sample. Full-history and subsequent push Gitleaks scans passed after the first-push root-parent range error. Evidence is recorded in Handoff.md and docs/evidence/publication-verification.json. 3D rendering remains deferred.
