# wenay-common2: replay-transparent RPC exposure (feature prompt)

Goal: upgrading a stream from `UseListen` to `UseReplayListen` must be a ONE-WORD change
at the declaration site. No facade edits, no separate `exposeReplay` key, no client
migration. Consumers opt into the replay surface per need; legacy subscribers never
notice the difference.

Additive only. `exposeReplay`/`replaySubscribe` keep working as the explicit manual path.

## Motivation

`UseReplayListen` is already a drop-in superset of `UseListen` (same `[emit, listen]`
pair, full plain-listen surface plus `line/getSince/keyframe`). The producer and the
in-proc consumers upgrade for free. The one remaining seam is the wire: the rpc server
exposes the value as a plain Listen (duck-typing), so the replay surface is lost unless
the facade author hand-adds an `exposeReplay(...)` key. That seam is in the wrong place —
the facade should not need to know which consumers want catch-up.

## Feature A — auto-detection in `createRpcServerAuto`

When a facade value duck-types as a replay listen (`ListenReplayApi`: plain listen
surface AND `line` + `getSince` + `keyframe`/`hasKeyframe` — prefer a brand/symbol check
over structural sniffing if available), expose BOTH surfaces under the SAME key:

1. **Legacy path unchanged:** subscribing to the key as a plain Listen behaves exactly
   as if the facade had exported the base listen — live events only, same wire format,
   byte-for-byte. Existing clients (callback-style rpc subscription) must not change.
2. **Replay path:** the key also carries the `exposeReplay` wire surface (`line` as a
   plain Listen, `since`/`keyframe` as plain methods) so `replaySubscribe(remote.key)`
   works against it directly.

Opt-out/force: server option `replay: false | 'auto' (default) | 'force'` per
`createRpcServerAuto` call, plus a per-key override map if cheap to add.

## Feature B — server-owned conflate

The rpc server owns the socket, so per-connection gating should not require the app to
plumb `pending` from outside. Add server-level replay options:

```ts
createRpcServerAuto({
    object, socketKey, socket, disconnectListen,
    replayOpts?: {
        conflate?: {highWater: number, lowWater?: number, pollMs?: number, maxKeys?: number}
            | ((key: string) => ConflateOpts-partial | null),   // per-key override / null = no gate
    },
})
```

- `pending` derives from the server's own socket (`socket.conn.writeBuffer.length` for
  socket.io; keep it overridable for other transports).
- `keyOf`: when the replay line is a store patch line, default to `storePatchKey`;
  otherwise no key-coalescing unless the per-key override provides one.
- Gates close on the server's own disconnect handling — no app wiring.
- Queue-flavored lines (fills, logs) typically want NO gate: the per-key function
  returning `null` must be easy and obvious in docs.

## Feature C (optional, smaller) — store transparency

Same idea one level up: a facade value that IS an ObserveAll2 `Store` could auto-expose
as `exposeStore` (or `exposeStoreReplay` when `replayOpts` present). Because exposing a
raw store is a bigger semantic step (write surface `set/replace` goes to the wire), make
this one explicitly opt-in — a tiny marker wrapper (`ObserveAll2.expose(store, opts?)`)
rather than pure duck-typing. If this bloats the change, ship A+B first.

## Contracts / edge cases

- A replay listen exposed under 'auto' must not double-journal or double-subscribe the
  base producer; the rpc layer only projects existing surfaces.
- Legacy subscription and replay subscription may coexist on one connection.
- `since`/`keyframe` are per-line, shared across connections; conflate state is
  per-connection per-key.
- RpcLimits apply to keyframe payloads (they can be large) — document that a keyframe
  exceeding limits should fail that call loudly, not silently truncate.

## Oracles / QA

- Wire harness: facade with a `UseReplayListen` member — (a) legacy client subscribes
  plain, sees live events identical to a `UseListen` baseline; (b) replay client
  `replaySubscribe` with `{since: 0}` folds journal + live with no gaps/dups; (c) both
  at once on one connection.
- Conflate: slow-consumer socket sim with server-level `replayOpts.conflate` — bounded
  buffer, keyframe/coalesced-tail recovery, gate closed on disconnect (no leak).
- Auto-detection negative: plain `UseListen` members and ordinary objects with a `line`
  property must NOT be misdetected (brand check preferred).

## Docs

`wenay-common2-rare.md` rpc section: one paragraph — "facade members that are replay
listens are exposed with both surfaces; upgrading UseListen→UseReplayListen is a
declaration-site-only change". Replay section: server-owned conflate via `replayOpts`.
