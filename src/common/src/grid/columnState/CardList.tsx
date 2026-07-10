// CardList - rows as mobile blocks instead of a table. The SAME columnState
// config drives it: visible columns become the card fields (created/removed
// live as dots are placed), cardRole:'title' is the card header,
// cardRole:'accent' renders as a badge. The sticky sort orders the cards even
// when its column is hidden. No ag-grid, no storage.
import React from 'react'
import type {ColumnStateController} from './columnState'

function cmpValues(a: unknown, b: unknown): number {
    if (typeof a == 'number' && typeof b == 'number') return a - b
    if (a == null && b == null) return 0
    if (a == null) return -1
    if (b == null) return 1
    return String(a).localeCompare(String(b))
}

function cx(parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(' ')
}

export function CardList<T extends object>(p: {
    state: ColumnStateController
    data: readonly T[]
    getId?: (row: T, index: number) => string
    /** custom field renderer; default = String(row[key]) */
    renderValue?: (key: string, row: T) => React.ReactNode
    /** default stacked key/value rows; compact packs fields into a responsive two-column grid */
    layout?: 'stack' | 'compact'
    className?: string
    style?: React.CSSProperties
}) {
    const cfg = p.state.api.useConfig()
    const cols = p.state.columns
    const byKey = new Map(cols.map(c => [c.key, c]))
    const keys = p.state.api.visibleKeys()
    const titleKey = cols.find(c => c.cardRole == 'title' && cfg.visible[c.key] != false)?.key ?? keys[0]
    const accentKey = cols.find(c => c.cardRole == 'accent' && cfg.visible[c.key] != false)?.key
    const fieldKeys = keys.filter(k => k != titleKey && k != accentKey)

    const value = (key: string, row: T): React.ReactNode =>
        p.renderValue?.(key, row) ?? String((row as Record<string, unknown>)[key] ?? '')

    const rows = [...p.data]
    if (cfg.sort) {
        const {key, dir} = cfg.sort
        rows.sort((a, b) => cmpValues((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]) * (dir == 'asc' ? 1 : -1))
    }

    return <div className={cx(['wenayCardList', p.className])} style={p.style}>
        {rows.map((row, i) => (
            <div key={p.getId?.(row, i) ?? i} className={cx(['wenayCardListItem', p.layout == 'compact' && 'wenayCardListItem_compact'])}>
                <div className={cx(['wenayCardListHeader', fieldKeys.length == 0 && 'wenayCardListHeader_compact'])}>
                    <b className='wenayCardListTitle'>{titleKey ? value(titleKey, row) : ''}</b>
                    {accentKey && <span className='wenayCardListAccent'>{value(accentKey, row)}</span>}
                </div>
                <div className='wenayCardListFields'>
                    {fieldKeys.map(k => (
                        <div key={k} className='wenayCardListField'>
                            <span className='wenayCardListLabel'>{byKey.get(k)?.short ?? byKey.get(k)?.title ?? k}</span>
                            <span className='wenayCardListValue'>{value(k, row)}</span>
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
}