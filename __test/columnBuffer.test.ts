import {createColumnBuffer} from '../src/internal/grid/agGrid4/columnBuffer'
import type {GridApi} from 'ag-grid-community'

const fakeApi = {} as GridApi

test('setNames skips apply when the deduped set is unchanged, apply() forces it', () => {
    const buffer = createColumnBuffer()
    const seen: string[][] = []
    buffer.control.attach(fakeApi, {apply: ({names}) => seen.push([...names])})
    expect(seen).toEqual([[]])

    buffer.api.setNames(['a', 'b'])
    expect(seen).toEqual([[], ['a', 'b']])

    // same set, same order - no re-apply (streams re-announce their column set every tick)
    buffer.api.setNames(['a', 'b'])
    // duplicates dedupe down to the same set - still no re-apply
    buffer.api.setNames(['a', 'b', 'a'])
    expect(seen).toEqual([[], ['a', 'b']])
    expect(buffer.api.names).toEqual(['a', 'b'])

    // order is part of the identity: a reorder IS a change
    buffer.api.setNames(['b', 'a'])
    expect(seen).toEqual([[], ['a', 'b'], ['b', 'a']])

    // a real change still applies
    buffer.api.setNames(['b', 'a', 'c'])
    expect(seen.length).toBe(4)
    expect(seen[3]).toEqual(['b', 'a', 'c'])

    // apply() stays the explicit force path even when nothing changed
    buffer.api.apply()
    expect(seen.length).toBe(5)
    expect(seen[4]).toEqual(['b', 'a', 'c'])
})

test('attach replays the buffered set, detach keeps it', () => {
    const buffer = createColumnBuffer()
    buffer.api.setNames(['x', 'y'])
    const seen: string[][] = []
    buffer.control.attach(fakeApi, {apply: ({names}) => seen.push([...names])})
    expect(seen).toEqual([['x', 'y']])
    buffer.control.detach()
    // unchanged set after detach: nothing to apply, and the names survive
    buffer.api.setNames(['x', 'y'])
    expect(buffer.api.names).toEqual(['x', 'y'])
    expect(seen).toEqual([['x', 'y']])
})
