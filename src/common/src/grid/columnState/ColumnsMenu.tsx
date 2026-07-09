// ColumnsMenu - the icon menu over a columnState config: one button per
// column, a 1:1 mirror of the grid. Reorder a column in the grid - the buttons
// reorder; drag a button - the grid reorders. Two DECOUPLED layers, because
// "what a click means" is deliberately not this strip's business:
//
//   MenuStrip   - pure presentation. Ordered buttons, each in one of three
//                 states ('on' / 'off' / 'disabled') plus an optional
//                 adornment (marks) for "on with extras" (sub-columns,
//                 naming strategies...). It reports clicks and drag-reorders;
//                 it never interprets them. Reusable for ANY button strip
//                 with multi-state buttons (table standards cyclers etc.).
//
//   ColumnsMenu - the binding to a ColumnStateController: derives the items
//                 from order/visibility/presence, default click = toggle the
//                 column, drag = api.move. The click meaning is overridable
//                 (onItem) - multi-state columns plug in without touching the
//                 strip.
//
// A column REMOVED from the live grid (dynamic defs, "drop empty columns"
// standards) keeps its button: it renders 'disabled' (dashed, inert) and
// comes back to life when the column returns. No ag-grid, no storage here.
import React, {useRef} from 'react'
import {useReorder} from '../../hooks/useReorder'
import type {ColumnStateController, ColumnsConfig} from './columnState'

export type MenuStripItem = {
    /** stable id; reported back on click / in the reorder commit */
    key: string
    /** full name - tooltip / accessible label */
    title: string
    /** caption on the button (falls back to title) */
    short?: string
    icon?: React.ReactNode
    /** 'disabled' = the slot exists but its target is gone (column removed
     *  from the live grid): the button stays in place, inert */
    state: 'on' | 'off' | 'disabled'
    /** adornment for "on with extras": sub-column dots, mode marks... */
    marks?: React.ReactNode
    /** cannot be dragged (fixed columns) */
    fixed?: boolean
}

function colsMenuClass(parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(' ')
}

function MenuButton(p: {
    item: MenuStripItem
    onItem?: (key: string, e: React.MouseEvent) => void
    drag?: {onMouseDown: React.MouseEventHandler, onTouchStart: React.TouchEventHandler}
    className?: string
    style?: React.CSSProperties
    /** icon-only face: the icon, or the first letters of short/title as a
     *  text pseudo-icon; the full title stays in the tooltip */
    compact?: boolean
}) {
    const it = p.item
    const disabled = it.state == 'disabled'
    const on = it.state == 'on'
    const stateClass = disabled ? 'wenayColsMenuBtn_disabled' : on ? 'wenayColsMenuBtn_on' : 'wenayColsMenuBtn_off'
    const abbr = p.compact && it.icon == null
        ? <span className='wenayColsMenuAbbr'>
            {(it.short ?? it.title).slice(0, 3)}
        </span> : null
    return <div title={it.title}
                onClick={disabled ? undefined : e => p.onItem?.(it.key, e)}
                onMouseDown={p.drag?.onMouseDown}
                onTouchStart={p.drag?.onTouchStart}
                className={colsMenuClass(['wenayColsMenuBtn', stateClass, it.fixed && 'wenayColsMenuBtn_fixed', p.className])}
                style={p.style}>
        {it.icon != null && <span className='wenayColsMenuIcon'>{it.icon}</span>}
        {abbr}
        {!p.compact && <span className='wenayColsMenuLabel'>{it.short ?? it.title}</span>}
        {it.marks != null && <span className='wenayColsMenuMarks'>{it.marks}</span>}
    </div>
}

/** The presentation layer: renders the buttons in the given order, reports
 *  clicks (onItem) and drag-reorders (onMove) - never interprets either.
 *  Disabled buttons do not report clicks; fixed ones do not drag. */
export function MenuStrip(p: {
    items: MenuStripItem[]
    /** a click happened on this key - the MEANING lives a layer up */
    onItem?: (key: string, e: React.MouseEvent) => void
    /** present = items are drag-reorderable (one commit per drop) */
    onMove?: (order: string[]) => void
    /** preview rule for the drop (fixed pinning etc.) - same contract as
     *  useReorder.move, so the preview shows exactly what onMove receives */
    move?: (order: string[], key: string, to: number) => string[]
    /** trailing buttons after a divider, OUTSIDE the reorder list (mode
     *  cyclers, actions...); their clicks go to onItem like any other key */
    tail?: MenuStripItem[]
    /** hold before a touch drag starts, ms (default 150 - keeps page scroll usable) */
    holdMs?: number
    /** icon-only buttons (letters stand in for a missing icon) */
    compact?: boolean
    className?: string
    style?: React.CSSProperties
}) {
    const reorder = useReorder({
        order: p.items.map(i => i.key),
        commit: next => p.onMove?.(next),
        move: p.move,
        canDrag: k => !!p.onMove && !p.items.find(i => i.key == k)?.fixed,
        holdMs: p.holdMs ?? 150,
    })
    // A drag that ends over the button it started on still produces a browser
    // click - without this guard every snapped-back drag would ALSO toggle the
    // button. Track the press point; a click that travelled is not a click.
    const down = useRef<{x: number, y: number} | null>(null)
    function onItem(key: string, e: React.MouseEvent) {
        const d = down.current
        down.current = null
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
        p.onItem?.(key, e)
    }
    return <div className={colsMenuClass(['wenayColsMenu', p.className])} style={p.style}>
        {/* the reorder container holds ONLY the reorderable items (1:1 with order) */}
        <div ref={reorder.listRef} className='wenayColsMenuList'>
            {p.items.map(it => {
                const r = reorder.item(it.key)
                const drag = {
                    onMouseDown: (e: React.MouseEvent<HTMLElement>) => {
                        down.current = {x: e.clientX, y: e.clientY}
                        r.props.onMouseDown(e)
                    },
                    onTouchStart: r.props.onTouchStart,
                }
                const dragClass = r.dragging ? 'wenayColsMenuBtn_dragging' : r.active ? 'wenayColsMenuBtn_shift' : undefined
                return <MenuButton key={it.key} item={it} onItem={onItem} drag={drag} compact={p.compact}
                                   className={dragClass} style={r.style}/>
            })}
        </div>
        {!!p.tail?.length && <>
            <div className='wenayColsMenuDivider'/>
            {p.tail.map(it => <MenuButton key={it.key} item={it} onItem={p.onItem} compact={p.compact}/>)}
        </>}
    </div>
}

/** The binding layer: MenuStrip fed by a ColumnStateController. Buttons follow
 *  config.order (the grid mirror is free: both sides subscribe to the same
 *  config); state per button = disabled (column absent from the live grid) /
 *  on / off. Default click toggles visibility; pass onItem for richer,
 *  multi-state semantics - the strip below stays untouched. */
export function ColumnsMenu(p: {
    state: ColumnStateController
    /** what a click MEANS - a separate layer by design. Default: toggle the
     *  column's visibility (fixed columns ignore the default). */
    onItem?: (key: string, e: React.MouseEvent) => void
    /** "on with extras" adornment per column (enabled sub-columns, strategies...) */
    marks?: (key: string, cfg: ColumnsConfig) => React.ReactNode
    /** trailing non-column buttons (table standards cycler etc.) */
    tail?: MenuStripItem[]
    /** clicks on tail buttons */
    onTail?: (key: string, e: React.MouseEvent) => void
    /** drag reorder of the column buttons, mirrored to the grid (default on) */
    reorder?: boolean
    holdMs?: number
    /** icon-only buttons: the column's icon, or the first letters of its
     *  short/title as a text pseudo-icon (full title in the tooltip) */
    compact?: boolean
    className?: string
    style?: React.CSSProperties
}) {
    const cfg = p.state.api.useConfig()
    const present = p.state.api.usePresent()
    const byKey = new Map(p.state.columns.map(c => [c.key, c]))
    const items: MenuStripItem[] = cfg.order.filter(k => byKey.has(k)).map(k => {
        const c = byKey.get(k)!
        return {
            key: k, title: c.title, short: c.short, icon: c.icon, fixed: c.fixed,
            state: present && !present[k] ? 'disabled' : cfg.visible[k] != false ? 'on' : 'off',
            marks: p.marks?.(k, cfg),
        }
    })

    function onItem(key: string, e: React.MouseEvent) {
        if (!byKey.has(key)) return p.onTail?.(key, e)
        if (p.onItem) return p.onItem(key, e)
        if (byKey.get(key)?.fixed) return
        p.state.api.show(key, cfg.visible[key] == false)
    }

    /** Simulated drop with the same fixed pinning as the config's normalize():
     *  the drag preview never disagrees with where the button actually lands. */
    function movedOrder(order: string[], key: string, to: number): string[] {
        const next = order.slice()
        const from = next.indexOf(key)
        if (from == -1) return next
        next.splice(from, 1)
        next.splice(Math.max(0, Math.min(next.length, to)), 0, key)
        const res = next.filter(k => !byKey.get(k)?.fixed)
        p.state.columns.forEach(function pinFixed(c, i) {
            if (c.fixed) res.splice(Math.min(i, res.length), 0, c.key)
        })
        return res
    }

    return <MenuStrip items={items} tail={p.tail} onItem={onItem}
                      onMove={p.reorder == false ? undefined : order => p.state.api.move(order)}
                      move={movedOrder} holdMs={p.holdMs} compact={p.compact}
                      className={p.className} style={p.style}/>
}
