import React, {useState} from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import {useReorder} from "../src/internal/hooks/useReorder";

function ColumnReorderHarness() {
    const [order, setOrder] = useState(["c1", "c2", "c3"]);
    const columns = useReorder({order, commit: setOrder, preview: "measure"});
    return <>
        <div ref={columns.listRef} data-testid="columns">
            {order.map(key => {
                const drag = columns.item(key);
                return <section key={key} data-testid={key} style={drag.style}>
                    <header {...drag.props}>
                        <span>{`handle ${key}`}</span>
                        <button>{`Del ${key}`}</button>
                    </header>
                </section>;
            })}
        </div>
        <output data-testid="order">{order.join(",")}</output>
    </>;
}

function mockHorizontalLayout() {
    const list = screen.getByTestId("columns");
    Object.defineProperty(list, "offsetWidth", {configurable: true, value: 300});
    list.getBoundingClientRect = () => ({x: 0, y: 0, left: 0, top: 0, right: 300, bottom: 120, width: 300, height: 120, toJSON() { return {}; }}) as DOMRect;
    ["c1", "c2", "c3"].forEach((key, index) => {
        const element = screen.getByTestId(key);
        Object.defineProperties(element, {
            offsetLeft: {configurable: true, value: index * 100},
            offsetTop: {configurable: true, value: 0},
            offsetWidth: {configurable: true, value: 80},
            offsetHeight: {configurable: true, value: 100},
        });
    });
}

describe("headless container reorder composition", () => {
    test("a header drag reorders complete consumer-owned containers", () => {
        render(<ColumnReorderHarness />);
        mockHorizontalLayout();

        fireEvent.mouseDown(screen.getByText("handle c1"), {button: 0, clientX: 40, clientY: 20});
        fireEvent.mouseMove(document, {clientX: 240, clientY: 20});
        fireEvent.mouseUp(document);

        expect(screen.getByTestId("order").textContent).toBe("c2,c3,c1");
    });

    test("interactive header controls do not start a container drag", () => {
        render(<ColumnReorderHarness />);
        mockHorizontalLayout();

        fireEvent.mouseDown(screen.getByRole("button", {name: "Del c1"}), {button: 0, clientX: 40, clientY: 20});
        fireEvent.mouseMove(document, {clientX: 240, clientY: 20});
        fireEvent.mouseUp(document);

        expect(screen.getByTestId("order").textContent).toBe("c1,c2,c3");
    });
});
