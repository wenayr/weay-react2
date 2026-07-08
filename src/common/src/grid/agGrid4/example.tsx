// agGrid4 usage samples. Not included in production.
import React, { useEffect } from 'react'
import type { ColDef } from 'ag-grid-community'
import { useAgGrid, AgGridTable, type BufferTable } from './index'

type Row = {
    id: string
    name: string
    price: number
}

// Specific config -> satisfies: checked against ColDef<Row>, literal type is preserved.
const columns = [
    { field: 'name', headerName: 'Name' },
    { field: 'price', headerName: 'Price' },
] satisfies ColDef<Row>[]

// ─────────────────────────────────────────────────────────────────────────────
// 1. Main pattern: controller + <AgGridTable controller>. Theme/memo/resize/selection
//    defaults live inside AgGridTable; any AgGridReact prop can be passed and overridden.
export function StreamingExample() {
    const grid = useAgGrid<Row>()

    // Socket data can arrive before the grid is ready: the buffer catches it, attach->sync catches up.
    useEffect(() => subscribeSocket(rows => grid.update({ newData: rows })), [grid])

    return <AgGridTable<Row> controller={grid} columnDefs={columns} />
}

// 2. Declarative mode, with no controller at all.
export function DeclarativeExample({ rows }: { rows: Row[] }) {
    return <AgGridTable<Row> data={rows} columnDefs={columns} />
}

// 3. External buffer: a plain object at module level (like datum.tableArr in production).
//    Leave the route, come back, and the grid syncs from the buffer.
const ordersBuffer: BufferTable<Row> = {}

export function PersistAcrossRouteExample() {
    const grid = useAgGrid<Row>({ externalBuffer: ordersBuffer })
    useEffect(() => subscribeSocket(rows => grid.update({ newData: rows })), [grid])
    return <AgGridTable<Row> controller={grid} columnDefs={columns} />
}

// 4. Point removal + direct api access (filters, sizing, passing to helpers).
export function ImperativeApiExample() {
    const grid = useAgGrid<Row>({ getId: r => `row-${r.id}` })
    return (
        <>
            <button onClick={() => grid.fit()}>Fit</button>
            <AgGridTable<Row>
                controller={grid}
                columnDefs={columns}
                onCellClicked={e => grid.remove([{ id: e.data!.id }])}
            />
        </>
    )
}

// 5. Headless without AgGridTable: spread gridProps onto a bare <AgGridReact> (agGrid3 mode
//    remains available; AgGridTable is only a wrapper over the same controller):
//
//    <AgGridReact<Row> {...grid.props} columnDefs={columns} />

// example stub
declare function subscribeSocket(cb: (rows: Row[]) => void): () => void
