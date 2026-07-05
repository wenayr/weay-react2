# agGrid4 Wrapper Boundary

This note defines the boundary between the generic `wenay-react2/agGrid4` primitives and app-level wrappers in products.

## Rule

`agGrid4` must not contain business names or layout assumptions.

The shared library may provide lifecycle primitives and small helpers, but it must not know:

- any product-specific dynamic group name;
- which `groupId` or `headerName` receives dynamic columns;
- how a column is built for a product domain object;
- how column visibility/order/state is persisted;
- whether dynamic names come from services, exchanges, accounts, portfolios, or any other domain object.

If a utility needs any of that knowledge, it belongs in an app-level wrapper, not in `wenay-react2`.

## Shared Layer Responsibilities

### `createGridBuffer`

Generic row lifecycle and transaction buffer:

- keeps row memory by stable `getId`;
- supports `mirror` and `overlay` modes;
- merges updates and dedupes rows inside one batch;
- exposes `updateData`, `removeData`, `clean`, `sync`;
- attaches/detaches one grid api at a time;
- does not know what a row means in business terms.

### `useAgGrid`

React binding for a row core:

- accepts either construction options or an external `core`;
- exposes imperative controller methods: `update`, `updateData`, `remove`, `clean`, `sync`, `fit`, `flush`;
- owns `apiRef` and grid lifecycle binding;
- does not decide app-specific data ownership beyond `mirror`/`overlay` semantics.

### `AgGridMy`

Thin component wrapper over `AgGridReact`:

- wires a controller when provided;
- creates an overlay-safe internal controller when no controller is provided;
- must not let an empty internal mirror buffer delete declarative `rowData` rows;
- provides controller `getRowId` only when a controller/data-buffer path is active;
- for plain declarative `rowData`, forwards user-provided `getRowId` as-is and preserves AgGridReact default behavior when it is absent;
- forwards normal grid props.

### `createColumnBuffer`

Generic dynamic-name lifecycle buffer:

```ts
const columns = createColumnBuffer<Row>()

columns.api.setNames(['a', 'b'])
columns.control.attach(api, {
    apply: ({ api, names }) => {
        api.setGridOption('columnDefs', buildColumnDefs(names))
    },
})
columns.control.detach()
```

`setNames(names)` replaces the whole dynamic-name set. It dedupes names while preserving order.

`api.apply()` replays the current names through the last attached `apply` callback. Use it when app-level base `columnDefs`, column builders, visibility policy, or other wrapper state changed without names changing.

It only stores the exact `names` set and replays it on `attach` through caller-provided `apply`.

It must not know groups, columnDefs shape, domain names, or any target location.

## App-Level Wrapper Responsibilities

A page/project wrapper owns all domain and layout policy. Example names:

- `createDomainColumnStore`
- `createDynamicGroupColumns`
- `mainColumns`
- `adminDynamicColumns`

That wrapper should decide:

- where dynamic columns are inserted;
- how to find the target group (`groupId`, recursive search, or a custom matcher);
- how to build each dynamic column;
- how to set stable `colId` values;
- how to preserve or restore visibility/order/width/sort/filter state;
- when to call `setNames()` during add/remove dynamic-name flows;
- whether to call `api.apply()` after external state changes such as base columnDefs, buildCol, or visibility policy changes.

## Example App Wrapper

```ts
import type { ColDef, ColGroupDef, GridApi } from 'ag-grid-community'
import { createColumnBuffer } from 'wenay-react2'

type AnyCol<T> = ColDef<T> | ColGroupDef<T>

type DynamicColumnsDeps<T> = {
    base: AnyCol<T>[]
    targetGroupId: string
    buildCol: (name: string) => ColDef<T>
}

function replaceGroupChildren<T>(cols: AnyCol<T>[], groupId: string, children: ColDef<T>[]): AnyCol<T>[] {
    return cols.map(col => {
        if (!('children' in col)) return col
        if (col.groupId == groupId) return { ...col, children }
        return { ...col, children: replaceGroupChildren(col.children as AnyCol<T>[], groupId, children) }
    })
}

export function createDynamicColumnStore<T>(deps: DynamicColumnsDeps<T>) {
    const buffer = createColumnBuffer<T>()

    function build(names: readonly string[]) {
        return replaceGroupChildren(deps.base, deps.targetGroupId, names.map(deps.buildCol))
    }

    function attach(api: GridApi<T>) {
        buffer.control.attach(api, {
            apply: ({ api, names }) => api.setGridOption('columnDefs', build(names)),
        })
    }

    return {
        control: {
            attach,
            detach: buffer.control.detach,
        },
        api: {
            setNames: buffer.api.setNames,
            apply: buffer.api.apply,
            get names() {
                return buffer.api.names
            },
        },
    }
}
```

A product-specific store can then wrap this with product-specific `base`, `targetGroupId`, and `buildCol`.

## Stable IDs

For row transactions, stable `getId` is required because add/update/remove are matched by id.

For plain declarative `rowData` without a controller, `AgGridMy` does not force row ids. User-provided `getRowId` is forwarded as-is; if absent, AgGridReact default behavior is preserved. Use `getRowId` when the grid needs stable identity for selection, row state, transactions, or streaming overlays.

For dynamic columns, wrappers should build stable `colId` values. A good pattern is:

```ts
colId: `dynamic:${name}`
```

Use a domain-specific prefix only in the app wrapper. The shared `createColumnBuffer` should not pick this prefix.


## Clean And Flush

`clean()` belongs to the row controller/core:

- in `mirror` mode it clears the buffer and removes current grid rows;
- in `overlay` mode it clears only the buffer because rows are owned by external `rowData`.

`flush()` belongs to the React controller and calls ag-grid `flushAsyncTransactions()`. Use it before reading grid state that must include already queued async updates.

