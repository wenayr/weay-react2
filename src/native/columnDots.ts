import type {NativeColumnStateController} from './columnState.js'

export type NativeColumnDotsGeometry = {start: number, length: number}
export type NativeColumnDotsSnapshot = {
    selected: string | null
    visible: string[]
    sort: {key: string, dir: 'asc' | 'desc'} | null
    drag: null | {origin: string, shown: string, index: number, removing: boolean}
}

/** Coordinate-driven interaction model for PanResponder, Gesture Handler or another native view. */
export function createNativeColumnDots(opts: {
    state: NativeColumnStateController
    max?: number
    moveSlop?: number
    removeDistance?: number
    /** Native coordinate systems and designs differ. Default 'either' is renderer-neutral. */
    removeDirection?: 'up' | 'down' | 'either'
}) {
    const listeners = new Set<(snapshot: NativeColumnDotsSnapshot) => void>()
    const byKey = new Map(opts.state.columns.map(column => [column.key, column]))
    let selected: string | null = null
    let drag: null | {
        origin: string
        shown: string
        startPrimary: number
        startCross: number
        moved: boolean
        index: number
        removing: boolean
    } = null

    function getSnapshot(): NativeColumnDotsSnapshot {
        const config = opts.state.api.getConfig()
        return {
            selected,
            visible: opts.state.api.visibleKeys(),
            sort: config.sort,
            drag: drag ? {origin: drag.origin, shown: drag.shown, index: drag.index, removing: drag.removing} : null,
        }
    }
    function emit() {
        const snapshot = getSnapshot()
        for (const listener of listeners) listener(snapshot)
    }
    const stopState = opts.state.api.subscribe(emit)
    const subscribe = (listener: (snapshot: NativeColumnDotsSnapshot) => void) => {
        listeners.add(listener)
        return function unsubscribe() { listeners.delete(listener) }
    }
    function select(key: string | null) {
        selected = key && byKey.has(key) ? key : null
        emit()
    }
    function toggle(key: string) {
        const config = opts.state.api.getConfig()
        if (!byKey.has(key) || byKey.get(key)?.fixed) return
        const isVisible = config.visible[key] != false
        if (isVisible && opts.state.api.visibleKeys().length <= 1) return
        if (!isVisible && opts.state.api.visibleKeys().length >= (opts.max ?? 8)) return
        selected = !isVisible ? key : selected == key ? null : selected
        opts.state.api.show(key, !isVisible)
    }
    const reorder = (key: string, to: number) => opts.state.api.moveKey(key, to)
    const toggleSelectedSort = () => { if (selected) opts.state.api.toggleSort(selected) }

    function begin(key: string, primary: number, cross: number) {
        const config = opts.state.api.getConfig()
        if (!byKey.has(key) || config.visible[key] == false) return false
        drag = {origin: key, shown: key, startPrimary: primary, startCross: cross, moved: false,
            index: config.order.indexOf(key), removing: false}
        emit()
        return true
    }
    function move(primary: number, cross: number, geometry: NativeColumnDotsGeometry) {
        if (!drag) return
        const config = opts.state.api.getConfig()
        const dx = primary - drag.startPrimary
        const dy = cross - drag.startCross
        if (!drag.moved && Math.hypot(dx, dy) < (opts.moveSlop ?? 4)) return
        drag.moved = true
        const last = Math.max(0, config.order.length - 1)
        const relative = geometry.length > 0 ? (primary - geometry.start) / geometry.length : 0
        drag.index = Math.max(0, Math.min(last, Math.round(relative * last)))
        const removeDelta = opts.removeDirection == 'up' ? -dy
            : opts.removeDirection == 'down' ? dy : Math.abs(dy)
        drag.removing = removeDelta > (opts.removeDistance ?? 32) && removeDelta > Math.abs(dx)
        if (!drag.removing && !byKey.get(drag.origin)?.fixed) {
            const target = config.order[drag.index]
            if (target && target != drag.shown && config.visible[target] == false) {
                opts.state.api.setConfig({...config, visible: {...config.visible, [drag.shown]: false, [target]: true}})
                drag.shown = target
            }
        }
        emit()
    }
    function end() {
        const current = drag
        drag = null
        if (!current) return
        if (!current.moved) selected = current.origin
        else if (current.removing && !byKey.get(current.shown)?.fixed && opts.state.api.visibleKeys().length > 1) {
            opts.state.api.show(current.shown, false)
            if (selected == current.origin || selected == current.shown) selected = null
        } else if (current.shown != current.origin && selected == current.origin) selected = current.shown
        emit()
    }
    function cancel() {
        drag = null
        emit()
    }
    function dispose() {
        stopState()
        listeners.clear()
        drag = null
    }
    return {getSnapshot, subscribe, select, toggle, reorder, toggleSelectedSort, begin, move, end, cancel, dispose}
}

export type NativeColumnDotsController = ReturnType<typeof createNativeColumnDots>
