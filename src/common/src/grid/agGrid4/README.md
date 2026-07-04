# agGrid4 - buffered ag-grid layer

`agGrid4` is the shared table layer for wenay apps: a pure row buffer core, a headless React controller, an opinionated `AgGridMy` wrapper, dynamic column buffering, and common column defaults.
[WRAPPER.md](./WRAPPER.md) documents the hard boundary between generic primitives and app-level wrappers.

## Layers

| File | What |
|------|------|
| `core.ts` | `createGridBuffer`: row buffer, add/update/remove delivery, attach/detach/sync lifecycle |
| `agGrid4.tsx` | `useAgGrid` controller + `AgGridMy` component defaults |
| `columnBuffer.ts` | `createColumnBuffer`: persisted exact set of dynamic names + grid lifecycle replay |
| `gridUtils.ts` | `colDefCentered`, `colDefWrap`, `numericComparator` |
| `theme.ts` | cached ag-grid theme builder/hook |

## Row Buffer

```ts
const table = createGridBuffer<Row>({ getId: row => row.id })
table.api.updateData({ newData: rows })
table.api.updateData({ removeData: [{ id: 'a' }] })
table.control.attach(api)
table.control.detach()
```

Modes:

- `mirror` (default): the buffer is the source of truth. `sync()` adds missing rows, updates existing rows and removes rows that are no longer in the buffer.
- `overlay`: external `rowData` owns the row set. `sync()` only updates rows that already exist in the grid and never adds/removes rows.

`pushDefaults` changes delivery defaults for `updateData`:

```ts
const table = createGridBuffer<Row>({
    getId: row => row.id,
    mode: 'overlay',
    pushDefaults: { add: false },
})
```

Use `pushDefaults: { add: false }` for streams over declarative `rowData` when updates must not create new rows by themselves.

Updates are merged into the buffer by stable `getId`. Rows inside one `updateData` batch are deduped by id before they are sent to ag-grid, so one id cannot be added twice in the same transaction. `removeData` also resolves rows through the same stable id. `clean()` clears the buffer; in mirror mode it also removes current grid rows, while overlay mode leaves externally owned `rowData` rows alone.

## React Controller

```tsx
const grid = useAgGrid<Row>({ getId })

<AgGridMy<Row> controller={grid} columnDefs={cols} />

grid.update({ newData })
grid.remove([{ id }])
grid.fit()
```

A module-level store can be shared with React:

```ts
export const mainTable = createGridBuffer<Row>({ getId, externalBuffer })
```

```tsx
const grid = useAgGrid({ core: mainTable })
<AgGridMy<Row> controller={grid} columnDefs={cols} />
```

The controller keeps the existing aliases: `update`, `updateData`, `remove`, `clean`, `sync`, `fit`, `flush`, `sizeColumnsToFit`, `flushAsyncTransactions`, `apiRef`, `props`, `gridProps`, `getApi`, and `withApi`.

## AgGridMy

`AgGridMy` keeps the current component API and forwards normal `AgGridReact` props. With `controller`, it uses that external controller. Without `controller`, it creates an internal overlay-safe controller so a plain `rowData` grid is not cleared during `attach -> sync`.

For declarative `rowData`, prefer either:

```tsx
<AgGridMy<Row> rowData={rows} columnDefs={cols} />
```

Plain `rowData` without a controller does not require or force `getRowId`: user-provided `getRowId` is forwarded as-is, and when absent AgGridReact default behavior is preserved. A stable key is required only when using buffered transaction updates (`controller`, `data`, or `createGridBuffer`).

or, when stream patches must overlay React-owned rows:

```tsx
const core = useState(() => createGridBuffer<Row>({ getId, mode: 'overlay', pushDefaults: { add: false } }))[0]
const grid = useAgGrid({ core })

useEffect(() => core.api.sync(), [rows])

<AgGridMy<Row> controller={grid} rowData={rows} columnDefs={cols} getRowId={p => getId(p.data)} />
```

The legacy `data` prop is still an upsert convenience through the buffer:

```tsx
<AgGridMy<Row> data={rows} columnDefs={cols} />
```

## Dynamic Columns

```ts
const columns = createColumnBuffer<Row>()

function buildColumnDefs(names: readonly string[]) {
    return base.map(col =>
        'children' in col && col.groupId == 'dynamic-metrics'
            ? { ...col, children: names.map(name => ({ colId: `dynamic:${name}`, field: name, headerName: name })) }
            : col,
    )
}

columns.api.setNames(['s1', 's2'])
columns.control.attach(api, {
    apply: ({ api, names }) => api.setGridOption('columnDefs', buildColumnDefs(names)),
})
columns.control.detach()
```

`setNames()` means exactly that dynamic name set and dedupes while preserving order. `attach()` applies the saved names to the current grid through the caller-provided `apply`. `api.apply()` replays the current names through the last attached callback when wrapper policy changes without names changing. `detach()` drops the grid reference but keeps names so route remounts keep the dynamic state.

The base utility deliberately knows nothing about groups, `columnDefs` shape, business names, or where dynamic columns live. Put that policy in a page/project wrapper above it.

## Type Checking

```sh
npm run build
```