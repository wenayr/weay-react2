import React, { useCallback, useLayoutEffect, useSyncExternalStore } from "react";
import { UseListen, waitRun } from "wenay-common2";

type Listener = (a?: any) => void;

interface ObserverState {
    listeners: Set<Listener>;
    version: number;
}

export const map3 = new WeakMap<object, ObserverState>();
export const mapWait = new Map<object, ReturnType<typeof waitRun>>();

/**
 * Ветка Dispatch<SetStateAction<T>>: listener получает тот же мутированный объект,
 * setState(тот же ref) React бэйлаутит без ререндера — используйте (a: T) => void.
 */
export type UpdateCallback<T extends object> =
    React.Dispatch<React.SetStateAction<T>> | ((a: T) => void);

const updateListens = new WeakMap<object, ReturnType<typeof UseListen<[object]>>>();

function getUpdateListen(obj: object) {
    let listen = updateListens.get(obj);
    if (!listen) {
        listen = UseListen<[object]>();
        updateListens.set(obj, listen);
    }
    return listen;
}

function getObserverState(obj: object): ObserverState {
    let state = map3.get(obj);
    if (!state) {
        state = { listeners: new Set(), version: 0 };
        map3.set(obj, state);
    }
    return state;
}

// reverse/lastOnly действуют только на React-подписчиков (useUpdateBy);
// императивные on-подписчики вызываются всегда все, в порядке подписки
function triggerUpdate(obj: object, reverse = false, lastOnly = false) {
    const listen = updateListens.get(obj);
    let state = map3.get(obj);
    if ((!state || state.listeners.size === 0) && !listen?.[1].count()) return;
    state ??= getObserverState(obj);

    state.version += 1;

    let listenersArray = Array.from(state.listeners);

    if (lastOnly) {
        const last = listenersArray.at(-1);
        if (last) last(obj);
        listen?.[0](obj);
        return;
    }

    if (reverse) {
        listenersArray.reverse();
    }

    listenersArray.forEach(listener => listener(obj));
    listen?.[0](obj);
}

function schedule(a: object, ms: number | undefined, reverse = false, lastOnly = false) {
    if (ms) {
        (mapWait.get(a) || mapWait.set(a, waitRun()).get(a)!)
            .refreshAsync(ms, () => {
                mapWait.delete(a);
                triggerUpdate(a, reverse, lastOnly);
            });
    } else triggerUpdate(a, reverse, lastOnly);
}

export function renderBy(a: object, ms?: number) {
    schedule(a, ms);
}

export function renderByRevers(a: object, ms?: number, reverse = true) {
    schedule(a, ms, reverse);
}

export function renderByLast(a: object, ms?: number) {
    schedule(a, ms, false, true);
}

export function useUpdateBy<T extends object>(a: T, f?: UpdateCallback<T>) {
    // стабильный subscribe: без useCallback React переподписывается на каждый рендер,
    // а удаление state из map3 при этом сбрасывало бы version → лишний форс-ререндер
    const subscribe = useCallback((listener: Listener) => {
        if (f) return () => {};

        const state = getObserverState(a);
        state.listeners.add(listener);

        return () => {
            state.listeners.delete(listener);
        };
    }, [a, f]);

    useSyncExternalStore(
        subscribe,
        // getSnapshot must be pure: only read the version, subscribe creates the state
        () => (f ? 0 : (map3.get(a)?.version ?? 0))
    );

    useLayoutEffect(() => {
        if (!f) return;

        const state = getObserverState(a);
        state.listeners.add(f);

        return () => {
            state.listeners.delete(f);
        };
    }, [a, f]);
}

export function updateBy<T extends object>(a: T, f?: UpdateCallback<T>) {
    useUpdateBy(a, f);
}

export type UpdateApi<T extends object> = {
    object: T;
    emit(ms?: number): void;
    render(ms?: number): void;
    renderReverse(ms?: number, reverse?: boolean): void;
    renderLast(ms?: number): void;
    on(listener: (obj: T) => void): () => void;
    subscribe(listener: (obj: T) => void): () => void;
    use(f?: UpdateCallback<T>): void;
    useSubscribe(f?: UpdateCallback<T>): void;
}

const apiCache = new WeakMap<object, UpdateApi<any>>();

export function createUpdateApi<T extends object>(obj: T): UpdateApi<T> {
    const cached = apiCache.get(obj);
    if (cached) return cached;

    const [, listen] = getUpdateListen(obj);
    const api: UpdateApi<T> = {
        object: obj,
        emit(ms?: number) { renderBy(obj, ms); },
        render(ms?: number) { renderBy(obj, ms); },
        renderReverse(ms?: number, reverse = true) { renderByRevers(obj, ms, reverse); },
        renderLast(ms?: number) { renderByLast(obj, ms); },
        on(listener: (obj: T) => void) {
            return listen.on((value) => listener(value as T));
        },
        subscribe(listener: (obj: T) => void) {
            return api.on(listener);
        },
        use(f?: UpdateCallback<T>) {
            useUpdateBy(obj, f);
        },
        useSubscribe(f?: UpdateCallback<T>) {
            useUpdateBy(obj, f);
        },
    }
    apiCache.set(obj, api);
    return api;
}

export function useUpdateByApi<T extends object>(obj: T, f?: UpdateCallback<T>) {
    useUpdateBy(obj, f);
    return createUpdateApi(obj);
}
