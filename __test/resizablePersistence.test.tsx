import React from "react";
import {render, screen} from "@testing-library/react";
import {ResizableBox, resizableSizeMap} from "../src/internal/components/Dnd/Resizable";

/** The box re-resizable renders carries the applied size as inline styles. */
function box(testId: string) {
    return screen.getByTestId(testId).parentElement as HTMLElement;
}

describe("FResizableReact persisted size", () => {
    afterEach(() => resizableSizeMap.clear());

    test("a stored size is honoured", () => {
        resizableSizeMap.set("kept", {width: 260, height: 140});
        render(
            <ResizableBox keyForSave="kept" size={{width: 200, height: 100}}>
                <div data-testid="kept">kept</div>
            </ResizableBox>
        );
        expect(box("kept").style.width).toBe("260px");
        expect(box("kept").style.height).toBe("140px");
    });

    test("a stored zero is ignored in favour of the size prop and repaired in place", () => {
        // What a parent that renders size={{width: 0}} on its first, pre-measurement pass
        // leaves behind - and what then outranked the real prop on every later mount.
        resizableSizeMap.set("damaged", {width: 0, height: 0});
        render(
            <ResizableBox keyForSave="damaged" size={{width: 200, height: 100}}>
                <div data-testid="damaged">damaged</div>
            </ResizableBox>
        );
        expect(box("damaged").style.width).toBe("200px");
        expect(box("damaged").style.height).toBe("100px");
        expect(resizableSizeMap.get("damaged")).toEqual({width: 200, height: 100});
    });

    test("a stored size under the declared minimum is damage, above it is a choice", () => {
        resizableSizeMap.set("tiny", {width: 4, height: 120});
        render(
            <ResizableBox keyForSave="tiny" minWidth={40} size={{width: 200, height: 100}}>
                <div data-testid="tiny">tiny</div>
            </ResizableBox>
        );
        // 4 is below the caller's own minWidth, so it cannot have come from a drag.
        expect(box("tiny").style.width).toBe("200px");
        // 120 clears the default floor and is left alone, prop or no prop.
        expect(box("tiny").style.height).toBe("120px");
    });

    test("string sizes and absent dimensions are the caller's business", () => {
        resizableSizeMap.set("auto", {width: "100%"});
        render(
            <ResizableBox keyForSave="auto" size={{width: 200, height: 100}}>
                <div data-testid="auto">auto</div>
            </ResizableBox>
        );
        expect(box("auto").style.width).toBe("100%");
        expect(resizableSizeMap.get("auto")).toEqual({width: "100%"});
    });

    test("a first mount seeds the map from the prop", () => {
        render(
            <ResizableBox keyForSave="fresh" size={{width: 180, height: 90}}>
                <div data-testid="fresh">fresh</div>
            </ResizableBox>
        );
        expect(resizableSizeMap.get("fresh")).toEqual({width: 180, height: 90});
    });
});
