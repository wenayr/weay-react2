# wenay-common2 1.0.74 — adoption assessment

## Upgrade

- Updated the workspace lockfile from `wenay-common2` 1.0.73 to 1.0.74.
- Compatibility: qa-check TypeScript, full Jest (20 suites / 67 tests), package build and diff-check pass.

## Architecture decision

- `Peer.createCallManager` is a new application interaction lifecycle, not an extension of the mirrored-store `usePeer` adapter.
- React may bind call state and controls; common2 retains signaling envelopes, call-id ordering, busy/glare handling, timeouts and offline verdicts.
- Presence belongs to the host protocol (`list()` plus edge-triggered `changes`), not polling or a second React-owned store.
- `createMediaRelay` remains relay-first and server-authorized through `watchOf` / `canWatch`; a call UI attaches viewers only while active. React must not make ACL decisions.

## Planned validation batch

Presence edges; ring/accept/active; media keyframe; hangup/decline/offline/busy; ACL revoke of an already-open viewer.
## Implementation batch — 1.0.46

- Added `usePeerCalls(manager)`: a thin binding for ring/active state and explicit `call`; the app owns `manager.close()`.
- Added `usePeerPresence(presence)`: subscribe-first snapshot plus online/offline edge projection.
- QA cards 41–44 verify an in-process call lifecycle, presence disconnect/reconnect and media relay ACL revocation on an open viewer.
- Automated verification: qa-check TypeScript, real in-process hook tests, full Jest and package build.
- Manual Verify pending: QA card 43 — grant camera access, confirm canvas receives frames; revoke ACL and confirm viewer frame count freezes while source remains live; grant again and confirm it resumes. QA card 44 — grant microphone access, confirm audio player receives frames/plays; revoke and grant ACL with the same expectation.
