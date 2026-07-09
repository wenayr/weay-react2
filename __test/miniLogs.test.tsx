import React from "react";
import {render} from "@testing-library/react";
import type {CellMouseDownEvent, ColDef, GridApi, GridReadyEvent} from "ag-grid-community";
import {type MiniLogsTableController, useMiniLogsTable} from "../src/common/src/logs/miniLogs";

type Row = {
    time: Date
    id: string
    var: number
    txt: string
    address: string
}

function HookProbe(props: {
    rows: Row[]
    onClick?: (e: CellMouseDownEvent<Row>) => void
    columnDefs?: ColDef<Row>[]
    defaultColDef?: ColDef<Row>
    onReady: (api: MiniLogsTableController<Row>) => void
}) {
    const api = useMiniLogsTable<Row>({
        data: props.rows,
        onClick: props.onClick,
        columnDefs: props.columnDefs,
        defaultColDef: props.defaultColDef,
    })
    props.onReady(api)
    return null
}

test("useMiniLogsTable exposes the compatibility table props without changing row identity", () => {
    const rows: Row[] = [
        {time: new Date("2026-01-01T10:00:00"), id: "same-source", var: 1, txt: "one", address: "A"},
        {time: new Date("2026-01-01T10:00:01"), id: "same-source", var: 2, txt: "two", address: "B"},
    ]
    const onClick = jest.fn()
    let controller: MiniLogsTableController<Row> | null = null

    render(<HookProbe rows={rows} onClick={onClick} onReady={api => { controller = api; }} />)

    expect(controller).not.toBeNull()
    const api = controller!
    expect(api.rows).toBe(rows)
    expect(api.props.rowData).toBe(rows)
    expect(api.props).not.toHaveProperty("data")
    expect(api.columnDefs.map(col => col.field)).toEqual(["time", "id", "var", "txt", "address"])
    expect(api.props.headerHeight).toBe(30)
    expect(api.props.rowHeight).toBe(26)
    expect(api.defaultColDef.wrapText).toBe(true)

    const event = {data: rows[0]} as CellMouseDownEvent<Row>
    api.onCellMouseDown(event)
    expect(onClick).toHaveBeenCalledWith(event)
})

test("useMiniLogsTable allows custom columns/defaults and exposes grid control helpers", () => {
    const rows: Row[] = []
    const columnDefs: ColDef<Row>[] = [{field: "txt", width: 120}]
    let controller: MiniLogsTableController<Row> | null = null

    render(<HookProbe
        rows={rows}
        columnDefs={columnDefs}
        defaultColDef={{filter: false, minWidth: 25}}
        onReady={api => { controller = api; }}
    />)

    expect(controller).not.toBeNull()
    const api = controller!
    expect(api.columnDefs).toBe(columnDefs)
    expect(api.defaultColDef.filter).toBe(false)
    expect(api.defaultColDef.minWidth).toBe(25)
    expect(api.fit()).toBe(false)
    expect(api.getApi()).toBeNull()

    const gridApi = {sizeColumnsToFit: jest.fn()} as unknown as GridApi<Row>
    api.onGridReady({api: gridApi} as GridReadyEvent<Row>)
    expect(api.getApi()).toBe(gridApi)
    expect(gridApi.sizeColumnsToFit).toHaveBeenCalledTimes(1)
    expect(api.withApi(active => active)).toBe(gridApi)
})
