import {copyToClipboard, timeLocalToStr_hhmmss} from "wenay-common";
import {AgGridReact} from "ag-grid-react";
import React, {useRef} from "react";
import {CellMouseDownEvent, GridReadyEvent} from "ag-grid-community";

export function MiniLogs({data, onClick}:{data: any[], onClick?: (e: CellMouseDownEvent<any, any>) => any}){
    const apiGrid = useRef<GridReadyEvent<any, any> | null>(null);
    const columns = [
        {
            field: "time",
            sort: "desc",
            width: 50,
            valueFormatter: (e: any)=>e.value.time ? timeLocalToStr_hhmmss(e.value.time) : e.value.time
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
    return <div className={"maxSize"}>
        <AgGridReact
            // className = "ag-theme-alpine-dark ag-theme-alpine2" // ag-theme-alpine-dark3
            suppressCellFocus = {true}
            onGridReady = {(a)=>{
                apiGrid.current = a  //as GridReadyEvent<tColum>
                apiGrid.current.api.sizeColumnsToFit()
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
            rowData = {data }
            columnDefs = {columns as any}
            onCellMouseDown = {(e)=>{
                // @ts-ignore
                onClick?.(e)
                // if (e.event?.button == 2) {
                //     // copyToClipboard(e.value)
                //     mouseAdd.map.set("sym",[
                //         {
                //             name: "copy", onClick: ()=> {copyToClipboard(e.value)}
                //         }
                //     ])
                // }
            }}
        ></AgGridReact>
    </div>
}
