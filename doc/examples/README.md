# Runnable consumer examples

- [`peer-call-media.tsx`](peer-call-media.tsx) — re-exports the interactive Peer/Media demos used by QA cards 41–44. Install the package and import from `wenay-react2/demo/peer-media`.

The component uses an in-process `Peer.createPeerHost`, so calls, presence, camera and microphone relay work without server credentials. For production, expose `publishOf(account)` and `watchOf(account)` from the RPC server and keep `canWatch` plus call authorization on that server.
- [stand.tsx](stand.tsx) — exports the entire interactive stand from wenay-react2/demo/stand. Active cards teach canonical APIs; Archive cards remain visible regression/compat examples.
