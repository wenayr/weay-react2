import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import {FloatingWindow} from "../src/internal/components/Dnd/FloatingWindow";
import {Button} from "../src/internal/components/Buttons/Button";

function rootFor(testId: string) {
    const content = screen.getByTestId(testId);
    const root = content.closest("[data-wenay-window]") as HTMLElement | null;
    expect(root).not.toBeNull();
    return root!;
}

const z = (root: HTMLElement) => Number(root.style.zIndex);

describe("FloatingWindow nested in another window", () => {
    // clientBacktest: the "user strategies" window has toolbar buttons ("history", "remote", "custom")
    // that each open their own FloatingWindow. Those windows are React descendants of the outer
    // window even though they portal to body, so their pointer/mouse events bubble through the
    // portal to the outer window's bringToFront and the child ends up under its opener.
    test("pressing inside a child window keeps it above the window that opened it", () => {
        render(
            <FloatingWindow title="outer" position={{x: 10, y: 10}} size={{width: 400, height: 300}}>
                <div data-testid="outer-content">
                    outer
                    <Button statusDef button={<span>open</span>}>
                        <FloatingWindow title="inner" position={{x: 60, y: 60}} size={{width: 200, height: 150}}>
                            <div data-testid="inner-content">inner</div>
                        </FloatingWindow>
                    </Button>
                </div>
            </FloatingWindow>
        );

        const outer = rootFor("outer-content");
        const inner = rootFor("inner-content");
        // the child mounts after its opener, so it starts on top
        expect(z(inner)).toBeGreaterThan(z(outer));
        expect(inner.dataset.active).toBe("true");

        // the user clicks something inside the child window (a table row, a chip...)
        fireEvent.pointerDown(screen.getByTestId("inner-content"));
        fireEvent.mouseDown(screen.getByTestId("inner-content"));

        expect(z(inner)).toBeGreaterThan(z(outer));
        expect(inner.dataset.active).toBe("true");
        expect(outer.dataset.active).toBe("false");

        // clicking the opener still raises it above the child
        fireEvent.pointerDown(screen.getByTestId("outer-content"));
        fireEvent.mouseDown(screen.getByTestId("outer-content"));
        expect(z(outer)).toBeGreaterThan(z(inner));
        expect(outer.dataset.active).toBe("true");

        // and pressing the child again brings it back on top
        fireEvent.pointerDown(screen.getByTestId("inner-content"));
        fireEvent.mouseDown(screen.getByTestId("inner-content"));
        expect(z(inner)).toBeGreaterThan(z(outer));
    });

    test("a press inside an embedded portal={false} child still raises the window that hosts it", () => {
        // FreeModal / ModalWrapper embed a parent-positioned window inside the host window's DOM:
        // it is visually part of the host, so pressing it must bring the host above other windows.
        render(<>
            <FloatingWindow title="host" position={{x: 10, y: 10}} size={{width: 400, height: 300}}>
                <div data-testid="host-content" style={{position: "relative"}}>
                    host
                    <FloatingWindow portal={false} title="embedded" position={{x: 20, y: 20}} size={{width: 200, height: 150}}>
                        <div data-testid="embedded-content">embedded</div>
                    </FloatingWindow>
                </div>
            </FloatingWindow>
            <FloatingWindow title="other" position={{x: 300, y: 200}} size={{width: 200, height: 150}}>
                <div data-testid="other-content">other</div>
            </FloatingWindow>
        </>);
        const host = rootFor("host-content");
        const other = rootFor("other-content");
        expect(z(other)).toBeGreaterThan(z(host));

        fireEvent.pointerDown(screen.getByTestId("embedded-content"));
        fireEvent.mouseDown(screen.getByTestId("embedded-content"));
        expect(z(host)).toBeGreaterThan(z(other));
        expect(host.dataset.active).toBe("true");
    });

    test("grabbing the child's resize handle keeps it above its opener", () => {
        // The resize handles are siblings of .wenayWnd inside the Rnd root. With the raise
        // handlers on .wenayWnd a press on a handle was never claimed by the child, so it
        // bubbled through the portal and raised the opener over the window being resized.
        render(
            <FloatingWindow title="outer" position={{x: 10, y: 10}} size={{width: 400, height: 300}}>
                <div data-testid="outer-content">
                    <FloatingWindow title="inner" position={{x: 60, y: 60}} size={{width: 200, height: 150}}>
                        <div data-testid="inner-content">inner</div>
                    </FloatingWindow>
                </div>
            </FloatingWindow>
        );
        const outer = rootFor("outer-content");
        const inner = rootFor("inner-content");

        // put the opener on top first, so the assertion cannot pass by accident
        fireEvent.pointerDown(screen.getByTestId("outer-content"));
        fireEvent.mouseDown(screen.getByTestId("outer-content"));
        expect(z(outer)).toBeGreaterThan(z(inner));

        // react-rnd puts its handles in a wrapper that is a sibling of .wenayWnd inside the root
        const wrapper = [...inner.children].find(el => !el.classList.contains("wenayWnd")) as HTMLElement;
        const handle = wrapper?.children[0] as HTMLElement;
        expect(handle).toBeTruthy();
        expect(screen.getByTestId("inner-content").closest(".wenayWnd")!.contains(handle)).toBe(false);

        fireEvent.pointerDown(handle);
        fireEvent.mouseDown(handle);
        expect(z(inner)).toBeGreaterThan(z(outer));
        expect(inner.dataset.active).toBe("true");
        fireEvent.mouseUp(document);
    });

    test("pressing the child's header (drag start) keeps it on top", () => {
        render(
            <FloatingWindow title="outer" position={{x: 10, y: 10}} size={{width: 400, height: 300}}>
                <div data-testid="outer-content">
                    <FloatingWindow title="inner" position={{x: 60, y: 60}} size={{width: 200, height: 150}}>
                        <div data-testid="inner-content">inner</div>
                    </FloatingWindow>
                </div>
            </FloatingWindow>
        );
        const outer = rootFor("outer-content");
        const inner = rootFor("inner-content");
        const header = inner.querySelector(".wenayWndHeader") as HTMLElement;

        fireEvent.pointerDown(header, {clientX: 80, clientY: 70});
        fireEvent.mouseDown(header, {clientX: 80, clientY: 70, buttons: 1});
        expect(z(inner)).toBeGreaterThan(z(outer));
        fireEvent.mouseUp(document);
    });
});
