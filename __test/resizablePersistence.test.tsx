import React from "react";
import {render, screen} from "@testing-library/react";
import {FResizableReact, mapResiReact} from "../src/internal/components/Dnd/Resizable";

/** The box re-resizable renders carries the applied size as inline styles. */
function box(testId: string) {
    return screen.getByTestId(testId).parentElement as HTMLElement;
}

describe("FResizableReact persisted size", () => {
    afterEach(() => mapResiReact.clear());

    test("a stored size is honoured", () => {
        mapResiReact.set("kept", {width: 260, height: 140});
        render(
            <FResizableReact keyForSave="kept" size={{width: 200, height: 100}}>
                <div data-testid="kept">kept</div>
            </FResizableReact>
        );
        expect(box("kept").style.width).toBe("260px");
        expect(box("kept").style.height).toBe("140px");
    });

    test("a stored zero is ignored in favour of the size prop and repaired in place", () => {
        // What a parent that renders size={{width: 0}} on its first, pre-measurement pass
        // leaves behind - and what then outranked the real prop on every later mount.
        mapResiReact.set("damaged", {width: 0, height: 0});
        render(
            <FResizableReact keyForSave="damaged" size={{width: 200, height: 100}}>
                <div data-testid="damaged">damaged</div>
            </FResizableReact>
        );
        expect(box("damaged").style.width).toBe("200px");
        expect(box("damaged").style.height).toBe("100px");
        expect(mapResiReact.get("damaged")).toEqual({width: 200, height: 100});
    });

    test("a stored size under the declared minimum is damage, above it is a choice", () => {
        mapResiReact.set("tiny", {width: 4, height: 120});
        render(
            <FResizableReact keyForSave="tiny" minWidth={40} size={{width: 200, height: 100}}>
                <div data-testid="tiny">tiny</div>
            </FResizableReact>
        );
        // 4 is below the caller's own minWidth, so it cannot have come from a drag.
        expect(box("tiny").style.width).toBe("200px");
        // 120 clears the default floor and is left alone, prop or no prop.
        expect(box("tiny").style.height).toBe("120px");
    });

    test("string sizes and absent dimensions are the caller's business", () => {
        mapResiReact.set("auto", {width: "100%"});
        render(
            <FResizableReact keyForSave="auto" size={{width: 200, height: 100}}>
                <div data-testid="auto">auto</div>
            </FResizableReact>
        );
        expect(box("auto").style.width).toBe("100%");
        expect(mapResiReact.get("auto")).toEqual({width: "100%"});
    });

    test("a first mount seeds the map from the prop", () => {
        render(
            <FResizableReact keyForSave="fresh" size={{width: 180, height: 90}}>
                <div data-testid="fresh">fresh</div>
            </FResizableReact>
        );
        expect(mapResiReact.get("fresh")).toEqual({width: 180, height: 90});
    });
});
