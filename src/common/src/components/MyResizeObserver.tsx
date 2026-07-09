import { useCallback, useRef, useState } from "react";

export type ObserveID = { readonly [Symbol.species]: ObserveID };

// Class for tracking element size changes

export class CResizeObserver {
    #idMap = new WeakMap<ObserveID, { element: Element, func: () => void }>();
    #funcMap = new WeakMap<Element, (() => void)[]>();
    #observer = typeof ResizeObserver !== "undefined"
        ? new ResizeObserver((entries) => {
            for (let entry of entries) {
                let functions = this.#funcMap.get(entry.target as Element);
                if (functions)
                    for (let func of functions) func();
            }
        })
        : null;

    add(element: Element, onResize: () => void): ObserveID {
        let functions = this.#funcMap.get(element);
        if (!functions) {
            this.#funcMap.set(element, functions = []);
            this.#observer?.observe(element);
        }
        functions.push(onResize);
        const id = {} as ObserveID; // unique WeakMap key; the branded type only exists at compile time
        this.#idMap.set(id, {element, func: onResize});
        return id;
    }

    delete(id: ObserveID) {
        let data = this.#idMap.get(id);
        if (!data) return;
        this.#idMap.delete(id);
        let el = data.element;
        let functions = this.#funcMap.get(el)!;
        let i = functions.indexOf(data.func);
        if (i >= 0) functions.splice(i, 1);
        if (functions.length == 0) {
            this.#funcMap.delete(el);
            this.#observer?.unobserve(el);
        }
    }
}

const global_resizeObserver = new CResizeObserver();

/** Subscribe an element to the shared resize observer via the returned callback ref.
 *  `onResize` goes through a ref - a new function identity neither resubscribes nor is missed.
 *  The native observer fires once right after observe, so the first measurement is not skipped.
 *  `setResizeableElement` / `removeResizeableElement` below stay untouched - this is the
 *  hook-shaped entry over the same singleton. */
export function useResizeObserver<T extends Element = HTMLElement>(onResize: () => void) {
    const cbRef = useRef(onResize);
    cbRef.current = onResize;
    const elRef = useRef<T | null>(null);
    const idRef = useRef<ObserveID | null>(null);
    const ref = useCallback((el: T | null) => {
        if (idRef.current) {
            global_resizeObserver.delete(idRef.current);
            idRef.current = null;
        }
        elRef.current = el;
        if (el) idRef.current = global_resizeObserver.add(el, function emitResize() { cbRef.current(); });
    }, []);
    return {
        /** Callback ref - attach to the element to observe. */
        ref,
        /** The currently observed element (null while detached). */
        element: () => elRef.current,
    };
}

/** "I want the size -> I get the value/method": observed element's width/height as state
 *  (rounded, equality-guarded - a no-op resize does not re-render) plus a live `getSize()`
 *  getter for measurements that must not wait for a render. */
export function useElementSize<T extends Element = HTMLElement>() {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const obs = useResizeObserver<T>(function readSize() {
        const el = obs.element();
        if (!el) return;
        const r = el.getBoundingClientRect();
        const next = { width: Math.round(r.width), height: Math.round(r.height) };
        setSize(prev => prev.width == next.width && prev.height == next.height ? prev : next);
    });
    const getSize = () => {
        const el = obs.element();
        if (!el) return { width: 0, height: 0 };
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
    };
    return { ref: obs.ref, element: obs.element, width: size.width, height: size.height, getSize };
}

type ResizeableElementState = { observerId: ObserveID, defaultWidth: number, styleWidth: string, resizing: boolean };
const resizeableElementMap = new WeakMap<HTMLElement, ResizeableElementState>();

function getWidth(el: HTMLElement) {
    return Math.ceil(el.clientWidth || el.getBoundingClientRect().width);
}

function applyWidth(el: HTMLElement, state: ResizeableElementState, width: number) {
    el.style.width = width >= state.defaultWidth ? state.styleWidth : width + "px";
}

// Set automatic element resizing based on the parent element size
//
export function setResizeableElement(el: HTMLElement) {
    const parent = el.parentElement;
    if (!parent) return;
    const parentParent = parent.parentElement; // one level higher
    if (!parentParent) return;
    const lastEl = parent.lastElementChild as HTMLElement | null;
    if (!lastEl) return;

    const existing = resizeableElementMap.get(el);
    if (existing) {
        global_resizeObserver.delete(existing.observerId);
        el.style.width = existing.styleWidth;
    }

    const state: ResizeableElementState = {
        observerId: {} as ObserveID,
        defaultWidth: existing?.defaultWidth ?? getWidth(el),
        styleWidth: existing?.styleWidth ?? el.style.width,
        resizing: false,
    };

    const resize = () => {
        if (state.resizing) return;
        state.resizing = true;
        try {
            applyWidth(el, state, state.defaultWidth);
            let rangeDelta = Math.floor(lastEl.getBoundingClientRect().right - parentParent.getBoundingClientRect().right);
            if (rangeDelta <= 0) return;

            const parentWidth = parentParent.getBoundingClientRect().width;
            const probeWidth = Math.max(10, Math.floor(state.defaultWidth * 0.8));
            if (state.defaultWidth - probeWidth >= 2) {
                el.style.width = probeWidth + "px";
                const probedParentWidth = parentParent.getBoundingClientRect().width;
                applyWidth(el, state, state.defaultWidth);
                if (Math.abs(parentWidth - probedParentWidth) > 0.5) return;
            }

            for (let width = state.defaultWidth, i = 0; i < 8; i++) {
                width = Math.max(10, Math.min(state.defaultWidth, width - rangeDelta));
                applyWidth(el, state, width);
                if (width == 10 || width == state.defaultWidth) break;
                rangeDelta = Math.floor(lastEl.getBoundingClientRect().right - parentParent.getBoundingClientRect().right);
                if (rangeDelta <= 0) break;
            }
        } finally {
            state.resizing = false;
        }
    };

    state.observerId = global_resizeObserver.add(parentParent, resize);
    resizeableElementMap.set(el, state);
    resize();
    return el;
}

export function removeResizeableElement(el: HTMLElement) {
    const state = resizeableElementMap.get(el);
    if (!state) return;
    global_resizeObserver.delete(state.observerId);
    el.style.width = state.styleWidth;
    resizeableElementMap.delete(el);
}
