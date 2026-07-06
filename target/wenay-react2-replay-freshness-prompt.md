# wenay-react2 Replay hooks: surface freshness (staleness) in controllers (feature prompt)

Follow-up to the wenay-common2 feature "Replay staleness watchdog" (`{staleMs, onStale}` in
`ReplayListenOptions` / `ReplaySubscribeOpts`, plus `isStale()` / `lastTs()` on the
subscription). **Do this only after that lands in wenay-common2** — the hooks must delegate
detection to common2, not re-implement a watchdog.

Additive only: existing hook signatures and controller fields keep working unchanged.

## Motivation

A subscriber that renders money-relevant data must be able to SHOW "this is stale" without
hand-rolling a timer over envelopes. Detection now lives in wenay-common2; the hooks' job is
React lifecycle: expose it reactively without breaking the "high-frequency lines never
re-render per event" contract.

## Surface

All three client hooks gain the same two options and two controller members:

```ts
useReplaySubscribe(remote, cb, {
    // ...existing: since?, keepSeq?=true, enabled?=true, onSeq?, onError?
    staleMs?: number,
    onStale?: (info: {stale: boolean, lastTs: number, age: number}) => void,
})
// controller gains:
//   stale: boolean       — React state; updates ONLY on fresh<->stale transitions
//   lastTs(): number     — plain getter, non-reactive (like seq())

useStoreReplaySync(store, remote, sameOpts)      // same controller additions
useStoreReplayMirror(remote, initial, sameOpts)  // same controller additions
```

`useReplayHistory` is archive playback — staleness does not apply; no change there.

## Contracts (the parts that are easy to get wrong)

- **`stale` re-renders on transition only.** A 100 events/sec line with `staleMs` set must
  cause zero extra renders while fresh. Internally: subscribe to common2's edge-triggered
  `onStale`, mirror into state; never derive per-event.
- **`lastTs()` is a getter**, same pattern as `seq()` — reading it must not subscribe the
  component to anything.
- **`onStale` goes through a ref** — new function identity does NOT resubscribe (same rule
  as `cb`/`apply` in the existing hooks). Resubscribe identity stays `[remote, enabled, epoch]`;
  changing `staleMs` may resubscribe (document whichever is chosen).
- **Resubscribe/restart semantics:** on `restart()` / `enabled` toggle / reconnect, `stale`
  resets to whatever common2 reports after the first delivery — in particular a keyframe
  with an old producer `ts` must surface `stale: true` immediately (common2 detects it;
  the hook must not mask it by resetting to `false` on resubscribe).
- **Unmount:** watchdog dies with the subscription; no timers leak (StrictMode double-effect
  safe, same discipline as the existing off() handling).
- **No `staleMs`:** zero cost — no state, no subscription to onStale, `stale` stays `false`,
  `lastTs()` still works if common2 provides it for free.

## QA stand

Extend the existing replay QA cards (video line + store sync):
- a stall toggle on the producer (stop emitting); the card shows a stale badge appearing
  after `staleMs` and disappearing on resume — with a render counter proving no per-event
  re-renders while fresh;
- a "stale keyframe" case: stall the producer, mount a NEW client — badge must be stale
  from the first paint;
- StrictMode on: no double watchdogs, no flicker of `stale` on the double effect.

## Docs

`wenay-react2.md` (brief, Replay React Adapter section): add `stale` / `lastTs()` to the
controller listing with one sentence on the transition-only render contract.
`wenay-react2-rare.md` (details): the resubscribe/keyframe semantics above.
