import {timeLocalToStr_hhmmss} from "wenay-common2";
import {AgGridReact} from "ag-grid-react";
import React from "react";
import {CellMouseDownEvent, ColDef} from "ag-grid-community";

const columns: ColDef[] = [
    {
        field: "time",
        sort: "desc",
        width: 50,
        valueFormatter: (e)=>e.value ? timeLocalToStr_hhmmss(e.value) : e.value
    },
    {
        field: "id",
        width: 20,
    },
    {
        field: "var",
        width: 50,
    },
    {
        field: "txt",
        wrapText: true,
        autoHeight: true,
        width: 350
    },
    {
        field: "address",
        width: 150,
    },
]

export function MiniLogs<T = any>({data, onClick}:{data: T[], onClick?: (e: CellMouseDownEvent<T>) => any}){
    return <div className={"maxSize"}>
        <AgGridReact<T>
            suppressCellFocus = {true}
            onGridReady = {(a)=>{
                a.api.sizeColumnsToFit()
            }}
            defaultColDef = {{
                headerClass: ()=> ("gridTable-header"),
                resizable: true,
                cellStyle: {textAlign: "center"},
                sortable: true,
                filter: true,
                wrapText: true,
            }}
            headerHeight = {30}
            rowHeight = {26}
            autoSizePadding = {1}
            rowData = {data}
            columnDefs = {columns as ColDef<T>[]}
            onCellMouseDown = {(e)=>{
                onClick?.(e)
            }}
        ></AgGridReact>
    </div>
}
