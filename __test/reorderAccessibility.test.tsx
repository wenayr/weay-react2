import React, {useState} from 'react'
import {act, fireEvent, render, screen} from '@testing-library/react'
import {useReorder, useReorderBoard} from '../src/react/index.js'

function Harness({board = false, allowed = true, keys = ['a', 'b', 'c'], holdMs = 0, commit = jest.fn()}: {
    board?: boolean; allowed?: boolean; keys?: string[]; holdMs?: number; commit?: jest.Mock
}) {
    const [order, setOrder] = useState(keys)
    const [cols, setCols] = useState([{key: 'one', items: keys}, {key: 'two', items: [] as string[]}])
    const single = useReorder({order: order.filter(k => keys.includes(k)), canDrag: () => allowed, holdMs,
        commit: next => { commit(next); setOrder(next) }})
    const multi = useReorderBoard({columns: cols.map(c => ({...c, items: c.items.filter(k => keys.includes(k))})),
        canDrag: () => allowed, holdMs, commit: next => { commit(next); setCols(next) }})
    const hook = board ? multi : single
    const row = (key: string) => {
        const item = hook.item(key)
        return <div key={key} data-testid={key} {...item.props} style={item.style}>
            <button {...item.handleProps} aria-label={`Move ${key}`}>{key}</button>
            <button>Action {key}</button><input aria-label={`Edit ${key}`}/>
        </div>
    }
    return <>
        {board ? cols.map(col => <div key={col.key} data-testid={col.key} ref={multi.columnRef(col.key)}>{col.items.filter(k => keys.includes(k)).map(row)}</div>)
            : <div ref={single.listRef} data-testid="list">{order.filter(k => keys.includes(k)).map(row)}</div>}
        <output data-testid="state">{hook.dragKey ?? 'idle'}:{hook.inputMode ?? '-'}</output>
        <output data-testid="result">{board ? cols.map(c => c.items.join(',')).join('|') : order.join(',')}</output>
        <button onClick={hook.cancel}>Cancel</button>
    </>
}
function layout(board: boolean) {
    const rect = (x: number, y: number, width: number, height: number) =>
        ({x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON() {}}) as DOMRect
    for (const key of board ? ['one', 'two'] : ['list']) {
        const el = screen.getByTestId(key)
        Object.defineProperty(el, 'offsetWidth', {configurable: true, value: 100})
        el.getBoundingClientRect = () => rect(key === 'two' ? 200 : 0, 0, 100, 300)
    }
    for (const [index, key] of ['a', 'b', 'c'].entries()) {
        const el = screen.getByTestId(key)
        Object.defineProperties(el, {
            offsetWidth: {configurable: true, value: 100}, offsetHeight: {configurable: true, value: 40},
            offsetLeft: {configurable: true, value: 0}, offsetTop: {configurable: true, value: index * 50},
        })
        el.getBoundingClientRect = () => rect(0, index * 50, 100, 40)
    }
}
const handle = () => screen.getByRole('button', {name: 'Move a'})
const key = (value: string) => fireEvent.keyDown(handle(), {key: value})

test.each([false, true])('keyboard preview, cancel, single commit and retained focus (board=%s)', board => {
    const commit = jest.fn()
    render(<Harness board={board} commit={commit}/>); layout(board)
    handle().focus(); key(' '); key('ArrowDown')
    expect(screen.getByTestId('state').textContent).toBe('a:keyboard')
    expect(commit).not.toHaveBeenCalled()
    key('Escape')
    expect(screen.getByTestId('state').textContent).toBe('idle:-')
    expect(commit).not.toHaveBeenCalled()
    key('Enter'); key('ArrowDown'); key('Enter')
    expect(commit).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('result').textContent).toBe(board ? 'b,a,c|' : 'b,a,c')
    expect(document.activeElement).toBe(handle())
    screen.getByRole('textbox', {name: 'Edit b'}).focus()
    fireEvent.change(screen.getByRole('textbox', {name: 'Edit b'}), {target: {value: 'edit'}})
    expect(document.activeElement).toBe(screen.getByRole('textbox', {name: 'Edit b'}))
})

test('keyboard crosses to an empty column and focuses the remounted button', () => {
    const commit = jest.fn()
    render(<Harness board commit={commit}/>); layout(true)
    key(' '); key('ArrowRight'); key(' ')
    expect(commit).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('result').textContent).toBe('b,c|a')
    expect(document.activeElement).toBe(handle())
})

test.each([false, true])('explicit button handle permits mouse/touch but row controls do not (board=%s)', board => {
    const commit = jest.fn()
    render(<Harness board={board} commit={commit}/>); layout(board)
    for (const control of [screen.getByRole('button', {name: 'Action a'}), screen.getByRole('textbox', {name: 'Edit a'})]) {
        fireEvent.mouseDown(control, {button: 0, clientX: 20, clientY: 20})
        expect(screen.getByTestId('state').textContent).toBe('idle:-')
    }
    fireEvent.mouseDown(handle(), {button: 0, clientX: 20, clientY: 20})
    fireEvent.mouseMove(document, {clientX: 20, clientY: 80}); fireEvent.mouseUp(document)
    expect(commit).toHaveBeenCalledTimes(1)
    const touch = {identifier: 1, clientX: 20, clientY: 20}
    fireEvent.touchStart(handle(), {changedTouches: [touch]})
    expect(screen.getByTestId('state').textContent).toBe('a:pointer')
    fireEvent.touchCancel(document, {changedTouches: [touch]})
    expect(screen.getByTestId('state').textContent).toBe('idle:-')
    expect(commit).toHaveBeenCalledTimes(1)
})

test.each([false, true])('canDrag fences all starts and revocation/removal cancel without commit (board=%s)', board => {
    const commit = jest.fn()
    const view = render(<Harness board={board} allowed={false} commit={commit}/>); layout(board)
    key(' '); fireEvent.mouseDown(handle(), {button: 0}); fireEvent.touchStart(handle(), {changedTouches: [{identifier: 1}]})
    expect(screen.getByTestId('state').textContent).toBe('idle:-')
    view.rerender(<Harness board={board} commit={commit}/>); key(' '); key('ArrowDown')
    view.rerender(<Harness board={board} allowed={false} commit={commit}/>)
    expect(screen.getByTestId('state').textContent).toBe('idle:-')
    view.rerender(<Harness board={board} commit={commit}/>); fireEvent.mouseDown(handle(), {button: 0, clientX: 20, clientY: 20})
    fireEvent.mouseMove(document, {clientX: 20, clientY: 100})
    view.rerender(<Harness board={board} keys={['b', 'c']} commit={commit}/>)
    fireEvent.mouseUp(document)
    expect(screen.getByTestId('state').textContent).toBe('idle:-')
    expect(commit).not.toHaveBeenCalled()
})

test.each([false, true])('release before hold, blur and unmount cancel safely (board=%s)', async board => {
    jest.useFakeTimers()
    const commit = jest.fn()
    const view = render(<Harness board={board} holdMs={200} commit={commit}/>); layout(board)
    fireEvent.mouseDown(handle(), {button: 0, clientX: 20, clientY: 20}); fireEvent.mouseUp(document)
    await act(async () => { jest.runAllTimers() })
    expect(screen.getByTestId('state').textContent).toBe('idle:-')
    key(' '); key('ArrowDown'); fireEvent.blur(window)
    expect(screen.getByTestId('state').textContent).toBe('idle:-')
    key(' '); key('ArrowDown'); view.unmount()
    fireEvent.keyDown(document, {key: 'Enter'})
    expect(commit).not.toHaveBeenCalled()
    jest.useRealTimers()
})

test.each([false, true])('manual scroll changes target but does not move viewport overlay (board=%s)', board => {
    const commit = jest.fn()
    render(<Harness board={board} commit={commit}/>); layout(board)
    fireEvent.mouseDown(handle(), {button: 0, clientX: 20, clientY: 20})
    const list = screen.getByTestId(board ? 'one' : 'list')
    list.scrollTop = 110; fireEvent.scroll(list)
    fireEvent.mouseUp(document)
    expect(commit).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('result').textContent).toBe(board ? 'b,c,a|' : 'b,c,a')
})

test.each([false, true])('touch drop and release over a stopPropagation control commit once (board=%s)', board => {
    const commit = jest.fn()
    render(<Harness board={board} commit={commit}/>); layout(board)
    fireEvent.touchStart(handle(), {changedTouches: [{identifier: 7, clientX: 20, clientY: 20}]})
    fireEvent.touchMove(document, {changedTouches: [{identifier: 7, clientX: 20, clientY: 100}]})
    const control = screen.getByRole('button', {name: 'Action c'})
    control.addEventListener('touchend', e => e.stopPropagation())
    fireEvent.touchEnd(control, {changedTouches: [{identifier: 7, clientX: 20, clientY: 100}]})
    expect(commit).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('state').textContent).toBe('idle:-')
    fireEvent.mouseDown(handle(), {button: 0, clientX: 20, clientY: 20})
    fireEvent.mouseMove(document, {clientX: 20, clientY: 150})
    control.addEventListener('mouseup', e => e.stopPropagation())
    fireEvent.mouseUp(control)
    expect(commit).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('state').textContent).toBe('idle:-')
})
