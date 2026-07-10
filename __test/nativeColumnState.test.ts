import {createNativeColumnDots} from '../src/native/columnDots'
import {createNativeColumnState, type NativeColumnStorage} from '../src/native/columnState'

const columns = [
    {key: 'name', title: 'Name', fixed: true},
    {key: 'price', title: 'Price'},
    {key: 'pnl', title: 'PnL'},
] as const

test('hydrates compatible config and persists edits', async () => {
    const values = new Map([['columns', JSON.stringify({
        v: 1, order: ['pnl', 'missing', 'name'], visible: {name: false, pnl: true, price: false},
        width: {pnl: 140, missing: 20}, sort: {key: 'pnl', dir: 'desc'},
        filter: {pnl: {type: 'greaterThan'}, missing: true}, groups: {},
    })]])
    const storage: NativeColumnStorage = {
        async getItem(key) { return values.get(key) ?? null },
        async setItem(key, value) { values.set(key, value) },
    }
    const state = createNativeColumnState({key: 'columns', columns, storage, saveMs: 0})
    await state.ready
    expect(state.api.getConfig()).toEqual({
        v: 1, order: ['name', 'pnl', 'price'], visible: {name: true, price: false, pnl: true},
        width: {pnl: 140}, sort: {key: 'pnl', dir: 'desc'},
        filter: {pnl: {type: 'greaterThan'}}, groups: {},
    })
    state.api.show('price', true)
    state.api.toggleSort('price')
    await state.api.flush()
    expect(JSON.parse(values.get('columns')!)).toMatchObject({visible: {price: true}, sort: {key: 'price', dir: 'asc'}})
})

test('local edit wins over stale async hydration', async () => {
    let release!: (value: string | null) => void
    const storage: NativeColumnStorage = {
        getItem: async () => new Promise(resolve => { release = resolve }),
        setItem: async () => undefined,
    }
    const state = createNativeColumnState({key: 'columns', columns, storage})
    state.api.show('price', false)
    release(JSON.stringify({...state.api.getConfig(), visible: {name: true, price: true, pnl: true}}))
    await state.ready
    expect(state.api.getConfig().visible.price).toBe(false)
})

test('dots model supports live replace, reorder, toggle and sticky sort', () => {
    const state = createNativeColumnState({key: 'columns', columns,
        def: {visible: {name: true, price: true, pnl: false}}})
    const dots = createNativeColumnDots({state, max: 2})
    expect(dots.begin('price', 50, 0)).toBe(true)
    dots.move(100, 0, {start: 0, length: 100})
    dots.end()
    expect(state.api.getConfig().visible).toEqual({name: true, price: false, pnl: true})
    dots.select('pnl')
    dots.toggleSelectedSort()
    dots.toggleSelectedSort()
    expect(state.api.getConfig().sort).toEqual({key: 'pnl', dir: 'desc'})
    dots.reorder('pnl', 1)
    expect(state.api.getConfig().order).toEqual(['name', 'pnl', 'price'])
    dots.toggle('pnl')
    expect(state.api.getConfig().visible.pnl).toBe(false)
})

test('native source graph has no browser, React DOM, CSS or grid dependency', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(path.join(__dirname, '../src/native/columnState.ts'), 'utf8')
        + fs.readFileSync(path.join(__dirname, '../src/native/columnDots.ts'), 'utf8')
    expect(source).not.toMatch(/react-dom|ag-grid|document\.|window\.|\.css['"]/)
})
