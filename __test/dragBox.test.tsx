import React from "react";
import {fireEvent, render} from "@testing-library/react";
import {DragBox} from "../src/common/src/components/Dnd/FloatingWindow";

// DragBox is now a thin adapter over useDraggableApi (A7). This suite pins the
// observable contract of the old bespoke loop: immediate start, per-tick imperative
// onX/onY with the delta from the press point, no re-render per move tick, onStop
// only after a real gesture (never on mount), `last` ref sharing the live position.

function setup(extra: Partial<React.ComponentProps<typeof DragBox>> = {}) {
    const onX = jest.fn(), onY = jest.fn(), onStart = jest.fn(), onStop = jest.fn();
    let renders = 0;
    const Probe = () => { renders++; return <span data-testid="probe" />; };
    const utils = render(
        <DragBox onX={onX} onY={onY} onStart={onStart} onStop={onStop} {...extra}>
            <Probe />
        </DragBox>
    );
    const box = utils.getByTestId("probe").parentElement as HTMLElement;
    return {onX, onY, onStart, onStop, box, renderCount: () => renders, ...utils};
}

describe("DragBox adapter over useDraggableApi", () => {
    test("mouse drag reports per-tick delta from press point, onStop after release", () => {
        const t = setup();
        expect(t.onStop).not.toHaveBeenCalled(); // the old mount-time onStop bug stays fixed

        fireEvent.mouseDown(t.box, {clientX: 100, clientY: 50});
        expect(t.onStart).toHaveBeenCalledTimes(1);

        fireEvent.mouseMove(document, {clientX: 110, clientY: 45});
        expect(t.onX).toHaveBeenLastCalledWith(10);
        expect(t.onY).toHaveBeenLastCalledWith(-5);

        fireEvent.mouseMove(document, {clientX: 130, clientY: 80});
        expect(t.onX).toHaveBeenLastCalledWith(30);
        expect(t.onY).toHaveBeenLastCalledWith(30);

        fireEvent.mouseUp(document);
        expect(t.onStop).toHaveBeenCalledTimes(1);
    });

    test("move ticks do not re-render; each gesture re-measures from its own press point", () => {
        const t = setup();
        fireEvent.mouseDown(t.box, {clientX: 0, clientY: 0});
        const after = t.renderCount();
        for (let i = 1; i <= 5; i++) fireEvent.mouseMove(document, {clientX: i, clientY: 0});
        expect(t.renderCount()).toBe(after); // imperative path only
        fireEvent.mouseUp(document);

        // second gesture: delta resets to the new press point (no accumulation)
        fireEvent.mouseDown(t.box, {clientX: 200, clientY: 200});
        fireEvent.mouseMove(document, {clientX: 203, clientY: 199});
        expect(t.onX).toHaveBeenLastCalledWith(3);
        expect(t.onY).toHaveBeenLastCalledWith(-1);
        fireEvent.mouseUp(document);
        expect(t.onStop).toHaveBeenCalledTimes(2);
    });

    test("last ref shares the live position object and keeps the final delta after release", () => {
        const last = React.createRef<{x: number; y: number}>() as React.RefObject<{x: number; y: number}>;
        const t = setup({last});
        fireEvent.mouseDown(t.box, {clientX: 10, clientY: 10});
        fireEvent.mouseMove(document, {clientX: 25, clientY: 40});
        expect(last.current).toEqual({x: 15, y: 30}); // live during the drag
        fireEvent.mouseUp(document);
        expect(last.current).toEqual({x: 15, y: 30}); // retained after release
    });

    test("touch drag tracks its own identifier", () => {
        const t = setup();
        fireEvent.touchStart(t.box, {changedTouches: [{identifier: 7, clientX: 50, clientY: 50}]});
        expect(t.onStart).toHaveBeenCalledTimes(1);
        // a different finger must be ignored
        fireEvent.touchMove(document, {changedTouches: [{identifier: 9, clientX: 500, clientY: 500}]});
        expect(t.onX).not.toHaveBeenCalled();
        fireEvent.touchMove(document, {changedTouches: [{identifier: 7, clientX: 58, clientY: 46}]});
        expect(t.onX).toHaveBeenLastCalledWith(8);
        expect(t.onY).toHaveBeenLastCalledWith(-4);
        fireEvent.touchEnd(document, {changedTouches: [{identifier: 7, clientX: 58, clientY: 46}]});
        expect(t.onStop).toHaveBeenCalledTimes(1);
    });

    test("right prop anchors the wrapper to the right edge", () => {
        const t = setup({right: true});
        expect(t.box.style.right).toBe("0px");
        expect(t.box.style.left).toBe("");
    });
});
