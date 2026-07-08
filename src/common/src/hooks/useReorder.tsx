import React, {useRef, useState} from 'react'
import {useDraggableApi} from './useDraggable'

/** useReorder - a deliberately small reorder-by-drag for keyed blocks laid out
 *  by CSS (vertical list, horizontal bar, wrapped grid - the hook never knows
 *  which). The DOM order does NOT change mid-drag: the dragged block follows
 *  the pointer via transform, the rest glide to their preview position, ONE
 *  commit fires on drop. The consumer renders children in `order`, 1:1 with
 *  the container's children.
 *  NOT a dnd framework: no nesting, no cross-container moves, no spans or
 *  collision packing - when that day comes, take a ready-made library. */

export type ReorderOptions = {
    /** keys in render order; the container's children must correspond 1:1 */
    order: string[]
    /** ONE commit on drop; skipped when nothing moved */
    commit: (next: string[]) => void
    /** simulated commit - the preview shows EXACTLY what commit will produce.
     *  Default: plain splice. Consumers with pinning rules (fixed items etc.)
     *  pass their own so preview == drop by construction. */
    move?: (order: string[], key: string, to: number) => string[]
    /** false = this key cannot start a drag (default: all can) */
    canDrag?: (key: string) => boolean
    /** 'slots' (default): blocks glide between the slot centers measured at
     *  drag start - exact when all blocks are equal-sized.
     *  'measure': FLIP - the preview order is applied via CSS `order`, the real
     *  layout is read and reverted in one synchronous pass (the intermediate
     *  state never paints) - exact for ANY block sizes and wrapping, requires
     *  a flex/grid container. */
    preview?: 'slots' | 'measure'
    /** hold before the drag starts (touch-friendly fields); default 0 */
    holdMs?: number
}

export type ReorderItem = {
    /** spread on the block element */
    props: {
        onMouseDown: React.MouseEventHandler<HTMLElement>
        onTouchStart: React.TouchEventHandler<HTMLElement>
    }
    /** transform while a drag is active (undefined otherwise) */
    style?: React.CSSProperties
    /** this block is the one under the pointer */
    dragging: boolean
    /** some drag is active - the consumer adds its transition class/style on non-dragged blocks */
    active: boolean
}

export function useReorder<E extends HTMLElement = HTMLDivElement>(o: ReorderOptions) {
    const listRef = useRef<E>(null)
    const [dragKey, setDragKey] = useState<string | null>(null)
    const slotsRef = useRef<{x: number, y: number}[]>([])   // child centers at drag start (local px)
    const startRef = useRef<{x: number, y: number}[]>([])   // child top-lefts at drag start (local px)
    // Pointer deltas are viewport px, layout is local px: under a scaled ancestor
    // (client styling, zoomed containers) they diverge - normalize by the ratio.
    const scaleRef = useRef(1)
    const measureRef = useRef<{target: number, pos: {x: number, y: number}[]} | null>(null)

    const move = o.move ?? function plainSplice(order: string[], key: string, to: number) {
        const next = order.slice()
        const from = next.indexOf(key)
        if (from == -1) return next
        next.splice(from, 1)
        next.splice(Math.max(0, Math.min(next.length, to)), 0, key)
        return next
    }

    const kids = () => Array.from(listRef.current?.children ?? []) as HTMLElement[]
    /** viewport px -> local px */
    const local = (v: number) => v / scaleRef.current

    /** Nearest START-slot center to the dragged block's center. Targeting always
     *  runs against the slots measured at drag start - computing it against a
     *  live-reflowing layout oscillates at boundaries; that failure mode is
     *  designed out. */
    function dragTarget(from: number, dx: number, dy: number) {
        const slots = slotsRef.current
        const start = slots[from]
        if (!start) return from
        const x = start.x + dx, y = start.y + dy
        let best = from, bestD = Infinity
        slots.forEach((c, i) => {
            const d = (c.x - x) ** 2 + (c.y - y) ** 2
            if (d < bestD) { bestD = d; best = i }
        })
        return best
    }

    const drag = useDraggableApi({holdMs: o.holdMs ?? 0, onDragEnd: function commitOrder(final) {
        setDragKey(null)
        measureRef.current = null
        if (dragKey == null) return
        const from = o.order.indexOf(dragKey)
        if (from == -1) return
        const next = move(o.order, dragKey, dragTarget(from, local(final.x), local(final.y)))
        if (next.some((k, i) => k != o.order[i])) o.commit(next)
    }})

    function beginDrag(key: string, e: React.SyntheticEvent): boolean {
        if (o.canDrag && !o.canDrag(key)) return false
        // interactive children stay clickable (checkboxes in rows etc.)
        if ((e.target as HTMLElement).closest('input, button, select, textarea, a')) return false
        const list = listRef.current
        if (!list) return false
        scaleRef.current = list.offsetWidth ? list.getBoundingClientRect().width / list.offsetWidth : 1
        // offsetLeft/Top, NOT getBoundingClientRect: offsets are pure layout-box
        // positions - transforms (incl. mid-flight transitions) never leak in
        const els = kids()
        slotsRef.current = els.map(el => ({x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2}))
        startRef.current = els.map(el => ({x: el.offsetLeft, y: el.offsetTop}))
        measureRef.current = null
        setDragKey(key)
        return true
    }

    /** FLIP: apply the preview order via CSS `order`, read the real layout,
     *  revert - one synchronous pass between frames, so the intermediate state
     *  never paints and CSS does the wrapping math for us. Cached per target
     *  (targets change rarely, not per mousemove). Positions are read via
     *  offsetLeft/Top, NEVER getBoundingClientRect: rects include transforms,
     *  and mid-drag the blocks carry mid-flight transition values (setting
     *  style.transform='none' does not stop a running transition within the
     *  same synchronous pass) - measuring through them accumulates the previous
     *  preview's offsets on every re-measure and the blocks fly apart. Offsets
     *  are pure layout-box positions, immune to all of that. */
    function measuredPositions(preview: string[], target: number) {
        if (measureRef.current?.target == target) return measureRef.current.pos
        const els = kids()
        const saved = els.map(el => el.style.order)
        els.forEach((el, i) => el.style.order = String(preview.indexOf(o.order[i])))
        const pos = els.map(el => ({x: el.offsetLeft, y: el.offsetTop}))
        els.forEach((el, i) => el.style.order = saved[i])
        measureRef.current = {target, pos}
        return pos
    }

    const from = dragKey != null ? o.order.indexOf(dragKey) : -1
    const target = from != -1 ? dragTarget(from, local(drag.position.x), local(drag.position.y)) : -1
    const preview = from != -1 && dragKey != null ? move(o.order, dragKey, target) : null

    function item(key: string): ReorderItem {
        const active = preview != null
        const dragging = key == dragKey
        let style: React.CSSProperties | undefined
        if (active) {
            const i = o.order.indexOf(key)
            if (dragging) {
                style = {transform: `translate(${local(drag.position.x)}px, ${local(drag.position.y)}px)`}
            } else if (o.preview == 'measure') {
                const pos = measuredPositions(preview!, target)
                const a = startRef.current[i], b = pos[i]
                if (a && b && (a.x != b.x || a.y != b.y)) style = {transform: `translate(${b.x - a.x}px, ${b.y - a.y}px)`}
            } else {
                const pi = preview!.indexOf(key)
                const a = slotsRef.current[i], b = slotsRef.current[pi]
                if (pi != i && a && b) style = {transform: `translate(${b.x - a.x}px, ${b.y - a.y}px)`}
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

    return {listRef, item, dragKey, preview}
}
