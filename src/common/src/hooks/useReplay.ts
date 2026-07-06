import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {ObserveAll2, Replay} from "wenay-common2";

type StorePatch = ObserveAll2.StorePatch;
type ReplayEvent<Z extends any[]> = Replay.ReplayEvent<Z>;
type ReplayRemote<Z extends any[]> = Replay.ReplayRemote<Z>;
type StaleInfo = Replay.StaleInfo;

/**
 * React bridge over the Replay stack (snapshot + sequenced delta line) of wenay-common2.
 *
 * The lifecycle rules these hooks encapsulate:
 * - off() on unmount, subscription never outlives the component (StrictMode double-effect safe);
 * - seq survives resubscribes within a mounted component (StrictMode double-effect, restart(),
 *   enabled toggling): the resubscribe reconnects with {since: lastSeq} and receives the journal
 *   tail instead of a full keyframe — as long as the folded state itself lives outside the effect
 *   (ref/store/canvas). If the consumer state resets on resubscribe, pass {keepSeq: false};
 * - a FULL unmount loses the hook's refs: to reconnect by tail after a remount, keep the position
 *   outside via onSeq and pass it back as `since` (see the QA card for the pattern);
 * - a different `remote` identity always starts from scratch (seq from another line is meaningless);
 * - freshness (staleMs/onStale, controller.stale/lastTs()) is detected by wenay-common2;
 *   the hooks only mirror the fresh<->stale edges into React state.
 *
 * Server-side parts of the stack (conflateReplay, archiveReplay) are per-connection/per-process
 * and intentionally have no hooks here.
 */

function useLatestRef<T>(value: T) {
    const ref = useRef(value);
    ref.current = value;
    return ref;
}

export type UseReplaySubscribeOptions = {
    /** Start position for the first subscription: journal tail after this seq; omit = keyframe. */
    since?: number;
    /** Keep the last seen seq across resubscribes (remount/restart) and reconnect with the tail. Default true. */
    keepSeq?: boolean;
    /** false = do not subscribe (and drop the current subscription). Default true. */
    enabled?: boolean;
    onSeq?: (seq: number) => void;
    onError?: (e: unknown) => void;
    /**
     * Producer-freshness watchdog (detection lives in wenay-common2): no event with a fresh
     * producer ts for staleMs -> `stale` flips true, flips back on resume. Omitted = zero cost
     * (no watchdog, no extra state updates). Changing staleMs resubscribes (reconnects by tail
     * under keepSeq, so it is cheap).
     */
    staleMs?: number;
    /** Edge-triggered mirror of common2's onStale (fresh<->stale transitions only). Goes through a ref — a new identity does not resubscribe. */
    onStale?: (info: StaleInfo) => void;
};

export type ReplaySubscribeController = {
    /** Keyframe/tail catch-up finished, events are live from here. */
    readonly ready: boolean;
    readonly error: unknown;
    /**
     * Line is stale by the staleMs watchdog. React state, but it updates ONLY on fresh<->stale
     * transitions — a high-frequency line causes zero extra renders while fresh.
     * Always false without staleMs.
     */
    readonly stale: boolean;
    /** Last seen seq (reconnect point). Getter — reading it does not re-render. */
    seq(): number;
    /** Producer ts of the last delivered event (0 before the first delivery). Getter — reading it does not re-render. */
    lastTs(): number;
    /** Drop and re-create the subscription. since omitted = continue by keepSeq rules; a number = explicit position. */
    restart(since?: number): void;
};

/**
 * Subscribe to a replay line (`Replay.exposeReplay` shape: {line, since, keyframe}).
 * The delivery contract of the line is preserved as is: cb first receives the snapshot
 * (keyframe as a normal event), then strictly-newer events, seq-ascending, deduped.
 * cb goes through a ref — a new cb identity does not resubscribe.
 */
export function useReplaySubscribe<Z extends any[]>(
    remote: ReplayRemote<Z> | null | undefined,
    cb: (...event: Z) => void,
    options: UseReplaySubscribeOptions = {},
): ReplaySubscribeController {
    const {since, keepSeq = true, enabled = true, onSeq, onError, staleMs, onStale} = options;
    const cbRef = useLatestRef(cb);
    const hooksRef = useLatestRef({onSeq, onError, onStale});
    const seqRef = useRef<number | undefined>(since);
    const subRef = useRef<(() => void) & {seq: () => number, lastTs: () => number} | null>(null);
    const lastRemoteRef = useRef<ReplayRemote<Z> | null | undefined>(undefined);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const [stale, setStale] = useState(false);
    const [epoch, setEpoch] = useState(0);

    useEffect(() => {
        if (!remote || !enabled) return;
        if (lastRemoteRef.current !== undefined && lastRemoteRef.current !== remote) seqRef.current = undefined; // a different line — old seq is meaningless
        lastRemoteRef.current = remote;

        let alive = true;
        setReady(false);
        setError(null);
        // stale is NOT reset here: it re-syncs from common2 after the first delivery (a stale
        // keyframe must show stale from the start, not flicker through false on resubscribe)
        if (staleMs === undefined) setStale(false);
        const off = Replay.replaySubscribe<Z>(remote, (...event) => cbRef.current(...event), {
            since: seqRef.current,
            onSeq: seq => {
                seqRef.current = seq;
                hooksRef.current.onSeq?.(seq);
            },
            onError: e => {
                if (alive) setError(e);
                hooksRef.current.onError?.(e);
            },
            ...(staleMs !== undefined ? {
                staleMs,
                onStale: (info: StaleInfo) => {
                    if (alive) setStale(info.stale);
                    hooksRef.current.onStale?.(info);
                },
            } : null),
        });
        subRef.current = off;
        off.ready.then(
            () => {
                if (!alive) return;
                setReady(true);
                if (staleMs !== undefined) setStale(off.isStale()); // fresh line after a stale one: no edge from common2, sync by hand
            },
            e => { if (alive) setError(e); },
        );
        return () => {
            alive = false;
            subRef.current = null;
            off();
            if (!keepSeq) seqRef.current = since;
        };
        // keepSeq/since are start-position config, not subscription identity — no resubscribe on change;
        // staleMs is subscribe-time config in common2, so changing it resubscribes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [remote, enabled, epoch, staleMs]);

    const seq = useCallback(() => subRef.current?.seq() ?? seqRef.current ?? -1, []);
    const lastTs = useCallback(() => subRef.current?.lastTs() ?? 0, []);
    const restart = useCallback((at?: number) => {
        if (at !== undefined) seqRef.current = at;
        setEpoch(v => v + 1);
    }, []);

    return useMemo(() => ({ready, error, stale, seq, lastTs, restart}), [ready, error, stale, seq, lastTs, restart]);
}

export type UseStoreReplaySyncOptions = UseReplaySubscribeOptions;

export type StoreReplaySyncController = ReplaySubscribeController;

/**
 * Sync an existing mirror store from a store replay line (`ObserveAll2.exposeStoreReplay(...).api.replay`).
 * Thin lifecycle wrapper over `ObserveAll2.syncStoreReplay`: the keyframe (root patch) and the
 * patch tail are applied to the store by the library; UI subscribes to the store as usual
 * (useStoreNode/useStoreSelect).
 */
export function useStoreReplaySync<T extends object>(
    store: ObserveAll2.Store<T> | null | undefined,
    remote: ReplayRemote<[StorePatch]> | null | undefined,
    options: UseStoreReplaySyncOptions = {},
): StoreReplaySyncController {
    const {since, keepSeq = true, enabled = true, onSeq, onError, staleMs, onStale} = options;
    const hooksRef = useLatestRef({onSeq, onError, onStale});
    const seqRef = useRef<number | undefined>(since);
    const subRef = useRef<(() => void) & {seq: () => number, lastTs: () => number} | null>(null);
    const lastRemoteRef = useRef<ReplayRemote<[StorePatch]> | null | undefined>(undefined);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const [stale, setStale] = useState(false);
    const [epoch, setEpoch] = useState(0);

    useEffect(() => {
        if (!store || !remote || !enabled) return;
        if (lastRemoteRef.current !== undefined && lastRemoteRef.current !== remote) seqRef.current = undefined;
        lastRemoteRef.current = remote;

        let alive = true;
        setReady(false);
        setError(null);
        if (staleMs === undefined) setStale(false); // see useReplaySubscribe: stale re-syncs from common2, no reset-to-false flicker
        const off = ObserveAll2.syncStoreReplay(store, remote, {
            since: seqRef.current,
            onSeq: seq => {
                seqRef.current = seq;
                hooksRef.current.onSeq?.(seq);
            },
            onError: e => {
                if (alive) setError(e);
                hooksRef.current.onError?.(e);
            },
            ...(staleMs !== undefined ? {
                staleMs,
                onStale: (info: StaleInfo) => {
                    if (alive) setStale(info.stale);
                    hooksRef.current.onStale?.(info);
                },
            } : null),
        });
        subRef.current = off;
        off.ready.then(
            () => {
                if (!alive) return;
                setReady(true);
                if (staleMs !== undefined) setStale(off.isStale());
            },
            e => { if (alive) setError(e); },
        );
        return () => {
            alive = false;
            subRef.current = null;
            off();
            if (!keepSeq) seqRef.current = since;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store, remote, enabled, epoch, staleMs]);

    const seq = useCallback(() => subRef.current?.seq() ?? seqRef.current ?? -1, []);
    const lastTs = useCallback(() => subRef.current?.lastTs() ?? 0, []);
    const restart = useCallback((at?: number) => {
        if (at !== undefined) seqRef.current = at;
        setEpoch(v => v + 1);
    }, []);

    return useMemo(() => ({ready, error, stale, seq, lastTs, restart}), [ready, error, stale, seq, lastTs, restart]);
}

export type StoreReplayMirrorController<T extends object> = StoreReplaySyncController & {
    readonly store: ObserveAll2.Store<T>;
};

/**
 * Convenience: create a local mirror store and keep it synced from a store replay line.
 * The store lives in a ref — a component remount keeps both the state and the seq,
 * so reconnect is a journal tail, not a keyframe. A new `remote` recreates the store.
 */
export function useStoreReplayMirror<T extends object>(
    remote: ReplayRemote<[StorePatch]> | null | undefined,
    initial: T,
    options: UseStoreReplaySyncOptions = {},
): StoreReplayMirrorController<T> {
    const storeRef = useRef<{remote: typeof remote, store: ObserveAll2.Store<T>} | null>(null);
    if (!storeRef.current || storeRef.current.remote !== remote) {
        storeRef.current = {remote, store: ObserveAll2.createStore<T>(initial)};
    }
    const store = storeRef.current.store;
    const sync = useStoreReplaySync(store, remote, options);
    return useMemo(() => ({...sync, store}), [sync, store]);
}

export type ReplayHistoryLike<Z extends any[]> = {
    at(where?: {seq?: number, ts?: number}): ReplayEvent<Z>[] | undefined;
    subscribe(cb: (...event: Z) => void, opts?: {since?: number, ts?: number, onSeq?: (seq: number) => void}): (() => void) & {seq: () => number};
};

export type UseReplayHistoryOptions = {
    /** Live head seq getter (slider max), e.g. `() => replay.head()`. Without it head = max seen seq. */
    head?: () => number;
    /** Called before folding a seek (clear consumer state). Usually not needed: a keyframe fully redefines the state. */
    reset?: () => void;
    /** UI position/head refresh period while live, ms. Default 300. */
    tickMs?: number;
    /** Follow live on mount. Default true. */
    autoPlay?: boolean;
};

export type ReplayHistoryController = {
    /** true = following live (archive tail -> live handover), false = paused/seeked. */
    readonly live: boolean;
    /** Current playback position (UI state; refreshed every tickMs while live). */
    readonly seq: number;
    /** Last known head seq (slider max). */
    readonly head: number;
    pause(): void;
    /** Resume from the current position: journal/archive tail, then live. */
    play(): void;
    /** Pause and jump: fold keyframe + events up to the position through `apply`. */
    seek(where: {seq?: number, ts?: number}): void;
};

/**
 * Time machine over `Replay.openHistory(storage, live?)`: scrubber/pause/resume for any replay line.
 * `apply` folds ONE event into the consumer state (draw a frame, apply a store patch, ...) —
 * the same fold works for live playback and for seeks, snapshot is not a special case.
 */
export function useReplayHistory<Z extends any[]>(
    history: ReplayHistoryLike<Z> | null | undefined,
    apply: (...event: Z) => void,
    options: UseReplayHistoryOptions = {},
): ReplayHistoryController {
    const {head: headGetter, reset, tickMs = 300, autoPlay = true} = options;
    const applyRef = useLatestRef(apply);
    const resetRef = useLatestRef(reset);
    const headRef = useLatestRef(headGetter);
    const posRef = useRef(-1);
    const killRef = useRef<(() => void) | null>(null);
    const [live, setLive] = useState(autoPlay);
    const [pos, setPos] = useState(-1);
    const [head, setHead] = useState(-1);

    const readHead = useCallback(() => {
        const h = headRef.current ? headRef.current() : -1;
        return Math.max(h, posRef.current);
    }, [headRef]);

    useEffect(() => {
        if (!history || !live) return;
        const off = history.subscribe((...event) => applyRef.current(...event), {
            since: posRef.current >= 0 ? posRef.current : undefined,
            onSeq: seq => { posRef.current = seq; },
        });
        let done = false;
        killRef.current = () => {
            if (done) return;
            done = true;
            off();
        };
        const timer = setInterval(() => {
            setPos(posRef.current);
            setHead(readHead());
        }, tickMs);
        return () => {
            clearInterval(timer);
            killRef.current?.();
            killRef.current = null;
        };
    }, [history, live, tickMs, applyRef, readHead]);

    const pause = useCallback(() => {
        killRef.current?.();   // stop deliveries immediately, not on the next render
        killRef.current = null;
        setLive(false);
        setPos(posRef.current);
        setHead(readHead());
    }, [readHead]);

    const play = useCallback(() => setLive(true), []);

    const seek = useCallback((where: {seq?: number, ts?: number}) => {
        if (!history) return;
        killRef.current?.();
        killRef.current = null;
        setLive(false);
        const events = history.at(where);
        if (events && events.length) {
            resetRef.current?.();
            for (const ev of events) applyRef.current(...ev.event);
            posRef.current = events[events.length - 1].seq;
        }
        setPos(posRef.current);
        setHead(readHead());
    }, [history, applyRef, resetRef, readHead]);

    return useMemo(() => ({live, seq: pos, head, pause, play, seek}), [live, pos, head, pause, play, seek]);
}
