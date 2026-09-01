import React, {useEffect, useRef, useState} from "react";
import type {RefObject} from "react";

import {ColDef, GridReadyEvent} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import {sleepAsync} from "wenay-common2/client";
import {updateBy} from "../../internal/updateBy.js";
import {contextMenu} from "../../internal/menu/menuMouse.js";
import {ensureAgGridModules} from "../../internal/grid/agGrid4/index.js";

ensureAgGridModules();

interface IRow {
    make: string;
    model: string;
    price: number;
    electric: boolean;
}

/** utils/gridRows.ts (applyGridRows) was removed in 2.0.0 - it was dead code in the library
 *  that dragged ag-grid into the "self-contained" utils leaf, and this QA stand was its only
 *  caller. The upsert/remove it needs is a few lines of the ag-grid API. */
function upsertRows(
    gridRef: RefObject<GridReadyEvent<IRow> | null>,
    buf: {[id: string]: Partial<IRow>},
    rows: Partial<IRow>[],
    mode: "upsert" | "remove" = "upsert",
) {
    const api = gridRef.current?.api;
    const add: IRow[] = [], update: IRow[] = [], remove: IRow[] = [];

    for (const row of rows) {
        const id = String(row.make);
        if (mode === "remove") {
            delete buf[id];
            const existing = api?.getRowNode(id)?.data;
            if (existing) remove.push(existing);
            continue;
        }
        const merged = {...(buf[id] ?? {}), ...row} as IRow;
        buf[id] = merged;
        (api?.getRowNode(id) ? update : add).push(merged);
    }

    if (api && (add.length || update.length || remove.length))
        api.applyTransaction({add, update, remove});
}

export const tt = {}

export const GridExample = () => {
    const gridApi = useRef<GridReadyEvent<IRow> | null>(null);
    const rowBuffer = useRef<{[id: string]: Partial<IRow>}>({});

    updateBy(tt, () => {
        const price = Math.round(Math.random() * 90000) + 10000
        upsertRows(gridApi, rowBuffer.current, [{make: "Tesla", model: "Model Y", price, electric: true}])
    })

    const [rowData] = useState<IRow[]>([
        { make: "Tesla", model: "Model Y", price: 64950, electric: true },
        { make: "Ford", model: "F-Series", price: 33850, electric: false },
        { make: "Toyota", model: "Corolla", price: 29600, electric: false },
        { make: "Mercedes", model: "EQA", price: 48890, electric: true },
        { make: "Fiat", model: "500", price: 15774, electric: false },
        { make: "Nissan", model: "Juke", price: 20675, electric: false },
    ]);

    const [colDefs] = useState<ColDef<IRow>[]>([
        { field: "make" },
        { field: "model" },
        { field: "price" },
        { field: "electric" },
    ]);

    const defaultColDef: ColDef = {
        flex: 1,
    };

    useEffect(() => {
        sleepAsync(1000)
            .then(() => {
                upsertRows(gridApi, rowBuffer.current, [{make: "Tesla", price: 55555}])
            })
    }, [])

    return (
        <div style={{ width: "100%", height: "100%" }}>
            <button onClick={() => upsertRows(gridApi, rowBuffer.current, [{make: "Tesla"}], "remove")}>remove Tesla</button>
            <AgGridReact
                onGridReady={e => {
                    gridApi.current = e
                }}
                onCellMouseDown={(e) => {
                    const event = e.event;
                    if (event instanceof MouseEvent) contextMenu.openAt(event, [
                        {
                            name: "test", onClick: () => {console.log("test")}
                        }
                    ]);
                }}
                getRowId={e => e.data.make}
                rowData={rowData}
                columnDefs={colDefs}
                defaultColDef={defaultColDef}
            />
        </div>
    );
};
