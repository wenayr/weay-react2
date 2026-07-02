// Layer 2 (React): headless hook over the core + custom <AgGridMy> component.
// The hook does NOT render; it returns a controller. AgGridMy is our AgGridReact with
// project defaults (theme, memo, auto sizing, selection, lifecycle). Wiring is the
// controller prop; bare <AgGridReact> can still spread gridProps (as in agGrid3).
import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact, AgGridReactProps } from 'ag-grid-react'
import type { GridApi, GetRowIdParams, GridPreDestroyedEvent, GridReadyEvent } from 'ag-grid-community'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import { createGridBuffer, type BufferTable, type GetId } from './core'
import { useAgGridTheme } from './theme'

// ag-grid v35 requires module registration. Do it lazily and once, on the first hook
// use, not when the package is imported (the entry stays side-effect-free).
// Re-registration by a consumer that already calls GridStyleDefault() is harmless.
let modulesRegistered = false
function ensureAgGridModules() {
    if (modulesRegistered) return
    modulesRegistered = true
    ModuleRegistry.registerModules([AllCommunityModule])
}

export type UseAgGridOptions<T> = {
    /** How to get a row id. Defaults to the `id` field. Captured once (first render). */
    getId?: GetId<T>
    /** External buffer: a plain object above the component (like datum.tableArr) that survives route remounts. */
    externalBuffer?: BufferTable<T>
}

/**
 * Headless table hook. All race handling lives in the core; the hook only binds it
 * to the React and grid lifecycle:
 *
 *   const grid = useAgGrid<Row>({ getId })
 *   <AgGridMy<Row> controller={grid} columnDefs={cols} />
 *   grid.update({ newData })
 */
export function useAgGrid<T>(options?: UseAgGridOptions<T>) {
    ensureAgGridModules()
    const apiRef = useRef<GridApi<T> | null>(null)

    // The core is created once; dependencies live in its closure, with no useCallback chains.
    const [core] = useState(function createCore() {
        const getId: GetId<T> = options?.getId ?? (data => String((data as any)?.id))
        return createGridBuffer<T>({ getId, externalBuffer: options?.externalBuffer })
    })

    const gridProps = useMemo(() => ({
        getRowId(params: GetRowIdParams<T>) {
            return core.api.getId(params.data)
        },
        onGridReady(event: GridReadyEvent<T>) {
            apiRef.current = event.api
            core.control.attach(event.api) // attach runs sync and catches up with the race
        },
        onGridPreDestroyed(_event: GridPreDestroyedEvent<T>) {
            apiRef.current = null
            core.control.detach()
        },
    }), [core])

    return useMemo(() => {
        const fit = () => {
            const api = apiRef.current
            if (!api) return false
            api.sizeColumnsToFit()
            return true
        }
        return {
            update: core.api.updateData,
            remove(rows: Partial<T>[]) {
                core.api.updateData({ removeData: rows })
            },
            fit,
            updateData: core.api.updateData,
            sync: core.api.sync,
            getId: core.api.getId,
            buffer: core.api.buffer,
            apiRef,
            props: gridProps,
            gridProps,
            getApi() {
                return apiRef.current
            },
            withApi<R>(fn: (api: GridApi<T>) => R) {
                const api = apiRef.current
                return api ? fn(api) : undefined
            },
            sizeColumnsToFit: fit,
        }
    }, [core, gridProps])
}

export type AgGridController<T> = ReturnType<typeof useAgGrid<T>>

// --- AgGridMy: our grid with project defaults --------------------------------

// v35: the canonical row-selection form is an object, not the legacy "multiple" string.
// Stable module-level reference so the grid does not re-evaluate the option on each render.
const ROW_SELECTION = { mode: 'multiRow' } as const

export type AgGridMyProps<T> = AgGridReactProps<T> & {
    /** Controller from useAgGrid: all wiring (getRowId, ready/destroy, sync) is inside. */
    controller?: AgGridController<T>
    /** Declarative row upsert for simple cases without a controller. */
    data?: Partial<T>[]
    /** Auto-fit columns to the container. Defaults to true. */
    autoSizeColumns?: boolean
}

function AgGridMyInner<T>(props: AgGridMyProps<T>) {
    const {
        controller, data, autoSizeColumns = true,
        defaultColDef, theme, getRowId, onGridReady, onGridPreDestroyed,
        ...rest
    } = props

    // Own controller for declarative mode (without an external controller); the hook is unconditional.
    const own = useAgGrid<T>()
    const grid = controller ?? own
    const defaultTheme = useAgGridTheme()
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(function pushData() {
        if (data) grid.update({ newData: data })
    }, [data, grid])

    useEffect(function observeResize() {
        if (!containerRef.current || !autoSizeColumns) return
        let rafId = 0
        const observer = new ResizeObserver(function fitColumns(entries) {
            // one observed element: the last entry is the latest size; one RAF per batch,
            // cancelled on cleanup so fit() cannot hit a grid mid-destroy
            const entry = entries[entries.length - 1]
            if (entry.contentRect.width < 400) return
            cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(() => grid.fit())
        })
        observer.observe(containerRef.current)
        return () => {
            cancelAnimationFrame(rafId)
            observer.disconnect()
        }
    }, [autoSizeColumns, grid])

    const mergedColDef = useMemo(
        () => ({ sortable: true, resizable: true, filter: true, ...defaultColDef }),
        [defaultColDef],
    )

    return (
        <div ref={containerRef} style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
            <AgGridReact<T>
                theme={theme ?? defaultTheme}
                asyncTransactionWaitMillis={50}
                suppressCellFocus
                rowSelection={ROW_SELECTION}
                {...rest}
                defaultColDef={mergedColDef}
                // getRowId after the spread: undefined from rest must not erase the wiring,
                // otherwise the grid falls back to index-based row identity.
                getRowId={getRowId ?? grid.props.getRowId}
                onGridReady={function ready(event) {
                    grid.props.onGridReady(event)
                    if (autoSizeColumns) event.api.sizeColumnsToFit()
                    onGridReady?.(event)
                }}
                onGridPreDestroyed={function destroyed(event) {
                    grid.props.onGridPreDestroyed(event)
                    onGridPreDestroyed?.(event)
                }}
            />
        </div>
    )
}

// memo: the grid does not re-render from unrelated page state; data updates bypass
// render (controller.updateData). The cast is required because memo() erases the component generic.
export const AgGridMy = memo(AgGridMyInner) as typeof AgGridMyInner
