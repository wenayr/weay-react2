type ResizeModule = typeof import("../src/common/src/components/MyResizeObserver");

let fireResize: ((target: Element) => void) | undefined;

class ResizeObserverMock {
    constructor(callback: ResizeObserverCallback) {
        fireResize = (target: Element) => callback([{target} as ResizeObserverEntry], this as unknown as ResizeObserver);
    }

    observe() {}
    unobserve() {}
    disconnect() {}
}

function loadModule(): ResizeModule {
    jest.resetModules();
    fireResize = undefined;
    (globalThis as any).ResizeObserver = ResizeObserverMock;
    return require("../src/common/src/components/MyResizeObserver") as ResizeModule;
}

function domRect(width: number): DOMRect {
    return {
        x: 0,
        y: 0,
        width,
        height: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: 0,
        toJSON() { return {}; },
    } as DOMRect;
}

function createResizeTree(parentWidth: number | (() => number)) {
    const outer = document.createElement("div");
    const parent = document.createElement("div");
    const el = document.createElement("select");
    const naturalWidth = 180;

    el.style.width = naturalWidth + "px";
    parent.append(el);
    outer.append(parent);
    document.body.append(outer);

    const elementWidth = () => Number.parseFloat(el.style.width) || naturalWidth;
    Object.defineProperty(el, "clientWidth", {
        configurable: true,
        get: () => elementWidth(),
    });
    el.getBoundingClientRect = () => domRect(elementWidth());
    outer.getBoundingClientRect = () => {
        const width = typeof parentWidth == "function" ? parentWidth() : parentWidth;
        return domRect(width);
    };

    return {outer, el, elementWidth};
}

afterEach(() => {
    document.body.innerHTML = "";
    delete (globalThis as any).ResizeObserver;
});

test("setResizeableElement shrinks in a fixed-width parent and restores the source width on remove", () => {
    const {setResizeableElement, removeResizeableElement} = loadModule();
    const {outer, el} = createResizeTree(150);

    setResizeableElement(el);
    fireResize?.(outer);
    fireResize?.(outer);
    expect(el.style.width).toBe("150px");

    removeResizeableElement(el);
    expect(el.style.width).toBe("180px");
});

test("setResizeableElement keeps the natural width across re-registration while the parent later expands", () => {
    const {setResizeableElement} = loadModule();
    let parentWidth = 150;
    const {outer, el} = createResizeTree(() => parentWidth);

    setResizeableElement(el);
    fireResize?.(outer);
    expect(el.style.width).toBe("150px");

    setResizeableElement(el);
    fireResize?.(outer);
    expect(el.style.width).toBe("150px");

    parentWidth = 220;
    fireResize?.(outer);
    expect(el.style.width).toBe("180px");
});

test("setResizeableElement does not mutate width when the parent width depends on the element", () => {
    const {setResizeableElement} = loadModule();
    const tree = createResizeTree(() => tree.elementWidth() - 30);

    setResizeableElement(tree.el);
    fireResize?.(tree.outer);
    fireResize?.(tree.outer);

    expect(tree.el.style.width).toBe("180px");
});