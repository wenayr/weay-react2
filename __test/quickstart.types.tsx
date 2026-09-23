// Compile-only mirror of doc/QUICKSTART.md: a snippet there that stops type-checking fails
// `npm run typecheck` here. Keep both in sync (imports differ only by the package path).
import {useRef, type ReactNode} from 'react'
import type {ColDef} from 'ag-grid-community'
import * as Observe from 'wenay-common2/observe'
import type * as Replay from 'wenay-common2/replay'
import {memoryCache, memoryCommit, memoryGetOrCreate, useCacheMapPersistence} from '../src/persist/index.js'
import {renderBy, updateBy, useReplaySubscribe, useStoreNode} from '../src/react/index.js'
import {createColumnGrid} from '../src/grid/index.js'
import {FloatingWindow} from '../src/windows/index.js'
import {createToolbar, SettingsDialog} from '../src/ui/index.js'
import {ModalProvider, useModal} from '../src/modal/index.js'
import {contextMenu} from '../src/menu/index.js'

// 1. App root
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState == 'hidden') void memoryCache.flush()
})

export function AppRoot({children}: {children: ReactNode}) {
    useCacheMapPersistence(memoryCache)
    return <ModalProvider>
        <contextMenu.Layer><div className="app">{children}</div></contextMenu.Layer>
    </ModalProvider>
}

// 2. Grid with a persisted column layout
type Order = {id: string, symbol: string, qty: number}
const orderColumns: ColDef<Order>[] = [
    {field: 'symbol', headerName: 'Symbol'},
    {field: 'qty', headerName: 'Qty'},
]
const ordersGrid = createColumnGrid<Order>({key: 'orders.columns', columnDefs: orderColumns, getId: row => row.id})

export function Orders({rows}: {rows: Order[]}) {
    return <div style={{height: 400}}>
        <ordersGrid.Toolbar settings />
        <ordersGrid.View mode="table" data={rows} />
    </div>
}

// 3. Floating window
export function ToolWindow({onClose}: {onClose: () => void}) {
    return <FloatingWindow keyForSave="tool" size={{width: 320, height: 240}} header={<b>Tool</b>}
                           closable closeOnEscape onClose={() => onClose()}>
        <p>Position and size survive a reload.</p>
    </FloatingWindow>
}

// 4. Toolbar + settings
const mainToolbar = createToolbar({key: 'main.toolbar', items: [
    {key: 'refresh', title: 'Refresh', onClick: () => location.reload()},
    {key: 'export', title: 'Export', onClick: () => console.log('export')},
]})

export function Header() {
    return <header>
        <mainToolbar.Bar settings />
        <SettingsDialog trigger={<span>Settings</span>} sections={[
            {key: 'toolbar', name: 'Toolbar', render: () => <mainToolbar.Settings />},
            {key: 'columns', name: 'Order columns', render: () => <ordersGrid.Settings />},
        ]} />
    </header>
}

// 5. Modal + context menu
export function OrderCell({orderId}: {orderId: string}) {
    const modal = useModal()
    return <span onContextMenu={e => contextMenu.openAt(e, [
        {name: 'Details', onClick: () => modal.open(<div>Order {orderId}</div>)},
        {name: 'Close dialog', onClick: () => modal.close()},
    ], {source: 'orders'})}>{orderId}</span>
}

// 6. Live data
type Quotes = {prices: {BTC: number, ETH: number}}
const quotes = Observe.createStore<Quotes>({prices: {BTC: 0, ETH: 0}})

export function BtcPrice() {
    const btc = useStoreNode(quotes.node.prices.BTC)
    return <span>{btc.value}</span>
}

export function LastTick({remote}: {remote: Replay.ReplayRemote<[number]>}) {
    const out = useRef<HTMLSpanElement>(null)
    const line = useReplaySubscribe(remote, price => {
        if (out.current) out.current.textContent = String(price)
    })
    return <span ref={out}>{line.ready ? '' : 'connecting...'}</span>
}

// Reactivity: your own object, then its persisted variant
const filters = {query: ''}

export function FilterBox() {
    updateBy(filters)
    return <input value={filters.query} onChange={e => { filters.query = e.target.value; renderBy(filters) }} />
}

const prefs = memoryGetOrCreate('app.prefs', {dense: false})

export function DensityToggle() {
    updateBy(prefs)
    return <button onClick={() => memoryCommit('app.prefs', prefs, p => { p.dense = !p.dense })}>
        {prefs.dense ? 'Dense' : 'Comfortable'}
    </button>
}
