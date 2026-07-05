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
