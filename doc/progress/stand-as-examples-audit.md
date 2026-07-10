# Stand as examples — audit

## Current shape

- `src/common/testUseReact/qa.tsx` owns 44 hand-written cards and the component implementations are mostly in the same file.
- The board has only Active/Archive separation. It does not declare whether a card is canonical consumer guidance or internal regression/compat coverage.
- `doc/examples/peer-call-media.tsx` is shipped, but card 41–44 currently use a parallel implementation.

## Decision

Turn the stand into a renderer/acceptance layer over a small set of canonical demo modules. Ship those modules in `demo/`; keep isolated repros and compat examples in QA/regression only. Use a manifest per card to link source demo, automated test and manual verification.

## First migration

Extract Media/Peer calls, presence, camera relay and microphone relay. The QA cards must import the same component that is shipped in the package. No new transport/ACL code belongs in React.
## Batch 1 complete — Media/Peer

- Extracted cards 41–44 into `src/common/demo/peerMedia.tsx`.
- QA imports those exact components; package exports `wenay-react2/demo/peer-media`.
- `doc/examples/peer-call-media.tsx` re-exports the public demo entrypoint.
- Remaining batches: Replay, then toolbar/columnState/grid; archive stays internal.
- Verification: qa-check TypeScript, full Jest (21 suites / 71 tests), package build and Vite stand cards 41–44 all pass. The package is browser-oriented; direct Node require is not a supported validation surface for its extensionless ESM build.
