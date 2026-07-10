import React, {useLayoutEffect, useRef, useState} from 'react'
import {listen as createListen} from 'wenay-common2'
import {createUpdateApi} from '../../../updateBy'
import {memoryGetOrCreate, memoryMarkDirty} from '../../utils/memoryStore'
import {pinFixedOrder, movedOrderWithFixed} from '../../utils/fixedOrder'
import {OutsideClickArea} from '../../hooks/useOutside'
import {useReorder} from '../../hooks/useReorder'

/** createToolbar - a customizable, self-describing toolbar primitive.
 *  Three decoupled layers: config (plain serializable data, persisted via
 *  memoryProps -> memoryCache, same mechanics as createUiSlot), Bar (renders visible
 *  items in config order at config density) and Settings (a pure editor that
 *  only reads/writes config) - so the SAME Settings element works both in the
 *  Bar's own gear popover and in a global settings section.
 *  v1 non-goals: no overflow/"more" menu (an overflow hook would live in Bar,
 *  right after the visible-items map), no grouping, no cross-bar drag. */

export type ToolbarItem = {
    /** stable id (persist key) */
    key: string
    /** full human name - shown in the Settings list */
    title: string
    /** short caption for 'label' density (falls back to title) */
    short?: string
    /** compact glyph/icon for 'icon' density; absent = the first letters of
     *  short/title render as a text pseudo-icon */
    icon?: React.ReactNode
    /** full custom render; default = icon [+ short] by the density registry */
    render?: (density: string) => React.ReactNode
    /** convenience for plain action buttons; interactive items can also handle clicks inside render() */
    onClick?: (e: React.MouseEvent) => void
    /** default true */
    defaultVisible?: boolean
    /** cannot be hidden or reordered (pinned to its index in opts.items) */
    fixed?: boolean
}

export type ToolbarConfig = {
    /** item keys, display order */
    order: string[]
    visible: {[key: string]: boolean}
    /** a key from the density registry ('icon' | 'label' | registered extras) */
    density: string
}

/** The order/visibility slice of a config - what an external source owns. */
export type UiListConfig = {
    order: string[]
    visible: {[key: string]: boolean}
}

export type ToolbarSourceMode = 'orderVisible' | 'order'

/** An external owner of order/visibility that a Toolbar can run on instead of
 *  its own store - e.g. columnState's listSource: the SAME config the grid
 *  syncs with, so dragging a column in the grid reorders the toolbar and
 *  vice versa. Density and the gear/reset flags stay toolbar-local (persisted under
 *  the toolbar's own key). useConfig must be a React hook (subscription). */
export type UiListSource = {
    useConfig: () => UiListConfig
    getConfig: () => UiListConfig
    setConfig: (next: UiListConfig) => void
    /** re-emitted as the toolbar's own onChange (grid-driven changes included) */
    onChange?: (cb: (cfg: UiListConfig) => void) => () => void
    /** optional transient display order; never persisted */
    useBaseConfig?: () => UiListConfig
    getBaseConfig?: () => UiListConfig
    setPreview?: (order: string[] | null) => void
}

export type ToolbarDensity = {
    key: string
    /** human name for the Settings segmented control */
    name: string
    /** how one item renders at this density; absent = icon + (short ?? title) */
    renderItem?: (item: ToolbarItem) => React.ReactNode
}

// Module singleton (closure + updateBy subscription, no React context) - same
// pattern as the settings-section registry. Two built-in levels; a third
// ("full" text etc.) is just one more registration.
const densities = {list: [
    {key: 'icon', name: 'Icons', renderItem: itemIconOnly},
    {key: 'label', name: 'Icons + labels'},
] as ToolbarDensity[]}
const densitiesApi = createUpdateApi(densities)

/** Icon with a text fallback: no glyph = the first letters of short/title
 *  (an "PR"-style pseudo-icon), so icon densities work for icon-less items. */
export function toolbarItemIcon(item: {icon?: React.ReactNode, short?: string, title: string}): React.ReactNode {
    // No real icon -> a text pseudo-icon (first 3 letters). Rendered a touch lighter
    // (lower weight + opacity) so this fallback does not read as a bold label.
    return item.icon ?? <span style={{fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.65}}>
        {(item.short ?? item.title).slice(0, 3)}
    </span>
}

function itemIconOnly(item: ToolbarItem) {
    return toolbarItemIcon(item)
}

/** Register an extra density level. Re-register with the same key replaces the
 *  previous one. The returned function removes exactly this registration. */
export function registerToolbarDensity(d: ToolbarDensity) {
    const i = densities.list.findIndex(e => e.key == d.key)
    if (i == -1) densities.list.push(d)
    else densities.list.splice(i, 1, d)
    densitiesApi.render()
    return function offToolbarDensity() {
        const j = densities.list.indexOf(d)
        if (j != -1) {
            densities.list.splice(j, 1)
            densitiesApi.render()
        }
    }
}

/** Current density registry (built-ins + registered). */
export function getToolbarDensities(): readonly ToolbarDensity[] {
    return densities.list
}

function itemContent(item: ToolbarItem, densityKey: string) {
    if (item.render) return item.render(densityKey)
    const d = densities.list.find(e => e.key == densityKey)
    if (d?.renderItem) return d.renderItem(item)
    return <>
        {item.icon != null && <span className='wenayTbIcon'>{item.icon}</span>}
        <span className='wenayTbLabel'>{item.short ?? item.title}</span>
    </>
}

/** Reserved visible-map key for the bar's settings (gear) button: not part of
 *  order (the gear always sits at the bar edge), but toggleable like an item. */
const SETTINGS_KEY = '__settings'
const RESET_KEY = '__reset'

function useToolbarFlip(layoutKey: string) {
    const itemRefs = useRef(new Map<string, HTMLDivElement>())
    const prevRects = useRef(new Map<string, {left: number, top: number}>())
    const rafs = useRef<number[]>([])

    useLayoutEffect(() => {
        const prev = prevRects.current
        const next = new Map<string, {left: number, top: number}>()
        rafs.current.forEach(cancelAnimationFrame)
        rafs.current = []

        itemRefs.current.forEach((node, key) => {
            const rect = node.getBoundingClientRect()
            next.set(key, {left: rect.left, top: rect.top})
            const old = prev.get(key)
            if (old == null) return
            const dx = old.left - rect.left
            const dy = old.top - rect.top
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
            node.style.transition = 'none'
            node.style.transform = `translate(${dx}px, ${dy}px)`
            node.getBoundingClientRect()
            const raf = requestAnimationFrame(() => {
                node.style.transition = 'transform 180ms ease'
                node.style.transform = ''
            })
            rafs.current.push(raf)
        })

        prevRects.current = next
        return () => {
            rafs.current.forEach(cancelAnimationFrame)
            rafs.current = []
        }
    }, [layoutKey])

    return function bind(key: string) {
        return (node: HTMLDivElement | null) => {
            if (node) itemRefs.current.set(key, node)
            else itemRefs.current.delete(key)
        }
    }
}

export function createToolbar(opts: {
    /** persistence key (memoryProps -> memoryCache), like createUiSlot */
    key: string
    /** item descriptors; the config only ever references them by key */
    items: ToolbarItem[]
    /** defaults; missing fields are derived from items */
    def?: Partial<ToolbarConfig>
    /** the gear button's face: icon/title default to a plain gear svg. The gear
     *  renders only when Bar mounts with settings, AND visible['__settings'] is
     *  not false - the Settings editor shows a separated toggle row for it. */
    settingsItem?: {title?: string, icon?: React.ReactNode}
    /** reset button face. The reset feature exists by default, but the bar
     *  button is hidden until Settings/showReset enables it; pass false to
     *  remove the feature. */
    resetItem?: false | {title?: string, icon?: React.ReactNode, defaultVisible?: boolean}
    /** external owner of order/visibility (columnState.api.listSource etc.):
     *  the toolbar becomes a VIEW over that config - Bar/Settings edit it, and
     *  outside changes (a column dragged in the grid) reorder the toolbar.
     *  Item keys should match the source's keys 1:1. Density and the gear/reset flags
     *  remain in the toolbar's own store under `key`. Default: own store. */
    source?: UiListSource
    /** Default 'orderVisible': source owns both item order and item visibility.
     *  'order': source owns only the relative order of source keys; item membership,
     *  density, pseudo-controls, and extra non-source item positions stay local. */
    sourceMode?: ToolbarSourceMode
}) {
    const resetDefaultVisible = () => opts.resetItem !== false && opts.resetItem?.defaultVisible === true

    const defConfig = (): ToolbarConfig => ({
        order: opts.def?.order?.slice() ?? opts.items.map(i => i.key),
        visible: opts.def?.visible ? {...opts.def.visible} : Object.fromEntries(opts.items.map(i => [i.key, i.defaultVisible != false])),
        density: opts.def?.density ?? densities.list[0].key,
    })
    const st = memoryGetOrCreate<ToolbarConfig>(opts.key, defConfig())
    const stApi = createUpdateApi(st)
    const [emitChange, onChange] = createListen<[ToolbarConfig]>()
    // ext is fixed for the controller's lifetime, so hook call order inside
    // useConfig/Bar/Settings never changes for a given toolbar instance
    const ext = opts.source
    const sourceMode: ToolbarSourceMode = ext ? (opts.sourceMode ?? 'orderVisible') : 'orderVisible'
    // outside edits of the external config (grid drags...) must reach the
    // toolbar's own subscribers too; lives until dispose() (repeated factories over
    // one key used to leak a permanent listener per call - HMR, remounts)
    const offSource = ext?.onChange?.(() => emitChange(normalize()))

    function sameOrder(a: string[], b: string[]) {
        return a.length == b.length && a.every((k, i) => k == b[i])
    }

    function sourceKeySet(raw: UiListConfig | undefined, known: Set<string>) {
        return new Set((Array.isArray(raw?.order) ? raw.order : []).filter(k => known.has(k)))
    }

    function mergeSourceOrder(localOrder: string[], rawSourceOrder: string[], sourceKeys: Set<string>) {
        if (!sourceKeys.size) return localOrder
        const sourceOrder = rawSourceOrder.filter(k => sourceKeys.has(k))
        let i = 0
        return localOrder.map(k => sourceKeys.has(k) ? (sourceOrder[i++] ?? k) : k)
    }

    /** The persisted state may be stale or partial (older app version, removed
     *  items, an unregistered density) - never crash, never drop user data that
     *  still applies: unknown keys are filtered out, missing items are appended
     *  (default-visible), fixed items are pinned back to their descriptor index. */
    function normalize(base = false): ToolbarConfig {
        const known = new Set(opts.items.map(i => i.key))
        const extRaw = ext ? (base ? (ext.getBaseConfig?.() ?? ext.getConfig()) : ext.getConfig()) : undefined
        const localRaw = {order: st.order, visible: st.visible}
        const raw = ext && sourceMode == 'orderVisible' ? extRaw! : localRaw
        const sourceKeys = ext && sourceMode == 'order' ? sourceKeySet(extRaw, known) : new Set<string>()
        const rawOrder = ext && sourceMode == 'order'
            ? mergeSourceOrder(Array.isArray(st.order) ? st.order : [], Array.isArray(extRaw?.order) ? extRaw.order : [], sourceKeys)
            : Array.isArray(raw.order) ? raw.order : []
        const prelim = rawOrder.filter(k => known.has(k) && !opts.items.find(i => i.key == k)?.fixed)
        for (const it of opts.items)
            if (!it.fixed && prelim.indexOf(it.key) == -1) prelim.push(it.key)
        const order = pinFixedOrder(prelim, opts.items)
        const rawVisible = raw.visible && typeof raw.visible == 'object' ? raw.visible : {}
        const visible: {[k: string]: boolean} = {}
        for (const it of opts.items)
            visible[it.key] = it.fixed ? true : (rawVisible[it.key] ?? it.defaultVisible != false)
        // the gear/reset flags are toolbar-local: an external source only owns items
        const gearRaw = (ext ? st.visible : rawVisible) ?? {}
        visible[SETTINGS_KEY] = typeof gearRaw[SETTINGS_KEY] == 'boolean' ? gearRaw[SETTINGS_KEY] : true
        if (opts.resetItem !== false)
            visible[RESET_KEY] = typeof gearRaw[RESET_KEY] == 'boolean' ? gearRaw[RESET_KEY] : resetDefaultVisible()
        const density = typeof st.density == 'string' && densities.list.some(d => d.key == st.density)
            ? st.density : (opts.def?.density ?? densities.list[0].key)
        return {order, visible, density}
    }

    function metaVisible(next: ToolbarConfig, key: string, def: boolean) {
        return typeof next.visible[key] == 'boolean' ? next.visible[key] : def
    }

    /** Every edit funnels through here: mutate the persisted object in place
     *  (identity is the updateBy/renderBy subscription key), announce, mark the
     *  cache dirty, emit outward. With an external source the items' order and
     *  visibility go THERE (its own change flow re-emits); density + gear/reset flags
     *  always stay in the toolbar's own store. */
    function setConfig(next: ToolbarConfig) {
        if (ext && sourceMode == 'orderVisible') {
            const visible = {...next.visible}
            delete visible[SETTINGS_KEY]
            delete visible[RESET_KEY]
            st.visible = {
                ...st.visible,
                [SETTINGS_KEY]: metaVisible(next, SETTINGS_KEY, true),
                [RESET_KEY]: metaVisible(next, RESET_KEY, resetDefaultVisible()),
            }
            st.density = next.density
            stApi.render()
            memoryMarkDirty(opts.key)
            ext.setConfig({order: next.order.slice(), visible})
            // the source's own onChange already re-emitted; emit only when it can't
            if (!ext.onChange) emitChange(normalize())
        } else if (ext && sourceMode == 'order') {
            const extRaw = ext.getBaseConfig?.() ?? ext.getConfig()
            const known = new Set(opts.items.map(i => i.key))
            const sourceKeys = sourceKeySet(extRaw, known)
            const curSourceOrder = (Array.isArray(extRaw.order) ? extRaw.order : []).filter(k => sourceKeys.has(k))
            const nextSourceOrder = next.order.filter(k => sourceKeys.has(k))
            st.order = next.order.slice()
            st.visible = {...next.visible}
            st.density = next.density
            stApi.render()
            memoryMarkDirty(opts.key)
            const orderChanged = !sameOrder(curSourceOrder, nextSourceOrder)
            if (orderChanged)
                ext.setConfig({
                    order: nextSourceOrder,
                    visible: extRaw.visible && typeof extRaw.visible == 'object' ? {...extRaw.visible} : {},
                })
            if (!orderChanged || !ext.onChange) emitChange(normalize())
        } else {
            st.order = next.order.slice()
            st.visible = {...next.visible}
            st.density = next.density
            stApi.render()
            memoryMarkDirty(opts.key)
            emitChange(normalize())
        }
    }

    const getConfig = () => normalize()

    /** subscription to everything the toolbar renders from (hook) */
    function useSubscribe(base = false) {
        stApi.use()
        if (base && ext?.useBaseConfig) ext.useBaseConfig()
        else ext?.useConfig() // ext is per-instance constant - hook order is stable
    }

    function useConfig() {
        useSubscribe()
        return normalize()
    }

    /** Headless bar: the ordered, visibility-filtered items plus their rendered
     *  content at the current density - build fully custom bar markup on top,
     *  while the same Settings editor still drives order/visibility/density.
     *  (Refs are the wrong contract here: the ORDER lives in the config, so the
     *  consumer re-renders from this list rather than the library re-parenting
     *  someone else's nodes.) */
    function useItems() {
        useSubscribe()
        densitiesApi.use()
        const cfg = normalize()
        const byKey = new Map(opts.items.map(i => [i.key, i]))
        return cfg.order
            .map(k => byKey.get(k))
            .filter((it): it is ToolbarItem => !!it && cfg.visible[it.key] != false)
            .map(it => ({item: it, density: cfg.density, content: itemContent(it, cfg.density)}))
    }

    const reset = () => setConfig(defConfig())
    function setOrder(order: string[]) {
        setConfig({...getConfig(), order: order.slice()})
    }
    function show(key: string, on: boolean) {
        const cfg = getConfig()
        setConfig({...cfg, visible: {...cfg.visible, [key]: on}})
    }
    function setDensity(density: string) {
        setConfig({...getConfig(), density})
    }
    const showSettings = (on: boolean) => show(SETTINGS_KEY, on)
    const showReset = (on: boolean) => show(RESET_KEY, on)

    const settingsTitle = () => opts.settingsItem?.title ?? 'Toolbar settings'
    const settingsIcon = () => opts.settingsItem?.icon ??
        <svg width='14' height='14' viewBox='0 0 16 16' aria-hidden='true'>
            <path d='M8 5.2 A2.8 2.8 0 1 0 8 10.8 A2.8 2.8 0 1 0 8 5.2 M8 1.2 L8.6 3.4 A4.8 4.8 0 0 1 10.6 4.2 L12.8 3.2 L14 5.6 L12.2 7 A4.8 4.8 0 0 1 12.2 9 L14 10.4 L12.8 12.8 L10.6 11.8 A4.8 4.8 0 0 1 8.6 12.6 L8 14.8 L7.4 12.6 A4.8 4.8 0 0 1 5.4 11.8 L3.2 12.8 L2 10.4 L3.8 9 A4.8 4.8 0 0 1 3.8 7 L2 5.6 L3.2 3.2 L5.4 4.2 A4.8 4.8 0 0 1 7.4 3.4 Z'
                  fill='none' stroke='currentColor' strokeWidth='1.2' strokeLinejoin='round'/>
        </svg>
    const resetOpts = () => opts.resetItem === false ? undefined : opts.resetItem
    const resetTitle = () => resetOpts()?.title ?? 'Reset toolbar'
    const resetIcon = () => resetOpts()?.icon ??
        <svg width='14' height='14' viewBox='0 0 16 16' aria-hidden='true'>
            <path d='M3.2 5.5 A5.2 5.2 0 1 1 4.1 11.7 M3.2 5.5 H6.4 M3.2 5.5 V2.3'
                  fill='none' stroke='currentColor' strokeWidth='1.4' strokeLinecap='round' strokeLinejoin='round'/>
        </svg>

    function moveKey(cfg: ToolbarConfig, key: string, to: number) {
        const order = cfg.order.slice()
        const from = order.indexOf(key)
        if (from == -1) return
        to = Math.max(0, Math.min(order.length - 1, to))
        if (to == from) return
        order.splice(from, 1)
        order.splice(to, 0, key)
        setConfig({...cfg, order})
    }

    /** The live bar. settings=true adds a built-in gear opening Settings in a
     *  local popover - optional, some consumers mount Settings only in the
     *  global settings menu. reset permits rendering the reset button when its
     *  pseudo-control is enabled (hidden by default). popAlign: which bar edge
     *  the popover sticks to - 'right' (default, for bars in a top-right corner)
     *  or 'left'. */
    function Bar(p: {className?: string, settings?: boolean, reset?: boolean, popAlign?: 'left' | 'right'} = {}) {
        const items = useItems()
        const cfg = normalize()
        const [open, setOpen] = useState(false)
        const resetOn = opts.resetItem !== false && (p.reset ?? p.settings ?? false) && cfg.visible[RESET_KEY] != false
        const settingsOn = !!p.settings && cfg.visible[SETTINGS_KEY] != false
        const layoutKey = [
            ...items.map(x => `${x.item.key}:${x.density}`),
            resetOn ? `${RESET_KEY}:on` : '',
            settingsOn ? `${SETTINGS_KEY}:on` : '',
        ].join('|')
        const bindFlip = useToolbarFlip(layoutKey)

        return <div className={p.className ?? 'wenayTb'}>
            {items.map(x => <div key={x.item.key} ref={bindFlip(x.item.key)} className='wenayTbItem'
                             title={x.density == 'icon' ? x.item.title : undefined}
                             onClick={x.item.onClick}>
                {x.content}
            </div>)}
            {resetOn && <div ref={bindFlip(RESET_KEY)} className='wenayTbItem' title={resetTitle()}
                             onClick={() => reset()}>
                {resetIcon()}
            </div>}
            {settingsOn && <OutsideClickArea className='wenayTbGear' status={open} outsideClick={() => setOpen(false)}>
                <div ref={bindFlip(SETTINGS_KEY)} className='wenayTbItem' title={settingsTitle()}
                     onClick={() => setOpen(v => !v)}>
                    {settingsIcon()}
                </div>
                {open && <div className={p.popAlign == 'left' ? 'wenayTbPop wenayTbPopLeft' : 'wenayTbPop'}>
                    <Settings/>
                </div>}
            </OutsideClickArea>}
        </div>
    }

    /** The pure editor over config: density segments + one row per item
     *  (visibility checkbox, icon preview, title, drag handle). Reorder rides the
     *  library's useReorder (this editor is its first consumer): the whole row
     *  drags (mouse and touch; the checkbox is excluded), and `move` is the SAME
     *  simulated commit as normalize() (splice + fixed pinning), so fixed rows
     *  never move in the preview and a drop never lands elsewhere than shown.
     *  Plus arrow keys on the focused handle; fixed rows have neither. */
    function Settings(p: {className?: string, activeClassName?: string} = {}) {
        // BASE config on purpose: Settings is the preview AUTHOR (onPreviewChange ->
        // ext.setPreview). Rendering from the display config would feed its own
        // preview back mid-drag: the rows' DOM order changes under the pointer
        // (useReorder requires it stable), styles jump, and the drop re-applies
        // the move over the already-previewed order - one extra row.
        useSubscribe(true)
        densitiesApi.use()
        const cfg = normalize(true)
        const base = p.className ?? 'wenaySegBtn'
        const activeCls = p.activeClassName ?? 'wenaySegBtnActive'
        const byKey = new Map(opts.items.map(i => [i.key, i]))

        /** Simulated commit: splice + the same fixed pinning as normalize() (shared utils/fixedOrder). */
        function movedOrder(order: string[], key: string, to: number): string[] {
            return movedOrderWithFixed(order, key, to, opts.items)
        }

        const reorder = useReorder({
            order: cfg.order,
            commit: order => setConfig({...cfg, order}),
            move: movedOrder,
            canDrag: k => !byKey.get(k)?.fixed,
            onPreviewChange: order => ext?.setPreview?.(order),
        })

        function onHandleKey(key: string, e: React.KeyboardEvent) {
            const step = {ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1}[e.key]
            if (!step) return
            e.preventDefault()
            moveKey(cfg, key, cfg.order.indexOf(key) + step)
        }
        return <div className='wenayTbSettings'>
            <div className='wenayTbDensity'>
                {densities.list.map(d => (
                    <div key={d.key}
                         className={d.key == cfg.density ? `${base} ${activeCls}` : base}
                         onClick={() => setConfig({...cfg, density: d.key})}>{d.name}</div>
                ))}
            </div>
            <div className='wenayTbRows' ref={reorder.listRef}>
                {cfg.order.map(k => {
                    const it = byKey.get(k)
                    if (!it) return null
                    const r = reorder.item(k)
                    let cls = it.fixed ? 'wenayTbRow' : 'wenayTbRow wenayTbRowGrab'
                    if (r.active) cls += r.dragging ? ' wenayTbRowDrag' : ' wenayTbRowShift' // Shift is transitioned, so displaced rows glide
                    return <div key={k} className={cls} style={r.style}
                                onMouseDown={it.fixed ? undefined : e => {
                                    // the drag hook preventDefaults mousedown, which suppresses native focus
                                    if (!(e.target as HTMLElement).closest('input'))
                                        (e.currentTarget.querySelector('.wenayTbHandle') as HTMLElement | null)?.focus()
                                    r.props.onMouseDown(e)
                                }}
                                onTouchStart={it.fixed ? undefined : r.props.onTouchStart}>
                        <input type='checkbox' disabled={it.fixed}
                               checked={cfg.visible[k] != false}
                               onChange={() => setConfig({...cfg, visible: {...cfg.visible, [k]: !(cfg.visible[k] != false)}})}/>
                        <span className='wenayTbIcon'>{toolbarItemIcon(it)}</span>
                        <span className='wenayTbRowTitle'>{it.title}</span>
                        {!it.fixed && <div className='wenayTbHandle' tabIndex={0} title='Drag or arrow keys to reorder'
                                           onKeyDown={e => onHandleKey(k, e)}>⠿</div>}
                    </div>
                })}
            </div>
            {/* The gear is not an item (no order slot - it always sits at the bar edge),
                but hiding it from the bar is a config edit like any other. Deliberately
                OUTSIDE the rows container so it adds no drag slot. */}
            <div className='wenayTbRow wenayTbRowMeta'>
                <input type='checkbox'
                       checked={cfg.visible[SETTINGS_KEY] != false}
                       onChange={() => setConfig({...cfg, visible: {...cfg.visible, [SETTINGS_KEY]: !(cfg.visible[SETTINGS_KEY] != false)}})}/>
                <span className='wenayTbIcon'>{settingsIcon()}</span>
                <span className='wenayTbRowTitle'>{settingsTitle()}</span>
            </div>
            {opts.resetItem !== false && <div className='wenayTbRow wenayTbRowMeta'>
                <input type='checkbox'
                       checked={cfg.visible[RESET_KEY] != false}
                       onChange={() => setConfig({...cfg, visible: {...cfg.visible, [RESET_KEY]: !(cfg.visible[RESET_KEY] != false)}})}/>
                <span className='wenayTbIcon'>{resetIcon()}</span>
                <span className='wenayTbRowTitle'>{resetTitle()}</span>
                <button type='button' className='wenayTbMetaAction' title={resetTitle()} onClick={() => reset()}>{resetIcon()}</button>
            </div>}
        </div>
    }

    /** Release the external-source subscription. The persisted config itself stays -
     *  dispose() is about listener lifetime (HMR, remounts), not about state. */
    function dispose() {
        offSource?.()
    }

    return {
        Bar,
        Settings,
        api: {useConfig, useItems, getConfig, setConfig, setOrder, show, setDensity, showSettings, showReset, reset, onChange, dispose},
    }
}
