# Execution Plan: Workspace cleanup and GitHub Pages publication

- **Date**: 2026-10-06
- **Status**: In Progress
- **Owner**: Codex

## Goal and context

Apply the user's UI observations to the validated Frame / Field application and publish it using gh. Keep 3D vehicle rendering for the subsequent discussion.

## Changes and steps

- [x] Move Diagnostics to the footer, remove the redundant Workspace link and global Local-first badge with unused connection listeners, and use mission wording that includes aquatic vehicles.
- [x] Run formatter, unit tests, lint, production build, and four-viewport/two-theme browser verification. Also verified production offline playback, map/CSV workers and routing at the Pages subpath.
- [ ] Create cboler/fmv-visualizer as a public repository, configure origin, enable GitHub Actions Pages deployment, and push main.
- [ ] Confirm successful GitHub Actions deployment and render/play the public website; update documentation and delivery evidence.

## Verification and limits

Verify the published page and its assets at the real Pages subpath, playback, map overlays, and Diagnostics navigation. Preserve the original starter. Public source publication and Pages hosting are explicitly authorized by the user. Revert the UI commit to roll back the presentation changes; do not delete the repository or deployed site without a separate request.
