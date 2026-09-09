import React, {useEffect, useLayoutEffect, useRef, useState} from 'react'
import {useDraggableApi} from './useDraggable.js'
import {isReorderControl, useReorderInteraction} from './reorderInteraction.js'
import type {ReorderHandleProps} from './reorderInteraction.js'
import {captureReorderScroll, useReorderScroll} from './reorderScroll.js'
import type {ReorderAutoScrollOptions} from './reorderScroll.js'
export type {ReorderHandleProps, ReorderAutoScrollOptions}

function sameOrder(a: string[] | null, b: string[] | null) {
    if (a === b) return true
    if (a == null || b == null || a.length != b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] != b[i]) return false
    return true
}

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
    /** transient simulated order while dragging; null on drop/cancel */
    onPreviewChange?: (next: string[] | null) => void
    /** Opt-in edge scrolling. Default off; manual scrolling still preserves targeting. */
    autoScroll?: false | ReorderAutoScrollOptions
}

export type ReorderItem = {
    /** Spread on a real button inside the block; supply its accessible name/description. */
    handleProps: ReorderHandleProps
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

/** Optional consumer-rendered preview: portal it outside clipping/transform ancestors.
 *  Pointer: hide the original with visibility:hidden, preserving its layout box.
 *  Keyboard: keep the original handle visible/focusable; overlay marks the target slot. */
export type ReorderOverlay = {
    key: string
    /** Viewport coordinates; add the consumer's stacking level and appearance. */
    style: React.CSSProperties
}

export function useReorder<E extends HTMLElement = HTMLDivElement>(o: ReorderOptions) {
    const listRef = useRef<E>(null)
    const [dragKey, setDragKey] = useState<string | null>(null)
    const [keyboardTarget, setKeyboardTarget] = useState(0)
    const scrollDelta = useRef<() => {x: number; y: number}>(() => ({x: 0, y: 0}))
    const slotsRef = useRef<{x: number, y: number}[]>([])   // child centers at drag start (local px)
    const startRef = useRef<{x: number, y: number}[]>([])   // child top-lefts at drag start (local px)
    // Pointer deltas are viewport px, layout is local px: under a scaled ancestor
    // (client styling, zoomed containers) they diverge - normalize by the ratio.
    const scaleRef = useRef(1)
    const overlayRectRef = useRef<{left: number, top: number, width: number, height: number} | null>(null)
    const measureRef = useRef<{target: number, pos: {x: number, y: number}[]} | null>(null)
    // Published by the layout effect below; item() only READS it, so nothing measures or
    // mutates the DOM during render.
    const [measured, setMeasured] = useState<{target: number, pos: {x: number, y: number}[]} | null>(null)

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

    const interaction = useReorderInteraction({shape: JSON.stringify(o.order), canDrag: o.canDrag, isDragging: () => drag.isDragging, cancel() {
        drag.cancelDrag(); setDragKey(null); measureRef.current = null
    }})
    const adjusted = (p: {x: number; y: number}) => {
        const s = scrollDelta.current()
        return {x: local(p.x + s.x), y: local(p.y + s.y)}
    }
    const drag = useDraggableApi({holdMs: o.holdMs ?? 0, onMove: p => scroll.move(p), onDragEnd: function commitOrder(final) {
        if (!interaction.valid()) { interaction.cancel(); return }
        interaction.finish()
        setDragKey(null)
        measureRef.current = null
        if (dragKey == null) return
        const from = o.order.indexOf(dragKey)
        if (from == -1) return
        const p = adjusted(final)
        const next = move(o.order, dragKey, dragTarget(from, p.x, p.y))
        if (next.some((k, i) => k != o.order[i])) o.commit(next)
    }})
    const scroll = useReorderScroll(interaction.mode === 'pointer' && drag.isDragging, o.autoScroll)

    function beginDrag(key: string, e: React.SyntheticEvent, handle = false, keyboard = false): boolean {
        if (o.canDrag && !o.canDrag(key)) return false
        // interactive children stay clickable (checkboxes in rows etc.)
        if (isReorderControl(e, handle)) return false
        const list = listRef.current
        if (!list) return false
        scaleRef.current = list.offsetWidth ? list.getBoundingClientRect().width / list.offsetWidth : 1
        // offsetLeft/Top, NOT getBoundingClientRect: offsets are pure layout-box
        // positions - transforms (incl. mid-flight transitions) never leak in
        const els = kids()
        const grabbed = els[o.order.indexOf(key)]
        if (!grabbed) return false
        if (!interaction.start(key, keyboard ? 'keyboard' : 'pointer')) return false
        if (handle) { e.stopPropagation(); (e.currentTarget as HTMLElement).focus({preventScroll: true}) }
        scrollDelta.current = captureReorderScroll(list)
        if (!keyboard) {
            const event = e as React.MouseEvent & React.TouchEvent
            const point = event.changedTouches?.[0] ?? event
            scroll.begin(grabbed, {x: point.clientX, y: point.clientY})
        }
        setKeyboardTarget(o.order.indexOf(key))
        const rect = grabbed.getBoundingClientRect()
        overlayRectRef.current = {left: rect.left, top: rect.top, width: rect.width, height: rect.height}
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
    const position = adjusted(drag.position)
    const target = from != -1 ? interaction.mode === 'keyboard' ? keyboardTarget : dragTarget(from, position.x, position.y) : -1
    const preview = from != -1 && dragKey != null ? move(o.order, dragKey, target) : null
    // `preview` is a fresh array on every pointer move, but its CONTENT changes only when the
    // target slot does. An element-wise compare is the same walk the joined key was, minus a
    // string allocation per move; the effect keys off a revision counter instead.
    const previewRef = useRef<string[] | null>(null)
    const previewRevision = useRef(0)
    if (!sameOrder(previewRef.current, preview)) {
        previewRef.current = preview
        previewRevision.current++
    }
    useEffect(() => o.onPreviewChange?.(previewRef.current), [previewRevision.current])
    // The FLIP measurement writes style.order on every child and reads the layout back - a
    // side effect on the committed DOM, so it runs in a layout effect instead of inside item()
    // during render. Keyed on `target`, it keeps the measure-once-per-target contract, and the
    // state it publishes lands in a synchronous re-render before paint, so the intermediate
    // state still never reaches the screen.
    useLayoutEffect(() => {
        if (o.preview != 'measure' || dragKey == null || target == -1) {
            measureRef.current = null
            setMeasured(null)
            return
        }
        if (measureRef.current?.target == target) return
        setMeasured({target, pos: measuredPositions(move(o.order, dragKey, target), target)})
    }, [dragKey, target, o.preview])
    // unmount mid-drag must not leave the preview order applied in columnState/grid
    const previewChangeRef = useRef(o.onPreviewChange)
    previewChangeRef.current = o.onPreviewChange
    useEffect(() => () => previewChangeRef.current?.(null), [])

    function item(key: string): ReorderItem {
        const active = preview != null
        const dragging = key == dragKey
        let style: React.CSSProperties | undefined
        if (active) {
            const i = o.order.indexOf(key)
            if (dragging) {
                style = interaction.mode === 'keyboard' ? {zIndex: 1} : {transform: `translate(${position.x}px, ${position.y}px)`}
            } else if (o.preview == 'measure') {
                const pos = measured?.target == target ? measured.pos : null
                const a = startRef.current[i], b = pos?.[i]
                if (a && b && (a.x != b.x || a.y != b.y)) style = {transform: `translate(${b.x - a.x}px, ${b.y - a.y}px)`}
            } else {
                const pi = preview!.indexOf(key)
                const a = slotsRef.current[i], b = slotsRef.current[pi]
                if (pi != i && a && b) style = {transform: `translate(${b.x - a.x}px, ${b.y - a.y}px)`}
            }
        }
        return {
            handleProps: {
                ref: interaction.handleRef(key), type: 'button', style: {touchAction: 'none'}, 'aria-pressed': dragging,
                'aria-disabled': o.canDrag?.(key) === false,
                onMouseDown(e) { if (e.button === 0 && beginDrag(key, e, true)) drag.props.onMouseDown(e as React.MouseEvent<HTMLDivElement>) },
                onTouchStart(e) { if (beginDrag(key, e, true)) drag.props.onTouchStart(e as React.TouchEvent<HTMLDivElement>) },
                onClick(e) { e.preventDefault(); e.stopPropagation() },
                onKeyDown(e) {
                    if (e.target !== e.currentTarget) return
                    if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault(); e.stopPropagation()
                        if (e.repeat) return
                        if (interaction.current.current?.key === key && interaction.mode === 'keyboard') {
                            if (!interaction.valid()) { interaction.cancel(); return }
                            const next = move(o.order, key, keyboardTarget)
                            interaction.finish(); setDragKey(null)
                            if (!sameOrder(next, o.order)) o.commit(next)
                        } else beginDrag(key, e, true, true)
                    } else if (interaction.current.current?.key === key && interaction.mode === 'keyboard' && e.key.startsWith('Arrow')) {
                        e.preventDefault(); e.stopPropagation()
                        const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1
                        setKeyboardTarget(n => Math.max(0, Math.min(o.order.length - 1, n + step)))
                    }
                },
            },
            props: {
                onMouseDown(e) { if (e.button == 0 && beginDrag(key, e)) drag.props.onMouseDown(e as React.MouseEvent<HTMLDivElement>) },
                onTouchStart(e) { if (beginDrag(key, e)) drag.props.onTouchStart(e as React.TouchEvent<HTMLDivElement>) },
            },
            style,
            dragging,
            active,
        }
    }

    const rect = overlayRectRef.current
    let overlayPosition = drag.position
    if (interaction.mode === 'keyboard' && preview && from !== -1) {
        const useMeasured = o.preview === 'measure' && measured?.target === target
        const a = useMeasured ? startRef.current[from] : slotsRef.current[from]
        const b = useMeasured ? measured.pos[from] : slotsRef.current[preview.indexOf(dragKey!)]
        const s = scrollDelta.current()
        if (a && b) overlayPosition = {x: (b.x - a.x) * scaleRef.current - s.x, y: (b.y - a.y) * scaleRef.current - s.y}
    }
    const overlay: ReorderOverlay | null = dragKey != null && (drag.isDragging || interaction.mode === 'keyboard') && rect ? {
        key: dragKey,
        style: {
            position: 'fixed', left: rect.left + overlayPosition.x, top: rect.top + overlayPosition.y,
            width: rect.width, height: rect.height, boxSizing: 'border-box',
            pointerEvents: 'none', margin: 0,
        },
    } : null

    return {listRef, item, dragKey, preview, overlay, inputMode: interaction.mode, cancel: interaction.cancel}
}
