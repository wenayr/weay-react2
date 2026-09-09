import {useEffect, useRef, useState} from 'react'

export type ReorderAutoScrollOptions = {
    /** Edge band in viewport pixels, default 40. */
    edge?: number
    /** Maximum viewport pixels/second, default 480 (halved for reduced motion). */
    maxSpeed?: number
    /** Explicit allow-list policy; false skips this element and tries its parent. */
    canScroll?: (element: HTMLElement) => boolean
}
type Point = {x: number; y: number}

export function captureReorderScroll(element: HTMLElement) {
    const ancestors: {el: HTMLElement; x: number; y: number; scale: number}[] = []
    for (let el: HTMLElement | null = element; el; el = el.parentElement) {
        const scale = el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1
        ancestors.push({el, x: el.scrollLeft, y: el.scrollTop, scale: scale || 1})
    }
    return () => ancestors.reduce((p, s) => ({
        x: p.x + (s.el.scrollLeft - s.x) * s.scale,
        y: p.y + (s.el.scrollTop - s.y) * s.scale,
    }), {x: 0, y: 0})
}

/** One nearest permitted scrollable per axis; no smooth scrolling or extra DnD engine. */
export function scrollReorderEdge(point: Point, fallback: HTMLElement | null,
    options: ReorderAutoScrollOptions, seconds: number, reducedMotion = false) {
    const edge = Math.max(1, options.edge ?? 40)
    const speed = Math.max(0, options.maxSpeed ?? 480) * (reducedMotion ? .5 : 1)
    let hit = document.elementFromPoint?.(point.x, point.y) as HTMLElement | null
    if (!(hit instanceof HTMLElement)) hit = fallback
    let movedX = false, movedY = false
    for (let el = hit; el; el = el.parentElement) {
        if (options.canScroll?.(el) === false) continue
        const css = getComputedStyle(el)
        const root = el === document.scrollingElement
        const rect = el.getBoundingClientRect()
        const bounds = root ? {left: 0, top: 0, right: innerWidth, bottom: innerHeight} : {
            left: Math.max(0, rect.left), top: Math.max(0, rect.top),
            right: Math.min(innerWidth, rect.right), bottom: Math.min(innerHeight, rect.bottom),
        }
        for (let parent = el.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent), r = parent.getBoundingClientRect()
            if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
                bounds.left = Math.max(bounds.left, r.left); bounds.right = Math.min(bounds.right, r.right)
            }
            if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
                bounds.top = Math.max(bounds.top, r.top); bounds.bottom = Math.min(bounds.bottom, r.bottom)
            }
        }
        if (point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom) continue
        const delta = (value: number, min: number, max: number) => {
            const band = Math.min(edge, (max - min) / 2)
            if (band <= 0) return 0
            return value < min + band ? -(1 - (value - min) / band)
                : value > max - band ? 1 - (max - value) / band : 0
        }
        const scale = root ? 1 : (el.offsetWidth ? rect.width / el.offsetWidth : 1) || 1
        const step = speed * Math.min(.05, Math.max(0, seconds)) / scale
        if (!movedX && (root || /auto|scroll/.test(css.overflowX)) && el.scrollWidth > el.clientWidth) {
            const old = el.scrollLeft
            el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth,
                old + delta(point.x, bounds.left, bounds.right) * step))
            movedX = el.scrollLeft !== old
        }
        if (!movedY && (root || /auto|scroll/.test(css.overflowY)) && el.scrollHeight > el.clientHeight) {
            const old = el.scrollTop
            el.scrollTop = Math.max(0, Math.min(el.scrollHeight - el.clientHeight,
                old + delta(point.y, bounds.top, bounds.bottom) * step))
            movedY = el.scrollTop !== old
        }
        if (movedX && movedY) break
    }
    return movedX || movedY
}

export function useReorderScroll(active: boolean, options: false | ReorderAutoScrollOptions | undefined) {
    const [, redraw] = useState(0)
    const source = useRef<HTMLElement | null>(null)
    const pointer = useRef<Point | null>(null)
    const start = useRef<Point>({x: 0, y: 0})
    const latest = useRef(options)
    latest.current = options
    useEffect(() => {
        if (!active) return
        const changed = () => redraw(n => n + 1)
        document.addEventListener('scroll', changed, true)
        let frame = 0, previous = 0
        const tick = (time: number) => {
            const opts = latest.current
            if (opts && pointer.current && scrollReorderEdge(pointer.current, source.current, opts,
                previous ? (time - previous) / 1000 : 0,
                window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)) changed()
            previous = time
            frame = requestAnimationFrame(tick)
        }
        if (options) frame = requestAnimationFrame(tick)
        return () => { cancelAnimationFrame(frame); document.removeEventListener('scroll', changed, true) }
    }, [active, !!options])
    return {
        begin(element: HTMLElement, point: Point) { source.current = element; start.current = point; pointer.current = point },
        move(delta: Point) { pointer.current = {x: start.current.x + delta.x, y: start.current.y + delta.y} },
    }
}
