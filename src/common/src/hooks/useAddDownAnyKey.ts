import {useEffect, useRef} from "react";
import {renderBy} from "../../updateBy";
import {listen as createListen} from "wenay-common2";

export const KeyDown = {
    key: "" as string
}

export type AnyKeyDownApi = {
    readonly key: string;
    getKey(): string;
    get(): string;
    clear(): void;
    reset(): void;
    subscribe(listener: (key: string, event?: KeyboardEvent) => void): () => void;
    on(listener: (key: string, event?: KeyboardEvent) => void): () => void;
}

const [emitKeyDown, keyDownListen] = createListen<[string, KeyboardEvent | undefined]>();

export const keyDownApi: AnyKeyDownApi = {
    get key() { return KeyDown.key; },
    getKey() { return KeyDown.key; },
    get() { return KeyDown.key; },
    clear() {
        KeyDown.key = "";
        renderBy(KeyDown);
        emitKeyDown("", undefined);
    },
    reset() {
        keyDownApi.clear();
    },
    subscribe(listener) {
        return keyDownListen.on(listener);
    },
    on(listener) {
        return keyDownListen.on(listener);
    }
}

export function useAddDownAnyKey(options: {
    enabled?: boolean,
    target?: Document | HTMLElement,
    onKeyDown?: (key: string, event: KeyboardEvent) => void,
} = {}) {
    const {enabled = true, target} = options;
    const onKeyDownRef = useRef(options.onKeyDown);
    onKeyDownRef.current = options.onKeyDown;

    useEffect(() => {
        if (!enabled) return;
        const currentTarget = target ?? (typeof document !== "undefined" ? document : null);
        if (!currentTarget) return;
        const func: EventListener = (event) => {
            if (!(event instanceof KeyboardEvent)) return;
            KeyDown.key = event.key;
            renderBy(KeyDown);
            emitKeyDown(event.key, event);
            onKeyDownRef.current?.(event.key, event);
        };
        currentTarget.addEventListener("keydown", func);
        return () => {
            currentTarget.removeEventListener("keydown", func);
        };
    }, [enabled, target]);

    return keyDownApi;
}

export const useKeyDown = useAddDownAnyKey;
export const useAnyKey = useAddDownAnyKey;

/** @deprecated Use `useKeyDown(options)` or `useAnyKey(options)`. */
export function addDownAnyKey() {
    return useAddDownAnyKey();
}

/** @deprecated Use `useKeyDown(options)` or `useAnyKey(options)`. */
export const useAddDownAnyKeyOld = useAddDownAnyKey;