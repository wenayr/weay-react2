import React, {useEffect, useRef, useState} from "react";

import {ColDef, GridReadyEvent} from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import {sleepAsync} from "wenay-common2";
import {updateBy} from "../updateBy";
import {contextMenu} from "../src/menu/menuMouse";
import {applyGridRows} from "../src/utils";

ModuleRegistry.registerModules([AllCommunityModule]);

interface IRow {
    make: string;
    model: string;
    price: number;
    electric: boolean;
}

export const tt = {}

export const GridExample = () => {
    const gridApi = useRef<GridReadyEvent<IRow> | null>(null);
    const rowBuffer = useRef<{[id: string]: Partial<IRow>}>({});

    updateBy(tt, () => {
        const price = Math.round(Math.random() * 90000) + 10000
        applyGridRows<IRow>({
            gridRef: gridApi,
            getId: e => String(e.make),
            bufTable: rowBuffer.current,
            newData: [{make: "Tesla", model: "Model Y", price, electric: true}]
        })
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
                applyGridRows<IRow>({
                    gridRef: gridApi,
                    getId: e => String(e.make),
                    bufTable: rowBuffer.current,
                    newData: [{make: "Tesla", price: 55555}]
                })
            })
    }, [])

    return (
        <div style={{ width: "100%", height: "100%" }}>
            <button onClick={() => applyGridRows<IRow>({gridRef: gridApi, getId: e => String(e.make), bufTable: rowBuffer.current, removeData: [{make: "Tesla"}]})}>remove Tesla</button>
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
