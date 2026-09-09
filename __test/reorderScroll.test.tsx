import React, {useState} from 'react'
import {act, fireEvent, render, screen} from '@testing-library/react'
import {useReorder} from '../src/react/index.js'
import {captureReorderScroll, scrollReorderEdge} from '../src/internal/hooks/reorderScroll.js'

function box(el: HTMLElement, x: number, y: number, w: number, h: number, sw = w, sh = h) {
    Object.defineProperties(el, {
        clientWidth: {configurable: true, value: w}, clientHeight: {configurable: true, value: h},
        offsetWidth: {configurable: true, value: w}, offsetHeight: {configurable: true, value: h},
        scrollWidth: {configurable: true, value: sw}, scrollHeight: {configurable: true, value: sh},
    })
    el.getBoundingClientRect = () => ({x, y, left: x, top: y, right: x + w, bottom: y + h, width: w, height: h, toJSON() {}})
}
test('nearest permitted axis, nested clipping, speed cap, reduced motion and edge exit', () => {
    const outer = document.createElement('div'), inner = document.createElement('div')
    outer.append(inner); document.body.append(outer)
    outer.style.overflowX = 'auto'; outer.style.overflowY = 'auto'; inner.style.overflowY = 'auto'
    box(outer, 0, 0, 200, 200, 600, 600); box(inner, 0, 0, 200, 400, 200, 1000)
    try {
        expect(scrollReorderEdge({x: 100, y: 100}, inner, {}, .016)).toBe(false)
        scrollReorderEdge({x: 195, y: 195}, inner, {maxSpeed: 400}, 5)
        expect(inner.scrollTop).toBe(17.5) // clipped to outer edge; 50ms frame cap
        expect(outer.scrollTop).toBe(0)
        expect(outer.scrollLeft).toBe(17.5)
        inner.scrollTop = 0; outer.scrollLeft = 0
        scrollReorderEdge({x: 195, y: 195}, inner, {maxSpeed: 400}, .05, true)
        expect(inner.scrollTop).toBe(8.75)
        scrollReorderEdge({x: 195, y: 195}, inner, {canScroll: el => el !== inner}, .05)
        expect(outer.scrollTop).toBeGreaterThan(0)
        const before = inner.scrollTop
        scrollReorderEdge({x: 100, y: 100}, inner, {}, .05)
        expect(inner.scrollTop).toBe(before)
        inner.scrollTop = 600; outer.scrollTop = 0
        scrollReorderEdge({x: 195, y: 195}, inner, {}, .05)
        expect(outer.scrollTop).toBeGreaterThan(0) // inner limit -> parent
    } finally { outer.remove() }
})

test('scroll capture sums actual ancestor movement', () => {
    const outer = document.createElement('div'), inner = document.createElement('div')
    outer.append(inner); document.body.append(outer)
    box(outer, 0, 0, 200, 200); box(inner, 0, 0, 100, 100)
    const delta = captureReorderScroll(inner)
    outer.scrollLeft = 40; inner.scrollTop = 60
    expect(delta()).toEqual({x: 40, y: 60})
    outer.remove()
})

test.each(['drop', 'cancel', 'unmount'])('opt-in loop stops on %s; disabled has no loop', ending => {
    jest.useFakeTimers()
    const commit = jest.fn()
    function Harness({enabled = true}: {enabled?: boolean}) {
        const [order, setOrder] = useState(['a', 'b'])
        const reorder = useReorder({order, autoScroll: enabled ? {} : false, commit: next => { commit(next); setOrder(next) }})
        return <div data-testid="scroll" style={{overflowY: 'auto'}} ref={reorder.listRef}>
            {order.map((k, i) => <div key={k} data-testid={k}><button {...reorder.item(k).handleProps}>{k}</button></div>)}
        </div>
    }
    const view = render(<Harness enabled={false}/>)
    const list = screen.getByTestId('scroll')
    box(list, 0, 0, 100, 100, 100, 600)
    for (const [i, k] of ['a', 'b'].entries()) {
        const el = screen.getByTestId(k); box(el, 0, i * 60, 100, 40)
        Object.defineProperties(el, {offsetTop: {value: i * 60}, offsetLeft: {value: 0}})
    }
    try {
        fireEvent.mouseDown(screen.getByRole('button', {name: 'a'}), {button: 0, clientX: 50, clientY: 20})
        fireEvent.mouseMove(document, {clientX: 50, clientY: 95})
        act(() => jest.advanceTimersByTime(100))
        expect(list.scrollTop).toBe(0)
        fireEvent.keyDown(document, {key: 'Escape'})
        view.rerender(<Harness/>)
        fireEvent.mouseDown(screen.getByRole('button', {name: 'a'}), {button: 0, clientX: 50, clientY: 20})
        fireEvent.mouseMove(document, {clientX: 50, clientY: 95})
        act(() => jest.advanceTimersByTime(100))
        expect(list.scrollTop).toBeGreaterThan(0)
        if (ending === 'drop') fireEvent.mouseUp(document)
        if (ending === 'cancel') fireEvent.keyDown(document, {key: 'Escape'})
        if (ending === 'unmount') view.unmount()
        const stopped = list.scrollTop
        act(() => jest.advanceTimersByTime(300))
        expect(list.scrollTop).toBe(stopped)
        expect(commit).toHaveBeenCalledTimes(ending === 'drop' ? 1 : 0)
    } finally { view.unmount(); jest.useRealTimers() }
})
