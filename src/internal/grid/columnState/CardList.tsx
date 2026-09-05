// CardList - rows as mobile blocks instead of a table. The SAME columnState
// config drives it: visible columns become the card fields (created/removed
// live as dots are placed), cardRole:'title' is the card header,
// cardRole:'accent' renders as a badge. The sticky sort orders the cards even
// when its column is hidden. No ag-grid, no storage.
import React, {useMemo} from 'react'
import type {ColumnStateController} from './columnState.js'
import {cx} from "../../utils/cx.js";

type CardRowProps<T extends object> = {
    row: T
    titleKey: string | undefined
    accentKey: string | undefined
    fieldKeys: string[]
    labels: {[key: string]: string}
    layout?: 'stack' | 'compact'
    value: (key: string, row: T) => React.ReactNode
}

/** One card. Memoized: a config change that does not touch this row's inputs
 *  (a re-render from an unrelated store) must not re-render every card. */
const CardRow = React.memo(function CardRow<T extends object>(p: CardRowProps<T>) {
    const {row, titleKey, accentKey, fieldKeys, labels, value} = p
    return <div className={cx(['wenayCardListItem', p.layout == 'compact' && 'wenayCardListItem_compact'])}>
        <div className={cx(['wenayCardListHeader', fieldKeys.length == 0 && 'wenayCardListHeader_compact'])}>
            <b className='wenayCardListTitle'>{titleKey ? value(titleKey, row) : ''}</b>
            {accentKey && <span className='wenayCardListAccent'>{value(accentKey, row)}</span>}
        </div>
        <div className='wenayCardListFields'>
            {fieldKeys.map(k => (
                <div key={k} className='wenayCardListField'>
                    <span className='wenayCardListLabel'>{labels[k] ?? k}</span>
                    <span className='wenayCardListValue'>{value(k, row)}</span>
                </div>
            ))}
        </div>
    </div>
}) as <T extends object>(p: CardRowProps<T>) => React.JSX.Element

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
    /** default stacked key/value rows; compact packs fields into a responsive two-column grid */
    layout?: 'stack' | 'compact'
    className?: string
    style?: React.CSSProperties
}) {
    const cfg = p.state.api.useConfig()
    const cols = p.state.columns
    const keys = p.state.api.visibleKeys()
    // cfg and keys keep their identity until the next commit (columnState memoizes normalize),
    // so the derived field set is memoized on them directly - no stringify per render.
    const {titleKey, accentKey, fieldKeys: stableFieldKeys, labels} = useMemo(() => {
        const titleKey = cols.find(c => c.cardRole == 'title' && cfg.visible[c.key] != false)?.key ?? keys[0]
        const accentKey = cols.find(c => c.cardRole == 'accent' && cfg.visible[c.key] != false)?.key
        const fieldKeys = keys.filter(k => k != titleKey && k != accentKey)
        const byKey = new Map(cols.map(c => [c.key, c]))
        const labels = Object.fromEntries(fieldKeys.map(k => [k, byKey.get(k)?.short ?? byKey.get(k)?.title ?? k]))
        return {titleKey, accentKey, fieldKeys, labels}
    }, [cfg, keys, cols])

    const renderValue = p.renderValue
    const value = useMemo(() => (key: string, row: T): React.ReactNode =>
        renderValue?.(key, row) ?? String((row as Record<string, unknown>)[key] ?? ''), [renderValue])

    // The sticky sort orders the cards even when its column is hidden. Tracked by VALUE
    // (key/dir): a visibility commit must not re-sort the rows.
    const sortKey = cfg.sort?.key
    const sortDir = cfg.sort?.dir
    const rows = useMemo(() => {
        const res = [...p.data]
        if (sortKey && sortDir)
            res.sort((a, b) => cmpValues((a as Record<string, unknown>)[sortKey], (b as Record<string, unknown>)[sortKey]) * (sortDir == 'asc' ? 1 : -1))
        return res
    }, [p.data, sortKey, sortDir])

    return <div className={cx(['wenayCardList', p.className])} style={p.style}>
        {rows.map((row, i) => (
            <CardRow<T> key={p.getId?.(row, i) ?? i} row={row} titleKey={titleKey} accentKey={accentKey}
                        fieldKeys={stableFieldKeys} labels={labels} layout={p.layout} value={value}/>
        ))}
    </div>
}