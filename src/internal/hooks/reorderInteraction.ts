import {useLayoutEffect, useRef, useState} from 'react'
import type React from 'react'

export type ReorderHandleProps = {
    ref: React.RefCallback<HTMLElement>
    type: 'button'
    style: React.CSSProperties
    'aria-pressed': boolean
    'aria-disabled': boolean
    onMouseDown: React.MouseEventHandler<HTMLElement>
    onTouchStart: React.TouchEventHandler<HTMLElement>
    onKeyDown: React.KeyboardEventHandler<HTMLElement>
    onClick: React.MouseEventHandler<HTMLElement>
}

export function isReorderControl(event: React.SyntheticEvent, handle: boolean) {
    const target = event.target as Element
    const control = target.closest('input,button,select,textarea,a,[contenteditable]:not([contenteditable="false"])')
    return !!control && (!handle || control !== event.currentTarget)
}

/** Shared cancellation/focus boundary; geometry and slot policy stay in each reorder hook. */
export function useReorderInteraction(options: {
    shape: string
    canDrag?: (key: string) => boolean
    isDragging: () => boolean
    cancel: () => void
}) {
    const latest = useRef(options)
    latest.current = options
    const current = useRef<{key: string; mode: 'pointer' | 'keyboard'; shape: string} | null>(null)
    const [mode, setMode] = useState<'pointer' | 'keyboard' | null>(null)
    const focusKey = useRef<string | null>(null)
    const handles = useRef(new Map<string, HTMLElement>())
    const callbacks = useRef(new Map<string, React.RefCallback<HTMLElement>>())
    const cancel = () => {
        if (!current.current) return
        current.current = null
        setMode(null)
        latest.current.cancel()
    }
    useLayoutEffect(() => {
        const session = current.current
        if (session && (session.shape !== options.shape || options.canDrag?.(session.key) === false)) cancel()
        if (focusKey.current) {
            handles.current.get(focusKey.current)?.focus()
            focusKey.current = null
        }
    })
    useLayoutEffect(() => {
        const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && current.current) { event.preventDefault(); cancel() }
        }
        const touch = () => cancel()
        const release = () => {
            // Only pre-hold release lacks onDragEnd. Do not queue a microtask:
            // real browsers may run it between native release listeners, before commit.
            if (current.current?.mode === 'pointer' && !latest.current.isDragging()) cancel()
        }
        document.addEventListener('keydown', key, true)
        document.addEventListener('touchcancel', touch, true)
        document.addEventListener('mouseup', release, true)
        document.addEventListener('touchend', release, true)
        window.addEventListener('blur', touch)
        return () => {
            current.current = null
            document.removeEventListener('keydown', key, true)
            document.removeEventListener('touchcancel', touch, true)
            document.removeEventListener('mouseup', release, true)
            document.removeEventListener('touchend', release, true)
            window.removeEventListener('blur', touch)
        }
    }, [])
    return {
        mode, current, cancel,
        start(key: string, nextMode: 'pointer' | 'keyboard') {
            if (current.current || latest.current.canDrag?.(key) === false) return false
            focusKey.current = null
            current.current = {key, mode: nextMode, shape: latest.current.shape}
            setMode(nextMode)
            return true
        },
        finish() {
            const session = current.current
            if (session) focusKey.current = handles.current.has(session.key) ? session.key : null
            current.current = null
            setMode(null)
        },
        valid() {
            const session = current.current
            return !!session && session.shape === latest.current.shape && latest.current.canDrag?.(session.key) !== false
        },
        handleRef(key: string): React.RefCallback<HTMLElement> {
            let callback = callbacks.current.get(key)
            if (!callback) {
                callback = el => {
                    if (el) {
                        handles.current.set(key, el)
                        if (focusKey.current === key) el.focus()
                    } else handles.current.delete(key)
                }
                callbacks.current.set(key, callback)
            }
            return callback
        },
    }
}
