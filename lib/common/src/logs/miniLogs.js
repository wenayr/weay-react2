import { jsx as _jsx } from "react/jsx-runtime";
import { timeLocalToStr_hhmmss } from "wenay-common";
import { AgGridReact } from "ag-grid-react";
import { useRef } from "react";
export function MiniLogs({ data, onClick }) {
    const apiGrid = useRef(null);
    const columns = [
        {
            field: "time",
            sort: "desc",
            width: 50,
            valueFormatter: (e) => e.value.time ? timeLocalToStr_hhmmss(e.value.time) : e.value.time
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
    ];
    return _jsx("div", { className: "maxSize", children: _jsx(AgGridReact
        // className = "ag-theme-alpine-dark ag-theme-alpine2" // ag-theme-alpine-dark3
        , { 
            // className = "ag-theme-alpine-dark ag-theme-alpine2" // ag-theme-alpine-dark3
            suppressCellFocus: true, onGridReady: (a) => {
                apiGrid.current = a; //as GridReadyEvent<tColum>
                apiGrid.current.api.sizeColumnsToFit();
            }, defaultColDef: {
                headerClass: () => ("gridTable-header"),
                resizable: true,
                cellStyle: { textAlign: "center" },
                sortable: true,
                filter: true,
                wrapText: true,
            }, headerHeight: 30, rowHeight: 26, autoSizePadding: 1, rowData: data, columnDefs: columns, onCellMouseDown: (e) => {
                // @ts-ignore
                onClick?.(e);
                // if (e.event?.button == 2) {
                //     // copyToClipboard(e.value)
                //     mouseAdd.map.set("sym",[
                //         {
                //             name: "copy", onClick: ()=> {copyToClipboard(e.value)}
                //         }
                //     ])
                // }
            } }) });
}
