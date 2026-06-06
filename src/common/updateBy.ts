import { useLayoutEffect, useSyncExternalStore } from "react";
import { waitRun } from "wenay-common2";

type Listener = (a?: any) => void;

interface ObserverState {
    listeners: Set<Listener>;
    version: number;
}

export const map3 = new WeakMap<object, ObserverState>();
export const mapWait = new Map<object, ReturnType<typeof waitRun>>();

function getObserverState(obj: object): ObserverState {
    let state = map3.get(obj);
    if (!state) {
        state = { listeners: new Set(), version: 0 };
        map3.set(obj, state);
    }
    return state;
}

function triggerUpdate(obj: object, reverse = false, lastOnly = false) {
    const state = map3.get(obj);
    if (!state || state.listeners.size === 0) return;

    state.version += 1;

    let listenersArray = Array.from(state.listeners);

    if (lastOnly) {
        const last = listenersArray.at(-1);
        if (last) last(obj);
        return;
    }

    if (reverse) {
        listenersArray.reverse();
    }

    listenersArray.forEach(listener => listener(obj));
}

export function renderBy(a: object, ms?: number) {
    if (ms) {
        (mapWait.get(a) || mapWait.set(a, waitRun()).get(a)!)
            .refreshAsync(ms, () => {
                mapWait.delete(a);
                triggerUpdate(a);
            });
    } else triggerUpdate(a);
}

export function renderByRevers(a: object, ms?: number, reverse = true) {
    if (ms) {
        (mapWait.get(a) || mapWait.set(a, waitRun()).get(a)!)
            .refreshAsync(ms, () => {
                mapWait.delete(a);
                triggerUpdate(a, reverse);
            });
    } else triggerUpdate(a, reverse);
}

export function renderByLast(a: object, ms?: number) {
    if (ms) {
        (mapWait.get(a) || mapWait.set(a, waitRun()).get(a)!)
            .refreshAsync(ms, () => {
                mapWait.delete(a);
                triggerUpdate(a, false, true);
            });
    } else triggerUpdate(a, false, true);
}

export function useUpdateBy<T extends object>(
    a: T,
    f?: React.Dispatch<React.SetStateAction<T>> | ((a: T) => void)
) {
    useSyncExternalStore(
        (listener) => {
            if (f) return () => {};

            const state = getObserverState(a);
            state.listeners.add(listener);

            return () => {
                state.listeners.delete(listener);
                if (state.listeners.size === 0) map3.delete(a);
            };
        },
        () => (f ? 0 : getObserverState(a).version)
    );

    useLayoutEffect(() => {
        if (!f) return;

        const state = getObserverState(a);
        state.listeners.add(f);

        return () => {
            state.listeners.delete(f);
            if (state.listeners.size === 0) map3.delete(a);
        };
    }, [a, f]);
}

export function updateBy<T extends object>(
    a: T,
    f?: React.Dispatch<React.SetStateAction<T>> | ((a: T) => void)
) {
    useUpdateBy(a, f);
}
