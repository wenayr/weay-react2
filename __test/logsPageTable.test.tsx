import React from "react";
import {act, render} from "@testing-library/react";
import type {GridReadyEvent} from "ag-grid-community";
import {useLogsPageTable, type LogsPageTableController} from "../src/internal/logs/logs";
import {createLogsController, createLogsControllerState, type LogEntry} from "../src/internal/logs/logsController";
import {renderBy} from "../src/internal/updateBy";

type Txn = {add: LogEntry<any>[], remove: LogEntry<any>[]};

function makeGrid() {
    const transactions: Txn[] = [];
    const api = {
        sizeColumnsToFit: jest.fn(),
        setFilterModel: jest.fn(),
        destroyFilter: jest.fn(),
        applyTransactionAsync: jest.fn((t: Txn) => {
            transactions.push({add: t.add ?? [], remove: t.remove ?? []});
        }),
    };
    return {transactions, event: {api} as unknown as GridReadyEvent<any>, api};
}

/** limitPer 2 so the third entry for one id evicts the oldest: the interesting case is that
 *  the eviction rides along in the SAME transaction as the addition. */
function makeStack(limitPer = 2) {
    const state = createLogsControllerState();
    const controller = createLogsController({
        options: {limit: 10, limitPer},
        state,
        onFullChange: () => renderBy(state.full),
        onMiniChange: () => renderBy(state.mini),
        onSettingsChange: () => renderBy(state.settings),
    });
    return {state, controller};
}

function Probe({state, onReady}: {state: any, onReady: (c: LogsPageTableController) => void}) {
    const table = useLogsPageTable({full: state.full, settings: state.settings});
    onReady(table);
    return <div/>;
}

const log = (id: string, txt: string) => ({id, txt, time: new Date("2026-01-01T10:00:00")});

test("per-entry sync adds one row per log without touching the rest of the store", () => {
    const {state, controller} = makeStack();
    let table: LogsPageTableController | null = null;
    render(<Probe state={state} onReady={t => { table = t; }}/>);
    const grid = makeGrid();
    act(() => { table!.onGridReady(grid.event); });
    grid.transactions.length = 0;

    act(() => { controller.addLogs(log("a", "one")); });

    expect(grid.transactions).toHaveLength(1);
    expect(grid.transactions[0].add.map(r => r.txt)).toEqual(["one"]);
    expect(grid.transactions[0].remove).toEqual([]);
});

test("an eviction rides in the same transaction as the entry that caused it", () => {
    const {state, controller} = makeStack(2);
    let table: LogsPageTableController | null = null;
    render(<Probe state={state} onReady={t => { table = t; }}/>);
    const grid = makeGrid();
    act(() => { table!.onGridReady(grid.event); });
    grid.transactions.length = 0;

    act(() => { controller.addLogs(log("a", "one")); });
    act(() => { controller.addLogs(log("a", "two")); });
    expect(grid.transactions.flatMap(t => t.remove)).toEqual([]);

    // third entry for id "a" pushes "one" out of the per-id array (limitPer 2)
    act(() => { controller.addLogs(log("a", "three")); });

    expect(grid.transactions).toHaveLength(3);
    const last = grid.transactions[2];
    expect(last.add.map(r => r.txt)).toEqual(["three"]);
    expect(last.remove.map(r => r.txt)).toEqual(["one"]);
});

test("eviction is per id: a different id does not evict rows of another", () => {
    const {state, controller} = makeStack(1);
    let table: LogsPageTableController | null = null;
    render(<Probe state={state} onReady={t => { table = t; }}/>);
    const grid = makeGrid();
    act(() => { table!.onGridReady(grid.event); });
    grid.transactions.length = 0;

    act(() => { controller.addLogs(log("a", "a1")); });
    act(() => { controller.addLogs(log("b", "b1")); });
    expect(grid.transactions.flatMap(t => t.remove)).toEqual([]);

    act(() => { controller.addLogs(log("a", "a2")); });
    expect(grid.transactions[2].add.map(r => r.txt)).toEqual(["a2"]);
    expect(grid.transactions[2].remove.map(r => r.txt)).toEqual(["a1"]);
});

test("a settings write wakes the full channel but applies no duplicate transaction", () => {
    const {state, controller} = makeStack();
    let table: LogsPageTableController | null = null;
    render(<Probe state={state} onReady={t => { table = t; }}/>);
    const grid = makeGrid();
    act(() => { table!.onGridReady(grid.event); });
    act(() => { controller.addLogs(log("a", "one")); });
    grid.transactions.length = 0;

    // params.set fires onFullChange too - the delta is the one already applied
    act(() => { controller.params.set({...controller.params.get(), minVarLogs: 3}); });

    expect(grid.transactions).toEqual([]);
});

test("onGridReady resyncs entries that landed before the grid existed", () => {
    const {state, controller} = makeStack();
    controller.addLogs(log("a", "before-mount-1"));
    controller.addLogs(log("b", "before-mount-2"));

    let table: LogsPageTableController | null = null;
    render(<Probe state={state} onReady={t => { table = t; }}/>);
    // rowData is the mount-time snapshot, so these two arrive with the grid, not as a txn
    expect(table!.gridProps.rowData!.map((r: any) => r.txt)).toEqual(["before-mount-1", "before-mount-2"]);

    const grid = makeGrid();
    act(() => { table!.onGridReady(grid.event); });
    // nothing new since mount -> the reconcile finds no difference
    expect(grid.transactions).toEqual([]);

    act(() => { controller.addLogs(log("a", "after")); });
    expect(grid.transactions[0].add.map(r => r.txt)).toEqual(["after"]);
});

test("resync catches up a grid that missed changes while its api was detached", () => {
    const {state, controller} = makeStack();
    let table: LogsPageTableController | null = null;
    render(<Probe state={state} onReady={t => { table = t; }}/>);

    // no grid attached yet: these changes reach no transaction at all
    act(() => { controller.addLogs(log("a", "missed-1")); });
    act(() => { controller.addLogs(log("a", "missed-2")); });

    const grid = makeGrid();
    act(() => { table!.onGridReady(grid.event); });

    expect(grid.transactions).toHaveLength(1);
    expect(grid.transactions[0].add.map(r => r.txt).sort()).toEqual(["missed-1", "missed-2"]);
});
