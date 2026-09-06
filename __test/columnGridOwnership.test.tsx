import {createColumnGrid} from "../src/internal/grid/columnState/columnGrid";

/** Minimal GridApi double: records applyColumnState calls and event listeners. */
function fakeGrid(colIds: string[]) {
    const applied: unknown[] = [];
    const listeners = new Map<string, Set<(e: unknown) => void>>();
    const api = {
        applyColumnState(s: unknown) { applied.push(s); },
        getColumnState: () => colIds.map(colId => ({colId, hide: false, width: 100, sort: null})),
        getFilterModel: () => ({}),
        setFilterModel() {},
        getColumns: () => colIds.map(colId => ({getColId: () => colId})),
        addEventListener(t: string, cb: (e: unknown) => void) { (listeners.get(t) ?? listeners.set(t, new Set()).get(t)!).add(cb); },
        removeEventListener(t: string, cb: (e: unknown) => void) { listeners.get(t)?.delete(cb); },
        isDestroyed: () => false,
        sizeColumnsToFit() {},
    };
    return {api: api as any, applied, listenerCount: () => [...listeners.values()].reduce((n, s) => n + s.size, 0)};
}

test("a destroyed OLDER table does not detach the newer grid; dispose releases the attached grid", () => {
    const grid = createColumnGrid<{id: string}>({
        key: "test.columnGrid.ownership",
        columns: [{key: "a", title: "A"}, {key: "b", title: "B"}],
        toolbar: false,
        chrome: false,
    });
    const props = grid.tableProps();
    const g1 = fakeGrid(["a", "b"]);
    const g2 = fakeGrid(["a", "b"]);
    props.onGridReady!({api: g1.api} as any);
    props.onGridReady!({api: g2.api} as any);
    expect(g1.listenerCount()).toBe(0);          // re-attach moved the state to g2
    expect(g2.listenerCount()).toBeGreaterThan(0);

    props.onGridPreDestroyed!({api: g1.api} as any); // old table goes away
    expect(g2.listenerCount()).toBeGreaterThan(0);   // ...and the live grid stays attached
    const before = g2.applied.length;
    grid.api.show("b", false);
    expect(g2.applied.length).toBe(before + 1);      // edits still reach the live grid

    grid.dispose();
    expect(g2.listenerCount()).toBe(0);
    const after = g2.applied.length;
    grid.api.show("b", true);
    expect(g2.applied.length).toBe(after);           // disposed: nothing reaches the grid
});
