import React from "react";
import {act, fireEvent, render, screen, within} from "@testing-library/react";
import {FloatingWindow, FloatingWindowTaskbar, WindowPortal, floatingWindowMap} from "../src/internal/components/Dnd/FloatingWindow";
import {OutsideClickArea} from "../src/internal/components/OutsideClickArea";
import {flushAnimationFrames} from "./setup";
import {useFloatingDesktopWindow} from "../src/internal/components/Dnd/FloatingDesktop";

/** The drag loop commits one position per animation frame, so a synthetic move is only
 *  observable once the frame it was coalesced into has run. */
function dragTo(init: {clientX: number, clientY: number, buttons?: number}) {
    fireEvent.mouseMove(document, init);
    act(() => { flushAnimationFrames(); });
}

function rootFor(testId: string) {
    const content = screen.getByTestId(testId);
    const root = content.closest("[data-wenay-window]") as HTMLElement | null;
    expect(root).not.toBeNull();
    return root!;
}

describe("FloatingWindow viewport layer", () => {
    test("portals to body by default and keeps the parent stacking context out", () => {
        const {container} = render(
            <div data-testid="host" style={{transform: "translateZ(0)", overflow: "hidden", zIndex: -1}}>
                <FloatingWindow size={{width: 240, height: 160}}>
                    <div data-testid="window-content">content</div>
                </FloatingWindow>
            </div>
        );

        const root = rootFor("window-content");
        expect(container.contains(root)).toBe(false);
        const portalRoot = root.closest("[data-wenay-window-portal-root]") as HTMLElement | null;
        expect(portalRoot).not.toBeNull();
        expect(portalRoot!.parentElement).toBe(document.body);
        expect(portalRoot!.style.position).toBe("fixed");
        expect(portalRoot!.style.inset).toBe("0");
        expect(portalRoot!.style.isolation).toBe("isolate");
        expect(portalRoot!.style.pointerEvents).toBe("none");
        expect(root.dataset.wenayWindowLayer).toBe("viewport");
        expect(root.style.position).toBe("absolute");
        expect(root.style.top).toBe("0px");
        expect(root.style.left).toBe("0px");
        expect(root.style.isolation).toBe("isolate");
        expect(root.style.pointerEvents).toBe("auto");
    });

    test("portal=false is the explicit parent-positioned escape hatch", () => {
        const {container} = render(
            <div data-testid="host" style={{position: "relative"}}>
                <FloatingWindow portal={false} size={{width: 240, height: 160}}>
                    <div data-testid="embedded-content">content</div>
                </FloatingWindow>
            </div>
        );

        const root = rootFor("embedded-content");
        expect(container.contains(root)).toBe(true);
        expect(root.dataset.wenayWindowLayer).toBe("parent");
        expect(root.style.position).toBe("absolute");
    });

    test("pressing an older window raises its whole stacking context", () => {
        render(<>
            <FloatingWindow zIndex={100} position={{x: 20, y: 20}} size={{width: 240, height: 160}}>
                <div data-testid="first-window">
                    first
                    <span data-testid="first-high-child" style={{position: "absolute", zIndex: 999_999}}>high child</span>
                </div>
            </FloatingWindow>
            <FloatingWindow zIndex={9} position={{x: 80, y: 60}} size={{width: 240, height: 160}}>
                <div data-testid="second-window">second</div>
            </FloatingWindow>
        </>);

        const firstRoot = rootFor("first-window");
        const secondRoot = rootFor("second-window");
        const firstPortalRoot = firstRoot.closest("[data-wenay-window-portal-root]") as HTMLElement;
        const secondPortalRoot = secondRoot.closest("[data-wenay-window-portal-root]") as HTMLElement;
        expect(Number(firstRoot.style.zIndex)).toBeLessThan(Number(secondRoot.style.zIndex));
        expect(Number(firstPortalRoot.style.zIndex)).toBeLessThan(Number(secondPortalRoot.style.zIndex));
        expect(firstRoot.dataset.active).toBe("false");
        expect(secondRoot.dataset.active).toBe("true");

        fireEvent.mouseDown(screen.getByTestId("first-window"));

        expect(Number(firstRoot.style.zIndex)).toBeGreaterThan(Number(secondRoot.style.zIndex));
        expect(Number(firstPortalRoot.style.zIndex)).toBeGreaterThan(Number(secondPortalRoot.style.zIndex));
        expect(firstRoot.dataset.active).toBe("true");
        expect(secondRoot.dataset.active).toBe("false");
        expect(screen.getByTestId("first-high-child").closest("[data-wenay-window]")).toBe(firstRoot);
        expect(firstRoot.style.isolation).toBe("isolate");
    });

    test("OutsideClickArea treats its portalled window as logically inside", () => {
        const outsideClick = jest.fn();
        render(
            <OutsideClickArea outsideClick={outsideClick}>
                <FloatingWindow size={{width: 240, height: 160}}>
                    <button data-testid="inside-portal">inside</button>
                </FloatingWindow>
            </OutsideClickArea>
        );

        fireEvent.mouseDown(screen.getByTestId("inside-portal"));
        expect(outsideClick).not.toHaveBeenCalled();

        fireEvent.mouseDown(document.body);
        expect(outsideClick).toHaveBeenCalledTimes(1);
    });

    test("close chrome is optional and uses an accessible button", () => {
        const close = jest.fn();
        const view = render(
            <FloatingWindow size={{width: 240, height: 160}} onClickClose={close}>
                <div>closable</div>
            </FloatingWindow>
        );

        fireEvent.click(screen.getByRole("button", {name: "Close"}));
        expect(close).toHaveBeenCalledTimes(1);

        view.rerender(
            <FloatingWindow size={{width: 240, height: 160}}>
                <div>without close</div>
            </FloatingWindow>
        );
        expect(screen.queryByRole("button", {name: "Close"})).toBeNull();
    });

    test("double click maximizes and restores without showing a maximize button by default", () => {
        const onModeChange = jest.fn();
        render(
            <FloatingWindow
                windowId="zoom"
                title="Zoom"
                position={{x: 40, y: 50}}
                size={{width: 320, height: 220}}
                onModeChange={onModeChange}
            >
                <div data-testid="zoom-content">zoom content</div>
            </FloatingWindow>
        );

        const root = rootFor("zoom-content");
        const header = root.querySelector(".wenayWndHeader") as HTMLElement;
        expect(screen.queryByRole("button", {name: "Maximize"})).toBeNull();
        fireEvent.doubleClick(header);
        expect(root.dataset.mode).toBe("maximized");
        expect(root.dataset.positionX).toBe("0");
        expect(root.dataset.positionY).toBe("0");
        expect(root.style.width).toBe(`${window.innerWidth}px`);

        fireEvent.doubleClick(header);
        expect(root.dataset.mode).toBe("normal");
        expect(root.dataset.positionX).toBe("40");
        expect(root.dataset.positionY).toBe("50");
        expect(root.style.width).toBe("320px");
        expect(onModeChange).toHaveBeenNthCalledWith(1, "maximized");
        expect(onModeChange).toHaveBeenNthCalledWith(2, "normal");
    });

    test("maximize control is an explicit opt-in", () => {
        render(
            <FloatingWindow title="Button zoom" maximizeButton position={{x: 20, y: 30}} size={{width: 240, height: 150}}>
                <div data-testid="button-zoom-content">button zoom</div>
            </FloatingWindow>
        );
        const root = rootFor("button-zoom-content");
        fireEvent.click(screen.getByRole("button", {name: "Maximize"}));
        expect(root.dataset.mode).toBe("maximized");
        fireEvent.click(screen.getByRole("button", {name: "Restore"}));
        expect(root.dataset.mode).toBe("normal");
    });

    test("two taps on the title bar toggle maximize without a mouse", () => {
        render(
            <FloatingWindow title="Touch zoom" position={{x: 30, y: 40}} size={{width: 300, height: 200}}>
                <div data-testid="touch-zoom-content">touch</div>
            </FloatingWindow>
        );
        const root = rootFor("touch-zoom-content");
        const header = root.querySelector(".wenayWndHeader") as HTMLElement;
        const tap = {identifier: 7, clientX: 100, clientY: 80};

        fireEvent.touchStart(header, {changedTouches: [tap]});
        fireEvent.touchEnd(header, {changedTouches: [tap]});
        fireEvent.touchStart(header, {changedTouches: [tap]});
        fireEvent.touchEnd(header, {changedTouches: [tap]});
        expect(root.dataset.mode).toBe("maximized");

        fireEvent.touchStart(header, {changedTouches: [tap]});
        fireEvent.touchEnd(header, {changedTouches: [tap]});
        fireEvent.touchStart(header, {changedTouches: [tap]});
        fireEvent.touchEnd(header, {changedTouches: [tap]});
        expect(root.dataset.mode).toBe("normal");
    });

    test("top-centre drag opens the snap picker and applies a layout", () => {
        const onSnapChange = jest.fn();
        render(
            <FloatingWindow title="Snap me" position={{x: 80, y: 90}} size={{width: 300, height: 200}} onSnapChange={onSnapChange}>
                <div data-testid="snap-content">snap</div>
            </FloatingWindow>
        );
        const root = rootFor("snap-content");
        const header = root.querySelector(".wenayWndHeader") as HTMLElement;

        fireEvent.mouseDown(header, {clientX: 120, clientY: 100, buttons: 1});
        dragTo({clientX: window.innerWidth / 2, clientY: 10, buttons: 1});
        expect(screen.getByRole("toolbar", {name: "Snap layouts"})).not.toBeNull();
        expect(screen.getAllByRole("group")).toHaveLength(3);
        expect(within(screen.getByRole("group", {name: "Two columns"})).getAllByRole("button")).toHaveLength(2);
        expect(within(screen.getByRole("group", {name: "Two rows"})).getAllByRole("button")).toHaveLength(2);
        const quarters = screen.getByRole("group", {name: "Four quarters"});
        expect(within(quarters).getAllByRole("button")).toHaveLength(4);

        fireEvent.mouseEnter(within(quarters).getByRole("button", {name: "Four quarters: bottom right"}));
        fireEvent.mouseUp(document);
        expect(root.dataset.snapRegion).toBe("bottom-right");
        expect(root.dataset.positionX).toBe(`${Math.floor(window.innerWidth / 2)}`);
        expect(root.dataset.positionY).toBe(`${Math.floor(window.innerHeight / 2)}`);
        expect(root.style.width).toBe(`${Math.floor(window.innerWidth / 2)}px`);
        expect(root.style.height).toBe(`${window.innerHeight - Math.floor(window.innerHeight / 2)}px`);
        expect(onSnapChange).toHaveBeenLastCalledWith("bottom-right");
        expect(screen.queryByRole("toolbar", {name: "Snap layouts"})).toBeNull();

        fireEvent.mouseDown(header, {clientX: 100, clientY: 300, buttons: 1});
        expect(root.dataset.snapRegion).toBe("bottom-right");   // a press alone must not tear it off
        dragTo({clientX: 140, clientY: 340, buttons: 1});
        expect(root.dataset.snapRegion).toBeUndefined();
        expect(root.style.width).toBe("300px");
        expect(onSnapChange).toHaveBeenLastCalledWith(null);
        fireEvent.mouseUp(document);
    });

    test("the two-rows preset snaps to horizontal halves", () => {
        render(
            <FloatingWindow title="Rows" position={{x: 80, y: 90}} size={{width: 300, height: 200}}>
                <div data-testid="rows-content">rows</div>
            </FloatingWindow>
        );
        const root = rootFor("rows-content");
        const header = root.querySelector(".wenayWndHeader") as HTMLElement;

        fireEvent.mouseDown(header, {clientX: 120, clientY: 100, buttons: 1});
        dragTo({clientX: window.innerWidth / 2, clientY: 10, buttons: 1});
        const rows = screen.getByRole("group", {name: "Two rows"});
        fireEvent.click(within(rows).getByRole("button", {name: "Two rows: bottom"}));

        expect(root.dataset.snapRegion).toBe("bottom");
        expect(root.dataset.positionX).toBe("0");
        expect(root.dataset.positionY).toBe(`${Math.floor(window.innerHeight / 2)}`);
        expect(root.style.width).toBe(`${window.innerWidth}px`);
        expect(root.style.height).toBe(`${window.innerHeight - Math.floor(window.innerHeight / 2)}px`);
        fireEvent.mouseUp(document);
    });

    test("dragging a maximized window off the edge restores its previous size", () => {
        const onModeChange = jest.fn();
        render(
            <FloatingWindow title="Tear off" position={{x: 40, y: 50}} size={{width: 320, height: 220}} onModeChange={onModeChange}>
                <div data-testid="tear-content">tear</div>
            </FloatingWindow>
        );
        const root = rootFor("tear-content");
        const header = root.querySelector(".wenayWndHeader") as HTMLElement;

        fireEvent.doubleClick(header);
        expect(root.dataset.mode).toBe("maximized");

        // A press that never travels leaves the window maximized, so a double click still toggles.
        fireEvent.mouseDown(header, {clientX: 400, clientY: 12, buttons: 1});
        expect(root.dataset.mode).toBe("maximized");
        dragTo({clientX: 404, clientY: 16, buttons: 1});
        expect(root.dataset.mode).toBe("maximized");

        dragTo({clientX: 420, clientY: 120, buttons: 1});
        expect(root.dataset.mode).toBe("normal");
        expect(root.style.width).toBe("320px");
        expect(root.style.height).toBe("220px");
        expect(root.dataset.positionX).toBe(`${420 - 160}`);
        expect(root.dataset.positionY).toBe(`${120 - 12}`);

        // From here the window follows the pointer with the grab offset taken at the tear-off.
        dragTo({clientX: 430, clientY: 140, buttons: 1});
        expect(root.dataset.positionX).toBe(`${430 - 160}`);
        expect(root.dataset.positionY).toBe(`${140 - 12}`);
        fireEvent.mouseUp(document);
        expect(onModeChange).toHaveBeenLastCalledWith("normal");
    });

    test("keyboard moves, resizes and toggles a focused window", () => {
        const onPositionChange = jest.fn();
        const onSizeChange = jest.fn();
        render(
            <FloatingWindow
                ariaLabel="Keyboard window"
                title="Keyboard"
                position={{x: 10, y: 20}}
                size={{width: 200, height: 120}}
                onPositionChange={onPositionChange}
                onSizeChange={onSizeChange}
            >
                <div>keyboard content</div>
            </FloatingWindow>
        );
        const root = screen.getByRole("dialog", {name: "Keyboard window"});

        fireEvent.keyDown(root, {key: "ArrowRight", altKey: true});
        expect(root.dataset.positionX).toBe("20");
        expect(root.dataset.positionY).toBe("20");
        expect(onPositionChange).toHaveBeenLastCalledWith({x: 20, y: 20});

        fireEvent.keyDown(root, {key: "ArrowDown", altKey: true, ctrlKey: true});
        expect(root.style.height).toBe("130px");
        expect(onSizeChange).toHaveBeenLastCalledWith({width: 200, height: 130});

        fireEvent.keyDown(root, {key: "Enter", altKey: true});
        expect(root.dataset.mode).toBe("maximized");
    });

    test("optional taskbar minimizes and restores the whole window", () => {
        render(<>
            <FloatingWindow windowId="task-one" stackGroup="task-test" title="One" minimizable size={{width: 220, height: 140}}>
                <div data-testid="task-one-content">one</div>
            </FloatingWindow>
            <FloatingWindow windowId="task-two" stackGroup="task-test" title="Two" minimizable size={{width: 220, height: 140}}>
                <div data-testid="task-two-content">two</div>
            </FloatingWindow>
            <FloatingWindowTaskbar stackGroup="task-test" portal={false} />
        </>);

        const first = rootFor("task-one-content");
        fireEvent.mouseDown(screen.getByTestId("task-one-content"));
        fireEvent.click(within(first).getByRole("button", {name: "Minimize"}));

        expect(first.dataset.minimized).toBe("true");
        expect(first.style.display).toBe("none");
        const taskButton = screen.getByRole("button", {name: "One"});
        expect(taskButton.dataset.minimized).toBe("true");

        fireEvent.click(taskButton);
        expect(first.dataset.minimized).toBe("false");
        expect(first.style.display).toBe("");
        expect(first.dataset.active).toBe("true");
    });

    test("window chrome can hide minimize while keeping external minimize behavior", () => {
        render(
            <FloatingWindow title="Headless controls" minimizable minimizeButton={false} size={{width: 220, height: 140}}>
                <div data-testid="headless-controls-content">headless controls</div>
            </FloatingWindow>
        );
        const root = rootFor("headless-controls-content");
        expect(screen.queryByRole("button", {name: "Minimize"})).toBeNull();
        expect(screen.queryByRole("button", {name: "Maximize"})).toBeNull();
        fireEvent.keyDown(root, {key: "ArrowDown", metaKey: true});
        expect(root.dataset.minimized).toBe("true");
    });

    test("windows without an explicit or saved position cascade", () => {
        render(<>
            <FloatingWindow stackGroup="cascade-test" size={{width: 160, height: 100}}><div data-testid="cascade-a">a</div></FloatingWindow>
            <FloatingWindow stackGroup="cascade-test" size={{width: 160, height: 100}}><div data-testid="cascade-b">b</div></FloatingWindow>
        </>);
        const a = rootFor("cascade-a");
        const b = rootFor("cascade-b");
        expect(a.dataset.positionX).not.toBe(b.dataset.positionX);
        expect(a.dataset.positionY).not.toBe(b.dataset.positionY);
    });

    test("Meta+Arrow provides Windows-style snap, maximize, restore and minimize", () => {
        render(
            <FloatingWindow title="Keyboard desktop" minimizable position={{x: 70, y: 80}} size={{width: 260, height: 170}}>
                <div data-testid="desktop-keyboard">desktop keyboard</div>
            </FloatingWindow>
        );
        const root = rootFor("desktop-keyboard");

        fireEvent.keyDown(root, {key: "ArrowLeft", metaKey: true});
        expect(root.dataset.snapRegion).toBe("left");
        fireEvent.keyDown(root, {key: "ArrowUp", metaKey: true});
        expect(root.dataset.mode).toBe("maximized");
        fireEvent.keyDown(root, {key: "ArrowDown", metaKey: true});
        expect(root.dataset.mode).toBe("normal");
        expect(root.dataset.snapRegion).toBe("left");
        fireEvent.keyDown(root, {key: "ArrowDown", metaKey: true});
        expect(root.dataset.snapRegion).toBeUndefined();
        expect(root.dataset.positionX).toBe("70");
        fireEvent.keyDown(root, {key: "ArrowDown", metaKey: true});
        expect(root.dataset.minimized).toBe("true");
    });

    test("layoutGroup persists a snapped group member and its free geometry", () => {
        const first = render(
            <FloatingWindow windowId="persisted-a" layoutGroup="saved-layout-test" position={{x: 91, y: 73}} size={{width: 280, height: 190}}>
                <div data-testid="persisted-first">first mount</div>
            </FloatingWindow>
        );
        const root = rootFor("persisted-first");
        fireEvent.keyDown(root, {key: "ArrowRight", metaKey: true});
        expect(root.dataset.snapRegion).toBe("right");
        first.unmount();

        render(
            <FloatingWindow windowId="persisted-a" layoutGroup="saved-layout-test" size={{width: 100, height: 100}}>
                <div data-testid="persisted-second">second mount</div>
            </FloatingWindow>
        );
        const restored = rootFor("persisted-second");
        expect(restored.dataset.snapRegion).toBe("right");
        fireEvent.keyDown(restored, {key: "ArrowDown", metaKey: true});
        expect(restored.dataset.snapRegion).toBeUndefined();
        expect(restored.dataset.positionX).toBe("91");
        expect(restored.dataset.positionY).toBe("73");
        expect(restored.style.width).toBe("280px");
        expect(restored.style.height).toBe("190px");
    });

    test("applies persisted session geometry loaded after the window mounts", () => {
        const persistedKey = "late-layout:late-window";
        floatingWindowMap.delete(persistedKey);
        render(
            <FloatingWindow windowId="late-window" layoutGroup="late-layout" position={{x: 12, y: 14}} size={{width: 160, height: 100}}>
                <div data-testid="late-persisted">late persisted</div>
            </FloatingWindow>
        );
        const root = rootFor("late-persisted");
        expect(root.dataset.positionX).toBe("12");

        act(() => {
            floatingWindowMap.set(persistedKey, {
                position: {x: 91, y: 73},
                size: {width: 280, height: 190},
                snapRegion: "right",
                freeGeometry: {position: {x: 91, y: 73}, size: {width: 280, height: 190}},
            });
        });

        expect(root.dataset.snapRegion).toBe("right");
        fireEvent.keyDown(root, {key: "ArrowDown", metaKey: true});
        expect(root.dataset.snapRegion).toBeUndefined();
        expect(root.dataset.positionX).toBe("91");
        expect(root.dataset.positionY).toBe("73");
        expect(root.style.width).toBe("280px");
        expect(root.style.height).toBe("190px");
        floatingWindowMap.delete(persistedKey);
    });

    test("modern close API reports reasons and beforeClose can veto", () => {
        const onClose = jest.fn();
        const beforeClose = jest.fn(() => false);
        const view = render(
            <FloatingWindow title="Safe close" closable onClose={onClose} beforeClose={beforeClose} closeOnEscape size={{width: 240, height: 160}}>
                <div>dirty form</div>
            </FloatingWindow>
        );

        fireEvent.click(screen.getByRole("button", {name: "Close"}));
        expect(beforeClose).toHaveBeenCalledWith("close-button");
        expect(onClose).not.toHaveBeenCalled();

        view.rerender(
            <FloatingWindow title="Safe close" closable onClose={onClose} beforeClose={() => true} closeOnEscape size={{width: 240, height: 160}}>
                <div>clean form</div>
            </FloatingWindow>
        );
        fireEvent.keyDown(document, {key: "Escape"});
        expect(onClose).toHaveBeenCalledWith("escape");
    });

    test("WindowPortal stays in its owning window stack but outside the Rnd subtree", () => {
        render(
            <FloatingWindow title="Portal owner" size={{width: 260, height: 180}}>
                <div data-testid="portal-owner">
                    owner
                    <WindowPortal style={{left: 12, top: 48}}>
                        <div data-testid="scoped-popup">popup</div>
                    </WindowPortal>
                </div>
            </FloatingWindow>
        );

        const root = rootFor("portal-owner");
        const portalRoot = root.closest("[data-wenay-window-portal-root]") as HTMLElement;
        const popup = screen.getByTestId("scoped-popup");
        expect(root.contains(popup)).toBe(false);
        expect(portalRoot.contains(popup)).toBe(true);
        expect(popup.parentElement?.style.zIndex).toBe("2147483646");
    });
});

describe("FloatingWindow degenerate geometry", () => {
    function setViewport(width: number, height: number) {
        Object.defineProperty(window, "innerWidth", {value: width, configurable: true, writable: true});
        Object.defineProperty(window, "innerHeight", {value: height, configurable: true, writable: true});
    }

    const realWidth = window.innerWidth;
    const realHeight = window.innerHeight;
    afterEach(() => setViewport(realWidth, realHeight));

    test("a mount at a zero viewport does not persist a 0x0 size", () => {
        const persistedKey = "zero-viewport:panic";
        floatingWindowMap.delete(persistedKey);
        try {
            // A hidden tab, a prerender or an offscreen iframe reports no viewport at all.
            setViewport(0, 0);
            const first = render(
                <FloatingWindow windowId="panic" layoutGroup="zero-viewport" position={{x: 14, y: 10}} size={{width: 400, height: 500}}>
                    <div data-testid="zero-content">panic</div>
                </FloatingWindow>
            );
            expect(floatingWindowMap.get(persistedKey)?.size).toEqual({width: 400, height: 500});
            first.unmount();

            // Back to a real viewport: the window must not have been shrunk away for good.
            setViewport(1280, 720);
            render(
                <FloatingWindow windowId="panic" layoutGroup="zero-viewport" position={{x: 14, y: 10}} size={{width: 400, height: 500}}>
                    <div data-testid="zero-content">panic</div>
                </FloatingWindow>
            );
            const root = rootFor("zero-content");
            expect(root.style.width).toBe("400px");
            expect(root.style.height).toBe("500px");
        } finally {
            floatingWindowMap.delete(persistedKey);
        }
    });

    test("a persisted degenerate size is ignored in favour of the size prop", () => {
        const persistedKey = "healed:panel";
        // Exactly the entry a pre-fix session left behind in localStorage.
        floatingWindowMap.set(persistedKey, {position: {x: 14, y: 10}, size: {width: 0, height: 0}});
        try {
            render(
                <FloatingWindow windowId="panel" layoutGroup="healed" size={{width: 400, height: 500}}>
                    <div data-testid="healed-content">healed</div>
                </FloatingWindow>
            );
            const root = rootFor("healed-content");
            expect(root.style.width).toBe("400px");
            expect(root.style.height).toBe("500px");
            // The saved position is a separate axis and stays authoritative.
            expect(root.dataset.positionX).toBe("14");
            expect(root.dataset.positionY).toBe("10");
            // and the damaged record itself is rewritten, so it stops coming back every load.
            expect(floatingWindowMap.get(persistedKey)?.size).toEqual({width: 400, height: 500});
        } finally {
            floatingWindowMap.delete(persistedKey);
        }
    });

    test("a degenerate entry arriving after mount is ignored too", () => {
        const persistedKey = "healed-late:panel";
        floatingWindowMap.delete(persistedKey);
        try {
            render(
                <FloatingWindow windowId="panel" layoutGroup="healed-late" size={{width: 320, height: 240}}>
                    <div data-testid="healed-late-content">late</div>
                </FloatingWindow>
            );
            act(() => {
                floatingWindowMap.set(persistedKey, {position: {x: 20, y: 30}, size: {width: 0, height: 0}});
            });
            const root = rootFor("healed-late-content");
            expect(root.style.width).toBe("320px");
            expect(root.style.height).toBe("240px");
            expect(root.dataset.positionX).toBe("20");
        } finally {
            floatingWindowMap.delete(persistedKey);
        }
    });

    test("a real resize is still persisted", () => {
        const persistedKey = "kept:panel";
        floatingWindowMap.delete(persistedKey);
        try {
            render(
                <FloatingWindow windowId="panel" layoutGroup="kept" size={{width: 300, height: 200}}>
                    <div data-testid="kept-content">kept</div>
                </FloatingWindow>
            );
            const root = rootFor("kept-content");
            fireEvent.keyDown(root, {key: "ArrowRight", altKey: true, ctrlKey: true});
            expect(root.style.width).toBe("310px");
            expect(floatingWindowMap.get(persistedKey)?.size).toEqual({width: 310, height: 200});
        } finally {
            floatingWindowMap.delete(persistedKey);
        }
    });
});

describe("FloatingWindow offscreen recovery", () => {
    /** jsdom measures everything as a zero rect, which is exactly what a display:none window
     *  reports in a real browser too - so the clamp needs a window that reports a real box at
     *  its applied position, and nothing while it is minimized. */
    const rect = (left: number, top: number, width: number, height: number) =>
        ({x: left, y: top, left, top, right: left + width, bottom: top + height, width, height, toJSON: () => ({})}) as DOMRect;

    function stubWindowRect() {
        const original = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function () {
            const el = this as HTMLElement;
            const root = el.closest?.("[data-wenay-window]") as HTMLElement | null;
            // display:none reports a zero box in a real browser too - that is the whole point
            // of the minimized case below.
            if (!root || root.style.display == "none") return rect(0, 0, 0, 0);
            const left = Number(root.dataset.positionX ?? 0);
            const top = Number(root.dataset.positionY ?? 0);
            const width = parseFloat(root.style.width || "0");
            const height = parseFloat(root.style.height || "0");
            // The clamp measures the window body and widens it by the chrome that overhangs it.
            if (el.classList.contains("wenayWnd")) return rect(left, top, width, height);
            if (el.classList.contains("wenayWndControl") || el.classList.contains("wenayWndClose")) {
                return rect(left + width - 24, top, 24, 24);
            }
            return rect(0, 0, 0, 0);
        };
        return () => { Element.prototype.getBoundingClientRect = original; };
    }

    test("a window persisted offscreen is pulled back on mount", () => {
        const persistedKey = "offscreen:panel";
        const restore = stubWindowRect();
        // Dragged to x=2400 on a wide monitor, reopened on this viewport.
        floatingWindowMap.set(persistedKey, {position: {x: 2400, y: 40}, size: {width: 300, height: 200}});
        try {
            render(
                <FloatingWindow windowId="panel" layoutGroup="offscreen" size={{width: 300, height: 200}}>
                    <div data-testid="offscreen-content">offscreen</div>
                </FloatingWindow>
            );
            const root = rootFor("offscreen-content");
            expect(Number(root.dataset.positionX)).toBe(window.innerWidth - 300);
        } finally {
            restore();
            floatingWindowMap.delete(persistedKey);
        }
    });

    test("a window minimized at mount is pulled back when the taskbar restores it", () => {
        const persistedKey = "offscreen-min:panel";
        const restore = stubWindowRect();
        floatingWindowMap.set(persistedKey, {position: {x: 2400, y: 40}, size: {width: 300, height: 200}});
        try {
            render(<>
                <FloatingWindow
                    windowId="panel" layoutGroup="offscreen-min" stackGroup="offscreen-min"
                    title="Stranded" minimizable defaultMinimized size={{width: 300, height: 200}}
                >
                    <div data-testid="offscreen-min-content">stranded</div>
                </FloatingWindow>
                <FloatingWindowTaskbar stackGroup="offscreen-min" portal={false}/>
            </>);
            const root = rootFor("offscreen-min-content");
            // Hidden, so nothing could measure it: the stale position is still in place.
            expect(root.dataset.minimized).toBe("true");
            expect(Number(root.dataset.positionX)).toBe(2400);

            fireEvent.click(screen.getByRole("button", {name: "Stranded"}));
            expect(root.dataset.minimized).toBe("false");
            // Restoring has to bring it back where it can be seen and grabbed.
            expect(Number(root.dataset.positionX)).toBe(window.innerWidth - 300);
        } finally {
            restore();
            floatingWindowMap.delete(persistedKey);
        }
    });
});

describe("FloatingDesktop stacking subscription", () => {
    test("a raise only re-renders the windows whose slot in the stack actually moved", () => {
        const renders: {[id: string]: number} = {a: 0, b: 0, c: 0};
        const raise: {[id: string]: () => void} = {};

        function StackProbe({id}: {id: string}) {
            const desktop = useFloatingDesktopWindow({windowId: id, group: "raise-probe", baseZIndex: 9});
            raise[id] = desktop.bringToFront;
            renders[id] += 1;
            return <div data-testid={`probe-${id}`}>{`${desktop.stack.index}:${desktop.stack.active}`}</div>;
        }

        render(<><StackProbe id="a"/><StackProbe id="b"/><StackProbe id="c"/></>);
        expect(screen.getByTestId("probe-a").textContent).toBe("0:false");
        expect(screen.getByTestId("probe-c").textContent).toBe("2:true");

        const before = {...renders};
        act(() => { raise.b(); });

        // b goes on top, c slides down one - a keeps slot 0 at the same z, so its snapshot is
        // identical and React must bail it (and its whole subtree) out.
        expect(screen.getByTestId("probe-b").textContent).toBe("2:true");
        expect(screen.getByTestId("probe-c").textContent).toBe("1:false");
        expect(screen.getByTestId("probe-a").textContent).toBe("0:false");
        expect(renders.a).toBe(before.a);
        expect(renders.b).toBeGreaterThan(before.b);
        expect(renders.c).toBeGreaterThan(before.c);
    });
});
