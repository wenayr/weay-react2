import React from "react";
import {act, render} from "@testing-library/react";
import {Sparkline} from "../src/common/src/myChart/Sparkline";

function rect(width: number, height: number): DOMRectReadOnly {
    return {
        x: 0,
        y: 0,
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        toJSON: () => ({}),
    } as DOMRectReadOnly;
}

class ResizeObserverMock {
    static instances: ResizeObserverMock[] = [];
    readonly observe = jest.fn((target: Element) => this.targets.add(target));
    readonly unobserve = jest.fn((target: Element) => this.targets.delete(target));
    readonly disconnect = jest.fn(() => this.targets.clear());
    readonly targets = new Set<Element>();

    constructor(private readonly callback: ResizeObserverCallback) {
        ResizeObserverMock.instances.push(this);
    }

    resize(width: number, height: number) {
        const entries = [...this.targets].map(target => ({
            target,
            contentRect: rect(width, height),
        }) as ResizeObserverEntry);
        this.callback(entries, this as unknown as ResizeObserver);
    }
}

function canvasContext() {
    const gradient = {addColorStop: jest.fn()};
    return {
        setTransform: jest.fn(),
        clearRect: jest.fn(),
        fillRect: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        closePath: jest.fn(),
        stroke: jest.fn(),
        fill: jest.fn(),
        arc: jest.fn(),
        createLinearGradient: jest.fn(() => gradient),
        lineCap: "butt",
        lineJoin: "miter",
        lineWidth: 1,
        fillStyle: "#000",
        strokeStyle: "#000",
    } as unknown as CanvasRenderingContext2D;
}

let context: CanvasRenderingContext2D;
let getContextSpy: jest.SpyInstance;
let originalDpr: PropertyDescriptor | undefined;

beforeEach(() => {
    ResizeObserverMock.instances = [];
    (globalThis as any).ResizeObserver = ResizeObserverMock;
    originalDpr = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
    Object.defineProperty(window, "devicePixelRatio", {configurable: true, value: 1});
    context = canvasContext();
    getContextSpy = jest.spyOn(HTMLCanvasElement.prototype, "getContext")
        .mockImplementation(() => context);
});

afterEach(() => {
    getContextSpy.mockRestore();
    delete (globalThis as any).ResizeObserver;
    if (originalDpr) Object.defineProperty(window, "devicePixelRatio", originalDpr);
    else delete (window as any).devicePixelRatio;
    document.body.innerHTML = "";
});

test("canvas does not exceed a 150x23 container", () => {
    const view = render(
        <div style={{width: 150, height: 23}}>
            <Sparkline series={{key: "price", data: [2, 4, 3]}} />
        </div>,
    );

    act(() => ResizeObserverMock.instances[0].resize(150, 23));
    const canvas = view.container.querySelector("canvas")!;
    const sparkline = canvas.parentElement!;

    expect(sparkline.style.width).toBe("100%");
    expect(sparkline.style.height).toBe("100%");
    expect(sparkline.style.overflow).toBe("hidden");
    expect(canvas.style.position).toBe("absolute");
    expect(canvas.style.width).toBe("150px");
    expect(canvas.style.height).toBe("23px");
    expect(canvas.style.maxWidth).toBe("100%");
    expect(canvas.style.maxHeight).toBe("100%");
});

test("resize updates physical and CSS canvas dimensions with devicePixelRatio", () => {
    Object.defineProperty(window, "devicePixelRatio", {configurable: true, value: 2});
    const view = render(<Sparkline series={{key: "price", data: [1, 2]}} />);
    const observer = ResizeObserverMock.instances[0];
    const canvas = view.container.querySelector("canvas")!;

    act(() => observer.resize(80, 20));
    expect({width: canvas.width, height: canvas.height}).toEqual({width: 160, height: 40});
    expect({width: canvas.style.width, height: canvas.style.height}).toEqual({width: "80px", height: "20px"});

    act(() => observer.resize(150, 23));
    expect({width: canvas.width, height: canvas.height}).toEqual({width: 300, height: 46});
    expect({width: canvas.style.width, height: canvas.style.height}).toEqual({width: "150px", height: "23px"});
});

test("30 mounted sparklines do not start persistent RAF loops", () => {
    const raf = jest.fn(() => 1);
    const previous = window.requestAnimationFrame;
    window.requestAnimationFrame = raf;
    try {
        render(<>{Array.from({length: 30}, (_, index) => (
            <Sparkline key={index} series={{key: index, data: [index, index + 1]}} />
        ))}</>);
        act(() => ResizeObserverMock.instances.forEach(observer => observer.resize(120, 23)));
        expect(raf).not.toHaveBeenCalled();
    } finally {
        window.requestAnimationFrame = previous;
    }
});

test("unmount disconnects the observer and registers no canvas listeners", () => {
    const canvasListenerSpy = jest.spyOn(HTMLCanvasElement.prototype, "addEventListener");
    const view = render(<Sparkline series={{key: "price", data: [1, 2, 3]}} />);
    const observer = ResizeObserverMock.instances[0];

    expect(observer.observe).toHaveBeenCalledTimes(1);
    expect(canvasListenerSpy).not.toHaveBeenCalled();
    view.unmount();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    canvasListenerSpy.mockRestore();
});

test("zero, constant, empty and one-point series draw without non-finite coordinates", () => {
    const view = render(<Sparkline series={{key: "zero", data: [0, 0, 0]}} />);
    act(() => ResizeObserverMock.instances[0].resize(150, 23));

    const assertFiniteCoordinates = () => {
        const calls = [
            ...(context.moveTo as jest.Mock).mock.calls,
            ...(context.lineTo as jest.Mock).mock.calls,
            ...(context.arc as jest.Mock).mock.calls,
        ];
        expect(calls.length).toBeGreaterThan(0);
        for (const call of calls) {
            for (const value of call) expect(Number.isFinite(value)).toBe(true);
        }
    };
    assertFiniteCoordinates();

    (context.moveTo as jest.Mock).mockClear();
    (context.lineTo as jest.Mock).mockClear();
    (context.arc as jest.Mock).mockClear();
    view.rerender(<Sparkline series={{key: "constant", data: [42, 42, 42]}} />);
    assertFiniteCoordinates();

    view.rerender(<Sparkline series={{key: "empty", data: []}} />);
    view.rerender(<Sparkline series={{key: "one", data: [0]}} />);
    expect(context.arc).toHaveBeenCalled();
    assertFiniteCoordinates();
});

test("redraws for mutated data and theme values, but not equal render props", () => {
    const data = [1, 2];
    const series = {key: "price", data};
    const view = render(<Sparkline series={series} theme={{lineColor: "blue"}} />);
    act(() => ResizeObserverMock.instances[0].resize(120, 23));
    const strokesAfterMount = (context.stroke as jest.Mock).mock.calls.length;

    view.rerender(<Sparkline series={{key: "replacement", data: [1, 2]}} theme={{lineColor: "blue"}} />);
    expect(context.stroke).toHaveBeenCalledTimes(strokesAfterMount);

    data.push(3);
    view.rerender(<Sparkline series={series} theme={{lineColor: "blue"}} />);
    expect(context.stroke).toHaveBeenCalledTimes(strokesAfterMount + 1);

    view.rerender(<Sparkline series={series} theme={{lineColor: "red"}} />);
    expect(context.stroke).toHaveBeenCalledTimes(strokesAfterMount + 2);
});
