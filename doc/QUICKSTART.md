# wenay-react2 quickstart

Start here. Six snippets cover the everyday surface; everything else is in
[wenay-react2.md](wenay-react2.md) (brief API) and [wenay-react2-rare.md](wenay-react2-rare.md).
Every snippet is compiled by `__test/quickstart.types.tsx`.

## Install

```sh
npm i wenay-react2 react react-dom ag-grid-community ag-grid-react wenay-common2
```

`ag-grid-*` and `wenay-common2` are peer dependencies; list them in the app because app code
imports them directly (grid types, stores). `wenay-exchange` is a peer as well: bars and quotes
history come from it, not from common2 (since common2 3.0.0). Import the stylesheet once, next to your app
entry, and import code only from the canonical subpaths (`wenay-react2/grid`, `/ui`, ...).
There is no root `wenay-react2` entry (removed in 4.0.0).

```ts
import "wenay-react2/styles"
```

## 1. App root

The library never writes storage by itself: the app loads once and decides when to save.

```tsx
import type {ReactNode} from "react"
import {memoryCache, useCacheMapPersistence} from "wenay-react2/persist"
import {ModalProvider} from "wenay-react2/modal"
import {contextMenu} from "wenay-react2/menu"

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState == "hidden") void memoryCache.flush()
})

export function AppRoot({children}: {children: ReactNode}) {
    useCacheMapPersistence(memoryCache)      // load once + debounced save on change
    return <ModalProvider>
        <contextMenu.Layer><div className="app">{children}</div></contextMenu.Layer>
    </ModalProvider>
}
```

## 2. Grid with a persisted column layout

One controller drives the table, its toolbar, settings and the mobile views. Create it at
module level so the layout outlives route remounts.

```tsx
import type {ColDef} from "ag-grid-community"
import {createColumnGrid} from "wenay-react2/grid"

type Order = {id: string, symbol: string, qty: number}
const orderColumns: ColDef<Order>[] = [
    {field: "symbol", headerName: "Symbol"},
    {field: "qty", headerName: "Qty"},
]
const ordersGrid = createColumnGrid<Order>({key: "orders.columns", columnDefs: orderColumns, getId: row => row.id})

export function Orders({rows}: {rows: Order[]}) {
    return <div style={{height: 400}}>
        <ordersGrid.Toolbar settings />
        <ordersGrid.View mode="table" data={rows} />
    </div>
}
```

`mode="cards"` renders the same config as mobile cards. Streaming rows: `useAgGrid` /
`createGridBuffer` in the brief doc.

## 3. Floating window

```tsx
import {FloatingWindow} from "wenay-react2/windows"

export function ToolWindow({onClose}: {onClose: () => void}) {
    return <FloatingWindow keyForSave="tool" size={{width: 320, height: 240}} header={<b>Tool</b>}
                           closable closeOnEscape onClose={() => onClose()}>
        <p>Position and size survive a reload.</p>
    </FloatingWindow>
}
```

## 4. Toolbar and settings

The same `Settings` element works inside the dialog and anywhere else.

```tsx
import {createToolbar, SettingsDialog} from "wenay-react2/ui"

const mainToolbar = createToolbar({key: "main.toolbar", items: [
    {key: "refresh", title: "Refresh", onClick: () => location.reload()},
    {key: "export", title: "Export", onClick: () => console.log("export")},
]})

export function Header() {
    return <header>
        <mainToolbar.Bar settings />
        <SettingsDialog trigger={<span>Settings</span>} sections={[
            {key: "toolbar", name: "Toolbar", render: () => <mainToolbar.Settings />},
            {key: "columns", name: "Order columns", render: () => <ordersGrid.Settings />},
        ]} />
    </header>
}
```

## 5. Modal and context menu

```tsx
import {useModal} from "wenay-react2/modal"
import {contextMenu} from "wenay-react2/menu"

export function OrderCell({orderId}: {orderId: string}) {
    const modal = useModal()
    return <span onContextMenu={e => contextMenu.openAt(e, [
        {name: "Details", onClick: () => modal.open(<div>Order {orderId}</div>)},
        {name: "Close dialog", onClick: () => modal.close()},
    ], {source: "orders"})}>{orderId}</span>
}
```

## 6. Live data

Stores, RPC and replay lines come from `wenay-common2`; the hooks here only bind them to
React lifecycle. High-frequency values go to a ref or canvas, never to React state.

```tsx
import {useRef} from "react"
import * as Observe from "wenay-common2/observe"
import type * as Replay from "wenay-common2/replay"
import {useReplaySubscribe, useStoreNode} from "wenay-react2/react"

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
    return <span ref={out}>{line.ready ? "" : "connecting..."}</span>
}
```

## Which state model to use

The library has three kinds of state, each for its own job:

| State | Use | API |
| --- | --- | --- |
| Your own mutable object (filters, local UI state shared by several components) | mutate in place, then announce | `updateBy(obj)` in components, `renderBy(obj)` after a change |
| Persisted UI preferences | same object model, stored by `memoryCache` | `memoryGetOrCreate(key, def)` + `memoryCommit(key, entry, mutate)` |
| Server, replicated or streamed data | owned by `wenay-common2` | `useStoreNode` / `useStoreSelect` / `useListenValue`, replay lines via `useReplaySubscribe` / `useStoreReplayMirror` |

`ObservableMap` is the plumbing under persistence; applications rarely touch it directly.

```tsx
import {renderBy, updateBy} from "wenay-react2/react"
import {memoryCommit, memoryGetOrCreate} from "wenay-react2/persist"

const filters = {query: ""}

export function FilterBox() {
    updateBy(filters)
    return <input value={filters.query} onChange={e => { filters.query = e.target.value; renderBy(filters) }} />
}

const prefs = memoryGetOrCreate("app.prefs", {dense: false})

export function DensityToggle() {
    updateBy(prefs)
    return <button onClick={() => memoryCommit("app.prefs", prefs, p => { p.dense = !p.dense })}>
        {prefs.dense ? "Dense" : "Comfortable"}
    </button>
}
```

## Ownership rules

- The app owns storage timing, transport, authorization and domain rules.
- Hooks that bind an existing client (`useClientStore`, `usePeer`, `useContractSlot`, ...)
  never close it; `useOwnedClient` creates and closes its own resource.
- `create*` controllers at module level keep their state across remounts; use the `use*`
  variant (for example `useColumnGrid`) when the state should die with the component.

## Next

- Everyday API: [wenay-react2.md](wenay-react2.md)
- Choosing between primitives: [EXAMPLE_USAGE.md](EXAMPLE_USAGE.md)
- React Native entry: [native.md](native.md)
- Migrating 3.x code (root imports, 4.0.0 renames): [WENAY_REACT2_RENAMES.md](WENAY_REACT2_RENAMES.md)
- Live QA stand (repository only): `npm run testReact`, then `http://localhost:3010/`
