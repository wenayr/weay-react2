# wenay-common2 1.0.73 adoption — progress

## Update

- Previous dependency: 1.0.70.
- npm latest verified: 1.0.73.
- Updated dependency and lockfile to 1.0.73.
- Compatibility: `tsc -p tsconfig.qa-check.json --noEmit` and full Jest 21 suites / 68 tests pass.

## Architecture decision

| common2 capability | wenay-react2 decision | Reason |
| --- | --- | --- |
| Peer gap repair / `resync()` (1.0.71) | Core-only protocol; future `usePeer` may expose status and explicit `resync` | React must not own journal or repair state. |
| Hidden-tab Media capture (1.0.72) | Adopt core defaults, no adapter | Browser worker/ImageCapture implementation belongs below React. |
| `Media.attachVideoCanvas` / audio player / publish pipe (1.0.73) | Recipe and QA consumer first; thin ref-lifecycle hooks only if repeated | Frame decode/playback must bypass React renders. |

## Follow-up

- Keep the existing `useMediaSource`, `usePeer` and WebRTC recipe items in target.
- Add a real Media/Peer QA consumer before introducing any new hook.
- No raw route-coordinator hook: Peer mirrors already survive route changes.
## Implementation batch

- Added `useMediaSource`: React owns source start/stop/device lifecycle only; frames remain on the common2 Listen path.
- Added `usePeer`: React exposes an SDK peer's mirrored store, low-frequency route state and explicit controls; it owns no repair or transport state.
- QA cards 38/39/40 cover camera canvas viewer, microphone player and an in-process Peer host/mirror/resync scenario.
- Verification: qa-check TypeScript, Jest 22 suites / 71 tests, package build, diff-check and live stand HTTP 200.
- Manual Verify: run cards 38, 39, 40 together with existing replay cards 23 and 34 before release.
- Manual verification completed by the user on the stand; release candidate is 1.0.45.
