import React from "react";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {Button} from "../src/common/src/hooks/useOutside";
import {buttonStatusMap} from "../src/common/src/utils/persistedMaps";
import {memoryCache, memoryMaps} from "../src/common/src/utils/memoryStore";

function renderButton(keyForSave?: string) {
    return render(
        <Button keyForSave={keyForSave} button={<span data-testid="trigger">open</span>}>
            <div data-testid="panel">panel</div>
        </Button>
    );
}

describe("Button keyForSave", () => {
    beforeEach(() => buttonStatusMap.clear());

    test("keyForSave rides the shared memoryCache registry, not a private module object", () => {
        expect(memoryMaps.button).toBe(buttonStatusMap);
        expect(memoryCache.getArr.map(([name]) => name)).toContain("buttonStatusMap");
    });

    test("an open state is written to the map and restored by a later mount", () => {
        const first = renderButton("panel-a");
        expect(screen.queryByTestId("panel")).toBeNull();

        act(() => { fireEvent.click(screen.getByTestId("trigger")); });
        expect(screen.getByTestId("panel")).toBeTruthy();
        expect(buttonStatusMap.get("panel-a")).toEqual({open: true});

        first.unmount();
        renderButton("panel-a");
        expect(screen.getByTestId("panel")).toBeTruthy();
    });

    test("a hydrating map entry reaches a button that already rendered", () => {
        renderButton("panel-b");
        expect(screen.queryByTestId("panel")).toBeNull();

        // memoryCache.load() lands after mount and fills the map
        act(() => { buttonStatusMap.set("panel-b", {open: true}); });
        expect(screen.getByTestId("panel")).toBeTruthy();
    });

    test("an unrelated key does not disturb another button", () => {
        renderButton("panel-c");
        act(() => { buttonStatusMap.set("panel-other", {open: true}); });
        expect(screen.queryByTestId("panel")).toBeNull();
    });

    test("without keyForSave nothing is persisted", () => {
        renderButton();
        act(() => { fireEvent.click(screen.getByTestId("trigger")); });
        expect(screen.getByTestId("panel")).toBeTruthy();
        expect(buttonStatusMap.size).toBe(0);
    });
});
