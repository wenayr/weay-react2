/** The ONE column-state core: the pure defaults / normalize / visibleKeys / sort-cycle /
 *  fixed-pinning logic that both platforms build on.
 *
 *  It lives under src/native because of the import direction the isolation guard
 *  (__test/nativeIsolation.test.ts) enforces: native may not import a value from the shared
 *  tree, the shared tree may import from native. So the shared copy has to be the native-safe
 *  one - no React, no DOM, no ag-grid, no imports at all.
 *
 *  It is deliberately NOT re-exported from src/native/index.ts: __test/barrelParity.test.ts
 *  requires ./native and the root barrel to share zero runtime names, and the root barrel
 *  re-exports utils/fixedOrder. Consumers inside this package import it by file path. */

export type ColumnCoreMeta = {
    key: string
    group?: string
    fixed?: boolean
    defaultVisible?: boolean
}

export type ColumnCoreSort = {key: string, dir: 'asc' | 'desc'}

export type ColumnCoreConfig = {
    v: number
    order: string[]
    visible: {[key: string]: boolean}
    width: {[key: string]: number}
    sort: ColumnCoreSort | null
    filter: {[key: string]: unknown}
    groups: {[group: string]: string[]}
}

/** Schema version of the persisted shape - shared, so a bump can never hit one platform only. */
export const COLUMN_SCHEMA_V = 1

/** Drop fixed keys from `order`, then pin every fixed descriptor back at its descriptor index.
 *  utils/fixedOrder.pinFixedOrder delegates here; the drag preview must land where the commit does. */
export function pinFixedColumns(order: readonly string[], descriptors: readonly {key: string, fixed?: boolean}[]): string[] {
    const fixed = new Set<string>()
    for (const d of descriptors) if (d.fixed) fixed.add(d.key)
    const res = order.filter(k => !fixed.has(k))
    descriptors.forEach(function pin(d, i) {
        if (d.fixed) res.splice(Math.min(i, res.length), 0, d.key)
    })
    return res
}

/** Distinct group keys, in descriptor order. */
export function columnGroupKeys(columns: readonly ColumnCoreMeta[]): string[] {
    return [...new Set(columns.map(c => c.group).filter((g): g is string => !!g))]
}

/** The keys a group owns, in descriptor order. */
export function columnGroupMembers(columns: readonly ColumnCoreMeta[], group: string): string[] {
    return columns.filter(c => c.group == group).map(c => c.key)
}

/** The config a fresh state starts from: caller defaults win, everything else is derived
 *  from the descriptors. */
export function defaultColumnsConfig(
    columns: readonly ColumnCoreMeta[],
    def?: Partial<ColumnCoreConfig> | null,
): ColumnCoreConfig {
    return {
        v: COLUMN_SCHEMA_V,
        order: def?.order?.slice() ?? columns.map(c => c.key),
        visible: def?.visible ? {...def.visible} : Object.fromEntries(columns.map(c => [c.key, c.defaultVisible != false])),
        width: def?.width ? {...def.width} : {},
        sort: def?.sort ? {...def.sort} : null,
        filter: def?.filter ? {...def.filter} : {},
        groups: def?.groups ? {...def.groups} : Object.fromEntries(columnGroupKeys(columns).map(g => [g, columnGroupMembers(columns, g)])),
    }
}

export type NormalizeColumnsOptions = {
    /** caller defaults, as handed to defaultColumnsConfig */
    def?: Partial<ColumnCoreConfig> | null
    /** When a stored `order` / `visible` is missing or of the wrong shape: native falls back to
     *  the DEFAULTS (so a caller-supplied def.order still applies), web falls back to EMPTY and
     *  lets the re-append below rebuild the descriptor order. Identical unless def.order /
     *  def.visible were supplied, which is why it is a parameter and not a pick. */
    fallbackToDefaults?: boolean
}

/** The persisted state may be stale or partial (older app version, columns added/removed) -
 *  never crash, never drop user data that still applies: unknown keys are filtered out,
 *  missing columns are appended (default-visible), fixed columns are pinned back to their
 *  descriptor index. This IS the soft migration; `v` covers incompatible shape changes. */
export function normalizeColumnsConfig(
    columns: readonly ColumnCoreMeta[],
    value: Partial<ColumnCoreConfig> | null | undefined,
    options?: NormalizeColumnsOptions,
): ColumnCoreConfig {
    const base = defaultColumnsConfig(columns, options?.def)
    const known = new Set(columns.map(c => c.key))
    const byKey = new Map(columns.map(c => [c.key, c]))

    const rawOrder = Array.isArray(value?.order) ? value!.order : (options?.fallbackToDefaults ? base.order : [])
    const prelim = rawOrder.filter(k => known.has(k) && !byKey.get(k)?.fixed)
    for (const c of columns)
        if (!c.fixed && prelim.indexOf(c.key) == -1) prelim.push(c.key)
    const order = pinFixedColumns(prelim, columns)

    const rawVisible = value?.visible && typeof value.visible == 'object'
        ? value.visible : (options?.fallbackToDefaults ? base.visible : {})
    const visible: {[key: string]: boolean} = {}
    for (const c of columns)
        visible[c.key] = c.fixed ? true : (rawVisible[c.key] ?? c.defaultVisible != false)

    const rawWidth = value?.width && typeof value.width == 'object' ? value.width : {}
    const width: {[key: string]: number} = {}
    for (const [k, w] of Object.entries(rawWidth))
        if (known.has(k) && typeof w == 'number' && isFinite(w) && w > 0) width[k] = w

    const sort: ColumnCoreSort | null =
        value?.sort && known.has(value.sort.key) && (value.sort.dir == 'asc' || value.sort.dir == 'desc')
            ? {key: value.sort.key, dir: value.sort.dir} : null

    const rawFilter = value?.filter && typeof value.filter == 'object' ? value.filter : {}
    const filter: {[key: string]: unknown} = {}
    for (const [k, f] of Object.entries(rawFilter))
        if (known.has(k)) filter[k] = f

    const rawGroups = value?.groups && typeof value.groups == 'object' ? value.groups : {}
    const groups: {[group: string]: string[]} = {}
    for (const g of columnGroupKeys(columns)) {
        const members = columnGroupMembers(columns, g)
        groups[g] = Array.isArray(rawGroups[g]) ? rawGroups[g].filter(k => members.indexOf(k) != -1) : members
    }

    return {v: COLUMN_SCHEMA_V, order, visible, width, sort, filter, groups}
}

/** Keys to render, in order. Grouped columns are additionally gated by their group's enabled set. */
export function columnVisibleKeys(config: ColumnCoreConfig, columns: readonly ColumnCoreMeta[]): string[] {
    const byKey = new Map(columns.map(c => [c.key, c]))
    return config.order.filter(k => {
        if (config.visible[k] == false) return false
        const g = byKey.get(k)?.group
        return !g || (config.groups[g]?.indexOf(k) ?? -1) != -1
    })
}

/** The "sort button" cycle over one column: asc -> desc -> off. A different column starts its
 *  own cycle at asc; the sticky sort of another column is simply replaced. */
export function nextColumnSort(current: ColumnCoreSort | null, key: string): ColumnCoreSort | null {
    return current?.key != key ? {key, dir: 'asc'} : current.dir == 'asc' ? {key, dir: 'desc'} : null
}

/** Deep-enough copy for handing a config out as a snapshot. */
export function copyColumnsConfig(config: ColumnCoreConfig): ColumnCoreConfig {
    return {
        ...config,
        order: config.order.slice(),
        visible: {...config.visible},
        width: {...config.width},
        sort: config.sort ? {...config.sort} : null,
        filter: {...config.filter},
        groups: Object.fromEntries(Object.entries(config.groups).map(([g, keys]) => [g, keys.slice()])),
    }
}
