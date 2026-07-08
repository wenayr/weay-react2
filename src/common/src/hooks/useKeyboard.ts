import {useEffect, useRef} from "react";
import {renderBy} from "../../updateBy";
import {listen as createListen} from "wenay-common2";

export const keyboardState = {
    key: "" as string
}

export type KeyboardApi = {
    readonly key: string;
    getKey(): string;
    get(): string;
    clear(): void;
    reset(): void;
    subscribe(listener: (key: string, event?: KeyboardEvent) => void): () => void;
    on(listener: (key: string, event?: KeyboardEvent) => void): () => void;
}

const [emitKeyDown, keyboardListen] = createListen<[string, KeyboardEvent | undefined]>();

export const keyboard: KeyboardApi = {
    get key() { return keyboardState.key; },
    getKey() { return keyboardState.key; },
    get() { return keyboardState.key; },
    clear() {
        keyboardState.key = "";
        renderBy(keyboardState);
        emitKeyDown("", undefined);
    },
    reset() {
        keyboard.clear();
    },
    subscribe(listener) {
        return keyboardListen.on(listener);
    },
    on(listener) {
        return keyboardListen.on(listener);
    }
}

export function useKeyboard(options: {
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
            keyboardState.key = event.key;
            renderBy(keyboardState);
            emitKeyDown(event.key, event);
            onKeyDownRef.current?.(event.key, event);
        };
        currentTarget.addEventListener("keydown", func);
        return () => {
            currentTarget.removeEventListener("keydown", func);
        };
    }, [enabled, target]);

    return keyboard;
}