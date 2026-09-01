import React, {useEffect, useMemo, useRef, useState} from "react";


export type UseOutsideOptions<T extends HTMLElement = HTMLDivElement> = {
    ref?: React.RefObject<T | null>;
    outsideClick?: () => void;
    onOutside?: () => void;
    status?: boolean;
    enabled?: boolean;
    /** Treat a logically nested React portal event as an inside interaction. */
    isInsideEvent?: (event: MouseEvent | TouchEvent) => boolean;
}

export type UseOutsideApi<T extends HTMLElement = HTMLDivElement> = {
    current: T | null;
    ref: React.RefObject<T | null>;
    props: { ref: React.Ref<T> };
    bind: { ref: React.Ref<T> };
    contains(target: EventTarget | null): boolean;
    enable(): void;
    disable(): void;
    readonly enabled: boolean;
}

export function useOutsideApi<T extends HTMLElement = HTMLDivElement>(options: UseOutsideOptions<T>): UseOutsideApi<T> {
    const {outsideClick, onOutside, ref, status = options.enabled ?? true, isInsideEvent} = options;
    const internalRef = useRef<T|null>(null);
    const r = ref ?? internalRef;
    const outsideClickRef = useRef(outsideClick ?? onOutside);
    const isInsideEventRef = useRef(isInsideEvent);
    const [enabled, setEnabled] = useState(status);
    const enabledRef = useRef(enabled);

    outsideClickRef.current = outsideClick ?? onOutside;
    isInsideEventRef.current = isInsideEvent;
    enabledRef.current = enabled;

    // The `status` prop wins: any change to it overwrites an imperative enable()/disable().
    // Use one or the other for a given instance - api.disable() on a status-driven hook is
    // undone by the next render in which status changes.
    useEffect(() => {
        setEnabled(status);
    }, [status]);

    useEffect(() => subscribeOutsidePress(event => {
        if (!enabledRef.current) return;
        if (
            r.current &&
            event.target instanceof Node &&
            !r.current.contains(event.target) &&
            !isInsideEventRef.current?.(event)
        ) outsideClickRef.current?.();
    }), [r]);

    const props = useMemo(() => ({ref: r as React.Ref<T>}), [r]);
    return useMemo(() => {
        const api = {
            ref: r,
            props,
            bind: props,
            contains(target: EventTarget | null) {
                return !!(r.current && target instanceof Node && r.current.contains(target));
            },
            enable() { setEnabled(true); },
            disable() { setEnabled(false); },
            get enabled() { return enabledRef.current; },
        } as UseOutsideApi<T>;
        Object.defineProperty(api, "current", {
            configurable: true,
            get: () => r.current,
            set: (node: T | null) => { r.current = node; },
        });
        return api;
    }, [props, r]);
}

/** Every open overlay, popover and outClick Button used to add its own mousedown+touchstart
 *  pair to `document` - two listeners per instance, live even while disabled. useKeyboard
 *  already solved this with one native listener plus a Set of subscribers; this is the same
 *  pattern. Callbacks stay fully independent; the copy on dispatch keeps an unsubscribe from
 *  inside a callback from skipping the rest. */
type OutsidePressListener = (event: MouseEvent | TouchEvent) => void;
const outsidePressListeners = new Set<OutsidePressListener>();
let outsidePressHandler: ((event: Event) => void) | null = null;

function subscribeOutsidePress(listener: OutsidePressListener) {
    if (!outsidePressHandler) {
        outsidePressHandler = event => {
            for (const current of [...outsidePressListeners]) current(event as MouseEvent | TouchEvent);
        };
        document.addEventListener("mousedown", outsidePressHandler);
        document.addEventListener("touchstart", outsidePressHandler);
    }
    outsidePressListeners.add(listener);
    return () => {
        outsidePressListeners.delete(listener);
        if (outsidePressListeners.size || !outsidePressHandler) return;
        document.removeEventListener("mousedown", outsidePressHandler);
        document.removeEventListener("touchstart", outsidePressHandler);
        outsidePressHandler = null;
    };
}

export function useOutside<T extends HTMLElement = HTMLDivElement>(options: UseOutsideOptions<T>) {
    return useOutsideApi(options);
}

export function useOutsideRef<T extends HTMLElement = HTMLDivElement>(options: UseOutsideOptions<T>) {
    return useOutsideApi(options).ref;
}

