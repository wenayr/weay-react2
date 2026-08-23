import React, { useCallback, useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { listen as createListen, waitRun } from "wenay-common2/client";

// изоморфный layout-эффект: на сервере (SSR) useLayoutEffect шумит предупреждением,
// поэтому там падаем на useEffect
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Listener = (a?: any) => void;

interface ObserverState {
    listeners: Set<Listener>; // React-нотификаторы (useSyncExternalStore)
    callbacks: Set<Listener>; // императивные f-колбэки (useUpdateBy(a, f))
    version: number;
    running: boolean; // идёт итерация triggerUpdate по этому объекту
    pending: boolean; // вложенный renderBy запросил повторный проход
}

export const map3 = new WeakMap<object, ObserverState>();
export const mapWait = new Map<object, ReturnType<typeof waitRun>>();

/**
 * Ветка Dispatch<SetStateAction<T>>: listener получает тот же мутированный объект,
 * setState(тот же ref) React бэйлаутит без ререндера — используйте (a: T) => void.
 */
export type UpdateCallback<T extends object> =
    React.Dispatch<React.SetStateAction<T>> | ((a: T) => void);

const updateListens = new WeakMap<object, ReturnType<typeof createListen<[object]>>>();

function getUpdateListen(obj: object) {
    let listen = updateListens.get(obj);
    if (!listen) {
        listen = createListen<[object]>();
        updateListens.set(obj, listen);
    }
    return listen;
}

function getObserverState(obj: object): ObserverState {
    let state = map3.get(obj);
    if (!state) {
        state = { listeners: new Set(), callbacks: new Set(), version: 0, running: false, pending: false };
        map3.set(obj, state);
    }
    return state;
}

// reverse/lastOnly действуют только на React-подписчиков (useSyncExternalStore);
// императивные f-колбэки вызываются всегда все, в порядке подписки, ДО React-нотификаторов
function runTriggerPass(obj: object, state: ObserverState, reverse: boolean, lastOnly: boolean) {
    const listen = updateListens.get(obj);

    state.version += 1;

    // один бросивший подписчик не должен обрывать проход: раньше исключение из
    // императивного колбэка не давало вызвать React-нотификаторы вообще
    const call = (f: Listener) => {
        try { f(obj); }
        catch (e) { console.error("updateBy: подписчик бросил исключение", e); }
    };

    // императивные f-колбэки: всегда все, в порядке подписки
    // копия нужна: колбэк может отписаться прямо во время прохода
    if (state.callbacks.size) for (const callback of [...state.callbacks]) call(callback);

    if (state.listeners.size) {
        if (lastOnly) {
            // нужен только хвост - обходим Set без копии массива
            let last: Listener | undefined;
            for (const listener of state.listeners) last = listener;
            if (last) call(last);
        } else if (reverse) {
            const listeners = [...state.listeners];
            for (let i = listeners.length - 1; i >= 0; i--) call(listeners[i]);
        } else {
            for (const listener of [...state.listeners]) call(listener);
        }
    }

    listen?.[0](obj);
}

const MAX_TRIGGER_PASSES = 100;
let warnedMaxPasses = false;

function triggerUpdate(obj: object, reverse = false, lastOnly = false) {
    const listen = updateListens.get(obj);
    let state = map3.get(obj);
    const idle = (!state || (state.listeners.size === 0 && state.callbacks.size === 0)) && !listen?.[1].count();
    state ??= getObserverState(obj);
    // The version must move even with nobody subscribed yet. A component that has already
    // rendered read the version in getSnapshot, and React re-reads it right after subscribing;
    // a mutation landing in that window would otherwise compare equal and be lost until the
    // next renderBy. runTriggerPass does the bump for the non-idle path.
    if (idle) {
        state.version += 1;
        return;
    }

    // реентерабельность: синхронный renderBy по тому же объекту изнутри слушателя
    // коалесцируется — помечаем pending и выходим, текущая итерация сделает ещё проход
    if (state.running) {
        state.pending = true;
        return;
    }

    state.running = true;
    try {
        for (let pass = 0; pass < MAX_TRIGGER_PASSES; pass++) {
            state.pending = false;
            runTriggerPass(obj, state, reverse, lastOnly);
            if (!state.pending) break;
        }
        if (state.pending && !warnedMaxPasses) {
            warnedMaxPasses = true;
            console.error(
                `updateBy: triggerUpdate достиг предела MAX_TRIGGER_PASSES (${MAX_TRIGGER_PASSES}) — ` +
                `слушатель синхронно перезапускает renderBy по тому же объекту. ` +
                `Коалесцирование прервано, дальнейшие проходы в этом цикле пропущены.`
            );
        }
    } finally {
        state.running = false;
        state.pending = false;
    }
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
    // f прокидывается через ref: inline-колбэк (новая identity на каждый рендер)
    // не должен вызывать переподписку — регистрируется одна стабильная обёртка на (a)
    const fRef = React.useRef(f);
    fRef.current = f;
    const hasF = !!f;

    // стабильный subscribe: без useCallback React переподписывается на каждый рендер,
    // а удаление state из map3 при этом сбрасывало бы version → лишний форс-ререндер
    const subscribe = useCallback((listener: Listener) => {
        if (hasF) return () => {};

        const state = getObserverState(a);
        state.listeners.add(listener);

        return () => {
            state.listeners.delete(listener);
        };
    }, [a, hasF]);

    useSyncExternalStore(
        subscribe,
        // getSnapshot must be pure: only read the version, subscribe creates the state
        () => (hasF ? 0 : (map3.get(a)?.version ?? 0)),
        // The hook returns no snapshot-derived value, so one stable server version is
        // sufficient and lets bundler-based SSR render subscribers without throwing.
        () => 0,
    );

    useIsoLayoutEffect(() => {
        if (!hasF) return;

        const state = getObserverState(a);
        // обёртка передаёт тот же мутированный объект — для ветки Dispatch<SetStateAction<T>>
        // setState(тот же ref) React бэйлаутит без ререндера (см. UpdateCallback)
        const wrapper: Listener = (obj) => {
            fRef.current?.(obj);
        };
        state.callbacks.add(wrapper);

        return () => {
            state.callbacks.delete(wrapper);
        };
    }, [a, hasF]);
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
