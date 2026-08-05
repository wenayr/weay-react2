import React, {useState} from "react";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {Overlay} from "../src/common/src/components/Overlay";

function NestedOverlays({onParentOutside = () => undefined, onChildOutside = () => undefined}: {
    onParentOutside?: () => void;
    onChildOutside?: () => void;
}) {
    const [parentOpen, setParentOpen] = useState(false);
    const [childOpen, setChildOpen] = useState(false);
    return <>
        <button onClick={() => setParentOpen(true)}>Open parent</button>
        {parentOpen && <Overlay ariaLabel="Parent" onEscape={() => setParentOpen(false)} onOutsideClick={onParentOutside}>
            <button onClick={() => setChildOpen(true)}>Open child</button>
            <button>Parent last</button>
            {childOpen && <Overlay ariaLabel="Child" onEscape={() => setChildOpen(false)} onOutsideClick={onChildOutside}>
                <button>Child first</button>
                <button>Child last</button>
            </Overlay>}
        </Overlay>}
    </>;
}

describe("Overlay arbitration and focus", () => {
    test("Escape and outside interaction belong to the top overlay only", async () => {
        const parentOutside = jest.fn();
        const childOutside = jest.fn();
        render(<NestedOverlays onParentOutside={parentOutside} onChildOutside={childOutside} />);

        fireEvent.click(screen.getByRole("button", {name: "Open parent"}));
        fireEvent.click(screen.getByRole("button", {name: "Open child"}));
        await waitFor(() => expect(screen.getByRole("dialog", {name: "Child"})).not.toBeNull());

        fireEvent.mouseDown(document.body);
        expect(childOutside).toHaveBeenCalledTimes(1);
        expect(parentOutside).not.toHaveBeenCalled();

        fireEvent.keyDown(document, {key: "Escape"});
        expect(screen.queryByRole("dialog", {name: "Child"})).toBeNull();
        expect(screen.getByRole("dialog", {name: "Parent"})).not.toBeNull();

        fireEvent.keyDown(document, {key: "Escape"});
        expect(screen.queryByRole("dialog", {name: "Parent"})).toBeNull();
    });

    test("focus enters, loops inside, then returns to the opener", async () => {
        render(<NestedOverlays />);
        const opener = screen.getByRole("button", {name: "Open parent"});
        opener.focus();
        fireEvent.click(opener);

        const first = await screen.findByRole("button", {name: "Open child"});
        const last = screen.getByRole("button", {name: "Parent last"});
        await waitFor(() => expect(document.activeElement).toBe(first));

        last.focus();
        fireEvent.keyDown(document, {key: "Tab"});
        expect(document.activeElement).toBe(first);

        first.focus();
        fireEvent.keyDown(document, {key: "Tab", shiftKey: true});
        expect(document.activeElement).toBe(last);

        fireEvent.keyDown(document, {key: "Escape"});
        expect(document.activeElement).toBe(opener);
    });
});
