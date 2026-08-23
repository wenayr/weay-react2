import React from "react";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {createContextMenu} from "../src/common/src/menu/menuMouse";
import {Menu} from "../src/common/src/menu/menu";
import {FloatingWindow} from "../src/common/src/components/Dnd/FloatingWindow";

/** jsdom measures every element as a zero rect, so the placement logic has nothing to react to.
 *  The menu root reports a box of the given size at whatever left it has applied (its offset
 *  parent sits at the viewport origin, and `left` carries the component's own -3 padding
 *  compensation, so the browser would measure exactly this). Everything else stays at 0,0,
 *  which makes the Layer's relative-point maths the identity. */
function stubMenuRect(size: {width: number; height?: number}) {
    const {width, height = 120} = size;
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
        const el = this as HTMLElement;
        if (!el.style || el.style.position != "absolute" || el.style.paddingLeft != "3px") {
            return {x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({})} as DOMRect;
        }
        const left = parseFloat(el.style.left || "0") + 3;
        const top = parseFloat(el.style.top || "0");
        return {x: left, y: top, left, top, right: left + width, bottom: top + height, width, height, toJSON: () => ({})} as DOMRect;
    };
    return () => { Element.prototype.getBoundingClientRect = original; };
}

function menuRoot() {
    return document.querySelector<HTMLElement>("div[style*='padding-left: 3px']")!;
}

describe("context menu placement", () => {
    test("a root menu at the right edge is pulled back into the viewport", () => {
        // Menu opened 60px from the right edge but 200px wide: 140px would hang outside.
        const restore = stubMenuRect({width: 200});
        try {
            render(<Menu data={[{name: "Item"}]} coordinate={{x: window.innerWidth - 60, y: 40}}/>);
            const applied = parseFloat(menuRoot().style.left);
            // -3 is the component's constant padding compensation, untouched by the clamp.
            expect(applied).toBe(window.innerWidth - 60 - 140 - 3);
            expect(applied + 3 + 200).toBeLessThanOrEqual(window.innerWidth);
        } finally {
            restore();
        }
    });

    test("a menu with room to spare is not moved", () => {
        const restore = stubMenuRect({width: 200});
        try {
            render(<Menu data={[{name: "Item"}]} coordinate={{x: 100, y: 40}}/>);
            expect(parseFloat(menuRoot().style.left)).toBe(100 - 3);
        } finally {
            restore();
        }
    });

    test("a menu wider than the viewport stops at the left edge instead of overshooting", () => {
        const restore = stubMenuRect({width: window.innerWidth + 200});
        try {
            render(<Menu data={[{name: "Item"}]} coordinate={{x: 40, y: 40}}/>);
            // Clamped by -baseLeft: the shift never drags the left edge off screen.
            expect(parseFloat(menuRoot().style.left)).toBe(40 - 40 - 3);
        } finally {
            restore();
        }
    });

    test("the clamp is idempotent across coordinate changes", () => {
        const restore = stubMenuRect({width: 200});
        try {
            const view = render(<Menu data={[{name: "Item"}]} coordinate={{x: window.innerWidth - 60, y: 40}}/>);
            const first = menuRoot().style.left;
            view.rerender(<Menu data={[{name: "Item"}]} coordinate={{x: window.innerWidth - 60, y: 60}}/>);
            expect(menuRoot().style.left).toBe(first);
        } finally {
            restore();
        }
    });
});

describe("context menu inside a floating window", () => {
    test("openAt from a window renders the menu in the window's own portal layer", () => {
        const menu = createContextMenu({name: "window-open"});
        render(
            <menu.Layer>
                <div>
                    <div data-testid="page">page</div>
                    <FloatingWindow title="Host" size={{width: 300, height: 200}}>
                        <div data-testid="window-content">rows</div>
                    </FloatingWindow>
                </div>
            </menu.Layer>
        );

        const inWindow = screen.getByTestId("window-content");
        const portalRoot = inWindow.closest("[data-wenay-window-portal-root]");
        expect(portalRoot).not.toBeNull();
        // The layer div is not a DOM ancestor of the window - that is the whole problem.
        expect(inWindow.closest("[data-wenay-menu-layer-id]")).toBeNull();

        act(() => {
            menu.openAt({clientX: 120, clientY: 140, target: inWindow}, [{name: "Row action"}], {source: "grid"});
        });

        const hosted = portalRoot!.querySelector("[data-wenay-menu-window-layer]");
        expect(hosted).not.toBeNull();
        expect(hosted!.textContent).toContain("Row action");
        // Positioned in client coordinates: the portal root is fixed at inset 0.
        expect(hosted!.querySelector<HTMLElement>("div[style*='padding-left: 3px']")!.style.top).toBe("140px");
        expect(menu.getState().windowPortal).toBe(portalRoot);
    });

    test("a press on the page still renders inline in the layer", () => {
        const menu = createContextMenu({name: "page-open"});
        render(
            <menu.Layer other={() => [{name: "Page action"}]}>
                <div data-testid="page">page</div>
            </menu.Layer>
        );

        fireEvent.contextMenu(screen.getByTestId("page"), {clientX: 20, clientY: 30});
        expect(document.querySelector("[data-wenay-menu-window-layer]")).toBeNull();
        expect(screen.getByText("Page action")).not.toBeNull();
        expect(menu.getState().windowPortal ?? null).toBeNull();
    });
});

describe("touch long press", () => {
    function longPress(target: Element, point: {x: number; y: number}) {
        fireEvent.touchStart(target, {touches: [{screenX: point.x, screenY: point.y, clientX: point.x, clientY: point.y}]});
        const started = Date.now();
        // The Layer measures the hold against Date.now, so move the clock rather than wait.
        const now = jest.spyOn(Date, "now").mockReturnValue(started + 400);
        try {
            fireEvent.touchEnd(target, {changedTouches: [{clientX: point.x, clientY: point.y}]});
        } finally {
            now.mockRestore();
        }
    }

    test("the item provider is called with the gesture, so contextMenu.map stays empty", () => {
        const menu = createContextMenu({name: "touch"});
        const gestures: unknown[] = [];
        render(
            <menu.Layer other={gesture => {
                gestures.push(gesture);
                const row = (gesture.target as HTMLElement | null)?.closest("[data-row]")?.getAttribute("data-row");
                return {items: [{name: `Row ${row}`}], source: "grid-rows"};
            }}>
                <div>
                    <div data-row="7"><span data-testid="cell">cell</span></div>
                </div>
            </menu.Layer>
        );

        longPress(screen.getByTestId("cell"), {x: 50, y: 60});

        expect(menu.map.size).toBe(0);
        expect(gestures).toEqual([{x: 50, y: 60, target: screen.getByTestId("cell"), pointer: "touch"}]);
        expect(screen.getByText("Row 7")).not.toBeNull();
        // The provider's own source is recorded, exactly as openAt would have done.
        expect(menu.getState().source).toBe("grid-rows");
        expect(menu.stats.getSnapshot().sources).toEqual({"grid-rows": 1});
    });

    test("right click reports a mouse gesture to the same provider", () => {
        const menu = createContextMenu({name: "mouse-gesture"});
        const gestures: Array<{pointer: string}> = [];
        render(
            <menu.Layer other={gesture => {
                gestures.push(gesture);
                return [{name: "Item"}];
            }}>
                <div data-testid="cell">cell</div>
            </menu.Layer>
        );

        fireEvent.contextMenu(screen.getByTestId("cell"), {clientX: 11, clientY: 22});
        expect(gestures).toEqual([{x: 11, y: 22, target: screen.getByTestId("cell"), pointer: "mouse"}]);
        // No explicit source from the provider: the Layer label stands.
        expect(menu.getState().source).toBe("layer");
    });

    test("a provider-less Layer still serves the legacy map", () => {
        const menu = createContextMenu({name: "legacy-touch"});
        menu.map.set("only", [{name: "Legacy"}]);
        render(
            <menu.Layer>
                <div data-testid="cell">cell</div>
            </menu.Layer>
        );

        longPress(screen.getByTestId("cell"), {x: 5, y: 6});
        expect(screen.getByText("Legacy")).not.toBeNull();
        expect(menu.map.size).toBe(0);
    });
});
