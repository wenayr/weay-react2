import React from "react";
import {render} from "@testing-library/react";
import {OutsideClickArea} from "../src/internal/components/OutsideClickArea";

/** Every instance used to add its own mousedown+touchstart pair to `document`, so N open
 *  overlays meant 2N native listeners. They are now multiplexed through a single pair. */

function countDocListeners() {
    const added: string[] = [];
    const removed: string[] = [];
    const origAdd = document.addEventListener.bind(document);
    const origRemove = document.removeEventListener.bind(document);
    jest.spyOn(document, "addEventListener").mockImplementation(((type: string, ...rest: unknown[]) => {
        if (type == "mousedown" || type == "touchstart") added.push(type);
        return (origAdd as unknown as (...a: unknown[]) => void)(type, ...rest);
    }) as typeof document.addEventListener);
    jest.spyOn(document, "removeEventListener").mockImplementation(((type: string, ...rest: unknown[]) => {
        if (type == "mousedown" || type == "touchstart") removed.push(type);
        return (origRemove as unknown as (...a: unknown[]) => void)(type, ...rest);
    }) as typeof document.removeEventListener);
    return {added, removed, restore: () => jest.restoreAllMocks()};
}

test("many outside-click areas share one pair of document listeners", () => {
    const spy = countDocListeners();
    const view = render(<>
        {[0, 1, 2, 3, 4].map(i =>
            <OutsideClickArea key={i} outsideClick={() => {}}><div>area {i}</div></OutsideClickArea>)}
    </>);

    // one mousedown + one touchstart for all five, not two per instance
    expect(spy.added.filter(t => t == "mousedown")).toHaveLength(1);
    expect(spy.added.filter(t => t == "touchstart")).toHaveLength(1);

    view.unmount();
    // the shared pair is released once the last subscriber goes away
    expect(spy.removed.filter(t => t == "mousedown")).toHaveLength(1);
    expect(spy.removed.filter(t => t == "touchstart")).toHaveLength(1);
    spy.restore();
});

test("each area still gets its own outside callback", () => {
    const hits: string[] = [];
    render(<>
        <OutsideClickArea outsideClick={() => hits.push("a")}><div data-testid="a">a</div></OutsideClickArea>
        <OutsideClickArea outsideClick={() => hits.push("b")}><div data-testid="b">b</div></OutsideClickArea>
    </>);

    const outside = document.createElement("div");
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent("mousedown", {bubbles: true}));

    expect(hits.sort()).toEqual(["a", "b"]);
    outside.remove();
});
