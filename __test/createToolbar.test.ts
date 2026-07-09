import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import {createToolbar, type UiListConfig} from "../src/common/src/components/Toolbar/Toolbar";

function createSource(initial: UiListConfig) {
    let state: UiListConfig = {
        order: initial.order.slice(),
        visible: {...initial.visible},
    };
    const listeners = new Set<(cfg: UiListConfig) => void>();
    const calls: UiListConfig[] = [];

    function emit() {
        listeners.forEach(cb => cb({order: state.order.slice(), visible: {...state.visible}}));
    }

    return {
        calls,
        current: () => state,
        replace(next: UiListConfig) {
            state = {order: next.order.slice(), visible: {...next.visible}};
            emit();
        },
        source: {
            useConfig: () => state,
            getConfig: () => state,
            setConfig(next: UiListConfig) {
                state = {order: next.order.slice(), visible: {...next.visible}};
                calls.push({order: state.order.slice(), visible: {...state.visible}});
                emit();
            },
            onChange(cb: (cfg: UiListConfig) => void) {
                listeners.add(cb);
                return () => { listeners.delete(cb); };
            },
        },
    };
}

const baseItems = [
    {key: "name", title: "Name", fixed: true},
    {key: "price", title: "Price"},
    {key: "blockMode", title: "Block mode"},
    {key: "qty", title: "Quantity"},
];

test("createToolbar source uses order and visibility by default", () => {
    const ext = createSource({
        order: ["name", "qty", "price"],
        visible: {name: true, price: false, qty: true},
    });
    const tb = createToolbar({
        key: "test.toolbar.defaultSource",
        items: baseItems,
        source: ext.source,
    });

    expect(tb.api.getConfig().order).toEqual(["name", "qty", "price", "blockMode"]);
    expect(tb.api.getConfig().visible.price).toBe(false);
});

test("createToolbar sourceMode order keeps membership and extra item positions local", () => {
    const ext = createSource({
        order: ["name", "price", "qty"],
        visible: {name: true, price: false, qty: true},
    });
    const tb = createToolbar({
        key: "test.toolbar.orderSource",
        items: baseItems,
        source: ext.source,
        sourceMode: "order",
    });

    expect(tb.api.getConfig().order).toEqual(["name", "price", "blockMode", "qty"]);
    expect(tb.api.getConfig().visible.price).toBe(true);

    ext.replace({
        order: ["name", "qty", "price"],
        visible: {name: true, price: false, qty: true},
    });
    expect(tb.api.getConfig().order).toEqual(["name", "qty", "blockMode", "price"]);

    tb.api.setOrder(["name", "blockMode", "price", "qty"]);
    expect(ext.calls).toHaveLength(1);
    expect(ext.calls[0].order).toEqual(["name", "price", "qty"]);
    expect(ext.calls[0].visible).toEqual({name: true, price: false, qty: true});
    expect(tb.api.getConfig().order).toEqual(["name", "blockMode", "price", "qty"]);

    ext.calls.length = 0;
    tb.api.show("qty", false);
    expect(ext.calls).toHaveLength(0);
    expect(tb.api.getConfig().visible.qty).toBe(false);
    expect(ext.current().visible.qty).toBe(true);
});

test("createToolbar Bar keeps item onClick when item face is custom-rendered", () => {
    const clicks: string[] = [];
    const tb = createToolbar({
        key: "test.toolbar.customFaceClick",
        items: [
            {
                key: "price",
                title: "Price",
                onClick: () => clicks.push("price"),
                render: () => React.createElement("span", null, "custom price face"),
            },
        ],
    });

    render(React.createElement(tb.Bar));
    fireEvent.click(screen.getByText("custom price face"));

    expect(clicks).toEqual(["price"]);
});