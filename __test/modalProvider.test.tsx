import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import {ModalProvider, useModal} from "../src/common/src/components/Modal/ModalContextProvider";

// ModalProvider now composes the internal Overlay primitive (A9). This suite pins the
// public contract that used to live inline: portal to document.body, token scrim,
// Escape gated by closeOnEscape, outside mousedown gated by closeOnOutsideClick.

const Opener = () => {
    const modal = useModal();
    return <button onClick={() => modal.show(<div data-testid="content">modal content</div>)}>open</button>;
};

function setup(props: {closeOnEscape?: boolean; closeOnOutsideClick?: boolean} = {}) {
    const utils = render(
        <ModalProvider {...props}>
            <Opener />
        </ModalProvider>
    );
    fireEvent.click(screen.getByText("open"));
    return utils;
}

describe("ModalProvider over the Overlay primitive", () => {
    test("opens into a body portal with the token scrim", () => {
        const u = setup();
        const content = screen.getByTestId("content");
        expect(document.body.contains(content)).toBe(true);
        // content -> OutsideClickArea div -> scrim div (direct child of body via portal)
        const scrim = content.parentElement!.parentElement as HTMLElement;
        expect(scrim.parentElement).toBe(document.body);
        expect(scrim.style.position).toBe("fixed");
        expect(scrim.style.zIndex).toBe("9999");
        u.unmount();
    });

    test("Escape closes by default and is inert with closeOnEscape=false", () => {
        const a = setup();
        fireEvent.keyDown(document, {key: "Escape"});
        expect(screen.queryByTestId("content")).toBeNull();
        a.unmount();

        const b = setup({closeOnEscape: false});
        fireEvent.keyDown(document, {key: "Escape"});
        expect(screen.queryByTestId("content")).not.toBeNull();
        b.unmount();
    });

    test("outside mousedown closes by default and is inert with closeOnOutsideClick=false", () => {
        const a = setup();
        fireEvent.mouseDown(document.body);
        expect(screen.queryByTestId("content")).toBeNull();
        a.unmount();

        const b = setup({closeOnOutsideClick: false});
        fireEvent.mouseDown(document.body);
        expect(screen.queryByTestId("content")).not.toBeNull();
        b.unmount();
    });

    test("mousedown inside the modal does not close it", () => {
        const u = setup();
        fireEvent.mouseDown(screen.getByTestId("content"));
        expect(screen.queryByTestId("content")).not.toBeNull();
        u.unmount();
    });
});
