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

/** Floor of the shrink range - the element never collapses below this. */
const MIN_WIDTH = 10;

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
            // An element wired up while hidden measures 0, and a defaultWidth of 0 disables
            // the shrink for this node for good: applyWidth then always takes the "already
            // wide enough" branch. The line above has just restored the natural width, so
            // this is the moment to capture it on the first observation that has a layout.
            if (!state.defaultWidth) state.defaultWidth = getWidth(el);
            // one read of the container box, reused below: it is the reference edge for every
            // probe and (see the probe right after) it does not move with the element
            const parentRect = parentParent.getBoundingClientRect();
            let rangeDelta = Math.floor(lastEl.getBoundingClientRect().right - parentRect.right);
            if (rangeDelta <= 0) return;

            const parentWidth = parentRect.width;
            const probeWidth = Math.max(MIN_WIDTH, Math.floor(state.defaultWidth * 0.8));
            if (state.defaultWidth - probeWidth >= 2) {
                el.style.width = probeWidth + "px";
                const probedParentWidth = parentParent.getBoundingClientRect().width;
                applyWidth(el, state, state.defaultWidth);
                if (Math.abs(parentWidth - probedParentWidth) > 0.5) return;
            }

            // Binary search instead of the old 8-step linear shrink: bounded at 4 probes (4
            // forced layouts instead of up to 8) and it cannot stall on a slowly converging
            // overflow. The container edge is invariant across probes (proved just above), so
            // only lastEl is re-measured; `parentRect` stays hoisted out of the loop.
            // The first probe is the linear estimate, which is exact whenever the overflow
            // moves 1:1 with the element width (the common case: lastEl IS the element) - the
            // halving steps are the fallback for everything else.
            let lo = MIN_WIDTH;                 // narrowest width we are ever willing to apply
            let hi = state.defaultWidth;        // known too wide (rangeDelta > 0 above)
            let best = -1;                      // widest probed width that fit
            let width = Math.max(lo, Math.min(hi, state.defaultWidth - rangeDelta));
            let linearProbe = true;
            for (let i = 0; i < 4; i++) {
                applyWidth(el, state, width);
                rangeDelta = Math.floor(lastEl.getBoundingClientRect().right - parentRect.right);
                if (rangeDelta <= 0) {
                    best = width;
                    // the linear estimate is EXACT whenever the overflow moves 1:1 with the
                    // element width (lastEl is the element itself, the common case) - once it
                    // fits there is nothing better to find, so do not pay for more layouts
                    if (linearProbe || width >= hi - 1) break;
                    lo = width;
                } else {
                    if (width <= MIN_WIDTH) break;  // nothing narrower left to try
                    hi = width;
                }
                linearProbe = false;
                const next = Math.floor((lo + hi) / 2);
                if (next <= lo || next >= hi) break;
                width = next;
            }
            // the last probe may have been a miss - settle on the widest width that fit
            if (best >= 0 && best != width) applyWidth(el, state, best);
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
