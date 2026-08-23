/** myChart measured its container ONCE, at creation, so a chart in a resizable panel kept its
 *  first bitmap forever - Sparkline and chartEngineReact both had a ResizeObserver, myChart had
 *  none. The subscription now comes from the shared canvasSurface helper.
 *
 *  This cannot be checked in the browser preview: a hidden tab delivers no ResizeObserver
 *  callbacks at all (verified with a raw observer - zero calls while the element really went
 *  300px -> 640px), exactly like requestAnimationFrame. So the contract is pinned here instead,
 *  against an injected observer. */

// jsdom ships no 2D context, and both myChart's render loop and sizeCanvasToBox ask for one.
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
        surface: require("../src/common/src/myChart/canvasSurface") as typeof import("../src/common/src/myChart/canvasSurface"),
        chart: require("../src/common/src/myChart/1/myChart") as typeof import("../src/common/src/myChart/1/myChart"),
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

describe("myChart follows its container", () => {
    function container(width: number, height: number) {
        const el = document.createElement("div");
        Object.defineProperty(el, "offsetWidth", {value: width, configurable: true, writable: true});
        Object.defineProperty(el, "offsetHeight", {value: height, configurable: true, writable: true});
        document.body.appendChild(el);
        return el;
    }

    test("an auto-sized chart resizes its canvas when the container changes", () => {
        const {chart} = load();
        const host = container(300, 200);
        const api = chart.createChartCanvas({container: host});
        const canvas = host.querySelector("canvas")!;
        expect(canvas.width).toBe(300);

        (host as any).offsetWidth = 640;
        (host as any).offsetHeight = 360;
        fire(host, 640, 360);

        expect(canvas.width).toBe(640);
        expect(canvas.height).toBe(360);
        api.destroy();
        host.remove();
    });

    test("an explicitly sized chart is left alone", () => {
        const {chart} = load();
        const host = container(300, 200);
        const api = chart.createChartCanvas({container: host, width: 500, height: 250});
        const canvas = host.querySelector("canvas")!;
        expect(canvas.width).toBe(500);

        (host as any).offsetWidth = 640;
        fire(host, 640, 360);

        expect(canvas.width).toBe(500);
        api.destroy();
        host.remove();
    });

    test("destroy disconnects the observer", () => {
        const {chart} = load();
        const host = container(300, 200);
        const api = chart.createChartCanvas({container: host});
        expect(instances.some(i => i.targets.includes(host) && !i.disconnected)).toBe(true);

        api.destroy();
        expect(instances.filter(i => i.targets.includes(host)).every(i => i.disconnected)).toBe(true);
        host.remove();
    });
});
