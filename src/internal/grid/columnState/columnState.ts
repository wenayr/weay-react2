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
import {listen as createListen} from 'wenay-common2/client'
import {createUpdateApi} from '../../updateBy.js'
import {memoryMarkDirty} from '../../utils/memoryStore.js'
import {createPersistedController} from '../../utils/persistedController.js'
import {pinFixedOrder} from '../../utils/fixedOrder.js'
// The pure column-state core (defaults / normalize / visibleKeys / sort cycle / fixed pinning)
// is shared with the React Native controller. It lives under src/native because that folder may
// not import values from the shared tree, while the shared tree may import from it; see
// src/native/columnStateCore.ts and __test/nativeIsolation.test.ts.
import {
    COLUMN_SCHEMA_V,
    columnGroupKeys,
    columnGroupMembers,
    columnVisibleKeys,
    defaultColumnsConfig,
    nextColumnSort,
    normalizeColumnsConfig,
} from '../../../native/columnStateCore.js'
import {structEqual} from '../../utils/structEqual.js'

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

const SCHEMA_V = COLUMN_SCHEMA_V

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
    const groupMembers = (g: string) => columnGroupMembers(opts.columns, g)
    const groupKeys = columnGroupKeys(opts.columns)
    // opts.columns is the controller's descriptor set: captured once at creation and never
    // reassigned (createColumnGrid resolves it before calling us), so the key index is
    // controller-lifetime data, not per-event data.
    const knownKeys = new Set(opts.columns.map(c => c.key))

    const defConfig = (): ColumnsConfig => defaultColumnsConfig(opts.columns, opts.def)

    // SCHEMA_V is now enforced through the shared slot: an entry stored by an older schema runs
    // migrate() once and is stamped, instead of the version silently being overwritten on the
    // next normalize(). Nothing to migrate yet at v1 - the hook is the point.
    const persisted = createPersistedController<ColumnsConfig>({
        key: opts.key,
        def: defConfig(),
        version: SCHEMA_V,
    })
    const st = persisted.state
    const stApi = persisted.api
    const [emitChange, onChange] = createListen<[ColumnsConfig]>()
    const previewRt = {order: null as string[] | null}
    const previewApi = createUpdateApi(previewRt)

    /** Runtime-only, never persisted: actual = which keys the attached grid has;
     *  gate = optional app-level availability over a stable grid schema (standards,
     *  mode blocks). Consumers see actual AND gate as one presence map. */
    const rt = {
        present: null as null | {[key: string]: true},
        presentGate: null as null | {[key: string]: true},
    }
    const rtApi = createUpdateApi(rt)
    const keyMap = (keys: string[] | null) => keys ? Object.fromEntries(keys.map(k => [k, true as const])) : null
    const sameMap = (a: null | {[key: string]: true}, b: null | {[key: string]: true}) => structEqual(a, b)
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

    /** The persisted state may be stale or partial (older app version, columns added/removed)
     *  - never crash, never drop user data that still applies: unknown keys are filtered out,
     *  missing columns are appended (default-visible), fixed columns are pinned back to their
     *  descriptor index. The rules live in the shared core, so native and web agree about the
     *  same persisted JSON. Web keeps the "a missing order/visible falls back to EMPTY" reading:
     *  st is seeded from defConfig(), so a caller def reaches normalize through st already. */
    // Memoized by the IDENTITY of the persisted fields. commit() below assigns a fresh array/
    // object to every field, and storage hydration (cache.ts addDataToMap) Object.assign()s new
    // references in the same way - so "some field reference changed" is exactly "the config
    // changed". Before this every subscriber render (CardList, ColumnsMenu, ColumnDots, the
    // Toolbar over listSource, columnGrid's visibleCount) re-derived the whole config and then
    // JSON.stringify'ed it again to get a stable identity back. Now the same object comes back
    // until the next commit, and consumers key their memos on it directly.
    // The returned config is shared: callers spread it (they already did), never mutate it.
    type NormalizedCache = {
        order: unknown, visible: unknown, width: unknown, sort: unknown, filter: unknown, groups: unknown,
        cfg: ColumnsConfig,
        keys: string[] | null,
    }
    let normalizedCache: NormalizedCache | null = null
    function normalize(): ColumnsConfig {
        const c = normalizedCache
        if (c && c.order === st.order && c.visible === st.visible && c.width === st.width
            && c.sort === st.sort && c.filter === st.filter && c.groups === st.groups) return c.cfg
        const cfg = normalizeColumnsConfig(opts.columns, st)
        normalizedCache = {order: st.order, visible: st.visible, width: st.width, sort: st.sort, filter: st.filter, groups: st.groups, cfg, keys: null}
        return cfg
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
        // one normalize per commit: the same normalized config goes to the grid and outward
        const normalized = normalize()
        if (!fromGrid) applyToGrid(normalized)
        emitChange(normalized)
    }

    const getConfig = () => normalize()
    const setConfig = (next: ColumnsConfig) => commit(next, false)
    const reset = () => commit(defConfig(), false)

    // Same identity contract for the preview-overlaid config: previewRt.order is only ever
    // replaced (applyPreviewOrder), so (cfg, previewRt.order) identities key the overlay.
    let displayCache: {cfg: ColumnsConfig, preview: string[] | null, out: ColumnsConfig} | null = null
    function displayConfig() {
        const cfg = normalize()
        const preview = previewRt.order
        if (!preview) return cfg
        const d = displayCache
        if (d && d.cfg === cfg && d.preview === preview) return d.out
        const out = {...cfg, order: preview.slice()}
        displayCache = {cfg, preview, out}
        return out
    }
    function useDisplayConfig() {
        stApi.use()
        previewApi.use()
        return displayConfig()
    }
    /** Internal: takes the caller's already normalized config so a caller that just
     *  normalized (onGridEvent) does not pay for a second pass. The public
     *  setPreviewOrder keeps its one-argument signature (it is part of listSource). */
    function applyPreviewOrder(order: string[] | null, cfg: ColumnsConfig) {
        const known = new Set(cfg.order)
        const next = order ? pinFixedOrder(order.filter(k => known.has(k)), opts.columns) : null
        if (structEqual(next, previewRt.order)) return
        previewRt.order = next
        previewApi.render()
        if (!gridApi || gridApi.isDestroyed?.()) return
        applying = true
        try { gridApi.applyColumnState({state: (next ?? cfg.order).map(colId => ({colId})), applyOrder: true}) }
        finally { applying = false }
    }
    function setPreviewOrder(order: string[] | null) {
        applyPreviewOrder(order, normalize())
    }
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
        setSort(nextColumnSort(normalize().sort, key))
    }

    /** The order/visibility slice of THIS config as an external list source
     *  (structurally = Toolbar's UiListSource): plug it into
     *  createToolbar({source}) or any order/visibility editor - the editor,
     *  the menu and the attached grid then all mirror one another, because
     *  they edit the SAME config. */
    const listSource = {
        useConfig() {
            const c = useDisplayConfig()
            return {order: c.order, visible: c.visible}
        },
        getConfig() {
            const c = displayConfig()
            return {order: c.order, visible: c.visible}
        },
        useBaseConfig() {
            const c = useConfig()
            return {order: c.order, visible: c.visible}
        },
        getBaseConfig() {
            const c = normalize()
            return {order: c.order, visible: c.visible}
        },
        setPreview: setPreviewOrder,        setConfig(next: {order: string[], visible: {[k: string]: boolean}}) {
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
        const c = normalizedCache!
        // derived from the cached config, cached alongside it: one array per config version
        return c.keys ??= columnVisibleKeys(cfg, opts.columns)
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
    function applyToGrid(config?: ColumnsConfig) {
        if (!gridApi) return
        applying = true
        try {
            const cfg = config ?? normalize()
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
        const order: string[] = []
        const visible = {...cfg.visible}
        const width = {...cfg.width}
        let sort: ColumnsSort | null = null
        const gridIds = new Set<string>()
        for (const s of gridApi.getColumnState()) {
            if (!s.colId) continue
            gridIds.add(s.colId)
            if (!knownKeys.has(s.colId)) continue
            order.push(s.colId)
            // `hide` for a gated-out column was written by applyToGrid(), not by
            // the user. Folding it back would turn runtime presence into persisted
            // visibility and keep the column hidden when the gate opens again.
            if (passesPresentGate(s.colId)) visible[s.colId] = !s.hide
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
        // structural compare: the grid returns filter models with its own key order,
        // which must not count as a change (stringify used to false-positive here)
        if (structEqual(next, cfg)) return
        commit(next, true)
        // normalize() may have corrected the grid's move (a fixed column dragged
        // away from its pinned index): push the corrected order back so the grid
        // and the config never disagree
        if (!structEqual(normalize().order, next.order)) applyToGrid()
    }

    function onGridEvent(e: {source?: string, finished?: boolean, type?: string}) {
        if (applying || e?.source == 'api') return
        if (e?.type == 'columnMoved' && e.finished === false && gridApi) {
            // fires per pointer move while a header is dragged: normalize once and hand
            // the same config to the preview instead of normalizing twice per frame
            const cfg = normalize()
            const order = gridApi.getColumnState().map(c => c.colId).filter((k): k is string => !!k && knownKeys.has(k))
            for (const k of cfg.order) if (!order.includes(k)) order.push(k)
            applyPreviewOrder(order, cfg)
            return
        }
        if (e?.type == 'columnMoved' && previewRt.order) {
            readFromGrid()
            setPreviewOrder(null)
            return
        }
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
        if (saveTimer != undefined) readFromGrid()
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
            getPresent, usePresent, isPresent, setPresent, getPresentGate, setPresentGate, useDisplayConfig, setPreviewOrder, listSource},
        grid: {attach, detach},
    }
}

export type ColumnStateController = ReturnType<typeof createColumnState>
