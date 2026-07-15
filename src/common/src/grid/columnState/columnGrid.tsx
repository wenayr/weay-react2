import React, {useState} from 'react'
import type {ColDef, ColGroupDef, GridApi, GridPreDestroyedEvent, GridReadyEvent} from 'ag-grid-community'
import type {AgGridReactProps} from 'ag-grid-react'
import {AgGridTable, type AgGridTableProps} from '../agGrid4'
import {createToolbar, type ToolbarConfig, type ToolbarItem, type ToolbarSourceMode} from '../../components/Toolbar'
import {CardList} from './CardList'
import {ColumnDots} from './ColumnDots'
import {ColumnsMenu} from './ColumnsMenu'
import {createColumnState, type ColumnMeta, type ColumnsConfig, type ColumnStateController} from './columnState'
import {createGridChrome, type GridChromeController, type GridChromeOptions, type GridChromeProps} from '../gridChrome'

export type ColumnGridColumnDef<T extends object> = ColDef<T> | ColGroupDef<T>

export type ColumnGridColumn = Partial<Omit<ColumnMeta, 'key'>> & {
    key: string
}

export type ColumnGridToolbarOptions = {
    key?: string
    items?: ToolbarItem[]
    def?: Partial<ToolbarConfig>
    settingsItem?: {title?: string, icon?: React.ReactNode}
    resetItem?: false | {title?: string, icon?: React.ReactNode, defaultVisible?: boolean}
    sourceMode?: ToolbarSourceMode
}

export type ColumnGridOptions<T extends object> = {
    /** Shared persistence key for the column config. */
    key: string
    /** ag-grid defs. Leaf defs become ColumnMeta automatically by colId/field/headerName. */
    columnDefs?: readonly ColumnGridColumnDef<T>[]
    /** Optional metadata overrides, keyed by colId/field. Missing fields are inferred from columnDefs. */
    columns?: readonly ColumnGridColumn[]
    def?: Partial<ColumnsConfig>
    /** Optional default data for View; per-render props still override it. */
    data?: readonly T[]
    /** Optional default row id getter for View/CardList and simple table wiring. */
    getId?: (row: T, index: number) => string
    /** Optional sizeColumnsToFit when the visible column count changes. */
    autoSizeOnColumnCountChange?: boolean
    saveMs?: number
    /** Built by default over the same columnState list source; pass false to skip it. */
    toolbar?: false | ColumnGridToolbarOptions
    /** Optional adaptive command surface. It reuses this factory's columnState. */
    chrome?: false | Omit<GridChromeOptions<T>, 'columnState'>
}

export type ColumnGridTableProps<T extends object> =
    Omit<AgGridTableProps<T>, 'columnDefs' | 'autoSizeColumns' | 'onGridReady' | 'onGridPreDestroyed'> & {
    columnDefs?: AgGridReactProps<T>['columnDefs']
    /** Defaults to false because columnState restores/persists widths. */
    autoSizeColumns?: boolean
    onGridReady?: (event: GridReadyEvent<T>) => void
    onGridPreDestroyed?: (event: GridPreDestroyedEvent<T>) => void
    /** Defaults from createColumnGrid(opts); fits once when visible column count changes. */
    autoSizeOnColumnCountChange?: boolean
}

export type ColumnGridMenuProps = Omit<React.ComponentProps<typeof ColumnsMenu>, 'state'>
export type ColumnGridDotsProps = Omit<React.ComponentProps<typeof ColumnDots>, 'state'>
export type ColumnGridCardsProps<T extends object> = Omit<React.ComponentProps<typeof CardList<T>>, 'state'>
export type ColumnGridViewMode = 'table' | 'cards'
export type ColumnGridControls = false | 'auto' | 'toolbar' | 'menu' | 'dots'
export type ColumnGridToolbar = ReturnType<typeof createToolbar>
export type ColumnGridToolbarBarProps = React.ComponentProps<ColumnGridToolbar['Bar']>
export type ColumnGridToolbarSettingsProps = React.ComponentProps<ColumnGridToolbar['Settings']>
export type ColumnGridChromeProps = GridChromeProps

export type ColumnGridViewProps<T extends object> = {
    mode?: ColumnGridViewMode
    data?: readonly T[]
    getId?: (row: T, index: number) => string
    controls?: ColumnGridControls
    table?: ColumnGridTableProps<T>
    cards?: Omit<ColumnGridCardsProps<T>, 'data'>
    menu?: ColumnGridMenuProps
    dots?: ColumnGridDotsProps
    toolbar?: ColumnGridToolbarBarProps
    className?: string
    style?: React.CSSProperties
    bodyClassName?: string
    bodyStyle?: React.CSSProperties
    tableHeight?: React.CSSProperties['height']
}

function isGroupDef<T extends object>(def: ColumnGridColumnDef<T>): def is ColGroupDef<T> {
    return Array.isArray((def as ColGroupDef<T>).children)
}

function textOrUndefined(v: unknown): string | undefined {
    if (v == null || v === '') return undefined
    return String(v)
}

function titleFromKey(key: string) {
    return key
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, s => s.toUpperCase())
}

function collectColumnMetas<T extends object>(
    defs: readonly ColumnGridColumnDef<T>[] | undefined,
    parentGroup?: string,
): ColumnMeta[] {
    const res: ColumnMeta[] = []
    for (const def of defs ?? []) {
        if (isGroupDef(def)) {
            const group = textOrUndefined(def.groupId) ?? textOrUndefined(def.headerName) ?? parentGroup
            res.push(...collectColumnMetas(def.children as ColumnGridColumnDef<T>[], group))
            continue
        }
        const key = textOrUndefined(def.colId) ?? textOrUndefined(def.field)
        if (!key) continue
        res.push({
            key,
            title: textOrUndefined(def.headerName) ?? titleFromKey(key),
            group: parentGroup,
        })
    }
    return res
}

function resolveColumns<T extends object>(opts: ColumnGridOptions<T>): ColumnMeta[] {
    const auto = collectColumnMetas(opts.columnDefs)
    const overrides = new Map((opts.columns ?? []).map(c => [c.key, c]))
    const used = new Set<string>()
    const res: ColumnMeta[] = []

    for (const base of auto) {
        if (used.has(base.key)) continue
        const patch = overrides.get(base.key)
        used.add(base.key)
        res.push({...base, ...patch, key: base.key, title: patch?.title ?? base.title})
    }
    for (const patch of opts.columns ?? []) {
        if (used.has(patch.key)) continue
        used.add(patch.key)
        res.push({...patch, key: patch.key, title: patch.title ?? titleFromKey(patch.key)})
    }
    return res
}

function cx(parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(' ')
}

function mergeClass(a: string | undefined, b: string) {
    return a ? b + ' ' + a : b
}

export type ColumnGridController<T extends object> = {
    state: ColumnStateController
    toolbar: ColumnGridToolbar | null
    chrome: GridChromeController<T> | null
    columns: readonly ColumnMeta[]
    columnDefs: AgGridReactProps<T>['columnDefs']
    api: ColumnStateController['api'] & {tableProps: (props?: ColumnGridTableProps<T>) => AgGridTableProps<T>}
    grid: ColumnStateController['grid']
    tableProps: (props?: ColumnGridTableProps<T>) => AgGridTableProps<T>
    Table: (props: ColumnGridTableProps<T>) => React.JSX.Element
    Menu: (props?: ColumnGridMenuProps) => React.JSX.Element
    Dots: (props?: ColumnGridDotsProps) => React.JSX.Element
    Cards: (props: ColumnGridCardsProps<T>) => React.JSX.Element
    Toolbar: (props?: ColumnGridToolbarBarProps) => React.JSX.Element | null
    Settings: (props?: ColumnGridToolbarSettingsProps) => React.JSX.Element | null
    Chrome: (props?: ColumnGridChromeProps) => React.JSX.Element | null
    View: (props: ColumnGridViewProps<T>) => React.JSX.Element
    /** Release factory-lifetime subscriptions; persisted config is untouched. */
    dispose: () => void
}

/** High-level column kit for the common case: one keyed config drives a grid,
 *  compact menu, toolbar settings, mobile dots, and card/table views. */
export function createColumnGrid<T extends object>(opts: ColumnGridOptions<T>): ColumnGridController<T> {
    const columnDefs = (opts.columnDefs ?? []) as AgGridReactProps<T>['columnDefs']
    const state = createColumnState({
        key: opts.key,
        columns: resolveColumns(opts),
        def: opts.def,
        saveMs: opts.saveMs,
    })
    let gridApiForFit: GridApi<T> | null = null
    let fitOnCountChange = opts.autoSizeOnColumnCountChange === true
    let visibleCount = state.api.visibleKeys().length
    let fitRaf = 0
    function scheduleFit() {
        if (!gridApiForFit) return
        cancelAnimationFrame(fitRaf)
        fitRaf = requestAnimationFrame(() => gridApiForFit?.sizeColumnsToFit())
    }
    const offConfigChange = state.api.onChange.on(() => {
        const next = state.api.visibleKeys().length
        if (next == visibleCount) return
        visibleCount = next
        if (fitOnCountChange) scheduleFit()
    })

    const toolbar = opts.toolbar === false ? null : createToolbar({
        key: opts.toolbar?.key ?? `${opts.key}.toolbar`,
        items: opts.toolbar?.items ?? state.columns.map(c => ({
            key: c.key,
            title: c.title,
            short: c.short,
            icon: c.icon,
            fixed: c.fixed,
            defaultVisible: c.defaultVisible,
            onClick: () => {
                const present = state.api.getPresent()
                if (c.fixed || (present && !present[c.key])) return
                const cfg = state.api.getConfig()
                state.api.show(c.key, cfg.visible[c.key] == false)
            },
        })),
        def: opts.toolbar?.def,
        settingsItem: opts.toolbar?.settingsItem,
        resetItem: opts.toolbar?.resetItem,
        source: state.api.listSource,
        sourceMode: opts.toolbar?.sourceMode,
    })
    const chromeOptions = opts.chrome === false ? null : opts.chrome ?? null
    const chrome = chromeOptions ? createGridChrome<T>({...chromeOptions, columnState: state}) : null

    function tableProps(props: ColumnGridTableProps<T> = {}): AgGridTableProps<T> {
        const {onGridReady, onGridPreDestroyed, onCellContextMenu, autoSizeColumns = false, autoSizeOnColumnCountChange = opts.autoSizeOnColumnCountChange === true, columnDefs: localDefs = columnDefs, ...rest} = props
        return {
            ...rest,
            columnDefs: localDefs,
            autoSizeColumns,
            onGridReady(event) {
                gridApiForFit = event.api
                fitOnCountChange = autoSizeOnColumnCountChange
                state.grid.attach(event.api)
                chrome?.grid.attach(event.api)
                // re-seed: the column count may have changed while no grid was attached,
                // and the first post-remount onChange must not mis-skip the auto-fit
                visibleCount = state.api.visibleKeys().length
                if (fitOnCountChange) scheduleFit()
                onGridReady?.(event)
            },
            onGridPreDestroyed(event) {
                if (gridApiForFit === event.api) gridApiForFit = null
                cancelAnimationFrame(fitRaf)
                fitRaf = 0
                chrome?.grid.detach(event.api)
                state.grid.detach()
                onGridPreDestroyed?.(event)
            },
            onCellContextMenu(event) {
                const appResult = onCellContextMenu?.(event)
                // A legacy callback may already open its own menu. Only open the
                // chrome menu automatically when it has an explicit composer or
                // there is no app callback to preserve.
                if (chrome && (!onCellContextMenu || chromeOptions?.contextItems))
                    chrome.api.openContextMenu(event, Array.isArray(appResult) ? appResult : undefined)
            },
        }
    }

    function Table(props: ColumnGridTableProps<T>) {
        return <AgGridTable<T> {...tableProps(props)} />
    }

    function Menu(props: ColumnGridMenuProps = {}) {
        return <ColumnsMenu {...props} state={state} />
    }

    function Dots(props: ColumnGridDotsProps = {}) {
        return <ColumnDots {...props} max={props.max ?? state.columns.length} className={mergeClass(props.className, 'wenayColumnGridDots')} state={state} />
    }

    function Cards(props: ColumnGridCardsProps<T>) {
        return <CardList<T> {...props} state={state} />
    }

    function Toolbar(props: ColumnGridToolbarBarProps = {}) {
        if (!toolbar) return null
        const Bar = toolbar.Bar
        return <Bar {...props} />
    }

    function Settings(props: ColumnGridToolbarSettingsProps = {}) {
        if (!toolbar) return null
        const ToolbarSettings = toolbar.Settings
        return <ToolbarSettings {...props} />
    }

    function Chrome(props: ColumnGridChromeProps = {}) {
        if (!chrome) return null
        const GridChrome = chrome.Chrome
        return <GridChrome {...props}/>
    }

    function controlKind(mode: ColumnGridViewMode, controls: ColumnGridControls | undefined): Exclude<ColumnGridControls, false | 'auto'> | null {
        if (controls === false) return null
        if (!controls || controls == 'auto') return 'dots'
        return controls
    }

    function renderControls(kind: Exclude<ColumnGridControls, false | 'auto'> | null, p: ColumnGridViewProps<T>) {
        if (!kind) return null
        if (kind == 'dots') return <Dots {...p.dots} />
        if (kind == 'toolbar') return <Toolbar settings popAlign="left" {...p.toolbar} />
        return <Menu compact {...p.menu} />
    }

    function View(p: ColumnGridViewProps<T>) {
        const mode = p.mode ?? 'table'
        const kind = controlKind(mode, p.controls)
        const controls = renderControls(kind, p)
        const data = p.data ?? opts.data ?? []
        const getId = p.getId ?? opts.getId
        const bodyStyle: React.CSSProperties = mode == 'table'
            ? {height: p.tableHeight ?? 240, minHeight: 0, ...p.bodyStyle}
            : {...p.bodyStyle}
        const tableGetRowId = p.table?.getRowId ?? (getId
            ? ((params: {data: T}) => getId(params.data, 0))
            : undefined)

        return <div className={cx(['wenayColumnGrid', `wenayColumnGrid_${mode}`, kind && `wenayColumnGrid_controls_${kind}`, p.className])} style={p.style}>
            <div className={cx(['wenayColumnGridBody', p.bodyClassName])} style={bodyStyle}>
                {mode == 'cards'
                    ? <Cards {...p.cards} data={data} getId={p.cards?.getId ?? getId} />
                    : <Table {...p.table} rowData={(p.table?.rowData ?? data) as T[]} getRowId={tableGetRowId as ColumnGridTableProps<T>['getRowId']} />}
            </div>
            {controls && <div className={cx(['wenayColumnGridControls', kind && `wenayColumnGridControls_${kind}`])}>{controls}</div>}
        </div>
    }

    /** Release factory-lifetime subscriptions (config onChange, toolbar source, pending fit).
     *  Persisted config stays; this is listener lifetime only (HMR, repeated factories). */
    function dispose() {
        offConfigChange()
        toolbar?.api.dispose()
        chrome?.dispose()
        cancelAnimationFrame(fitRaf)
        fitRaf = 0
        gridApiForFit = null
    }

    return {
        state,
        toolbar,
        chrome,
        columns: state.columns,
        columnDefs,
        api: {...state.api, tableProps},
        grid: state.grid,
        tableProps,
        Table,
        Menu,
        Dots,
        Cards,
        Toolbar,
        Settings,
        Chrome,
        View,
        dispose,
    }
}

export function useColumnGrid<T extends object>(opts: ColumnGridOptions<T>): ColumnGridController<T> {
    const [grid] = useState(() => createColumnGrid<T>(opts))
    return grid
}
