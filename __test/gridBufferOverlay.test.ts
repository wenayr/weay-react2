import {createGridBuffer, type GridApiLike} from '../src/common/src/grid/agGrid4/core'

type Row = {id: string, name: string, price?: number}

function createGrid(rows: Row[]) {
    const data = new Map(rows.map(row => [row.id, row]))
    const api: GridApiLike<Row> = {
        getRowNode(id) {
            const row = data.get(id)
            return row ? {data: row} : undefined
        },
        forEachNode(cb) { data.forEach(row => cb({data: row})) },
        applyTransaction({add, update, remove}) {
            add?.forEach(row => data.set(row.id, row))
            update?.forEach(row => data.set(row.id, row))
            remove?.forEach(row => data.delete(row.id))
        },
        applyTransactionAsync(tx) { this.applyTransaction(tx) },
    }
    return {api, data}
}

test('overlay patch keeps static grid-owned fields on immediate update and sync', () => {
    const grid = createGrid([{id: 'a', name: 'Alpha', price: 10}])
    const core = createGridBuffer<Row>({getId: row => row.id!, mode: 'overlay'})
    core.control.attach(grid.api)

    core.api.updateData({newData: [{id: 'a', price: 11}]})
    expect(grid.data.get('a')).toEqual({id: 'a', name: 'Alpha', price: 11})

    grid.data.set('a', {id: 'a', name: 'Renamed', price: 10})
    core.api.sync()
    expect(grid.data.get('a')).toEqual({id: 'a', name: 'Renamed', price: 11})
})
