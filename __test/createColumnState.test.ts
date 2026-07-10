import {createColumnState} from "../src/common/src/grid/columnState/columnState";

test("createColumnState presentGate is runtime-only and intersects actual presence", () => {
    const cs = createColumnState({
        key: "test.columnState.presentGate",
        columns: [
            {key: "name", title: "Name", fixed: true},
            {key: "price", title: "Price"},
            {key: "empty", title: "Empty"},
        ],
    });

    expect(cs.api.getPresent()).toBeNull();
    expect(cs.api.getConfig().visible.empty).toBe(true);

    cs.api.setPresentGate(["name", "price"]);
    expect(cs.api.getPresent()).toEqual({name: true, price: true});
    expect(cs.api.isPresent("empty")).toBe(false);
    expect(cs.api.getConfig().visible.empty).toBe(true);

    cs.api.setPresent(["name", "empty"]);
    expect(cs.api.getPresent()).toEqual({name: true});

    cs.api.setPresentGate(null);
    expect(cs.api.getPresent()).toEqual({name: true, empty: true});

    cs.api.setPresent(null);
    expect(cs.api.getPresent()).toBeNull();
});

function createFakeGrid(colIds: string[]) {
    const state = new Map(colIds.map(colId => [colId, {colId, hide: false, width: 100, sort: null as null | "asc" | "desc"}]));
    const listeners: Record<string, Array<(event: any) => void>> = {};
    let filterModel: Record<string, unknown> = {};
    return {
        applyColumnState({state: next}: {state: Array<{colId: string, hide?: boolean, width?: number, sort?: "asc" | "desc" | null}>}) {
            for (const patch of next) {
                const current = state.get(patch.colId);
                if (!current) continue;
                if (patch.hide != undefined) current.hide = patch.hide;
                if (typeof patch.width == "number") current.width = patch.width;
                current.sort = patch.sort ?? null;
            }
        },
        setFilterModel(next: Record<string, unknown> | null) { filterModel = next ?? {}; },
        getFilterModel() { return filterModel; },
        getColumnState() { return [...state.values()].map(column => ({...column})); },
        getColumns() { return colIds.map(colId => ({getColId: () => colId})); },
        addEventListener(type: string, callback: (event: any) => void) { (listeners[type] ??= []).push(callback); },
        removeEventListener(type: string, callback: (event: any) => void) {
            listeners[type] = (listeners[type] ?? []).filter(candidate => candidate != callback);
        },
        isDestroyed: () => false,
        userResize(colId: string, width: number) {
            state.get(colId)!.width = width;
            for (const callback of listeners.columnResized ?? []) callback({source: "uiColumnResized", finished: true});
        },
        userHide(colId: string) {
            state.get(colId)!.hide = true;
            for (const callback of listeners.columnVisible ?? []) callback({source: "uiColumnVisible", finished: true});
        },
        hidden(colId: string) { return state.get(colId)?.hide; },
    };
}

test("present-gated grid hiding never overwrites persisted visibility during unrelated grid edits", async () => {
    const cs = createColumnState({
        key: "test.columnState.presentGate.readback",
        columns: [{key: "a", title: "A"}, {key: "b", title: "B"}, {key: "c", title: "C"}],
        saveMs: 1,
    });
    const grid = createFakeGrid(["a", "b", "c"]);
    cs.grid.attach(grid as any);

    cs.api.setPresentGate(["a", "c"]);
    grid.userResize("a", 150);
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(cs.api.getConfig().visible.b).toBe(true);
    cs.api.setPresentGate(null);
    expect(grid.hidden("b")).toBe(false);
});

test("an open present gate still folds an explicit grid visibility edit into config", async () => {
    const cs = createColumnState({
        key: "test.columnState.presentGate.openReadback",
        columns: [{key: "a", title: "A"}, {key: "b", title: "B"}],
        saveMs: 1,
    });
    const grid = createFakeGrid(["a", "b"]);
    cs.grid.attach(grid as any);

    grid.userHide("b");
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(cs.api.getConfig().visible.b).toBe(false);
});

test("preview order is runtime-only and exposed through the shared list source", () => {
    const cs = createColumnState({
        key: "test.columnState.preview",
        columns: [{key: "a", title: "A"}, {key: "b", title: "B"}, {key: "c", title: "C"}],
    });
    const base = cs.api.getConfig().order;
    cs.api.setPreviewOrder(["c", "a", "b"]);
    expect(cs.api.getConfig().order).toEqual(base);
    expect(cs.api.listSource.getBaseConfig().order).toEqual(base);
    expect(cs.api.listSource.getConfig().order).toEqual(["c", "a", "b"]);
    cs.api.setPreviewOrder(null);
    expect(cs.api.listSource.getConfig().order).toEqual(base);
});