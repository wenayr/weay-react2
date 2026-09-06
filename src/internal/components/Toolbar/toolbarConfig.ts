/** The config algebra of createToolbar as pure functions: what a persisted (possibly stale or
 *  partial) toolbar entry plus an optional external order/visibility source normalise to.
 *  No store, no React, no registry - the controller passes in what it read. Split out of
 *  Toolbar.tsx so the rules can be tested and read without the Bar/Settings views around them. */
import {pinFixedOrder} from '../../utils/fixedOrder.js'

export type ToolbarConfigItem = {
    key: string
    defaultVisible?: boolean
    fixed?: boolean
}

export type ToolbarListConfig = {
    order: string[]
    visible: {[key: string]: boolean}
}

/** Reserved visible-map key for the bar's settings (gear) button: not part of
 *  order (the gear always sits at the bar edge), but toggleable like an item. */
export const SETTINGS_KEY = '__settings'
export const RESET_KEY = '__reset'

export function sameOrder(a: string[], b: string[]) {
    return a.length == b.length && a.every((k, i) => k == b[i])
}

/** Keys the external source actually owns, restricted to the toolbar's own items. */
export function sourceKeySet(raw: ToolbarListConfig | undefined, known: Set<string>) {
    return new Set((Array.isArray(raw?.order) ? raw.order : []).filter(k => known.has(k)))
}

/** 'order' source mode: the source dictates the RELATIVE order of its keys; local keys and
 *  their positions stay where the local order has them. */
export function mergeSourceOrder(localOrder: string[], rawSourceOrder: string[], sourceKeys: Set<string>) {
    if (!sourceKeys.size) return localOrder
    const sourceOrder = rawSourceOrder.filter(k => sourceKeys.has(k))
    let i = 0
    return localOrder.map(k => sourceKeys.has(k) ? (sourceOrder[i++] ?? k) : k)
}

export type NormalizeToolbarInput = {
    items: readonly ToolbarConfigItem[]
    /** the toolbar's own persisted entry (may be stale/partial) */
    local: {order?: unknown, visible?: unknown, density?: unknown}
    /** what the external source reports right now; undefined = no source */
    extRaw: ToolbarListConfig | undefined
    sourceMode: 'orderVisible' | 'order'
    /** false = the reset pseudo-control does not exist */
    resetItem: boolean
    resetDefaultVisible: boolean
    /** registered density keys, first one is the fallback */
    densityKeys: readonly string[]
    defDensity?: string
}

/** The persisted state may be stale or partial (older app version, removed items, an
 *  unregistered density) - never crash, never drop user data that still applies: unknown keys
 *  are filtered out, missing items are appended (default-visible), fixed items are pinned back
 *  to their descriptor index. The gear/reset flags are toolbar-local even with a source. */
export function normalizeToolbarConfig(p: NormalizeToolbarInput): {order: string[], visible: {[k: string]: boolean}, density: string} {
    const {items, local, extRaw, sourceMode} = p
    const known = new Set(items.map(i => i.key))
    const ext = extRaw !== undefined
    const localRaw = {order: local.order, visible: local.visible}
    const raw = ext && sourceMode == 'orderVisible' ? extRaw : localRaw
    const sourceKeys = ext && sourceMode == 'order' ? sourceKeySet(extRaw, known) : new Set<string>()
    const rawOrder = ext && sourceMode == 'order'
        ? mergeSourceOrder(Array.isArray(local.order) ? local.order as string[] : [], Array.isArray(extRaw?.order) ? extRaw.order : [], sourceKeys)
        : Array.isArray(raw.order) ? raw.order as string[] : []
    const prelim = rawOrder.filter(k => known.has(k) && !items.find(i => i.key == k)?.fixed)
    for (const it of items)
        if (!it.fixed && prelim.indexOf(it.key) == -1) prelim.push(it.key)
    const order = pinFixedOrder(prelim, items)
    const rawVisible = raw.visible && typeof raw.visible == 'object' ? raw.visible as {[k: string]: boolean} : {}
    const visible: {[k: string]: boolean} = {}
    for (const it of items)
        visible[it.key] = it.fixed ? true : (rawVisible[it.key] ?? it.defaultVisible != false)
    // the gear/reset flags are toolbar-local: an external source only owns items
    const gearRaw = ((ext ? local.visible : rawVisible) ?? {}) as {[k: string]: unknown}
    visible[SETTINGS_KEY] = typeof gearRaw[SETTINGS_KEY] == 'boolean' ? gearRaw[SETTINGS_KEY] as boolean : true
    if (p.resetItem)
        visible[RESET_KEY] = typeof gearRaw[RESET_KEY] == 'boolean' ? gearRaw[RESET_KEY] as boolean : p.resetDefaultVisible
    const density = typeof local.density == 'string' && p.densityKeys.includes(local.density)
        ? local.density : (p.defDensity ?? p.densityKeys[0])
    return {order, visible, density}
}
