import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import {createContextMenu} from "../src/common/src/menu/menuMouse";

test("contextMenu stats count direct opens and reset locally", () => {
    const menu = createContextMenu({name: "stats"});
    const changes: number[] = [];
    const off = menu.stats.onChange(snapshot => changes.push(snapshot.openAt + snapshot.openAtPoint));

    expect(menu.openAtPoint({x: 4, y: 8}, [{name: "A"}], {source: "test", layerId: "layer-a"})).toBe(true);
    expect(menu.openAt({clientX: 10, clientY: 12}, [{name: "B"}], {source: "test"})).toBe(true);

    expect(menu.stats.getSnapshot()).toMatchObject({
        openAt: 1,
        openAtPoint: 1,
        replace: 1,
        sources: {test: 2},
        layers: {"layer-a": 1},
    });
    expect(changes.length).toBeGreaterThan(0);

    menu.stats.reset();
    off();
    expect(menu.stats.getSnapshot()).toEqual({
        openAt: 0,
        openAtPoint: 0,
        legacyLayer: 0,
        close: 0,
        replace: 0,
        empty: 0,
        sources: {},
        layers: {},
    });
});

test("contextMenu stats keep legacy map Layer path visible", () => {
    const menu = createContextMenu({name: "legacy"});
    menu.map.set("legacy-action", [{name: "Legacy"}]);

    render(React.createElement(menu.Layer, {children: React.createElement("div", null, "target")}));
    fireEvent.contextMenu(screen.getByText("target"), {clientX: 20, clientY: 30});

    const snapshot = menu.stats.getSnapshot();
    expect(snapshot.legacyLayer).toBe(1);
    expect(snapshot.sources.layer).toBe(1);
    expect(Object.values(snapshot.layers)).toEqual([1]);
    expect(menu.map.size).toBe(0);
});

test("contextMenu stats count empty opens without storing item labels", () => {
    const menu = createContextMenu();

    expect(menu.openAtPoint({x: 0, y: 0}, [])).toBe(false);

    expect(menu.stats.getSnapshot()).toEqual({
        openAt: 0,
        openAtPoint: 0,
        legacyLayer: 0,
        close: 0,
        replace: 0,
        empty: 1,
        sources: {},
        layers: {},
    });
});