import React from "react";
import {act, render} from "@testing-library/react";
import {
    floatingWindowMap,
    type FloatingWindowController,
    type FloatingWindowControllerOptions,
    useFloatingWindowController,
} from "../src/common/src/components/Dnd/FloatingWindow";

function HookProbe(props: FloatingWindowControllerOptions & { onReady: (api: FloatingWindowController) => void }) {
    const api = useFloatingWindowController(props);
    props.onReady(api);
    return null;
}

function resizeElement(width: number, height: number) {
    const element = document.createElement("div");
    Object.defineProperty(element, "offsetWidth", {configurable: true, value: width});
    Object.defineProperty(element, "offsetHeight", {configurable: true, value: height});
    return element;
}

test("useFloatingWindowController restores saved geometry and commits resize stop", () => {
    floatingWindowMap.clear();
    floatingWindowMap.set("window", {
        position: {x: 5, y: 6},
        size: {width: 100, height: 80},
    });
    const onChange = jest.fn();
    const unsubscribe = floatingWindowMap.onChange(onChange);
    let controller: FloatingWindowController | null = null;

    render(<HookProbe keyForSave="window" onReady={(api) => { controller = api; }} />);

    expect(controller).not.toBeNull();
    expect(controller!.position).toEqual({x: 5, y: 6});
    expect(controller!.size).toEqual({width: 100, height: 80});
    expect(controller!.update).toBe(0);

    const element = resizeElement(140, 120);
    const dir = "bottomRight" as Parameters<FloatingWindowController["onResizeStop"]>[1];
    act(() => {
        controller!.onResizeStop(new MouseEvent("mouseup"), dir, element, {width: 40, height: 40}, {x: 15, y: 16});
    });

    expect(controller!.position).toEqual({x: 15, y: 16});
    expect(controller!.size).toEqual({width: 140, height: 120});
    expect(controller!.update).toBe(1);
    expect(floatingWindowMap.get("window")).toEqual({
        position: {x: 15, y: 16},
        size: {width: 140, height: 120},
    });
    expect(onChange).toHaveBeenCalledWith("window");
    unsubscribe();
});

test("useFloatingWindowController clamps header drag and announces saved movement", () => {
    floatingWindowMap.clear();
    floatingWindowMap.set("drag", {
        position: {x: 0, y: 0},
        size: {width: 100, height: 80},
    });
    const onChange = jest.fn();
    const unsubscribe = floatingWindowMap.onChange(onChange);
    let controller: FloatingWindowController | null = null;

    render(<HookProbe
        keyForSave="drag"
        limit={{x: {min: 0, max: 50}, y: {min: -10, max: 40}}}
        onReady={(api) => { controller = api; }}
    />);

    act(() => {
        controller!.onHeaderMouseDown({clientX: 10, clientY: 20} as React.MouseEvent<HTMLDivElement>);
    });
    expect(controller!.dragging).toBe(true);

    act(() => {
        document.dispatchEvent(new MouseEvent("mousemove", {clientX: 100, clientY: 100, buttons: 1}));
    });
    expect(controller!.position).toEqual({x: 50, y: 40});

    act(() => {
        document.dispatchEvent(new MouseEvent("mouseup"));
    });
    expect(controller!.dragging).toBe(false);
    expect(floatingWindowMap.get("drag")?.position).toEqual({x: 50, y: 40});
    expect(onChange).toHaveBeenCalledWith("drag");
    unsubscribe();
});

test("useFloatingWindowController forwards live resize updates", () => {
    floatingWindowMap.clear();
    const onUpdate = jest.fn();
    let controller: FloatingWindowController | null = null;

    render(<HookProbe onUpdate={onUpdate} onReady={(api) => { controller = api; }} />);

    const element = resizeElement(90, 70);
    const dir = "right" as Parameters<FloatingWindowController["onResize"]>[1];
    const event = new MouseEvent("mousemove");
    const delta = {width: 10, height: 0};
    const position = {x: 3, y: 4};

    act(() => {
        controller!.onResize(event, dir, element, delta, position);
    });

    expect(onUpdate).toHaveBeenCalledWith({e: event, dir, elementRef: element, delta, position});
});