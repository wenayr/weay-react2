# Replay route hand-off hooks

Goal: expose `wenay-common2@1.0.65` route hand-off to React without changing existing `useReplaySubscribe` / `useStoreReplaySync` behavior.

## Checkpoints

- [x] Read target rules, target task, common2 route docs/types, current Replay hooks, tests, and QA stand cards.
- [x] Add `useReplayRouteSubscribe`, `useStoreReplayRouteSync`, and `useStoreReplayRouteMirror`.
- [x] Add unit coverage for route switch, failed replacement fallback, unmount cleanup, and store convergence.
- [x] Add QA stand drawing demo for direct/relay route switching.
- [x] Update public/rare docs and changelog.
- [x] Run `tsc -p tsconfig.qa-check.json --noEmit`, `npm run build`, `npm run testjest -- --runInBand`, and QA stand smoke.

Decision: route hand-off is explicit through controller `switchRoute(...)`; changing the `remote` prop remains a fresh subscription boundary. common2 route helpers do not expose `stale` / `lastTs()`, so route hooks will not promise freshness until common2 extends that surface.

## Verification

- `npm run testjest -- --runInBand` — 4 suites / 13 tests passed.
- `tsc -p tsconfig.qa-check.json --noEmit` — passed.
- `npm run build` — passed.
- QA stand `http://127.0.0.1:3004/` — HTTP 200, root present.
