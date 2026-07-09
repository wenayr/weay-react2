import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import {createContextMenu} from "../src/common/src/menu/menuMouse";

const zeroActionTotals = {
    click: 0,
    ok: 0,
    error: 0,
    taskOk: 0,
    taskError: 0,
    submenuOpen: 0,
    submenuOk: 0,
    submenuError: 0,
    funcOpen: 0,
    funcOk: 0,
    funcError: 0,
    focusOpen: 0,
    focusOk: 0,
    focusError: 0,
};

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
        actionTotals: {...zeroActionTotals},
        actions: {},
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
        actionTotals: {...zeroActionTotals},
        actions: {},
    });
});
test("contextMenu stats count keyed actions without storing labels", () => {
    const menu = createContextMenu({name: "actions"});
    const clicks: string[] = [];

    render(React.createElement(menu.Layer, {
        children: React.createElement("div", null, "target-keyed"),
        other: () => [{name: "Sensitive label", actionKey: "qa4.action1", onClick: () => { clicks.push("ok"); }}],
    }));
    fireEvent.contextMenu(screen.getByText("target-keyed"), {clientX: 20, clientY: 30});
    fireEvent.click(screen.getByText("Sensitive label"));

    const snapshot = menu.stats.getSnapshot();
    expect(clicks).toEqual(["ok"]);
    expect(snapshot.actionTotals.click).toBe(1);
    expect(snapshot.actionTotals.ok).toBe(1);
    expect(snapshot.actions["qa4.action1"].click).toBe(1);
    expect(snapshot.actions["qa4.action1"].ok).toBe(1);
    expect(JSON.stringify(snapshot)).not.toContain("Sensitive label");
});

test("contextMenu stats count unkeyed actions only in totals", () => {
    const menu = createContextMenu({name: "actions-unkeyed"});

    render(React.createElement(menu.Layer, {
        children: React.createElement("div", null, "target-unkeyed"),
        other: () => [{name: "Unkeyed label", onClick: () => null}],
    }));
    fireEvent.contextMenu(screen.getByText("target-unkeyed"), {clientX: 20, clientY: 30});
    fireEvent.click(screen.getByText("Unkeyed label"));

    const snapshot = menu.stats.getSnapshot();
    expect(snapshot.actionTotals.click).toBe(1);
    expect(snapshot.actionTotals.ok).toBe(1);
    expect(snapshot.actions).toEqual({});
    expect(JSON.stringify(snapshot)).not.toContain("Unkeyed label");
});

test("contextMenu stats count keyed submenu loading", () => {
    const menu = createContextMenu({name: "actions-submenu"});

    render(React.createElement(menu.Layer, {
        children: React.createElement("div", null, "target-submenu"),
        other: () => [{
            name: "Parent",
            actionKey: "qa4.parent",
            next: () => [{name: "Child", actionKey: "qa4.child", onClick: () => null}],
        }],
    }));
    fireEvent.contextMenu(screen.getByText("target-submenu"), {clientX: 20, clientY: 30});
    const parentWrapper = screen.getByText("Parent").parentElement?.parentElement;
    if (!parentWrapper) throw new Error("Parent menu wrapper not found");
    fireEvent.mouseEnter(parentWrapper);

    const snapshot = menu.stats.getSnapshot();
    expect(snapshot.actionTotals.submenuOpen).toBe(1);
    expect(snapshot.actionTotals.submenuOk).toBe(1);
    expect(snapshot.actions["qa4.parent"].submenuOpen).toBe(1);
    expect(snapshot.actions["qa4.parent"].submenuOk).toBe(1);
    expect(screen.getByText("Child")).toBeTruthy();
});