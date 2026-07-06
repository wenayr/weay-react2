import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {ObserveAll2} from "wenay-common2";

type StoreChange = ObserveAll2.StoreChange;
type StoreEachCtx = ObserveAll2.StoreEachCtx;
type StoreSubOpts = ObserveAll2.StoreSubOpts;
type StoreSyncOpts = ObserveAll2.StoreSyncOpts;
type StoreDrain = ObserveAll2.StoreDrain;
type StoreMask<T> = ObserveAll2.StoreMask<T>;
type StorePick<T, M> = ObserveAll2.StorePick<T, M>;
type StoreNode<T> = ObserveAll2.StoreNode<T>;
type StoreSelection<T, M> = ObserveAll2.StoreSelection<T, M>;

export type ListenLike<TArgs extends readonly unknown[] = readonly unknown[]> = {
    on(cb: (...args: TArgs) => void, opts?: {key?: string | symbol, current?: boolean | (() => TArgs | undefined)}): () => void;
};

export type UseStoreNodeOptions<T> = StoreSubOpts & {
    mode?: "get" | "snapshot";
    fallback?: T;
};

export type StoreNodeController<T> = {
    readonly node: StoreNode<T>;
    readonly value: T;
    readonly exists: boolean;
    readonly path: PropertyKey[];
    readonly pathString: string;
    refresh(): void;
    get(): T;
    snapshot(): T;
    has(): boolean;
    set(value: T): void;
    replace(value: T): void;
    update<M extends StoreMask<T>>(mask: M, opts?: StoreSubOpts): StoreSelection<T, M>;
};

function readNode<T>(node: StoreNode<T>, options?: UseStoreNodeOptions<T>) {
    if (!node.has()) return options?.fallback as T;
    return (options?.mode == "snapshot" ? node.snapshot() : node.get()) as T;
}

function isSameStoreMask(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === true || b === true) return false;
    if (!a || !b || typeof a != "object" || typeof b != "object") return false;

    const keysA = Reflect.ownKeys(a);
    const keysB = Reflect.ownKeys(b);
    if (keysA.length != keysB.length) return false;

    for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!isSameStoreMask((a as any)[key], (b as any)[key])) return false;
    }
    return true;
}

function useStableStoreMask<M extends StoreMask<any>>(mask: M): M {
    const ref = useRef(mask);
    if (!isSameStoreMask(ref.current, mask)) ref.current = mask;
    return ref.current;
}

function useLatestRef<T>(value: T) {
    const ref = useRef(value);
    ref.current = value;
    return ref;
}

export function useStoreNode<T>(node: StoreNode<T>, options: UseStoreNodeOptions<T> = {}): StoreNodeController<T> {
    const {current, drain, key, mode = "get", fallback} = options;
    const [version, setVersion] = useState(0);
    const refresh = useCallback(() => setVersion(v => v + 1), []);

    useEffect(() => {
        return node.on(() => refresh(), {current, drain, key});
    }, [node, current, drain, key, refresh]);

    const value = useMemo(() => readNode(node, {mode, fallback}), [node, version, mode, fallback]);
    const exists = useMemo(() => node.has(), [node, version]);

    return useMemo(() => ({
        node,
        value,
        exists,
        path: node.path,
        pathString: node.pathString,
        refresh,
        get: () => node.get(),
        snapshot: () => node.snapshot(),
        has: () => node.has(),
        set: (next: T) => node.set(next),
        replace: (next: T) => node.replace(next),
        update: <M extends StoreMask<T>>(mask: M, opts?: StoreSubOpts) => node.update(mask, opts),
    }), [node, value, exists, refresh]);
}

export type UseStoreSelectOptions<TValue> = StoreSubOpts & {
    fallback?: TValue;
};

export type StoreSelectionController<T, M extends StoreMask<T>> = {
    readonly selection: StoreSelection<T, M>;
    readonly value: StorePick<T, M>;
    readonly mask: M;
    readonly paths: PropertyKey[][];
    refresh(): void;
    get(): StorePick<T, M>;
};

export type StoreKeysController<T extends object = any> = {
    readonly node: StoreNode<T>;
    readonly keys: PropertyKey[];
    readonly stringKeys: string[];
    readonly value: T;
    readonly exists: boolean;
    refresh(): void;
    has(key: PropertyKey): boolean;
    get<K extends keyof T>(key: K): T[K];
};

export function useStoreKeys<T extends object>(
    node: StoreNode<T>,
    options: Omit<UseStoreNodeOptions<T>, "mode"> = {},
): StoreKeysController<T> {
    const state = useStoreNode(node, {...options, mode: "snapshot"});
    const keys = useMemo(() => {
        const value = state.value;
        return value != null && typeof value == "object" ? Reflect.ownKeys(value) : [];
    }, [state.value]);

    return useMemo(() => ({
        node,
        keys,
        stringKeys: keys.map(String),
        value: state.value,
        exists: state.exists,
        refresh: state.refresh,
        has: (key: PropertyKey) => state.value != null && typeof state.value == "object" && key in state.value,
        get: <K extends keyof T>(key: K) => state.value[key],
    }), [node, keys, state]);
}

export function useStoreSelect<T, M extends StoreMask<T>>(
    selection: StoreSelection<T, M>,
    options: UseStoreSelectOptions<StorePick<T, M>> = {},
): StoreSelectionController<T, M> {
    const {current, drain, key, fallback} = options;
    const [version, setVersion] = useState(0);
    const refresh = useCallback(() => setVersion(v => v + 1), []);

    useEffect(() => {
        return selection.on(() => refresh(), {current, drain, key});
    }, [selection, current, drain, key, refresh]);

    const value = useMemo(() => {
        const next = selection.get();
        return next === undefined ? fallback as StorePick<T, M> : next;
    }, [selection, version, fallback]);

    return useMemo(() => ({
        selection,
        value,
        mask: selection.mask,
        paths: selection.paths,
        refresh,
        get: () => selection.get(),
    }), [selection, value, refresh]);
}

export type UseStoreEachOptions = {
    /** false = do not subscribe (and drop the current subscription). Default true. */
    enabled?: boolean;
};

/**
 * Per-changed-top-level-key feed of a store (`store.each()` of wenay-common2): cb fires once per
 * CHANGED key per drain window with the current `store.state[key]` (`undefined` = key deleted);
 * a root replace (store.replace / mirror keyframe) EXPANDS into one call per key, so cold start
 * is not a special case for per-key consumers (grid rows, canvas layers, ...). The fold target
 * should live outside React state (ref/store/grid api) — this hook renders nothing by itself.
 * cb goes through a ref — a new identity does not resubscribe.
 * The remote (wire) counterpart is useStoreReplayEach in useReplay.ts.
 */
export function useStoreEach<T extends object>(
    store: ObserveAll2.Store<T> | null | undefined,
    cb: (key: string, value: T[keyof T] | undefined, ctx: StoreEachCtx) => void,
    options: UseStoreEachOptions = {},
): void {
    const {enabled = true} = options;
    const cbRef = useLatestRef(cb);
    useEffect(() => {
        if (!store || !enabled) return;
        // each() is created lazily per subscription: it runs while it has subscribers and closes on off()
        return store.each().on((key, value, ctx) => cbRef.current(key, value, ctx));
    }, [store, enabled, cbRef]);
}

export type RemoteStoreLike<T extends object> = {
    get(mask?: any): T | Promise<T>;
    changed: ListenLike<readonly []>;
    changedPaths?: ListenLike<readonly [StoreChange]>;
};

export type UseStoreMirrorOptions<T extends object, M extends StoreMask<T>> = StoreSyncOpts & {
    mask: M;
    auto?: boolean;
};

export type StoreMirrorController<T extends object, M extends StoreMask<T>> = {
    readonly store: ObserveAll2.Store<T> & {
        sync(mask: M, subOpts?: StoreSyncOpts): Promise<() => void>;
    };
    readonly value: StorePick<T, M>;
    readonly selection: StoreSelectionController<T, M>;
    readonly ready: boolean;
    readonly syncing: boolean;
    readonly error: unknown;
    sync(mask?: M, opts?: StoreSyncOpts): Promise<() => void>;
    stop(): void;
};

export function useStoreMirror<T extends object, M extends StoreMask<T>>(
    remote: RemoteStoreLike<T>,
    initial: T,
    options: UseStoreMirrorOptions<T, M>,
): StoreMirrorController<T, M> {
    const {mask, auto = true, current = true, drain, key, partial, onError} = options;
    const stableMask = useStableStoreMask(mask);
    const syncOptionsRef = useLatestRef({current, drain, key, partial, onError});
    const mountedRef = useRef(false);
    const stopRef = useRef<(() => void) | null>(null);
    const [ready, setReady] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const storeRef = useRef<{remote: RemoteStoreLike<T>, store: StoreMirrorController<T, M>["store"]} | null>(null);
    if (!storeRef.current || storeRef.current.remote !== remote) {
        storeRef.current = {
            remote,
            store: ObserveAll2.createStoreMirror<T>(remote, initial) as StoreMirrorController<T, M>["store"],
        };
    }
    const store = storeRef.current.store;
    const selectionRaw = useMemo(() => store.update(stableMask), [store, stableMask]);
    const selection = useStoreSelect(selectionRaw, {drain});

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            stopRef.current?.();
            stopRef.current = null;
        };
    }, []);

    const stop = useCallback(() => {
        stopRef.current?.();
        stopRef.current = null;
        if (mountedRef.current) setReady(false);
    }, []);

    const sync = useCallback(async (nextMask: M = stableMask, opts?: StoreSyncOpts) => {
        stopRef.current?.();
        stopRef.current = null;
        if (mountedRef.current) {
            setSyncing(true);
            setError(null);
        }
        try {
            const latest = syncOptionsRef.current;
            const overrideOnError = opts?.onError;
            const off = await store.sync(nextMask, {
                current: latest.current,
                drain: latest.drain,
                key: latest.key,
                partial: latest.partial,
                ...opts,
                onError(error: any) {
                    if (mountedRef.current) setError(error);
                    (overrideOnError ?? syncOptionsRef.current.onError)?.(error);
                },
            });
            stopRef.current = off;
            if (mountedRef.current) setReady(true);
            return off;
        } catch (e) {
            if (mountedRef.current) setError(e);
            throw e;
        } finally {
            if (mountedRef.current) setSyncing(false);
        }
    }, [store, stableMask, syncOptionsRef]);

    useEffect(() => {
        if (!auto) return;
        sync().catch(() => {});
        return () => {
            stopRef.current?.();
            stopRef.current = null;
        };
    }, [auto, sync, current, drain, key, partial]);

    return useMemo(() => ({
        store,
        value: selection.value,
        selection,
        ready,
        syncing,
        error,
        sync,
        stop,
    }), [store, selection, ready, syncing, error, sync, stop]);
}

export function useListenEffect<TArgs extends readonly unknown[]>(
    listen: ListenLike<TArgs> | null | undefined,
    cb: (...args: TArgs) => void,
    opts?: {key?: string | symbol, current?: boolean | (() => TArgs | undefined)},
) {
    const cbRef = useRef(cb);
    cbRef.current = cb;
    const key = opts?.key;
    const current = opts?.current;

    useEffect(() => {
        if (!listen) return;
        return listen.on((...args) => cbRef.current(...args), {key, current});
    }, [listen, key, current]);
}

export type StoreChangedPathsController = {
    readonly change: StoreChange | undefined;
    readonly paths: PropertyKey[][];
    readonly count: number;
    reset(): void;
};

export function useStoreChangedPaths(
    listen: ListenLike<readonly [StoreChange]> | null | undefined,
    opts?: {initial?: StoreChange, key?: string | symbol},
): StoreChangedPathsController {
    const [state, setState] = useState<{change?: StoreChange, count: number}>({change: opts?.initial, count: 0});
    useListenEffect(listen, (change) => {
        setState(prev => ({change, count: prev.count + 1}));
    }, {key: opts?.key});

    return useMemo(() => ({
        change: state.change,
        paths: state.change?.paths ?? [],
        count: state.count,
        reset: () => setState({change: opts?.initial, count: 0}),
    }), [state, opts?.initial]);
}

export function useListenArgs<TArgs extends readonly unknown[]>(
    listen: ListenLike<TArgs> | null | undefined,
    opts?: {initial?: TArgs, key?: string | symbol, current?: boolean | (() => TArgs | undefined)},
) {
    const [value, setValue] = useState<TArgs | undefined>(opts?.initial);
    useListenEffect(listen, (...args) => setValue(args), {key: opts?.key, current: opts?.current});
    return value;
}

export function useListenValue<T, TArgs extends readonly unknown[] = readonly [T]>(
    listen: ListenLike<TArgs> | null | undefined,
    opts?: {
        initial?: T;
        key?: string | symbol;
        current?: boolean | (() => TArgs | undefined);
        map?: (...args: TArgs) => T;
    },
) {
    const [value, setValue] = useState<T | undefined>(opts?.initial);
    const map = opts?.map;
    useListenEffect(listen, (...args) => {
        setValue(map ? map(...args) : args[0] as T);
    }, {key: opts?.key, current: opts?.current});
    return value;
}

export type {StoreChange, StoreDrain, StoreEachCtx, StoreMask, StoreNode, StorePick, StoreSelection, StoreSubOpts, StoreSyncOpts};
