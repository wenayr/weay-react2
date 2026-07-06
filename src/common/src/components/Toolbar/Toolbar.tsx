import React, {useState} from 'react'
import {UseListen} from 'wenay-common2'
import {renderBy, updateBy} from '../../../updateBy'
import {staticGetAdd, staticMarkDirty} from '../../utils/mapMemory'
import {DivOutsideClick} from '../../hooks/useOutside'
import {useReorder} from '../../hooks/useReorder'

/** createToolbar - a customizable, self-describing toolbar primitive.
 *  Three decoupled layers: config (plain serializable data, persisted via
 *  staticProps -> Cash, same mechanics as createUiSlot), Bar (renders visible
 *  items in config order at config density) and Settings (a pure editor that
 *  only reads/writes config) - so the SAME Settings element works both in the
 *  Bar's own gear popover and in a global settings section.
 *  v1 non-goals: no overflow/"more" menu (an overflow hook would live in Bar,
 *  right after the visible-items map), no grouping, no cross-bar drag. */

export type tToolbarItem = {
    /** stable id (persist key) */
    key: string
    /** full human name - shown in the Settings list */
    title: string
    /** short caption for 'label' density (falls back to title) */
    short?: string
    /** compact glyph/icon for 'icon' density */
    icon: React.ReactNode
    /** full custom render; default = icon [+ short] by the density registry */
    render?: (density: string) => React.ReactNode
    /** convenience for plain action buttons; interactive items can also handle clicks inside render() */
    onClick?: (e: React.MouseEvent) => void
    /** default true */
    defaultVisible?: boolean
    /** cannot be hidden or reordered (pinned to its index in opts.items) */
    fixed?: boolean
}

export type tToolbarConfig = {
    /** item keys, display order */
    order: string[]
    visible: {[key: string]: boolean}
    /** a key from the density registry ('icon' | 'label' | registered extras) */
    density: string
}

export type tToolbarDensity = {
    key: string
    /** human name for the Settings segmented control */
    name: string
    /** how one item renders at this density; absent = icon + (short ?? title) */
    renderItem?: (item: tToolbarItem) => React.ReactNode
}

// Module singleton (closure + updateBy subscription, no React context) - same
// pattern as the settings-section registry. Two built-in levels; a third
// ("full" text etc.) is just one more registration.
const densities = {list: [
    {key: 'icon', name: 'Icons', renderItem: itemIconOnly},
    {key: 'label', name: 'Icons + labels'},
] as tToolbarDensity[]}

function itemIconOnly(item: tToolbarItem) {
    return item.icon
}

/** Register an extra density level. Re-register with the same key replaces the
 *  previous one. The returned function removes exactly this registration. */
export function registerToolbarDensity(d: tToolbarDensity) {
    const i = densities.list.findIndex(e => e.key == d.key)
    if (i == -1) densities.list.push(d)
    else densities.list.splice(i, 1, d)
    renderBy(densities)
    return function offToolbarDensity() {
        const j = densities.list.indexOf(d)
        if (j != -1) {
            densities.list.splice(j, 1)
            renderBy(densities)
        }
    }
}

/** Current density registry (built-ins + registered). */
export function getToolbarDensities(): readonly tToolbarDensity[] {
    return densities.list
}

function itemContent(item: tToolbarItem, densityKey: string) {
    if (item.render) return item.render(densityKey)
    const d = densities.list.find(e => e.key == densityKey)
    if (d?.renderItem) return d.renderItem(item)
    return <>
        <span className='wenayTbIcon'>{item.icon}</span>
        <span className='wenayTbLabel'>{item.short ?? item.title}</span>
    </>
}

/** Reserved visible-map key for the bar's settings (gear) button: not part of
 *  order (the gear always sits at the bar edge), but toggleable like an item. */
const SETTINGS_KEY = '__settings'

export function createToolbar(opts: {
    /** persistence key (staticProps -> Cash), like createUiSlot */
    key: string
    /** item descriptors; the config only ever references them by key */
    items: tToolbarItem[]
    /** defaults; missing fields are derived from items */
    def?: Partial<tToolbarConfig>
    /** the gear button's face: icon/title default to a plain gear svg. The gear
     *  renders only when Bar mounts with settings, AND visible['__settings'] is
     *  not false - the Settings editor shows a separated toggle row for it. */
    settingsItem?: {title?: string, icon?: React.ReactNode}
}) {
    const defConfig = (): tToolbarConfig => ({
        order: opts.def?.order?.slice() ?? opts.items.map(i => i.key),
        visible: opts.def?.visible ? {...opts.def.visible} : Object.fromEntries(opts.items.map(i => [i.key, i.defaultVisible != false])),
        density: opts.def?.density ?? densities.list[0].key,
    })
    const st = staticGetAdd<tToolbarConfig>(opts.key, defConfig())
    const [emitChange, onChange] = UseListen<[tToolbarConfig]>()

    /** The persisted state may be stale or partial (older app version, removed
     *  items, an unregistered density) - never crash, never drop user data that
     *  still applies: unknown keys are filtered out, missing items are appended
     *  (default-visible), fixed items are pinned back to their descriptor index. */
    function normalize(): tToolbarConfig {
        const known = new Set(opts.items.map(i => i.key))
        const rawOrder = Array.isArray(st.order) ? st.order : []
        const order = rawOrder.filter(k => known.has(k) && !opts.items.find(i => i.key == k)?.fixed)
        for (const it of opts.items)
            if (!it.fixed && order.indexOf(it.key) == -1) order.push(it.key)
        opts.items.forEach(function pinFixed(it, i) {
            if (it.fixed) order.splice(Math.min(i, order.length), 0, it.key)
        })
        const rawVisible = st.visible && typeof st.visible == 'object' ? st.visible : {}
        const visible: {[k: string]: boolean} = {}
        for (const it of opts.items)
            visible[it.key] = it.fixed ? true : (rawVisible[it.key] ?? it.defaultVisible != false)
        visible[SETTINGS_KEY] = typeof rawVisible[SETTINGS_KEY] == 'boolean' ? rawVisible[SETTINGS_KEY] : true
        const density = typeof st.density == 'string' && densities.list.some(d => d.key == st.density)
            ? st.density : (opts.def?.density ?? densities.list[0].key)
        return {order, visible, density}
    }

    /** Every edit funnels through here: mutate the persisted object in place
     *  (identity is the updateBy/renderBy subscription key), announce, mark the
     *  cache dirty, emit outward. */
    function setConfig(next: tToolbarConfig) {
        st.order = next.order.slice()
        st.visible = {...next.visible}
        st.density = next.density
        renderBy(st)
        staticMarkDirty(opts.key)
        emitChange(normalize())
    }

    const getConfig = () => normalize()

    function useConfig() {
        updateBy(st)
        return normalize()
    }

    /** Headless bar: the ordered, visibility-filtered items plus their rendered
     *  content at the current density - build fully custom bar markup on top,
     *  while the same Settings editor still drives order/visibility/density.
     *  (Refs are the wrong contract here: the ORDER lives in the config, so the
     *  consumer re-renders from this list rather than the library re-parenting
     *  someone else's nodes.) */
    function useItems() {
        updateBy(st)
        updateBy(densities)
        const cfg = normalize()
        const byKey = new Map(opts.items.map(i => [i.key, i]))
        return cfg.order
            .map(k => byKey.get(k))
            .filter((it): it is tToolbarItem => !!it && cfg.visible[it.key] != false)
            .map(it => ({item: it, density: cfg.density, content: itemContent(it, cfg.density)}))
    }

    const reset = () => setConfig(defConfig())

    const settingsTitle = () => opts.settingsItem?.title ?? 'Toolbar settings'
    const settingsIcon = () => opts.settingsItem?.icon ??
        <svg width='14' height='14' viewBox='0 0 16 16' aria-hidden='true'>
            <path d='M8 5.2 A2.8 2.8 0 1 0 8 10.8 A2.8 2.8 0 1 0 8 5.2 M8 1.2 L8.6 3.4 A4.8 4.8 0 0 1 10.6 4.2 L12.8 3.2 L14 5.6 L12.2 7 A4.8 4.8 0 0 1 12.2 9 L14 10.4 L12.8 12.8 L10.6 11.8 A4.8 4.8 0 0 1 8.6 12.6 L8 14.8 L7.4 12.6 A4.8 4.8 0 0 1 5.4 11.8 L3.2 12.8 L2 10.4 L3.8 9 A4.8 4.8 0 0 1 3.8 7 L2 5.6 L3.2 3.2 L5.4 4.2 A4.8 4.8 0 0 1 7.4 3.4 Z'
                  fill='none' stroke='currentColor' strokeWidth='1.2' strokeLinejoin='round'/>
        </svg>

    function moveKey(cfg: tToolbarConfig, key: string, to: number) {
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
     *  global settings menu. popAlign: which bar edge the popover sticks to -
     *  'right' (default, for bars in a top-right corner) or 'left'. */
    function Bar(p: {className?: string, settings?: boolean, popAlign?: 'left' | 'right'} = {}) {
        updateBy(st)
        updateBy(densities)
        const cfg = normalize()
        const [open, setOpen] = useState(false)
        const byKey = new Map(opts.items.map(i => [i.key, i]))
        return <div className={p.className ?? 'wenayTb'}>
            {cfg.order.map(k => {
                const it = byKey.get(k)
                if (!it || cfg.visible[k] == false) return null
                return <div key={k} className='wenayTbItem'
                            title={cfg.density == 'icon' ? it.title : undefined}
                            onClick={it.onClick}>
                    {itemContent(it, cfg.density)}
                </div>
            })}
            {p.settings && cfg.visible[SETTINGS_KEY] != false && <DivOutsideClick className='wenayTbGear' status={open} outsideClick={() => setOpen(false)}>
                <div className='wenayTbItem' title={settingsTitle()}
                     onClick={() => setOpen(v => !v)}>
                    {settingsIcon()}
                </div>
                {open && <div className={p.popAlign == 'left' ? 'wenayTbPop wenayTbPopLeft' : 'wenayTbPop'}>
                    <Settings/>
                </div>}
            </DivOutsideClick>}
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
        updateBy(st)
        updateBy(densities)
        const cfg = normalize()
        const base = p.className ?? 'wenaySegBtn'
        const activeCls = p.activeClassName ?? 'wenaySegBtnActive'
        const byKey = new Map(opts.items.map(i => [i.key, i]))

        /** Simulated commit: splice + the same fixed pinning as normalize(). */
        function movedOrder(order: string[], key: string, to: number): string[] {
            const next = order.slice()
            const from = next.indexOf(key)
            if (from == -1) return next
            next.splice(from, 1)
            next.splice(Math.max(0, Math.min(next.length, to)), 0, key)
            const res = next.filter(k => !byKey.get(k)?.fixed)
            opts.items.forEach(function pinFixed(it, i) {
                if (it.fixed) res.splice(Math.min(i, res.length), 0, it.key)
            })
            return res
        }

        const reorder = useReorder({
            order: cfg.order,
            commit: order => setConfig({...cfg, order}),
            move: movedOrder,
            canDrag: k => !byKey.get(k)?.fixed,
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
                        <span className='wenayTbIcon'>{it.icon}</span>
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
        </div>
    }

    return {
        Bar,
        Settings,
        api: {useConfig, useItems, getConfig, setConfig, reset, onChange},
    }
}
