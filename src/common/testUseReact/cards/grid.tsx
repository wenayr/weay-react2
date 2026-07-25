import React, { useState, useMemo, useEffect } from "react";
import { useAgGrid, AgGridTable, createGridBuffer, createColumnBuffer, renderBy, type BufferTable } from "../../api";
import type { ColDef, ColGroupDef } from "ag-grid-community";
import { GridExample, tt } from "../useGrid";
import { Check } from "../standKit";


/* ---------- 12. agGrid4: controller + external buffer ---------- */
type tQARow = { id: string; name: string; price: number };
const agQABuffer: BufferTable<tQARow> = {}; // module-level buffer that survives grid remounts
const agQACols = [
    { field: "name", headerName: "Name" },
    { field: "price", headerName: "Price" },
] satisfies ColDef<tQARow>[];
const rndPrice = () => +(Math.random() * 1000).toFixed(2);

const AgGrid4Inner = () => {
    const grid = useAgGrid<tQARow>({ externalBuffer: agQABuffer });
    return (
        <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <button onClick={() => grid.update({ newData: [{ id: "tsla", name: "Tesla", price: rndPrice() }] })}>add/update Tesla</button>
                <button onClick={() => grid.update({ newData: [{ id: "aapl", name: "Apple", price: rndPrice() }] })}>add/update Apple</button>
                <button onClick={() => grid.update({ removeData: [{ id: "tsla" }] })}>remove Tesla</button>
                <button onClick={() => grid.fit()}>fit via API</button>
            </div>
            <div style={{ height: 220 }}><AgGridTable<tQARow> controller={grid} columnDefs={agQACols} /></div>
        </div>
    );
};

const AgGrid4Demo = () => {
    const [on, setOn] = useState(true);
    return (
        <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <button onClick={() => setOn(v => !v)}>{on ? "unmount grid" : "mount grid"}</button>
                <button onClick={() => { agQABuffer["msft"] = { id: "msft", name: "Microsoft (outside the grid)", price: rndPrice() }; }}>write MSFT directly to the buffer</button>
            </div>
            {on ? <AgGrid4Inner /> : <div style={{ padding: 20, color: "#57606a" }}>grid is unmounted - buffer lives in the module</div>}
        </div>
    );
};


/* ---------- 15. agGrid4: overlay over declarative rowData ---------- */
type tOverlayRow = { id: string; name: string; price?: number; note?: string };
const overlayColumns = [
    { field: "id", width: 90 },
    { field: "name" },
    { field: "price", headerName: "Stream price" },
    { field: "note" },
] satisfies ColDef<tOverlayRow>[];

const AgGrid4OverlayDemo = () => {
    const [showC, setShowC] = useState(false);
    const [core] = useState(() => createGridBuffer<tOverlayRow>({
        getId: row => String(row.id),
        mode: "overlay",
        pushDefaults: { add: false },
    }));
    const grid = useAgGrid({ core });
    const rows = useMemo<tOverlayRow[]>(() => [
        { id: "a", name: "Alpha", note: "owned by rowData" },
        { id: "b", name: "Beta", note: "owned by rowData" },
        ...(showC ? [{ id: "c", name: "Gamma", note: "appears only after rowData adds it" }] : []),
    ], [showC]);

    useEffect(() => {
        core.api.sync();
    }, [core, rows]);

    return (
        <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <button onClick={() => core.api.updateData({ newData: [{ id: "a", price: rndPrice() }] })}>stream update A</button>
                <button onClick={() => core.api.updateData({ newData: [{ id: "c", price: 777 }] })}>stream C before rowData</button>
                <button onClick={() => setShowC(v => !v)}>{showC ? "remove C from rowData" : "add C to rowData"}</button>
                <button onClick={() => grid.sync()}>sync overlay</button>
            </div>
            <div style={{ height: 230 }}>
                <AgGridTable<tOverlayRow>
                    controller={grid}
                    rowData={rows}
                    columnDefs={overlayColumns}
                    getRowId={p => p.data.id}
                />
            </div>
        </div>
    );
};


/* ---------- 16. agGrid4: dynamic column buffer ---------- */
type tDynamicRow = { id: string; symbol: string; [key: string]: string | number };
const dynamicRows: tDynamicRow[] = [
    { id: "btc", symbol: "BTCUSDT", alpha: 11, beta: 21, gamma: 31 },
    { id: "eth", symbol: "ETHUSDT", alpha: 12, beta: 22, gamma: 32 },
];
const dynamicBaseCols = [
    { field: "symbol", width: 130 },
    { headerName: "Dynamic", groupId: "qa-dynamic", children: [] },
] satisfies (ColDef<tDynamicRow> | ColGroupDef<tDynamicRow>)[];

const buildDynamicCol = (name: string): ColDef<tDynamicRow> => ({
    colId: `dynamic:${name}`,
    field: name,
    headerName: name,
    width: 100,
});

function buildDynamicColumnDefs(names: readonly string[]) {
    return dynamicBaseCols.map(col =>
        "children" in col && col.groupId == "qa-dynamic"
            ? { ...col, children: names.map(buildDynamicCol) }
            : col,
    );
}

const AgGrid4ColumnBufferDemo = () => {
    const [columns] = useState(() => createColumnBuffer<tDynamicRow>());

    return (
        <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <button onClick={() => columns.api.setNames(["alpha"])}>alpha</button>
                <button onClick={() => columns.api.setNames(["alpha", "beta"])}>alpha + beta</button>
                <button onClick={() => columns.api.setNames(["gamma", "alpha", "gamma"])}>gamma + alpha</button>
                <button onClick={() => columns.api.setNames([])}>clear dynamic</button>
            </div>
            <div style={{ height: 230 }}>
                <AgGridTable<tDynamicRow>
                    rowData={dynamicRows}
                    getRowId={p => p.data.id}
                    columnDefs={dynamicBaseCols}
                    onGridReady={event => columns.control.attach(event.api, {
                        apply: ({ api, names }) => api.setGridOption("columnDefs", buildDynamicColumnDefs(names)),
                    })}
                    onGridPreDestroyed={() => columns.control.detach()}
                />
            </div>
        </div>
    );
};



/* ---------- card wrappers ---------- */

export function Card5() {
    return (
    <Check n={5} title="Grid + transactions (applyGridRows)"
                       do="update Tesla uses a random price and updates by ID. Then remove Tesla should make the row disappear."
                       expect="Update by ID without duplicates. remove Tesla removes the row. ✅ Remove-only updates used to be lost, leaving the row in place."
                       note="Fix: applyGridRows applies remove once, INDEPENDENTLY of add/update. Previously remove was lost when add/update were empty, and duplicated when both were present."
                       tall>
                    <div>
                        <button style={{ marginBottom: 8 }} onClick={() => renderBy(tt)}>update Tesla (random price)</button>
                        <div style={{ height: 280 }}><GridExample /></div>
                    </div>
                </Check>
    );
}

export function Card12() {
    return (
    <Check n={12} title="agGrid4 - controller, removal, external buffer"
                       do="add/update Tesla and Apple should make rows appear/update. remove Tesla should remove it. Then: unmount grid -> write MSFT directly to the buffer -> mount grid."
                       expect="Updates by ID have no duplicates; removal works. After remount, the grid catches up with the buffer itself: Tesla/Apple are still present, MSFT appears (attach->sync). Theme is dark, like production grids (GridStyleDefault)."
                       note="Controller path over createGridBuffer; the old transaction helper names were removed. The createGridBuffer core also works outside React."
                       tall>
                    <AgGrid4Demo />
                </Check>
    );
}

export function Card15() {
    return (
    <Check n={15} title="agGrid4 - overlay rowData"
                       do="Click stream C before rowData. C must not appear. Then add C to rowData: C appears and receives the buffered stream price. Stream A updates A only."
                       expect="Overlay sync updates only rowData-owned rows, never adds stream-only rows and never removes rowData rows."
                       note="This covers selectHistory/portfolio/symbol tables where React state owns the row set."
                       tall>
                    <AgGrid4OverlayDemo />
                </Check>
    );
}

export function Card16() {
    return (
    <Check n={16} title="agGrid4 - dynamic column buffer"
                       do="Switch alpha / alpha+beta / gamma+alpha / clear. Reloading the stand should keep the component API path clean; detach itself does not clear names."
                       expect="The explicit dynamic group shows exactly the selected columns, deduped and in order. Base columns remain intact."
                       note="This covers dynamic add/remove columns without any business-specific default in the shared utility."
                       tall>
                    <AgGrid4ColumnBufferDemo />
                </Check>
    );
}
