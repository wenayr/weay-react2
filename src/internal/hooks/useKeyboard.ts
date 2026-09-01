import {useEffect, useRef} from "react";
import {createUpdateApi} from "../updateBy.js";
import {listen as createListen} from "wenay-common2/client";

export const keyboardState = {
    key: "" as string
}
const keyboardStateApi = createUpdateApi(keyboardState)

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

type KeyboardTarget = Document | HTMLElement;
type TargetListener = (key: string, event: KeyboardEvent) => void;
type TargetBinding = {
    listeners: Set<TargetListener>;
    handler: EventListener;
};

const targetBindings = new WeakMap<KeyboardTarget, TargetBinding>();
const emittedEvents = new WeakSet<KeyboardEvent>();

/** Many hook consumers on the same DOM target share one native listener and one
 * global keyboard event. Per-hook callbacks remain independent. */
function subscribeKeyboardTarget(target: KeyboardTarget, listener: TargetListener) {
    let binding = targetBindings.get(target);
    if (!binding) {
        const listeners = new Set<TargetListener>();
        const handler: EventListener = event => {
            if (!(event instanceof KeyboardEvent)) return;
            if (!emittedEvents.has(event)) {
                emittedEvents.add(event);
                keyboardState.key = event.key;
                keyboardStateApi.render();
                emitKeyDown(event.key, event);
            }
            for (const current of [...listeners]) current(event.key, event);
        };
        binding = {listeners, handler};
        targetBindings.set(target, binding);
        target.addEventListener("keydown", handler);
    }

    binding.listeners.add(listener);
    return () => {
        const current = targetBindings.get(target);
        if (!current) return;
        current.listeners.delete(listener);
        if (current.listeners.size) return;
        target.removeEventListener("keydown", current.handler);
        targetBindings.delete(target);
    };
}

export const keyboard: KeyboardApi = {
    get key() { return keyboardState.key; },
    getKey() { return keyboardState.key; },
    get() { return keyboardState.key; },
    clear() {
        keyboardState.key = "";
        keyboardStateApi.render();
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
        return subscribeKeyboardTarget(currentTarget, (key, event) => {
            onKeyDownRef.current?.(key, event);
        });
    }, [enabled, target]);

    return keyboard;
}
