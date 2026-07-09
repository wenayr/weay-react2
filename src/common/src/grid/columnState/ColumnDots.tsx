// ColumnDots - the mobile column selector: a track of marks (one per column)
// with dots on the columns that are currently shown. Placing a dot IS showing
// the column; the card view (CardList) rebuilds from the same config live.
// Gestures (pointer events, mouse + touch):
//   drag a dot along the track  -> the dot slides to another (empty) mark: that
//                                  column replaces the old one
//   swipe a dot UP (flick off)  -> the dot tears off the track: column hidden
//   tap an empty mark           -> a dot appears there: column shown
//   tap a dot (no move)         -> select the field (highlight); the sort
//                                  button cycles asc -> desc -> off on the
//                                  SELECTED field. Sort is sticky: selecting
//                                  another dot does not touch it, and it may
//                                  point at a hidden column.
// No ag-grid, no storage - only the columnState config.
import React, {useRef, useState} from 'react'
import type {ColumnStateController} from './columnState'

/** Dominant-axis thresholds: a gesture is a REMOVE only when it is clearly
 *  vertical and clearly upward - a horizontal drag or a page scroll never is. */
const REMOVE_DY = 32
const MOVE_SLOP = 4

type tDrag = {key: string, dx: number, dy: number, to: number, off: boolean}

function cx(parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(' ')
}

export function ColumnDots(p: {
    state: ColumnStateController
    /** max simultaneous dots (default 8) */
    max?: number
    className?: string
    style?: React.CSSProperties
}) {
    const cfg = p.state.api.useConfig()
    const cols = p.state.columns
    const byKey = new Map(cols.map(c => [c.key, c]))
    const max = p.max ?? 8
    const order = cfg.order
    const n = order.length
    const visibleKeys = order.filter(k => cfg.visible[k] != false)

    const trackRef = useRef<HTMLDivElement | null>(null)
    const gestureRef = useRef<{key: string, startX: number, startY: number, moved: boolean} | null>(null)
    const [drag, setDrag] = useState<tDrag | null>(null)
    const [selected, setSelected] = useState<string | null>(null)

    const pct = (i: number) => n <= 1 ? 50 : (i * 100) / (n - 1)
    const short = (k: string | null | undefined) => k ? (byKey.get(k)?.short ?? byKey.get(k)?.title ?? k) : ''

    function downDot(key: string, e: React.PointerEvent) {
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        gestureRef.current = {key, startX: e.clientX, startY: e.clientY, moved: false}
    }

    function moveDot(e: React.PointerEvent) {
        const g = gestureRef.current
        if (!g) return
        const dx = e.clientX - g.startX
        const dy = e.clientY - g.startY
        if (!g.moved && Math.hypot(dx, dy) < MOVE_SLOP) return
        g.moved = true
        const r = trackRef.current?.getBoundingClientRect()
        if (!r) return
        const step = n > 1 ? r.width / (n - 1) : r.width
        const from = order.indexOf(g.key)
        const off = -dy > REMOVE_DY && -dy > Math.abs(dx)
        const to = Math.max(0, Math.min(n - 1, Math.round(from + dx / step)))
        setDrag({key: g.key, dx, dy, to, off})
    }

    function upDot() {
        const g = gestureRef.current
        gestureRef.current = null
        const st = drag
        setDrag(null)
        if (!g) return
        if (!g.moved) {
            setSelected(g.key)
            return
        }
        if (!st) return
        const meta = byKey.get(g.key)
        if (st.off) {
            if (!meta?.fixed && visibleKeys.length > 1) {
                p.state.api.show(g.key, false)
                if (selected == g.key) setSelected(null)
            }
            return
        }
        const target = order[st.to]
        if (target && target != g.key && cfg.visible[target] == false && !meta?.fixed) {
            p.state.api.setConfig({...cfg, visible: {...cfg.visible, [g.key]: false, [target]: true}})
            if (selected == g.key) setSelected(target)
        }
    }

    function tapMark(key: string) {
        if (cfg.visible[key] != false) return
        if (visibleKeys.length >= max) return
        p.state.api.show(key, true)
        setSelected(key)
    }

    const sortLabel = cfg.sort ? `${short(cfg.sort.key)} ${cfg.sort.dir == 'asc' ? '↑' : '↓'}` : 'off'

    return <div className={cx(['wenayColDots', p.className])} style={p.style}>
        <div className='wenayColDotsHead'>
            <span className='wenayColDotsMeta'>{visibleKeys.length}/{max} fields</span>
            <span className='wenayColDotsSpacer'/>
            <span className='wenayColDotsMeta'>field: <b>{selected ? short(selected) : '—'}</b></span>
            <button className='wenayColDotsSort' disabled={!selected}
                    title='Sort by the selected field: asc -> desc -> off'
                    onClick={() => selected && p.state.api.toggleSort(selected)}>
                ⇅ sort: {sortLabel}
            </button>
        </div>
        <div ref={trackRef} className='wenayColDotsTrack'>
            <div className='wenayColDotsRail'/>
            {order.map((k, i) => {
                const vis = cfg.visible[k] != false
                const isSorted = cfg.sort?.key == k
                return <div key={'m' + k} onPointerUp={() => tapMark(k)}
                            className={cx(['wenayColDotsMark', vis ? 'wenayColDotsMark_on' : 'wenayColDotsMark_off'])}
                            style={{left: `${pct(i)}%`, cursor: !vis && visibleKeys.length < max ? 'pointer' : 'default'}}>
                    {isSorted && <div className='wenayColDotsSortMark'>{cfg.sort!.dir == 'asc' ? '↑' : '↓'}</div>}
                    <div className='wenayColDotsMarkPin'/>
                    <div className='wenayColDotsMarkLabel'>{short(k)}</div>
                </div>
            })}
            {order.map((k, i) => {
                if (cfg.visible[k] == false) return null
                const meta = byKey.get(k)
                const d = drag?.key == k ? drag : null
                const removing = !!d?.off && !meta?.fixed && visibleKeys.length > 1
                return <div key={'d' + k}
                            onPointerDown={e => downDot(k, e)} onPointerMove={moveDot} onPointerUp={upDot} onPointerCancel={upDot}
                            className={cx(['wenayColDotsDotWrap', d && 'wenayColDotsDotWrap_dragging', removing && 'wenayColDotsDotWrap_removing'])}
                            style={{left: `${pct(i)}%`, transform: d ? `translate(${d.dx}px, ${removing ? d.dy : 0}px)` : undefined}}>
                    <div className={cx(['wenayColDotsDot', selected == k && 'wenayColDotsDot_selected', meta?.fixed && 'wenayColDotsDot_fixed'])}/>
                </div>
            })}
        </div>
    </div>
}