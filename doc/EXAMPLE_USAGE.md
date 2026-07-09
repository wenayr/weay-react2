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
import { SettingsDialog, registerSettingsSection } from "wenay-react2"
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
```

Why:

- Sections can be registered by feature modules.
- Search and tree behavior stays consistent across apps.

Standard:

- Use stable `key` values.
- Put searchable synonyms in `keywords` or `searchText`.
- Do not put settings registry state in product globals when the shared
  registry already fits.

## Context Menu

Use for right-click actions.

```tsx
import { contextMenu } from "wenay-react2"

export function RowSurface() {
    return (
        <contextMenu.Layer>
            <div
                onContextMenu={event => contextMenu.openAt(event, [
                    { name: "Copy", onClick: copy },
                    { name: "Delete", onClick: removeSelected },
                    { name: "More", next: () => [
                        { name: "Open details", onClick: openDetails },
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
- Do not mutate menu item objects to track hover/open state.

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

Why:

- The shared logger already has notification/table chrome.
- Styling is tokenized through `--logs-*`.

Standard:

- Use a stable `id` per source area.
- Keep high-volume debug-only logs out of user-facing logger surfaces unless
  the app intentionally exposes them.

## QA Stand Standards

Use the QA stand to validate behavior, but read it critically.

Current strong examples:

- `qa.tsx` cards 28-31 for `columnState`, `ColumnsMenu`, `ColumnDots`,
  `CardList`, and `createToolbar({source})`.
- `qa.tsx` cards 23-26 for Replay hooks.
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
