/** canvasSurface is the shared sizing/observing helper behind the canvas charts: a chart in a
 *  resizable panel used to keep its first bitmap forever, because its container was measured
 *  ONCE at creation. Sparkline and chartEngine both subscribe through this helper now.
 *
 *  This cannot be checked in the browser preview: a hidden tab delivers no ResizeObserver
 *  callbacks at all (verified with a raw observer - zero calls while the element really went
 *  300px -> 640px), exactly like requestAnimationFrame. So the contract is pinned here instead,
 *  against an injected observer. The component-level "canvas follows its container" case lives in
 *  Sparkline.test.tsx (the legacy myChart/1 canvas chart it used to cover was removed in 2.0). */

// jsdom ships no 2D context, and sizeCanvasToBox asks for one.
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const ctxStub = new Proxy({}, {get: () => () => undefined}) as unknown as CanvasRenderingContext2D;
beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = function (id: string) {
        return id == "2d" ? ctxStub : null;
    } as typeof HTMLCanvasElement.prototype.getContext;
});
afterAll(() => { HTMLCanvasElement.prototype.getContext = originalGetContext });

let instances: Array<{cb: ResizeObserverCallback; targets: Element[]; disconnected: boolean}> = [];

class CanvasResizeObserverMock {
    private entry: {cb: ResizeObserverCallback; targets: Element[]; disconnected: boolean};
    constructor(cb: ResizeObserverCallback) {
        this.entry = {cb, targets: [], disconnected: false};
        instances.push(this.entry);
    }
    observe(target: Element) { this.entry.targets.push(target) }
    unobserve() {}
    disconnect() { this.entry.disconnected = true }
}

function fire(target: Element, width: number, height: number) {
    for (const inst of instances) {
        if (inst.disconnected || !inst.targets.includes(target)) continue;
        inst.cb([{target, contentRect: {width, height}} as unknown as ResizeObserverEntry], {} as ResizeObserver);
    }
}

function load() {
    jest.resetModules();
    instances = [];
    (globalThis as any).ResizeObserver = CanvasResizeObserverMock;
    return {
        surface: require("../src/internal/myChart/canvasSurface") as typeof import("../src/internal/myChart/canvasSurface"),
    };
}

describe("canvasSurface.observeElementBox", () => {
    test("reports content-box changes and stops after the disposer", () => {
        const {surface} = load();
        const el = document.createElement("div");
        const seen: number[] = [];
        const off = surface.observeElementBox(el, size => seen.push(size.width));

        fire(el, 640, 360);
        expect(seen).toEqual([640]);

        off();
        fire(el, 800, 400);
        expect(seen).toEqual([640]);
    });

    test("no element and no ResizeObserver are both a silent no-op", () => {
        const {surface} = load();
        expect(() => surface.observeElementBox(null, () => {})()).not.toThrow();

        delete (globalThis as any).ResizeObserver;
        expect(() => surface.observeElementBox(document.createElement("div"), () => {})()).not.toThrow();
    });
});

describe("canvasSurface.sizeCanvasToBox", () => {
    test("reports whether the bitmap actually changed", () => {
        const {surface} = load();
        const canvas = document.createElement("canvas");
        expect(surface.sizeCanvasToBox(canvas, 300, 200)).toBe(true);
        expect(canvas.width).toBe(300);
        expect(canvas.height).toBe(200);
        // same box again: assigning width/height would clear the canvas for nothing
        expect(surface.sizeCanvasToBox(canvas, 300, 200)).toBe(false);
    });

    test("a device pixel ratio scales the bitmap up", () => {
        const {surface} = load();
        const canvas = document.createElement("canvas");
        surface.sizeCanvasToBox(canvas, 300, 200, 2);
        expect(canvas.width).toBe(600);
        expect(canvas.height).toBe(400);
    });
});
