import {createNativeColumnDots} from '../src/native/columnDots'
import {createNativeColumnState} from '../src/native/columnState'

const columns = [
    {key: 'name', title: 'Name', fixed: true},
    {key: 'price', title: 'Price'},
    {key: 'pnl', title: 'PnL'},
] as const

test('dots protects fixed, max and last-visible invariants', () => {
    const state = createNativeColumnState({key: 'columns', columns,
        def: {visible: {name: true, price: false, pnl: false}}})
    const dots = createNativeColumnDots({state, max: 2, removeDirection: 'down'})

    dots.toggle('name')
    expect(state.api.getConfig().visible.name).toBe(true)
    dots.toggle('price')
    dots.toggle('pnl')
    expect(state.api.getConfig().visible).toEqual({name: true, price: true, pnl: false})

    expect(dots.begin('name', 0, 0)).toBe(true)
    dots.move(0, 80, {start: 0, length: 100})
    dots.end()
    expect(state.api.getConfig().visible.name).toBe(true)

    expect(dots.begin('price', 50, 0)).toBe(true)
    dots.move(50, 80, {start: 0, length: 100})
    dots.end()
    expect(state.api.getConfig().visible.price).toBe(false)
})

test('default tear-off direction is platform-neutral', () => {
    const state = createNativeColumnState({key: 'columns', columns,
        def: {visible: {name: true, price: true, pnl: false}}})
    const dots = createNativeColumnDots({state})
    dots.begin('price', 50, 50)
    dots.move(50, 0, {start: 0, length: 100})
    dots.end()
    expect(state.api.getConfig().visible.price).toBe(false)
})
