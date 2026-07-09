import {timeLocalToStr_hhmmss} from "wenay-common2";
import React, {useCallback, useMemo, useRef} from "react";
import type {CellMouseDownEvent, ColDef, GridApi, GridPreDestroyedEvent, GridReadyEvent} from "ag-grid-community";
import {AgGridTable, colDefCentered, type AgGridTableProps} from "../grid/agGrid4";

export const miniLogsColumnDefs = [
    {
        field: "time",
        sort: "desc",
        width: 50,
        valueFormatter: (e) => e.value ? timeLocalToStr_hhmmss(e.value) : e.value
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
] satisfies ColDef<any>[]

export const miniLogsDefaultColDef = {...colDefCentered, wrapText: true} satisfies ColDef<any>

export type UseMiniLogsTableOptions<T = any> = {
    data: T[]
    onClick?: (e: CellMouseDownEvent<T>) => any
    columnDefs?: ColDef<T>[]
    defaultColDef?: ColDef<T>
}

export type MiniLogsTableController<T = any> = {
    rows: T[]
    columns: ColDef<T>[]
    columnDefs: ColDef<T>[]
    defaultColDef: ColDef<T>
    apiRef: React.RefObject<GridApi<T> | null>
    fit: () => boolean
    getApi: () => GridApi<T> | null
    withApi: <R>(fn: (api: GridApi<T>) => R) => R | undefined
    onGridReady: (e: GridReadyEvent<T>) => void
    onGridPreDestroyed: (e: GridPreDestroyedEvent<T>) => void
    onCellMouseDown: (e: CellMouseDownEvent<T>) => void
    props: AgGridTableProps<T>
    tableProps: AgGridTableProps<T>
    gridProps: AgGridTableProps<T>
}

export type MiniLogsController<T = any> = MiniLogsTableController<T>

export type MiniLogsViewProps<T = any> = {
    controller: MiniLogsTableController<T>
    className?: string
    style?: React.CSSProperties
}

export type MiniLogsTableProps<T = any> = UseMiniLogsTableOptions<T> & {
    className?: string
    style?: React.CSSProperties
}

export function useMiniLogsTable<T = any>(options: UseMiniLogsTableOptions<T>): MiniLogsTableController<T> {
    const {data, onClick, columnDefs, defaultColDef: defaultColDefOverride} = options
    const apiRef = useRef<GridApi<T> | null>(null)
    const columns = useMemo(() => (columnDefs ?? miniLogsColumnDefs) as ColDef<T>[], [columnDefs])
    const defaultColDef = useMemo(
        () => ({...miniLogsDefaultColDef, ...defaultColDefOverride}) as ColDef<T>,
        [defaultColDefOverride]
    )
    const fit = useCallback(() => {
        const api = apiRef.current
        if (!api) return false
        api.sizeColumnsToFit()
        return true
    }, [])
    const getApi = useCallback(() => apiRef.current, [])
    const withApi = useCallback(function withApi<R>(fn: (api: GridApi<T>) => R) {
        const api = apiRef.current
        return api ? fn(api) : undefined
    }, [])
    const onGridReady = useCallback((e: GridReadyEvent<T>) => {
        apiRef.current = e.api
        fit()
    }, [fit])
    const onGridPreDestroyed = useCallback((_e: GridPreDestroyedEvent<T>) => {
        apiRef.current = null
    }, [])
    const onCellMouseDown = useCallback((e: CellMouseDownEvent<T>) => {
        onClick?.(e)
    }, [onClick])
    const props = useMemo<AgGridTableProps<T>>(() => ({
        suppressCellFocus: true,
        onGridReady,
        onGridPreDestroyed,
        defaultColDef,
        headerHeight: 30,
        rowHeight: 26,
        autoSizePadding: 1,
        rowData: data,
        columnDefs: columns,
        onCellMouseDown,
    }), [columns, data, defaultColDef, onCellMouseDown, onGridPreDestroyed, onGridReady])

    return useMemo(() => ({
        rows: data,
        columns,
        columnDefs: columns,
        defaultColDef,
        apiRef,
        fit,
        getApi,
        withApi,
        onGridReady,
        onGridPreDestroyed,
        onCellMouseDown,
        props,
        tableProps: props,
        gridProps: props,
    }), [columns, data, defaultColDef, fit, getApi, onCellMouseDown, onGridPreDestroyed, onGridReady, props, withApi])
}

export function MiniLogsView<T = any>({controller, className, style}: MiniLogsViewProps<T>) {
    const classNames = ["maxSize", className].filter(Boolean).join(" ")
    return <div className={classNames} style={style}>
        <AgGridTable<T> {...controller.props} />
    </div>
}

export function MiniLogsTable<T = any>({className, style, ...options}: MiniLogsTableProps<T>) {
    const table = useMiniLogsTable<T>(options)
    return <MiniLogsView<T> controller={table} className={className} style={style} />
}

export function MiniLogs<T = any>(props: MiniLogsTableProps<T>) {
    return <MiniLogsTable<T> {...props} />
}
