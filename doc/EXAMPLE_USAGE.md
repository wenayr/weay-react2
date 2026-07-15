# wenay-react2 Example Usage Standards

This document explains how to choose and use the library primitives, and why
those choices matter.

It is a standards file, not a complete API reference. For raw signatures, read
`doc/wenay-react2.md`. For rare behavior and compatibility notes, read
`doc/wenay-react2-rare.md`.

## General Rule

Prefer the highest-level primitive that owns the lifecycle you need. For reusable behavior, the canonical primitive should usually be a headless `use*` hook or `create*` controller, with visual components layered above it.

Examples:

- Use `useAgGrid` / `AgGridTable` before direct `applyGridRows`.
- Use `createColumnState` before a local "visible columns" object.
- Use `createToolbar({source})` before manually bridging toolbar and grid
  order.
- Use `contextMenu.openAt(e, items)` before queued/global context menu writes.
- Use `useStoreMirror` or replay hooks before hand-written subscribe effects.
- Use `memoryCache.onDirty` save wiring before direct storage writes inside a
  shared primitive.

The reason is lifecycle ownership. The canonical primitive already knows how to
attach, detach, replay current state, notify React, and preserve user config.

## Hook/Controller Layering Standard

For new reusable functionality, design the hook/controller API first. A visual component should usually be a thin layer over that API, and old component-only entry points should remain as compatibility wrappers when practical.

Preferred shape:

- Layer 1: `use*` hook or `create*` controller that owns state, lifecycle, subscriptions, persistence, commands, and callbacks.
- Layer 2: visual `*View` / `*Table` / `*Panel` component that consumes the hook/controller and renders DOM.
- Layer 3: compatibility component with the old name/props, implemented through Layer 1 and Layer 2.

Do not add a hook just to add a hook. The hook/controller should expose real control: methods, subscription state, refs/controllers, persistence hooks, or an API object that a stand card/app can use without copying JSX.

## Compatibility Standard

New examples should teach the canonical hook/controller API first. Old public APIs should usually remain supported during internal refactors, but an aggressive migration is allowed when it is explicitly planned and recorded in changelog/migration notes. Do not present a removed API as supported.

When a replacement API is introduced:

- keep the old import working;
- document the old path as compatibility/low-level if needed;
- add migration notes before changing examples broadly;
- collect local usage statistics for risky surfaces before proposing removal;
- keep default styles available until a replacement class/token contract is documented.

## Imports

Use root imports in consumer code:

```ts
import {
    AgGridTable,
    createColumnState,
    createToolbar,
    memoryCache,
    useAgGrid,
} from "wenay-react2"
```

Use deep imports only inside this repository or when working on a local module
that has no root export yet.

## Style Standard

Shared primitives must ship with usable default styling. Prefer CSS classes plus custom properties over inline visual styles. Inline style is acceptable for computed runtime geometry such as drag offsets, dot positions, measured sizes, and z-index decisions; it is not the right place for reusable colors, spacing, borders, shadows, fonts, or hover/active states.

When changing styles:

- keep the old default class working or provide a documented replacement;
- add/extend CSS variables before broad visual rewrites;
- write the changelog in terms of what changed visually and how apps override it;
- check the relevant QA card before and after the migration.

## App Startup Persistence

Use when the app wants persisted shared UI preferences.

```ts
import { memoryCache } from "wenay-react2"

memoryCache.load()

const off = memoryCache.onDirty(() => {
    memoryCache.saveDebounced(800)
})
// Call off() during app shutdown or test cleanup when this setup is scoped.

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState == "hidden") void memoryCache.flush()
})

window.addEventListener("pagehide", () => {
    void memoryCache.flush()
})
```

Why:

- `createToolbar`, `createUiSlot`, `createColumnState`, floating windows, and
  resize maps can mark their data dirty.
- The library must not decide when the product writes storage.
- The app can choose debounce, final flush, or explicit save behavior.

Standard:

- Call `memoryCache.load()` before mounting UI that reads persisted config.
- Do not put `localStorage.setItem` inside a shared primitive.
- Use `memoryUpdate` or `memoryMarkDirty` when mutating stored objects in place
  from app code.

## Declarative Table

Use when React owns the full row list.

```tsx
import { AgGridTable } from "wenay-react2"
import type { ColDef } from "ag-grid-community"

type Row = { id: string; name: string; price: number }

const columns: ColDef<Row>[] = [
    { field: "name" },
    { field: "price" },
]

export function PricesTable({ rows }: { rows: Row[] }) {
    return (
        <AgGridTable<Row>
            rowData={rows}
            columnDefs={columns}
            getRowId={p => p.data.id}
        />
    )
}
```

Why:

- React already has the complete row array.
- There is no patch stream or transaction buffer to manage.
- `AgGridTable` keeps the shared theme/wrapper path while preserving normal
  ag-grid props.

Standard:

- Provide `getRowId` when selection, row state, streaming overlays, or stable
  identity matters.
- Do not create a buffer just to render a static list.

## Streaming Or Patch-Updating Table

Use when rows arrive as add/update/remove patches.

```tsx
import { AgGridTable, useAgGrid } from "wenay-react2"
import type { ColDef } from "ag-grid-community"
import { useEffect } from "react"

type Row = { id: string; name: string; price: number }

const columns: ColDef<Row>[] = [
    { field: "name" },
    { field: "price" },
]

export function StreamTable({ subscribe }: {
    subscribe: (cb: (rows: Row[]) => void) => () => void
}) {
    const grid = useAgGrid<Row>({ getId: row => row.id })

    useEffect(() => {
        return subscribe(rows => {
            grid.update({ newData: rows })
        })
    }, [grid, subscribe])

    return <AgGridTable<Row> controller={grid} columnDefs={columns} />
}
```

Why:

- The controller owns grid readiness.
- Patches received before the grid is ready are kept in the buffer.
- Route remounts can resync from the buffer.
- Remove/update semantics are centralized.

Standard:

- Prefer `grid.update`, `grid.remove`, `grid.clean`, `grid.sync`, `grid.fit`.
- Keep a stable `getId`.
- Use a module-level `createGridBuffer` when the buffer must survive component
  unmounts or be shared by several views.
- Treat direct `applyGridRows` as a low-level helper or legacy migration path,
  not the first example for new code.

## Overlay Stream Over React-Owned Rows

Use when React owns which rows exist, but a stream updates values on those rows.

```tsx
import { AgGridTable, createGridBuffer, useAgGrid } from "wenay-react2"
import { useEffect, useState } from "react"

type Row = { id: string; name: string; streamPrice?: number }

export function OverlayTable({ rows, subscribe }: {
    rows: Row[]
    subscribe: (cb: (rows: Partial<Row>[]) => void) => () => void
}) {
    const [core] = useState(() => createGridBuffer<Row>({
        getId: row => row.id,
        mode: "overlay",
        pushDefaults: { add: false },
    }))
    const grid = useAgGrid({ core })

    useEffect(() => core.api.sync(), [core, rows])

    useEffect(() => {
        return subscribe(patches => {
            core.api.updateData({ newData: patches as Row[] })
        })
    }, [core, subscribe])

    return (
        <AgGridTable<Row>
            controller={grid}
            rowData={rows}
            columnDefs={[
                { field: "name" },
                { field: "streamPrice" },
            ]}
            getRowId={p => p.data.id}
        />
    )
}
```

Why:

- React decides row membership.
- Stream-only rows should not appear by accident.
- Buffered patches can be applied when a matching row appears later.

Standard:

- Use `mode: "overlay"` and usually `pushDefaults: { add: false }`.
- Call `sync()` when the declarative row set changes.
- Do not mix overlay ownership with independent transaction add/remove logic
  unless the behavior is deliberately specified.

## Dynamic Columns

Use when a table has a stable base schema plus a variable set of dynamic
column names.

```tsx
import { AgGridTable, createColumnBuffer } from "wenay-react2"
import type { ColDef, ColGroupDef } from "ag-grid-community"
import { useState } from "react"

type Row = { id: string; symbol: string; [key: string]: string | number }
type AnyCol = ColDef<Row> | ColGroupDef<Row>

const baseColumns: AnyCol[] = [
    { field: "symbol" },
    { headerName: "Metrics", groupId: "metrics", children: [] },
]

function buildColumn(name: string): ColDef<Row> {
    return {
        colId: `metric:${name}`,
        field: name,
        headerName: name,
    }
}

function buildColumns(names: readonly string[]): AnyCol[] {
    return baseColumns.map(col =>
        "children" in col && col.groupId == "metrics"
            ? { ...col, children: names.map(buildColumn) }
            : col,
    )
}

export function DynamicGrid({ rows }: { rows: Row[] }) {
    const [columns] = useState(() => createColumnBuffer<Row>())

    return (
        <AgGridTable<Row>
            rowData={rows}
            getRowId={p => p.data.id}
            columnDefs={baseColumns}
            onGridReady={event => columns.control.attach(event.api, {
                apply: ({ api, names }) => {
                    api.setGridOption("columnDefs", buildColumns(names))
                },
            })}
            onGridPreDestroyed={() => columns.control.detach()}
        />
    )
}
```

Why:

- The shared library stores and replays the dynamic name set.
- The app owns group selection, column IDs, headers, value formatters, and
  domain naming.

Standard:

- `createColumnBuffer` should not know product group IDs.
- Build stable `colId` values in the app wrapper.
- Use `columns.api.setNames(nextNames)` when the set changes.
- Use `columns.api.apply()` when wrapper policy changes but names do not.

## Column State For Grid, Menu, Toolbar, And Mobile Cards

Use when one column config should drive multiple surfaces.

```tsx
import {
    AgGridTable,
    CardList,
    ColumnDots,
    ColumnsMenu,
    createColumnState,
    createToolbar,
} from "wenay-react2"
import type { ColDef } from "ag-grid-community"

type Row = { id: string; name: string; price: number; qty: number }

const state = createColumnState({
    key: "orders.columns",
    columns: [
        { key: "name", title: "Name", fixed: true, cardRole: "title" },
        { key: "price", title: "Price", short: "px" },
        { key: "qty", title: "Quantity", short: "qty" },
    ],
})

const columnsToolbar = createToolbar({
    key: "orders.columns.toolbar",
    items: state.columns.map(col => ({
        key: col.key,
        title: col.title,
        short: col.short,
    })),
    source: state.api.listSource,
})
const ColumnsToolbarBar = columnsToolbar.Bar

const columnDefs: ColDef<Row>[] = [
    { colId: "name", field: "name" },
    { colId: "price", field: "price" },
    { colId: "qty", field: "qty" },
]

export function OrdersGrid({ rows, compact }: { rows: Row[]; compact?: boolean }) {
    if (compact) {
        return (
            <>
                <ColumnDots state={state} />
                <CardList<Row> state={state} data={rows} getId={row => row.id} />
            </>
        )
    }

    return (
        <>
            <ColumnsToolbarBar settings />
            <ColumnsMenu state={state} compact />
            <AgGridTable<Row>
                rowData={rows}
                columnDefs={columnDefs}
                getRowId={p => p.data.id}
                autoSizeColumns={false}
                onGridReady={e => state.grid.attach(e.api)}
                onGridPreDestroyed={() => state.grid.detach()}
            />
        </>
    )
}
```

Why:

- Grid drag, menu toggle, toolbar settings, and mobile dots edit one config.
- User preferences survive remounts.
- Mobile cards do not need ag-grid.

Standard:

- Keep `createColumnState` at module/app-wrapper level when config should
  survive component remounts.
- Attach the ag-grid adapter in `onGridReady` and detach in
  `onGridPreDestroyed`.
- Pass `autoSizeColumns={false}` when restoring widths, otherwise auto-fit can
  overwrite persisted width state.
- Use `state.api.listSource` when a toolbar should mirror column order and
  visibility.
- Use `sourceMode: "order"` when toolbar membership and extra toolbar-only
  buttons must stay local while column order comes from `columnState`.

## Default Column Grid Wrapper

Use when a normal grid should get the standard column menu, toolbar settings,
and mobile card/table representation without hand-wiring every surface.

```tsx
import { createColumnGrid } from "wenay-react2"
import type { ColDef } from "ag-grid-community"

type Row = { id: string; name: string; price: number; qty: number; note: string }

const columnDefs: ColDef<Row>[] = [
    { colId: "name", field: "name" },
    { colId: "price", field: "price" },
    { colId: "qty", field: "qty", headerName: "Qty" },
    { colId: "note", field: "note" },
]

const ordersGrid = createColumnGrid<Row>({
    key: "orders.columns",
    columnDefs,
    getId: row => row.id,
    autoSizeOnColumnCountChange: true,
    columns: [
        { key: "name", fixed: true, cardRole: "title" },
        { key: "note", defaultVisible: false },
    ],
})

export function OrdersView({ rows, mobile }: { rows: Row[]; mobile?: boolean }) {
    return (
        <ordersGrid.View
            mode={mobile ? "cards" : "table"}
            data={rows}
            table={{ getRowId: p => p.data.id }}
        />
    )
}
```

Standard:

- `createColumnGrid` infers column metadata from `colId`, `field`, and
  `headerName`; pass `columns` only for overrides like `fixed`, `icon`,
  `defaultVisible`, and `cardRole`.
- The returned `Table` and `View` attach/detach `columnState` automatically and
  default `autoSizeColumns` to `false` so restored widths survive remounts.
- `View` defaults to the dots overlay (`controls="auto"`) for both table and cards;
  pass `controls="menu"`, `controls="toolbar"`, or `controls={false}` only when needed.
- `Dots` can drive a table too; it is a column selector over the shared config,
  not a card-only control, and the wrapper defaults its max to all columns.
- `autoSizeOnColumnCountChange` is optional and separate from `autoSizeColumns`;
  it fits once when the number of visible columns changes.
- Drop to raw `createColumnState` when a product needs custom grouping, runtime
  presence gates, or a fully custom toolbar skin.

## Grid Chrome: Compact Table Commands

Use `createGridChrome` directly, or enable it on `createColumnGrid`, when table
commands should be available from one adaptive trigger instead of a permanent row
of small buttons. It reuses the existing column state; it never creates another
column config or serializes domain rows itself.

```tsx
import { createColumnGrid } from "wenay-react2"

const ordersGrid = createColumnGrid<Order>({
    key: "orders.columns",
    columnDefs,
    chrome: {
        copy({rows}) {
            navigator.clipboard.writeText(rows.map(order => order.id).join("\n"))
        },
        saveColumns({columnState}) {
            return saveTableLayout(columnState?.api.getConfig())
        },
        contextItems(event) {
            return [{name: "Открыть заказ", onClick: () => openOrder(event.node?.data)}]
        },
        commands: [
            {key: "refresh", group: "table", name: "Обновить", run: () => reloadOrders()},
        ],
    },
})

export function OrdersHeader() {
    const Chrome = ordersGrid.Chrome
    return <div className="wenayGridChromeArea ordersHeaderActions">
        <h2>Orders</h2>
        <Chrome />
    </div>
}
```

On a fine pointer the slot stays reserved and the trigger appears on hover/focus;
on touch/coarse layouts CSS keeps a 44px target visible. The popover contains
column controls, size actions, selected-row copy, and declarative app commands.
Right-click copy selects the clicked row only when needed and appends its item to
`contextItems`; it does not replace application items. `Ctrl/Cmd+C` and existing
long-touch/context-menu layers remain untouched.

`wenayGridChromeArea` is an optional neutral header wrapper. It makes the desktop
trigger discoverable when the pointer enters the whole header while retaining the
same fixed trigger slot and without coupling the library to an app header style.

## Toolbar With Local Commands

Use when a command strip has its own commands and user-configurable layout.

```tsx
import { createToolbar } from "wenay-react2"

const ordersToolbar = createToolbar({
    key: "orders.toolbar",
    items: [
        { key: "refresh", title: "Refresh", short: "ref", onClick: refresh },
        { key: "export", title: "Export", short: "csv", onClick: exportCsv },
        { key: "settings", title: "Settings", fixed: true, onClick: openSettings },
    ],
    resetItem: { title: "Reset" },
})

export function OrdersToolbar() {
    const OrdersToolbarBar = ordersToolbar.Bar
    return <OrdersToolbarBar settings reset />
}
```

Why:

- Users can choose order, visibility, and density.
- The same `toolbar.Settings` can be rendered in an inline popover, global
  settings dialog, or a custom floating window.

Standard:

- Toolbar items should be commands or view controls, not product data rows.
- Use `fixed` for commands that must not disappear.
- Prefer `item.render(density)` only when the default icon/label renderer is
  insufficient.

## Settings Dialog

Use when app settings need a searchable tree.

```tsx
import { SettingsDialog, registerSettingsSection, useSettingsDialogController } from "wenay-react2"
import { useEffect } from "react"

const ColumnsSettings = columnsToolbar.Settings

export function OrdersSettingsRegistration() {
    useEffect(() => {
        return registerSettingsSection({
            key: "orders.columns",
            name: "Columns",
            parentKey: "orders",
            keywords: ["table", "grid", "visibility"],
            render: () => <ColumnsSettings />,
        })
    }, [])

    return null
}

export function SettingsButton() {
    return (
        <SettingsDialog
            trigger={<button>Settings</button>}
            sections={[
                { key: "orders", name: "Orders", render: () => null },
            ]}
            defaultSection="orders.columns"
        />
    )
}

export function CustomSettingsTrigger() {
    const settings = useSettingsDialogController({
        sections: [{ key: "orders", name: "Orders", render: () => null }],
        defaultSection: "orders",
    })

    return <button onClick={settings.openDialog}>{settings.open ? "Open" : "Settings"}</button>
}
```

Why:

- Sections can be registered by feature modules.
- Search and tree behavior stays consistent across apps.
- `useSettingsDialogController` exposes the same open/search/tree/history/resize actions for custom settings chrome.

Standard:

- Use stable `key` values.
- Put searchable synonyms in `keywords` or `searchText`.
- Do not put settings registry state in product globals when the shared
  registry already fits.
- Do not rewrite tree/search/divider UX just to customize the trigger; use the controller actions.

## Params Editor

Use `ParamsEditor` for the normal generated editor. Use `useParamsEditorController` only when the app needs a custom renderer over the same draft/debounce/expand contract.

```tsx
import { ParamsEditor, useParamsEditorController } from "wenay-react2"

export function DefaultParams({params, save}: {params: any; save: (next: any) => void}) {
    return <ParamsEditor params={params} onChange={save} onExpand={save} />
}

export function CustomParamsHeader({params, save}: {params: any; save: (next: any) => void}) {
    const editor = useParamsEditorController({params, onChange: save})

    return (
        <button onClick={() => editor.notifyChange()}>
            Save draft
        </button>
    )
}
```

Why:

- `ParamsEditor` keeps the existing generated rows and input behavior.
- The controller owns the mutable draft clone, immediate/delayed notify, expand callback, and timer cleanup.
- Product-specific validation and save policy stay outside the shared editor.

Standard:

- Do not rewrite row/input rendering just to use the controller.
- Keep `ParamsEdit` and `ParamsArrayEdit` as compatibility wrappers unless the async load/save policy is being redesigned explicitly.
## Context Menu

Use for right-click actions.

```tsx
import { contextMenu } from "wenay-react2"

export function RowSurface() {
    return (
        <contextMenu.Layer>
            <div
                onContextMenu={event => contextMenu.openAt(event, [
                    { name: "Copy", actionKey: "row.copy", onClick: copy },
                    { name: "Delete", actionKey: "row.delete", onClick: removeSelected },
                    { name: "More", actionKey: "row.more", next: () => [
                        { name: "Open details", actionKey: "row.openDetails", onClick: openDetails },
                    ] },
                ])}
            />
        </contextMenu.Layer>
    )
}
```

Why:

- The open action is tied to a concrete event.
- The old menu is closed/replaced consistently.
- Menu items are a snapshot for the current open.

Standard:

- Prefer `contextMenu.openAt(event, items)`.
- Keep legacy queued/global context menu paths working for compatibility; instrument them before considering removal.
- Keep menu item construction close to the surface that owns the action.
- Add explicit `actionKey` for actions that should appear in `contextMenu.stats.actions`; unkeyed actions are counted only in aggregate totals.
- Do not use labels as diagnostics keys: labels can be translated or sensitive.
- Do not mutate menu item objects to track hover/open state.

## Floating Right Menu

Use `DropdownMenu` for the default floating action menu. Use `useRightMenuController` when the app needs its own DOM while keeping the same open/fixed/select/submenu state contract.

```tsx
import { DropdownMenu, useRightMenuController } from "wenay-react2"

const elements = [
    { label: "Columns", subMenuContent: () => <ColumnsPanel /> },
]

export function DefaultFloatingMenu() {
    return <DropdownMenu elements={elements} keyForSave="orders.rightMenu" />
}

export function CustomFloatingMenu() {
    const menu = useRightMenuController({ elements })

    return (
        <div onMouseEnter={menu.open} onMouseLeave={() => !menu.isFixed && menu.setOpen(false)}>
            <button onClick={menu.toggleFixed}>{menu.isFixed ? "Pinned" : "Menu"}</button>
            {menu.isOpen && elements.map((item, index) => (
                <button key={item.label} onMouseEnter={() => menu.selectItem(item, index)}>
                    {item.label}
                </button>
            ))}
            {menu.submenuRender}
        </div>
    )
}
```

Why:

- `DropdownMenu` remains the compatibility visual wrapper.
- `useRightMenuController` owns state and drag/persist contracts when a custom view is needed.
- The app decides trigger/content styling instead of changing shared default styles.

Standard:

- Do not duplicate right-menu hover/fixed/submenu timers in product code.
- Keep persisted placement in `keyForSave` / `mapRightMenu`; do not create another store for the same menu.
## Floating Settings Window

Use when a settings editor needs to stay stable while the bar itself reflows.

```tsx
import { FloatingWindow, OutsideClickArea } from "wenay-react2"

const OrdersToolbarSettings = ordersToolbar.Settings

export function ToolbarSettingsWindow({ open, close }: { open: boolean; close: () => void }) {
    if (!open) return null

    return (
        <OutsideClickArea status={open} outsideClick={close}>
            <FloatingWindow
                keyForSave="orders.toolbar.settings"
                size={{ width: 360, height: 420 }}
                header={<div>Toolbar</div>}
                onCLickClose={close}
                moveOnlyHeader
            >
                <OrdersToolbarSettings />
            </FloatingWindow>
        </OutsideClickArea>
    )
}
```

Why:

- `toolbar.Settings` is presentation-agnostic.
- `FloatingWindow` owns drag/position/close chrome.
- `OutsideClickArea` owns outside-click closing.

Standard:

- Do not bake floating-window behavior into `createToolbar`.
- Choose the settings container in the app.
- Reuse `FloatingWindow` rather than inventing another movable modal.

Controller-first variant for custom chrome:

```tsx
import type { ReactNode } from "react"
import { useFloatingWindowController } from "wenay-react2"

export function CustomFloatingPanel({ children }: { children: ReactNode }) {
    const wnd = useFloatingWindowController({
        keyForSave: "orders.custom.panel",
        size: { width: 360, height: 260 },
        limit: { x: { min: 0 }, y: { min: 0 } },
    })

    return (
        <section
            onMouseDown={wnd.onWindowMouseDown}
            style={{ position: "absolute", left: wnd.position.x, top: wnd.position.y, zIndex: wnd.zIndex }}
        >
            <header ref={wnd.headerRef} onMouseDown={wnd.onHeaderMouseDown} onTouchStart={wnd.onHeaderTouchStart}>
                Custom panel
            </header>
            {children}
        </section>
    )
}
```

Use the hook only when the default `FloatingWindow` DOM/chrome is not suitable. Keep `FloatingWindow` as the normal path for standard draggable windows.

## Observe Store Mirror

Use when React needs a local mirror of a remote Observe store.

```tsx
import { useStoreMirror, useStoreNode } from "wenay-react2"

type State = { data: Record<string, number>; meta: { status: string } }

export function PriceStatus({ remote }: { remote: any }) {
    const mirror = useStoreMirror<State, any>(remote, {
        data: {},
        meta: { status: "loading" },
    }, {
        mask: { data: true, meta: { status: true } },
        current: true,
        drain: 250,
    })

    const status = useStoreNode(mirror.store.node.meta.status)

    return <span>{mirror.ready ? status.value : "loading"}</span>
}
```

Why:

- The hook owns subscription lifecycle.
- The mask says exactly what is mirrored.
- Transport stays explicit in the remote object.

Standard:

- Do not start network sync from a simple node read.
- Subscribe to parent keys with `useStoreKeys` when add/delete matters.
- For per-key grid updates, prefer `useStoreEach` or `useStoreReplayEach`
  feeding a grid/controller outside React state.

## Lossless Replay Across a Transport Reconnect

Use when every retained event matters, such as orders, audit records, or
state-machine transitions. Obtain one RPC replay remote outside component
render and keep that same object through a temporary Socket.IO reconnect.

```tsx
import { useRef } from "react"
import { useReplaySubscribe } from "wenay-react2"

// Created once by the RPC/client setup, not during OrdersFeed render.
// It remains the same object while its transport reconnects.
const ordersRemote = rpc.orders.replay

export function OrdersFeed() {
    const applied = useRef<number[]>([])

    const replay = useReplaySubscribe(ordersRemote, event => {
        applied.current.push(event.id) // fold into a ref, store, or controller
    }, {
        since: 0,
        policy: "queue",
        onError: error => reportReplayGap(error),
    })

    return <span>{replay.ready ? `up to ${replay.seq()}` : "connecting"}</span>
}
```

Why:

- `wenay-common2@^1.0.75` restores a stable remote after a transient transport
  reconnect: live delivery, seq catch-up, queued race drain, then dedupe.
- `policy: "queue"` keeps every event available in the retained journal;
  `"frame"` is intentionally lossy and belongs to visual/latest-value feeds.
- Callback identity and ordinary parent rerenders do not recreate the
  subscription.

Standard:

- Do not call `restart()`, replace `ordersRemote`, remount with a new key, or
  listen to Socket.IO in React just because the transport reconnected.
- Treat `replay.error` as a real recovery failure: a sacred journal gap without
  a keyframe cannot be safely continued.
- `client.dispose()`/`close()` and hub token rotation are deliberate hard
  teardowns. Start a new subscription only with the intentionally new remote.

## Replay Feed Into A Grid


Use when a replay line carries store patches and the grid should update per key.

```tsx
import { AgGridTable, useAgGrid, useStoreReplayEach } from "wenay-react2"

type Row = { id: string; price: number }
type Rows = Record<string, Row>

export function ReplayRowsGrid({ remote }: { remote: any }) {
    const grid = useAgGrid<Row>({ getId: row => row.id })

    const feed = useStoreReplayEach<Rows>(remote, (key, row) => {
        if (row == null) {
            grid.remove([{ id: key } as Row])
        } else {
            grid.update({ newData: [{ ...row, id: key }] })
        }
    }, {
        initial: {},
        staleMs: 2500,
        policy: "frame",
    })

    return (
        <>
            <span>{feed.ready ? "live" : "connecting"}</span>
            <AgGridTable<Row> controller={grid} columnDefs={[
                { field: "id" },
                { field: "price" },
            ]} />
        </>
    )
}
```

Why:

- Keyframe and root replace expand into per-key calls.
- Deletes arrive as `undefined`.
- The grid updates without rerendering a React row array on every event.

Standard:

- Keep the fold target outside React state: grid controller, ref, Map, canvas,
  or external store.
- Use `staleMs` when freshness is user-visible.
- Use route hand-off hooks when switching relay/direct without gaps.

## Logs

Use for shared app-visible log output.

```tsx
import { logsApi } from "wenay-react2"

logsApi.addLogs({
    id: "orders",
    time: new Date(),
    txt: "order saved",
    var: 1,
})

const PageLogs = logsApi.React.PageLogs

export function LogsPanel() {
    return <PageLogs />
}
```

For headless custom log stores, use `createLogsController`; `getLogsApi` remains the compatibility entrypoint for the shared global logger:

```ts
import { createLogsController } from "wenay-react2"

const logs = createLogsController({options: {limit: 50, limitPer: 500}})
logs.addLogs({id: "orders", time: new Date(), txt: "queued", var: 1})
logs.getLatest()
```

For corner notifications, the compatibility wrapper is still the shortest path. Use the hook/controller layer when the app needs to place or restyle the notification chrome itself:

```tsx
import { MessageEventLogsView, useMessageEventLogsController } from "wenay-react2"

export function CornerLogs() {
    const notifications = useMessageEventLogsController({maxVisible: 4})
    return <MessageEventLogsView controller={notifications} zIndex={80} />
}
```

For compact embedded log tables, use the MiniLogs hook/controller first when the parent needs grid control:

```tsx
import { AgGridTable, MiniLogsTable, useMiniLogsTable } from "wenay-react2"

type LogRow = { time: Date; id: string; var: number; txt: string; address?: string }

export function CompactLogs({rows}: {rows: LogRow[]}) {
    const table = useMiniLogsTable<LogRow>({
        data: rows,
        onClick: e => console.log(e.data),
    })

    return <AgGridTable<LogRow> {...table.props} />
}

export function SimpleCompactLogs({rows}: {rows: LogRow[]}) {
    return <MiniLogsTable<LogRow> data={rows} />
}
```

Why:

- The shared logger already has notification/table chrome.
- `createLogsController` keeps append/limit/settings state testable without rewriting logger UI.
- `useMessageEventLogsController` owns notification queue/timers/settings; `MessageEventLogsView` is the visual layer and `MessageEventLogs` remains the wrapper.
- `useMiniLogsTable` keeps the compact table defaults, click contract, and grid control API in one reusable layer.
- `MiniLogsTable` is the visual layer; `MiniLogs` remains the old compatibility wrapper.
- Styling is tokenized through `--logs-*`.

Standard:

- Use a stable `id` per source area.
- Keep high-volume debug-only logs out of user-facing logger surfaces unless
  the app intentionally exposes them.

## QA Stand Standards

The QA stand and in-repository example files are maintained usage examples, not disposable tests. When a public standard changes, update the affected card/example in the same pass, or record why no example change is needed.

Use the QA stand to validate behavior, but read it critically.

Current strong examples:

- `qa.tsx` card 20 for `SettingsDialog` search/tree registry behavior.
- `qa.tsx` card 21 for `createUiSlot` persisted placement behavior.
- `qa.tsx` card 25 for local `createToolbar` config/settings behavior.
- `qa.tsx` cards 28-32 for `columnState`, `createColumnGrid`, `ColumnsMenu`, `ColumnDots`,
  `CardList`, and `createToolbar({source})`.
- `qa.tsx` cards 23-26 for Replay hooks.
- `src/common/src/grid/agGrid4/example.tsx` for `useAgGrid` / `AgGridTable` controller examples.
- `qa.tsx` active cards for current work.

Legacy or low-level examples:

- `src/common/testUseReact/useGrid.tsx` and archive card 5 use direct
  `applyGridRows`. Keep this as regression coverage for the low-level helper,
  but do not copy it as the first pattern for new grids.
- Archive cards may preserve old bug repros or compatibility paths. Their
  presence does not automatically make the shown API canonical.

When adding an example:

- Explain what problem it solves.
- Name the owner of lifecycle/state.
- Mention what the app still owns.
- Prefer root imports.
- Avoid business-specific names in shared docs.
- If the example is intentionally low-level, label it as low-level.

## Anti-Patterns To Avoid

| Anti-pattern | Prefer | Reason |
| --- | --- | --- |
| Reusable behavior owned by a visual component | Headless `use*` hook or `create*` controller plus a thin component | Apps and stand cards can reuse lifecycle/state without copying JSX. |
| Direct `applyGridRows` in new React UI | `useAgGrid` / `createGridBuffer` | Controller owns readiness, sync, detach, and remount behavior. |
| Manual toolbar-grid order bridge | `createToolbar({source: columnState.api.listSource})` | One config should drive all views. |
| Writing storage inside a primitive | `memoryCache.onDirty` in app startup | App owns persistence timing. |
| One-off search history state in a component | `createSearchHistory({key})` | Search recall is reusable and publishes through memoryCache. |
| Product group logic inside `createColumnBuffer` | App wrapper around `createColumnBuffer` | Shared layer must stay domain-free. |
| Context menu global queue for new code | `contextMenu.openAt(e, items)` | Opens a concrete snapshot at a concrete point. |
| `useState` for every replay frame | Ref/store/grid/canvas fold target | Avoid rerendering high-frequency streams. |
| New examples with `Get*`, `FuncJSX`, `*2`, `*3` names | `create*`, `use*`, controller names | Keep canonical naming stable. |

## Documentation Rule

When a new public usage pattern is introduced:

- Put the short signature in `doc/wenay-react2.md`.
- Put the detailed edge cases in `doc/wenay-react2-rare.md`.
- Put purpose and standards in this file.
- Put broad project role changes in `doc/PROJECT_FUNCTIONALITY.md`.
- Link new durable docs from `README.md`.
- Add a changelog note in `doc/changes/`.
