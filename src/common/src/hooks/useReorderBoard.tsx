import React, {useEffect, useRef, useState} from 'react'
import {useDraggableApi} from './useDraggable'
import {tReorderItem} from './useReorder'

/** useReorderBoard - the columns extension of useReorder: keyed blocks live in
 *  VERTICAL columns (plain consumer divs), one block drags between/within them,
 *  ONE commit on drop. Column "gravity" is pure consumer CSS (justify-content:
 *  flex-start packs up, flex-end packs down) - the hook never knows it, it
 *  measures the real layout. Columns can appear/disappear between drags (the
 *  ref callback registry is live); the set is frozen for the duration of one
 *  drag. Children of a column div must be exactly its items, 1:1, in order.
 *  Same non-goals as useReorder: no nesting, no spans/collision packing, no
 *  autoscroll - that day is a ready-made dnd library. */

export type tBoardPos = {col: string, index: number}
export type tBoardColumn = {key: string, items: string[]}

export type tReorderBoardOptions = {
    /** columns in board order; each column's div children must render items 1:1 */
    columns: tBoardColumn[]
    /** ONE commit on drop; skipped when nothing moved */
    commit: (next: tBoardColumn[]) => void
    /** false = this key cannot start a drag (default: all can) */
    canDrag?: (key: string) => boolean
    /** hold before the drag starts; default 0 */
    holdMs?: number
    /** the block was grabbed */
    onDragStart?: (e: {key: string, from: tBoardPos}) => void
    /** every pointer move while dragging; position = pointer delta in local px */
    onDragMove?: (e: {key: string, over: tBoardPos, position: {x: number, y: number}}) => void
    /** the target slot changed (compare prev.col != over.col for column crossings) */
    onOverChange?: (e: {key: string, over: tBoardPos, prev: tBoardPos | null}) => void
    /** drop; committed=false when nothing moved (plain click) */
    onDragEnd?: (e: {key: string, from: tBoardPos, over: tBoardPos, committed: boolean}) => void
}

type tGeom = {
    scale: number
    from: tBoardPos
    colRect: Map<string, {x: number, y: number, w: number, h: number}>
    /** item centers per column at drag start (local px, viewport basis) */
    centers: Map<string, {key: string, y: number}[]>
    /** per-item layout offsets at drag start (offsetLeft/Top - transform-immune) */
    startOffset: Map<string, {x: number, y: number}>
    rowGap: Map<string, number>
    draggedCenter: {x: number, y: number}
    draggedSize: {w: number, h: number}
}

export function useReorderBoard(o: tReorderBoardOptions) {
    const oRef = useRef(o)
    oRef.current = o
    const colEls = useRef(new Map<string, HTMLElement>())
    const refCbs = useRef(new Map<string, (el: HTMLElement | null) => void>())
    const [dragKey, setDragKey] = useState<string | null>(null)
    const geom = useRef<tGeom | null>(null)
    const measureCache = useRef<{key: string, pos: Map<string, {x: number, y: number}>} | null>(null)

    /** stable callback ref for a column div; columns can be added at runtime */
    function columnRef(col: string) {
        let cb = refCbs.current.get(col)
        if (!cb) {
            cb = el => { el ? colEls.current.set(col, el) : colEls.current.delete(col) }
            refCbs.current.set(col, cb)
        }
        return cb
    }

    const local = (v: number) => v / (geom.current?.scale ?? 1)

    /** Nearest column by clamped distance to its rect, then the insertion index
     *  = how many of that column's items (start centers, excluding the dragged
     *  one) sit above the dragged center. Targeting always runs against the
     *  geometry measured at drag START (anti-oscillation, same as useReorder). */
    function dragTarget(dx: number, dy: number): tBoardPos {
        const g = geom.current
        if (!g) return {col: '', index: 0}
        const cx = g.draggedCenter.x + dx, cy = g.draggedCenter.y + dy
        let best: string | null = null, bestD = Infinity
        for (const [col, r] of g.colRect) {
            const px = Math.max(r.x, Math.min(r.x + r.w, cx))
            const py = Math.max(r.y, Math.min(r.y + r.h, cy))
            const d = (px - cx) ** 2 + (py - cy) ** 2
            if (d < bestD) { bestD = d; best = col }
        }
        if (best == null) return g.from
        let index = 0
        for (const c of geom.current!.centers.get(best) ?? [])
            if (c.key != dragKey && c.y < cy) index++
        return {col: best, index}
    }

    /** Simulated commit: the dragged key removed from its column and inserted at
     *  over - preview and drop share this, so they agree by construction. */
    function movedColumns(key: string, over: tBoardPos): tBoardColumn[] {
        return oRef.current.columns.map(c => {
            let items = c.items.filter(k => k != key)
            if (c.key == over.col) {
                const i = Math.max(0, Math.min(items.length, over.index))
                items = items.slice(0, i).concat(key, items.slice(i))
            }
            return {key: c.key, items}
        })
    }

    /** FLIP across columns, all offset-based (transform/transition-immune, see
     *  useReorder): the dragged block leaves flow via display:none, survivors get
     *  their preview CSS `order`, and the landing slot becomes a real margin gap
     *  (draggedHeight + row-gap) on the neighbour - so the column's own CSS
     *  gravity decides who moves aside (flex-end pushes the blocks ABOVE up).
     *  One synchronous apply-read-revert, cached per target slot. */
    function measured(key: string, over: tBoardPos): Map<string, {x: number, y: number}> {
        const cacheKey = over.col + '#' + over.index
        if (measureCache.current?.key == cacheKey) return measureCache.current.pos
        const g = geom.current!
        const keyToEl = new Map<string, HTMLElement>()
        for (const c of oRef.current.columns) {
            const el = colEls.current.get(c.key)
            if (!el) continue
            const kids = el.children
            c.items.forEach((k, i) => { const kid = kids[i] as HTMLElement | undefined; if (kid) keyToEl.set(k, kid) })
        }
        const preview = movedColumns(key, over)
        const saved: {el: HTMLElement, order: string, display: string, mt: string, mb: string}[] = []
        const save = (el: HTMLElement) => saved.push({el, order: el.style.order, display: el.style.display, mt: el.style.marginTop, mb: el.style.marginBottom})
        for (const pc of preview) {
            pc.items.forEach((k, i) => {
                const el = keyToEl.get(k)
                if (!el) return
                save(el)
                if (k == key) el.style.display = 'none'
                else el.style.order = String(i)
            })
        }
        const target = preview.find(c => c.key == over.col)
        if (target) {
            const gap = g.draggedSize.h + (g.rowGap.get(over.col) ?? 0)
            const afterEl = keyToEl.get(target.items[over.index + 1] ?? '')
            const beforeEl = keyToEl.get(target.items[over.index - 1] ?? '')
            if (afterEl) afterEl.style.marginTop = gap + 'px'
            else if (beforeEl) beforeEl.style.marginBottom = gap + 'px'
        }
        const pos = new Map<string, {x: number, y: number}>()
        for (const c of oRef.current.columns)
            for (const k of c.items) {
                if (k == key) continue
                const el = keyToEl.get(k)
                if (el) pos.set(k, {x: el.offsetLeft, y: el.offsetTop})
            }
        saved.reverse().forEach(s => { s.el.style.order = s.order; s.el.style.display = s.display; s.el.style.marginTop = s.mt; s.el.style.marginBottom = s.mb })
        measureCache.current = {key: cacheKey, pos}
        return pos
    }

    const drag = useDraggableApi({holdMs: o.holdMs ?? 0, onDragEnd: function commitBoard(final) {
        const key = dragKey
        setDragKey(null)
        measureCache.current = null
        const g = geom.current
        geom.current = null
        if (key == null || !g) return
        geom.current = g // dragTarget/local need it for this last computation
        const over = dragTarget(local(final.x), local(final.y))
        const next = movedColumns(key, over)
        const cur = oRef.current.columns
        const committed = next.some((c, i) => c.items.length != cur[i].items.length || c.items.some((k, j) => k != cur[i].items[j]))
        geom.current = null
        if (committed) oRef.current.commit(next)
        oRef.current.onDragEnd?.({key, from: g.from, over, committed})
    }})

    function beginDrag(key: string, e: React.SyntheticEvent): boolean {
        if (oRef.current.canDrag && !oRef.current.canDrag(key)) return false
        if ((e.target as HTMLElement).closest('input, button, select, textarea, a')) return false
        const cols = oRef.current.columns
        let from: tBoardPos | null = null
        for (const c of cols) {
            const i = c.items.indexOf(key)
            if (i != -1) { from = {col: c.key, index: i}; break }
        }
        const fromEl = from && colEls.current.get(from.col)
        if (!from || !fromEl) return false
        const scale = fromEl.offsetWidth ? fromEl.getBoundingClientRect().width / fromEl.offsetWidth : 1
        const g: tGeom = {scale, from, colRect: new Map(), centers: new Map(), startOffset: new Map(), rowGap: new Map(), draggedCenter: {x: 0, y: 0}, draggedSize: {w: 0, h: 0}}
        for (const c of cols) {
            const el = colEls.current.get(c.key)
            if (!el) continue
            const r = el.getBoundingClientRect()
            g.colRect.set(c.key, {x: r.x / scale, y: r.y / scale, w: r.width / scale, h: r.height / scale})
            g.rowGap.set(c.key, parseFloat(getComputedStyle(el).rowGap) || 0)
            const kids = el.children
            const cs: {key: string, y: number}[] = []
            c.items.forEach((k, i) => {
                const kid = kids[i] as HTMLElement | undefined
                if (!kid) return
                const kr = kid.getBoundingClientRect()
                cs.push({key: k, y: (kr.y + kr.height / 2) / scale})
                g.startOffset.set(k, {x: kid.offsetLeft, y: kid.offsetTop})
                if (k == key) {
                    g.draggedCenter = {x: (kr.x + kr.width / 2) / scale, y: (kr.y + kr.height / 2) / scale}
                    g.draggedSize = {w: kid.offsetWidth, h: kid.offsetHeight}
                }
            })
            g.centers.set(c.key, cs)
        }
        geom.current = g
        measureCache.current = null
        setDragKey(key)
        oRef.current.onDragStart?.({key, from})
        return true
    }

    const over: tBoardPos | null = dragKey != null && geom.current
        ? dragTarget(local(drag.position.x), local(drag.position.y)) : null

    // callbacks ride effects (post-render), reading fresh options via oRef
    const prevOverRef = useRef<tBoardPos | null>(null)
    useEffect(() => {
        if (dragKey == null || !over) { prevOverRef.current = null; return }
        const prev = prevOverRef.current
        if (!prev || prev.col != over.col || prev.index != over.index) {
            oRef.current.onOverChange?.({key: dragKey, over, prev})
            prevOverRef.current = {...over}
        }
    })
    const px = dragKey != null ? drag.position.x : 0, py = dragKey != null ? drag.position.y : 0
    useEffect(() => {
        if (dragKey != null && over) oRef.current.onDragMove?.({key: dragKey, over, position: {x: px, y: py}})
    }, [dragKey, px, py]) // eslint-disable-line react-hooks/exhaustive-deps

    function item(key: string): tReorderItem {
        const active = dragKey != null
        const dragging = key == dragKey
        let style: React.CSSProperties | undefined
        if (active && geom.current && over) {
            if (dragging) {
                style = {transform: `translate(${local(drag.position.x)}px, ${local(drag.position.y)}px)`}
            } else {
                const pos = measured(dragKey!, over)
                const a = geom.current.startOffset.get(key), b = pos.get(key)
                if (a && b && (a.x != b.x || a.y != b.y)) style = {transform: `translate(${b.x - a.x}px, ${b.y - a.y}px)`}
            }
        }
        return {
            props: {
                onMouseDown(e) { if (e.button == 0 && beginDrag(key, e)) drag.props.onMouseDown(e as React.MouseEvent<HTMLDivElement>) },
                onTouchStart(e) { if (beginDrag(key, e)) drag.props.onTouchStart(e as React.TouchEvent<HTMLDivElement>) },
            },
            style,
            dragging,
            active,
        }
    }

    return {columnRef, item, dragKey, over}
}
