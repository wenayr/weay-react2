// Образцы использования agGrid4. Не подключается в прод.
import React, { useEffect } from 'react'
import type { ColDef } from 'ag-grid-community'
import { useAgGrid, AgGridMy, type BufferTable } from './index'

type Row = {
    id: string
    name: string
    price: number
}

// Специфичный конфиг → satisfies: проверка по ColDef<Row>, литеральный тип сохраняется.
const columns = [
    { field: 'name', headerName: 'Название' },
    { field: 'price', headerName: 'Цена' },
] satisfies ColDef<Row>[]

// ─────────────────────────────────────────────────────────────────────────────
// 1. Главный паттерн: контроллер + <AgGridMy controller>. Тема/memo/resize/selection —
//    дефолты внутри AgGridMy; любой проп AgGridReact можно передать и переопределить.
export function StreamingExample() {
    const grid = useAgGrid<Row>()

    // данные из сокета — неважно, готов ли грид: буфер ловит, attach→sync догоняет
    useEffect(() => subscribeSocket(rows => grid.updateData({ newData: rows })), [grid])

    return <AgGridMy<Row> controller={grid} columnDefs={columns} />
}

// 2. Декларативный режим — без контроллера вовсе.
export function DeclarativeExample({ rows }: { rows: Row[] }) {
    return <AgGridMy<Row> data={rows} columnDefs={columns} />
}

// 3. Внешний буфер: обычный объект на уровне модуля (как datum.tableArr в проде) —
//    ушёл с роута → вернулся → грид досинхронизируется из буфера.
const ordersBuffer: BufferTable<Row> = {}

export function PersistAcrossRouteExample() {
    const grid = useAgGrid<Row>({ externalBuffer: ordersBuffer })
    useEffect(() => subscribeSocket(rows => grid.updateData({ newData: rows })), [grid])
    return <AgGridMy<Row> controller={grid} columnDefs={columns} />
}

// 4. Точечное удаление + прямой доступ к api (фильтры, размер, передача в хелперы).
export function ImperativeApiExample() {
    const grid = useAgGrid<Row>({ getId: r => `row-${r.id}` })
    return (
        <>
            <button onClick={() => grid.apiRef.current?.sizeColumnsToFit()}>Подогнать</button>
            <AgGridMy<Row>
                controller={grid}
                columnDefs={columns}
                onCellClicked={e => grid.updateData({ removeData: [{ id: e.data!.id }] })}
            />
        </>
    )
}

// 5. Headless без AgGridMy: спред gridProps на голый <AgGridReact> (режим agGrid3
//    остаётся доступен — AgGridMy лишь обёртка над тем же контроллером):
//
//    <AgGridReact<Row> {...grid.gridProps} columnDefs={columns} />

// заглушка для примера
declare function subscribeSocket(cb: (rows: Row[]) => void): () => void
