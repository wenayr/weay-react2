# wenay-calls

React call UI and hooks over the [wenay-common2](https://www.npmjs.com/package/wenay-common2)
peer/media stack: the `VideoCall` product surface, media capture, peer calls, presence and the
relay↔direct route chip. Until wenay-react2 5.0.0 this was `wenay-react2/communication`.

The package imports only `react` and `wenay-common2` and never depends on wenay-react2.

## Install

```sh
npm i wenay-calls react wenay-common2
```

```ts
import "wenay-calls/styles"   // once, next to your app entry
```

| Entry | Contents |
| --- | --- |
| `wenay-calls` | `VideoCall`, `useVideoCallController`, `videoCallLabelsRu`, `videoCallLabelsEn`, `useMediaSource`, `usePeer`, `usePeerCalls`, `usePeerPresence`, `useRouteState` and their types |
| `wenay-calls/styles` | the `VideoCall` stylesheet |
| `wenay-calls/demo/peer-media` | interactive in-process peer call, presence and media relay demos |
| `wenay-calls/demo/peer-conference` | a 3-way conference over pairwise calls, relay fan-out and a relay↔direct focus pair |

## VideoCall

```tsx
import {VideoCall, useVideoCallController, videoCallLabelsEn} from "wenay-calls"

const phase = call.active ? "active" : call.ringing ? "ringing" : "lobby"
const ui = useVideoCallController({phase, speakerId: participants[0].id})

<VideoCall
  controller={ui}
  labels={videoCallLabelsEn}     // optional; any Partial<VideoCallLabels>, Russian by default
  phase={phase}
  meeting={meeting}
  participants={participants}
  selfParticipantId={me}
  canvasRef={remoteCanvasRef}
  cameraState={camera.state}
  microphoneState={microphone.state}
  screenShareState={screen.state}
  screenVideoRef={screen.videoRef}
  recording={recording}
  rooms={rooms}
  assistant={assistant}
  onJoin={call.start}
  onHangup={call.hangup}
  onToggleCamera={camera.toggle}
  onToggleMicrophone={microphone.toggle}
  onToggleScreenShare={screen.toggle}
  onToggleRecording={recording.toggle}
  onJoinRoom={rooms.join}
  onLeaveRoom={rooms.leave}
  onAssistantCommand={assistant.run}
/>
```

`VideoCall` is a controlled product surface, not a protocol. `useVideoCallController` owns only
visual state: panel, focus mode, layout, speaker, poll/effect/drafts, laser pointer, the call
timer and control auto-hiding. Every visible and assistive text comes from `labels`: missing keys
fall back to `videoCallLabelsRu`, and `videoCallLabelsEn` is a complete English set.
`assistantCommands` are sent verbatim to `onAssistantCommand`, so the application's command
parser must use the same language.

## Hooks

- `useMediaSource(kind, options)` - capture lifecycle only (`start`, `stop`, device selection,
  state and stats); it stops a started source on unmount and returns the common2 `listen`
  unchanged. Frames are `Uint8Array`s (`Media.decodeMediaFrame`): draw or play them through a ref
  (canvas, AudioContext), never through React state.
- `usePeer(client, account)` - the mirrored Store of `Peer.createPeerClient(...).peer(account)`
  plus low-frequency route/status and explicit route/resync controls. Journal, repair and
  transport state stay in common2.
- `usePeerCalls(manager)` - rings, active call and call UI state over `Peer.createCallManager`;
  the caller keeps `manager.close()` and the signal policy.
- `usePeerPresence(presence)` - subscribes before reading the host snapshot and exposes the
  online/offline edges.
- `useRouteState(coordinator, link)` - the route chip over `Replay.createRouteCoordinator`:
  state, last reason, connector metrics every 500 ms and a short hand-off log. The caller owns the
  coordinator and link lifecycle.

## Ownership

The application owns call authorization, participant and room truth, capture permissions,
relay/direct routes, translation, recording policy and canvas/video attachment. For calls with
media, wire `Peer.createMediaRelay` on the server (`publishOf`, `watchOf`, `canWatch`) and attach
viewers only when the server-owned call policy grants access: React never makes the ACL decision.
Never serve a route coordinator from `relay.watchOf` lines, they are per-watcher re-sequenced
journals. A real-backend conference example lives in the wenay-react2 repository:
[conference-server.mjs](https://github.com/wenayr/weay-react2/blob/master/doc/examples/conference-server.mjs)
and [conference-client.ts](https://github.com/wenayr/weay-react2/blob/master/doc/examples/conference-client.ts).

## Migrating from wenay-react2

wenay-react2 5.0.0 ships a CLI that rewrites the imports in one run, 3.x and 4.x code alike:
`wenay-react2/communication` → `wenay-calls`, `wenay-react2/styles/communication` →
`wenay-calls/styles`, `wenay-react2/demo/*` → `wenay-calls/demo/*`, and `useRouteState` from
`wenay-react2/react` → `wenay-calls`.

```sh
npm i wenay-react2@5 wenay-calls
npm i -D @babel/parser
node node_modules/wenay-react2/scripts/migrate-root-imports.mjs --write src
```

## Changes

### 1.0.0 (2026-09-24)

First release: the former `wenay-react2/communication` entry (`VideoCall` with `labels`, the
media/peer hooks), `useRouteState` (formerly on `wenay-react2/react`), the two peer demos and the
stylesheet (formerly `wenay-react2/styles/communication`). The conference demo now imports
`listen` from the narrow `wenay-common2/listen` instead of the client barrel.
