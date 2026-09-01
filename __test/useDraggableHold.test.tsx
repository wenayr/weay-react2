import React from "react";
import {act, fireEvent, render} from "@testing-library/react";
import {useDraggableApi} from "../src/internal/hooks/useDraggable";

function renderHandle(holdMs: number, starts: string[], ends: string[]) {
    function Host() {
        const drag = useDraggableApi({
            holdMs,
            onDragStart: () => starts.push("start"),
            onDragEnd: () => ends.push("end"),
        });
        return <div data-testid="handle" {...drag.bind}/>;
    }
    return render(<Host/>).getByTestId("handle");
}

describe("useDraggableApi hold gate", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test("a click shorter than holdMs starts no drag and announces nothing", () => {
        const starts: string[] = [], ends: string[] = [];
        const handle = renderHandle(500, starts, ends);

        fireEvent.mouseDown(handle, {clientX: 10, clientY: 10});
        act(() => { jest.advanceTimersByTime(50); });
        fireEvent.mouseUp(document, {clientX: 10, clientY: 10});
        act(() => { jest.advanceTimersByTime(1000); });

        expect(starts).toEqual([]);
        expect(ends).toEqual([]);
    });

    test("holding past holdMs starts the drag, and the release ends it", () => {
        const starts: string[] = [], ends: string[] = [];
        const handle = renderHandle(500, starts, ends);

        fireEvent.mouseDown(handle, {clientX: 10, clientY: 10});
        act(() => { jest.advanceTimersByTime(500); });
        expect(starts).toEqual(["start"]);
        expect(ends).toEqual([]);

        act(() => { fireEvent.mouseMove(document, {clientX: 40, clientY: 30}); });
        act(() => { fireEvent.mouseUp(document, {clientX: 40, clientY: 30}); });

        expect(starts).toEqual(["start"]);
        expect(ends).toEqual(["end"]);
    });

    test("holdMs 0 keeps the immediate-start contract DragBox and useReorder rely on", () => {
        const starts: string[] = [], ends: string[] = [];
        const handle = renderHandle(0, starts, ends);

        act(() => { fireEvent.mouseDown(handle, {clientX: 10, clientY: 10}); });
        expect(starts).toEqual(["start"]);

        act(() => { fireEvent.mouseUp(document, {clientX: 10, clientY: 10}); });
        expect(ends).toEqual(["end"]);
    });

    test("a touch shorter than holdMs announces nothing either", () => {
        const starts: string[] = [], ends: string[] = [];
        const handle = renderHandle(500, starts, ends);

        fireEvent.touchStart(handle, {changedTouches: [{identifier: 1, clientX: 10, clientY: 10}]});
        act(() => { jest.advanceTimersByTime(50); });
        fireEvent.touchEnd(document, {changedTouches: [{identifier: 1, clientX: 10, clientY: 10}]});
        act(() => { jest.advanceTimersByTime(1000); });

        expect(starts).toEqual([]);
        expect(ends).toEqual([]);
    });
});
