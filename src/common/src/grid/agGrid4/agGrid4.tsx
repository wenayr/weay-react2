// Слой 2 (React): headless-хук поверх ядра + свой компонент <AgGridMy>.
// Хук НЕ рендерит — отдаёт контроллер. AgGridMy — наш AgGridReact с проектными
// дефолтами (тема, memo, авторазмер, selection, lifecycle). Связка — проп controller;
// для голого <AgGridReact> остаётся спред gridProps (как в agGrid3).
import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact, AgGridReactProps } from 'ag-grid-react'
import type { GridApi, GetRowIdParams, GridPreDestroyedEvent, GridReadyEvent } from 'ag-grid-community'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import { createGridBuffer, type BufferTable, type GetId } from './core'
import { useAgGridTheme } from './theme'

// ag-grid v35 требует регистрации модулей. Лениво и один раз — при первом
// использовании хука, а не при импорте пакета (вход остаётся side-effect-free).
// Повторная регистрация у потребителя, который уже зовёт GridStyleDefault(), безвредна.
let modulesRegistered = false
function ensureAgGridModules() {
    if (modulesRegistered) return
    modulesRegistered = true
    ModuleRegistry.registerModules([AllCommunityModule])
}

export type UseAgGridOptions<T> = {
    /** Как достать id строки. По умолчанию — поле `id`. Захватывается один раз (первый рендер). */
    getId?: GetId<T>
    /** Внешний буфер: обычный объект выше компонента (как datum.tableArr) — переживает ремаунт роута. */
    externalBuffer?: BufferTable<T>
}

/**
 * Headless-хук таблицы. Вся логика гонок — в ядре (core), хук лишь привязывает его
 * к жизненному циклу React и грида:
 *
 *   const grid = useAgGrid<Row>({ getId })
 *   <AgGridMy<Row> controller={grid} columnDefs={cols} />
 *   grid.updateData({ newData })
 */
export function useAgGrid<T>(options?: UseAgGridOptions<T>) {
    ensureAgGridModules()
    const apiRef = useRef<GridApi<T> | null>(null)

    // ядро создаётся один раз; зависимости живут в его замыкании — без useCallback-цепочек
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
            core.control.attach(event.api) // attach делает sync — догоняет гонку
        },
        onGridPreDestroyed(_event: GridPreDestroyedEvent<T>) {
            apiRef.current = null
            core.control.detach()
        },
    }), [core])

    return {
        updateData: core.api.updateData,
        sync: core.api.sync,
        getId: core.api.getId,
        buffer: core.api.buffer,
        apiRef,
        gridProps,
    }
}

export type AgGridController<T> = ReturnType<typeof useAgGrid<T>>

// ─── AgGridMy: наш грид с проектными дефолтами ───────────────────────────────

// v35: каноничная форма выбора строк — объект, не легаси-строка "multiple".
// Стабильная ссылка (module-level), чтобы грид не переоценивал опцию каждый рендер.
const ROW_SELECTION = { mode: 'multiRow' } as const

export type AgGridMyProps<T> = AgGridReactProps<T> & {
    /** Контроллер из useAgGrid: вся связка (getRowId, ready/destroy, sync) — внутри. */
    controller?: AgGridController<T>
    /** Декларативный апсерт строк — для простых случаев без контроллера. */
    data?: Partial<T>[]
    /** Автоширина колонок под контейнер. По умолчанию true. */
    autoSizeColumns?: boolean
}

function AgGridMyInner<T>(props: AgGridMyProps<T>) {
    const {
        controller, data, autoSizeColumns = true,
        defaultColDef, theme, getRowId, onGridReady, onGridPreDestroyed,
        ...rest
    } = props

    // свой контроллер для декларативного режима (без controller снаружи); хук безусловный
    const own = useAgGrid<T>()
    const grid = controller ?? own
    const defaultTheme = useAgGridTheme()
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(function pushData() {
        if (data) grid.updateData({ newData: data })
    }, [data, grid])

    useEffect(function observeResize() {
        if (!containerRef.current || !autoSizeColumns) return
        const observer = new ResizeObserver(function fitColumns(entries) {
            for (const entry of entries) {
                if (entry.contentRect.width < 400) return
                if (grid.apiRef.current)
                    requestAnimationFrame(() => grid.apiRef.current?.sizeColumnsToFit())
            }
        })
        observer.observe(containerRef.current)
        return () => observer.disconnect()
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
                // getRowId — ПОСЛЕ спреда: undefined из rest не должен затирать связку,
                // иначе грид падает на индексную идентификацию строк
                getRowId={getRowId ?? grid.gridProps.getRowId}
                onGridReady={function ready(event) {
                    grid.gridProps.onGridReady(event)
                    if (autoSizeColumns) event.api.sizeColumnsToFit()
                    onGridReady?.(event)
                }}
                onGridPreDestroyed={function destroyed(event) {
                    grid.gridProps.onGridPreDestroyed(event)
                    onGridPreDestroyed?.(event)
                }}
            />
        </div>
    )
}

// memo: грид не ререндерится от чужих стейтов страницы — апдейты данных идут мимо
// рендера (controller.updateData). Каст вынужденный: memo() стирает дженерик компонента.
export const AgGridMy = memo(AgGridMyInner) as typeof AgGridMyInner
