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

export function CardList<T extends object>(p: {
    state: ColumnStateController
    data: readonly T[]
    getId?: (row: T, index: number) => string
    /** custom field renderer; default = String(row[key]) */
    renderValue?: (key: string, row: T) => React.ReactNode
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
    if (cfg.sort) { // sticky sort: applies even when its column is hidden
        const {key, dir} = cfg.sort
        rows.sort((a, b) => cmpValues((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]) * (dir == 'asc' ? 1 : -1))
    }

    return <div className={p.className} style={{display: 'grid', gap: 8, ...p.style}}>
        {rows.map((row, i) => (
            <div key={p.getId?.(row, i) ?? i}
                 style={{border: '1px solid #d0d7de', borderRadius: 8, padding: '8px 10px', background: '#fff'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: fieldKeys.length ? 6 : 0}}>
                    <b style={{fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                        {titleKey ? value(titleKey, row) : ''}
                    </b>
                    {accentKey && <span style={{fontSize: 11, padding: '1px 8px', borderRadius: 10, background: '#ddf4ff', color: '#0969da', whiteSpace: 'nowrap'}}>
                        {value(accentKey, row)}
                    </span>}
                </div>
                {fieldKeys.map(k => (
                    <div key={k} style={{display: 'flex', gap: 10, fontSize: 12, lineHeight: 1.7}}>
                        <span style={{color: '#57606a', minWidth: 72}}>{byKey.get(k)?.title ?? k}</span>
                        <span style={{flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis'}}>{value(k, row)}</span>
                    </div>
                ))}
            </div>
        ))}
    </div>
}
