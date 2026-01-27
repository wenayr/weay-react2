import React, {StrictMode, useEffect, useRef, useState} from "react";

import {
    ColDef,
    colorSchemeDarkBlue,
    GridApi,
    GridReadyEvent,
    iconSetMaterial,
    provideGlobalGridOptions,
    themeAlpine
} from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import {applyTransactionAsyncUpdate} from "../src/applyTransactionAsyncUpdate";
import {sleepAsync} from "wenay-common";
import {renderBy, updateBy} from "../updateBy";
import {mouseMenuApi} from "../src/menu/menuMouse";

ModuleRegistry.registerModules([AllCommunityModule]);

// // Register all community features
// ModuleRegistry.registerModules([AllCommunityModule]);
// const theme = themeAlpine
//     .withPart(colorSchemeDarkBlue)
//     .withPart(iconSetMaterial)
//     .withParams({
//         'fontFamily': 'Roboto',
//         'fontSize': '12px',
//         'backgroundColor' :'rgb(24,27,33)'
//     });
// // Mark all grids as using legacy themes
// provideGlobalGridOptions({ theme: theme});


// Row Data Interface
interface IRow {
    make: string;
    model: string;
    price: number;
    electric: boolean;
}

export const tt = {}
// Create new GridExample component
export const GridExample = () => {

    updateBy(tt, () => {
        applyTransactionAsyncUpdate<IRow>(gridApi.current, [{make: "Tesla", price: 7777}], e=> e.make, {})
    })
    // Row Data: The data to be displayed.
    const [rowData, setRowData] = useState<IRow[]>([
        { make: "Tesla", model: "Model Y", price: 64950, electric: true },
        { make: "Ford", model: "F-Series", price: 33850, electric: false },
        { make: "Toyota", model: "Corolla", price: 29600, electric: false },
        { make: "Mercedes", model: "EQA", price: 48890, electric: true },
        { make: "Fiat", model: "500", price: 15774, electric: false },
        { make: "Nissan", model: "Juke", price: 20675, electric: false },
    ]);

    // Column Definitions: Defines & controls grid columns.
    const [colDefs, setColDefs] = useState<ColDef<IRow>[]>([
        { field: "make" },
        { field: "model" },
        { field: "price" },
        { field: "electric" },
    ]);

    const defaultColDef: ColDef = {
        flex: 1,
    };
    const gridApi = useRef<null| GridReadyEvent<IRow>>(null);

    useEffect(() => {
        sleepAsync(1000)
            .then(e=>{
                applyTransactionAsyncUpdate<IRow>(gridApi.current, [{make: "Tesla", price: 55555}], e=> e.make, {})
            })
    })

    // Container: Defines the grid's theme & dimensions.
    return (
        <div style={{ width: "100%", height: "100%" }}>
    <AgGridReact
        onGridReady={e=> {
            gridApi.current = e

        }}
        onCellMouseDown={()=>{

            mouseMenuApi.map.set("sym",[
                {
                    name: "test", onClick: ()=> {console.log("test")}
                }
            ])
        }}
        getRowId={e=>e.data.make}
        rowData={rowData}
        columnDefs={colDefs}
        defaultColDef={defaultColDef}
    />
    </div>
);
};
