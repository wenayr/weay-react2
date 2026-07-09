// Column state layer: persisted order / visibility / width / sort / filter for a
// keyed set of columns. The config store is standalone (mobile card views consume
// it without ag-grid at all); an optional grid adapter syncs the SAME config with
// a live ag-grid instance two-way. agGrid4 wrappers are not modified - this is
// exactly the app-level wrapper WRAPPER.md postulates, packaged as a reusable
// primitive. ag-grid enters only as a type import plus the GridApi the caller
// hands to grid.attach() - no runtime coupling for grid-less consumers.
//
// Persistence rides the library convention (memoryProps -> memoryCache -> storage),
// same mechanics as createToolbar: the caller supplies one string key.
import type {ReactNode} from 'react'
import type {ColumnState as AgColumnState, GridApi} from 'ag-grid-community'
import {listen as createListen} from 'wenay-common2'
import {createUpdateApi, renderBy, updateBy} from '../../../updateBy'
import {memoryGetOrCreate, memoryMarkDirty} from '../../utils/memoryStore'

export type ColumnMeta = {
    /** stable id (persist key; must equal the grid colId) */
    key: string
    /** full human name - menus, card labels */
    title: string
    /** short caption for icons/cards (falls back to title) */
    short?: string
    /** glyph for icon menus */
    icon?: ReactNode
    /** group key for columns with sub-columns ("versions" etc.) */
    group?: string
    /** cannot be hidden or reordered (pinned to its descriptor index) */
    fixed?: boolean
    /** default true */
    defaultVisible?: boolean
    /** role in the mobile card view: 'title' = card header, 'accent' = badge */
    cardRole?: 'title' | 'accent'
}

export type ColumnsSort = {key: string, dir: 'asc' | 'desc'}

export type ColumnsConfig = {
    /** schema version of the persisted shape */
    v: number
    /** column keys, display order */
    order: string[]
    visible: {[key: string]: boolean}
    /** column widths - written by the grid adapter only */
    width: {[key: string]: number}
    /** STICKY sort: independent of visibility and of any UI selection, may point
     *  at a hidden column; changes only by an explicit toggle or a header click */
    sort: ColumnsSort | null
    /** grid filterModel - written by the grid adapter only */
    filter: {[key: string]: unknown}
    /** group key -> enabled sub-column keys */
    groups: {[group: string]: string[]}
}

const SCHEMA_V = 1

/** Grid events that mean "the user changed the column layout / sort / filter". */
const GRID_EVENTS = ['columnMoved', 'columnResized', 'columnVisible', 'sortChanged', 'filterChanged'] as const

export function createColumnState(opts: {
    /** persistence key (memoryProps -> memoryCache), like createToolbar */
    key: string
    /** column descriptors; the config only ever references them by key */
    columns: ColumnMeta[]
    /** defaults; missing fields are derived from columns */
    def?: Partial<ColumnsConfig>
    /** grid->store save debounce, ms (default 300) */
    saveMs?: number
}) {
    const groupMembers = (g: string) => opts.columns.filter(c => c.group == g).map(c => c.key)
    const groupKeys = [...new Set(opts.columns.map(c => c.group).filter((g): g is string => !!g))]

    const defConfig = (): ColumnsConfig => ({
        v: SCHEMA_V,
        order: opts.def?.order?.slice() ?? opts.columns.map(c => c.key),
        visible: opts.def?.visible ? {...opts.def.visible} : Object.fromEntries(opts.columns.map(c => [c.key, c.defaultVisible != false])),
        width: opts.def?.width ? {...opts.def.width} : {},
        sort: opts.def?.sort ? {...opts.def.sort} : null,
        filter: opts.def?.filter ? {...opts.def.filter} : {},
        groups: opts.def?.groups ? {...opts.def.groups} : Object.fromEntries(groupKeys.map(g => [g, groupMembers(g)])),
    })
    const st = memoryGetOrCreate<ColumnsConfig>(opts.key, defConfig())
    const stApi = createUpdateApi(st)
    const [emitChange, onChange] = createListen<[ColumnsConfig]>()

    /** Runtime-only, never persisted: actual = which keys the attached grid has;
     *  gate = optional app-level availability over a stable grid schema (standards,
     *  mode blocks). Consumers see actual AND gate as one presence map. */
    const rt = {
        present: null as null | {[key: string]: true},
        presentGate: null as null | {[key: string]: true},
    }
    const rtApi = createUpdateApi(rt)
    const keyMap = (keys: string[] | null) => keys ? Object.fromEntries(keys.map(k => [k, true as const])) : null
    const sameMap = (a: null | {[key: string]: true}, b: null | {[key: string]: true}) => JSON.stringify(a) == JSON.stringify(b)
    function combinedPresent() {
        if (!rt.present && !rt.presentGate) return null
        const res: {[key: string]: true} = {}
        for (const c of opts.columns) {
            if ((!rt.present || rt.present[c.key]) && (!rt.presentGate || rt.presentGate[c.key]))
                res[c.key] = true
        }
        return res
    }

    function setPresent(keys: string[] | null) {
        const next = keyMap(keys)
        if (sameMap(next, rt.present)) return
        rt.present = next
        rtApi.render()
    }
    function setPresentGate(keys: string[] | null) {
        const next = keyMap(keys)
        if (sameMap(next, rt.presentGate)) return
        rt.presentGate = next
        rtApi.render()
        applyToGrid()
    }
    const getPresent = combinedPresent
    const getPresentGate = () => rt.presentGate
    const isPresent = (key: string) => {
        const p = combinedPresent()
        return !p || p[key] == true
    }
    const passesPresentGate = (key: string) => !rt.presentGate || rt.presentGate[key] == true
    function usePresent() {
        rtApi.use()
        return combinedPresent()
    }

    /** The persisted state may be stale or partial (older app version, columns
     *  added/removed) - never crash, never drop user data that still applies:
     *  unknown keys are filtered out, missing columns are appended
     *  (default-visible), fixed columns are pinned back to their descriptor
     *  index. This IS the soft migration; v covers incompatible shape changes. */
    function normalize(): ColumnsConfig {
        const known = new Set(opts.columns.map(c => c.key))
        const byKey = new Map(opts.columns.map(c => [c.key, c]))
        const rawOrder = Array.isArray(st.order) ? st.order : []
        const order = rawOrder.filter(k => known.has(k) && !byKey.get(k)?.fixed)
        for (const c of opts.columns)
            if (!c.fixed && order.indexOf(c.key) == -1) order.push(c.key)
        opts.columns.forEach(function pinFixed(c, i) {
            if (c.fixed) order.splice(Math.min(i, order.length), 0, c.key)
        })
        const rawVisible = st.visible && typeof st.visible == 'object' ? st.visible : {}
        const visible: {[k: string]: boolean} = {}
        for (const c of opts.columns)
            visible[c.key] = c.fixed ? true : (rawVisible[c.key] ?? c.defaultVisible != false)
        const rawWidth = st.width && typeof st.width == 'object' ? st.width : {}
        const width: {[k: string]: number} = {}
        for (const [k, w] of Object.entries(rawWidth))
            if (known.has(k) && typeof w == 'number' && isFinite(w) && w > 0) width[k] = w
        const sort: ColumnsSort | null =
            st.sort && known.has(st.sort.key) && (st.sort.dir == 'asc' || st.sort.dir == 'desc')
                ? {key: st.sort.key, dir: st.sort.dir} : null
        const rawFilter = st.filter && typeof st.filter == 'object' ? st.filter : {}
        const filter: {[k: string]: unknown} = {}
        for (const [k, f] of Object.entries(rawFilter))
            if (known.has(k)) filter[k] = f
        const rawGroups = st.groups && typeof st.groups == 'object' ? st.groups : {}
        const groups: {[g: string]: string[]} = {}
        for (const g of groupKeys) {
            const members = groupMembers(g)
            groups[g] = Array.isArray(rawGroups[g]) ? rawGroups[g].filter(k => members.indexOf(k) != -1) : members
        }
        return {v: SCHEMA_V, order, visible, width, sort, filter, groups}
    }

    /** Every edit funnels through here: mutate the persisted object in place
     *  (identity is the updateBy/renderBy subscription key), announce, mark the
     *  cache dirty, push to the attached grid (unless the grid IS the source),
     *  emit outward. */
    function commit(next: ColumnsConfig, fromGrid: boolean) {
        st.v = SCHEMA_V
        st.order = next.order.slice()
        st.visible = {...next.visible}
        st.width = {...next.width}
        st.sort = next.sort ? {...next.sort} : null
        st.filter = {...next.filter}
        st.groups = Object.fromEntries(Object.entries(next.groups).map(([g, keys]) => [g, keys.slice()]))
        stApi.render()
        memoryMarkDirty(opts.key)
        if (!fromGrid) applyToGrid()
        emitChange(normalize())
    }

    const getConfig = () => normalize()
    const setConfig = (next: ColumnsConfig) => commit(next, false)
    const reset = () => commit(defConfig(), false)

    function useConfig() {
        stApi.use()
        return normalize()
    }

    function show(key: string, on: boolean) {
        const cfg = normalize()
        commit({...cfg, visible: {...cfg.visible, [key]: on}}, false)
    }

    function move(order: string[]) {
        commit({...normalize(), order}, false)
    }

    function setSort(sort: ColumnsSort | null) {
        commit({...normalize(), sort}, false)
    }

    /** The mobile "sort button" cycle over one column: asc -> desc -> off.
     *  A different column starts its own cycle at asc; the sticky sort of
     *  another column is simply replaced. */
    function toggleSort(key: string) {
        const cur = normalize().sort
        setSort(cur?.key != key ? {key, dir: 'asc'} : cur.dir == 'asc' ? {key, dir: 'desc'} : null)
    }

    /** The order/visibility slice of THIS config as an external list source
     *  (structurally = Toolbar's UiListSource): plug it into
     *  createToolbar({source}) or any order/visibility editor - the editor,
     *  the menu and the attached grid then all mirror one another, because
     *  they edit the SAME config. */
    const listSource = {
        useConfig() {
            const c = useConfig()
            return {order: c.order, visible: c.visible}
        },
        getConfig() {
            const c = normalize()
            return {order: c.order, visible: c.visible}
        },
        setConfig(next: {order: string[], visible: {[k: string]: boolean}}) {
            const cfg = normalize()
            // an editor over a SUBSET of columns must not lose the rest:
            // unknown incoming keys are dropped by normalize, missing ones re-appended
            commit({...cfg, order: next.order, visible: {...cfg.visible, ...next.visible}}, false)
        },
        onChange: (cb: (cfg: {order: string[], visible: {[k: string]: boolean}}) => void) =>
            onChange.on(c => cb({order: c.order, visible: c.visible})),
    }

    /** Keys to render, in order. Grouped columns are additionally gated by their
     *  group's enabled set. */
    function visibleKeys(): string[] {
        const cfg = normalize()
        const byKey = new Map(opts.columns.map(c => [c.key, c]))
        return cfg.order.filter(k => {
            if (cfg.visible[k] == false) return false
            const g = byKey.get(k)?.group
            return !g || cfg.groups[g]?.indexOf(k) != -1
        })
    }

    /* ----- grid adapter (two-way) ----- */

    let gridApi: GridApi | null = null
    let applying = false
    let saveTimer: ReturnType<typeof setTimeout> | undefined

    function toAgState(cfg: ColumnsConfig): AgColumnState[] {
        return cfg.order.map(k => ({
            colId: k,
            hide: cfg.visible[k] == false || !passesPresentGate(k),
            width: cfg.width[k], // undefined = leave the grid's current width
            sort: cfg.sort?.key == k ? cfg.sort.dir : null,
        }))
    }

    /** Store -> grid. The applying flag (plus source=='api' on events) keeps the
     *  restore from bouncing back as a save. */
    function applyToGrid() {
        if (!gridApi) return
        applying = true
        try {
            const cfg = normalize()
            gridApi.applyColumnState({state: toAgState(cfg), applyOrder: true})
            gridApi.setFilterModel(Object.keys(cfg.filter).length ? cfg.filter : null)
        } finally {
            applying = false
        }
    }

    /** Grid -> store: fold the live column state back into the config. Columns
     *  the grid does not know keep their stored values (a grid may mount a
     *  subset). Skipped when nothing actually changed - the residual guard
     *  against apply/save loops. */
    function readFromGrid() {
        if (!gridApi || gridApi.isDestroyed?.()) return
        const cfg = normalize()
        const known = new Set(opts.columns.map(c => c.key))
        const order: string[] = []
        const visible = {...cfg.visible}
        const width = {...cfg.width}
        let sort: ColumnsSort | null = null
        const gridIds = new Set<string>()
        for (const s of gridApi.getColumnState()) {
            if (!s.colId) continue
            gridIds.add(s.colId)
            if (!known.has(s.colId)) continue
            order.push(s.colId)
            visible[s.colId] = !s.hide
            if (typeof s.width == 'number' && s.width > 0) width[s.colId] = s.width
            if (s.sort == 'asc' || s.sort == 'desc') sort = {key: s.colId, dir: s.sort}
        }
        // the grid cannot express a sort by a column it does not currently have:
        // keep the STICKY sort instead of folding its absence in as "off"
        if (!sort && cfg.sort && !gridIds.has(cfg.sort.key)) sort = cfg.sort
        for (const k of cfg.order)
            if (order.indexOf(k) == -1) order.push(k)
        const filter = (gridApi.getFilterModel() ?? {}) as {[k: string]: unknown}
        const next: ColumnsConfig = {...cfg, order, visible, width, sort, filter}
        if (JSON.stringify(next) == JSON.stringify(cfg)) return
        commit(next, true)
        // normalize() may have corrected the grid's move (a fixed column dragged
        // away from its pinned index): push the corrected order back so the grid
        // and the config never disagree
        if (JSON.stringify(normalize().order) != JSON.stringify(next.order)) applyToGrid()
    }

    function onGridEvent(e: {source?: string, finished?: boolean}) {
        if (applying || e?.source == 'api') return
        // resize/move fire per animation frame during a drag; persist the final shape only
        if (e?.finished === false) return
        clearTimeout(saveTimer)
        saveTimer = setTimeout(readFromGrid, opts.saveMs ?? 300)
    }

    /** The grid's column SET changed (dynamic columnDefs, "drop empty columns"
     *  standards): refresh presence; when the set really changed, re-impose the
     *  config - a column that came BACK gets its stored order/width/visibility
     *  again (setting columnDefs resets order to the defs' order). No loop:
     *  applyColumnState never adds/removes columns, so it cannot re-fire this. */
    function onGridColumns() {
        if (!gridApi || gridApi.isDestroyed?.()) return
        const before = rt.present
        setPresent((gridApi.getColumns() ?? []).map(c => c.getColId()))
        if (rt.present != before && !applying) applyToGrid()
    }

    /** Call from onGridReady (AgGridTable forwards it on top of its own wiring) or
     *  via controller.withApi. Restores the saved state, then watches the grid. */
    function attach(api: GridApi) {
        detach()
        gridApi = api
        applyToGrid()
        setPresent((api.getColumns() ?? []).map(c => c.getColId()))
        for (const t of GRID_EVENTS) api.addEventListener(t, onGridEvent)
        api.addEventListener('gridColumnsChanged', onGridColumns)
    }

    /** Call from onGridPreDestroyed. The config survives the grid (columnBuffer
     *  pattern): remount + attach restores the same layout. */
    function detach() {
        clearTimeout(saveTimer)
        saveTimer = undefined
        if (gridApi && !gridApi.isDestroyed?.()) {
            for (const t of GRID_EVENTS) gridApi.removeEventListener(t, onGridEvent)
            gridApi.removeEventListener('gridColumnsChanged', onGridColumns)
        }
        gridApi = null
        setPresent(null)
    }

    return {
        /** The column descriptors this state was created over - UI components
         *  (dots, cards, icon menus) render from these + the config. */
        columns: opts.columns as readonly ColumnMeta[],
        api: {getConfig, setConfig, useConfig, onChange, reset, show, move, setSort, toggleSort, visibleKeys,
            getPresent, usePresent, isPresent, setPresent, getPresentGate, setPresentGate, listSource},
        grid: {attach, detach},
    }
}

export type ColumnStateController = ReturnType<typeof createColumnState>
