# agGrid4 — headless core + opinionated component

Buffered ag-grid binding: a pure buffer core (anti-race "memory point"), a headless React
hook, and `<AgGridMy>` — an opinionated grid component with project defaults baked in.

## Why this shape (lessons from agGrid2 / agGrid3)

- **agGrid2** (hook returns a bound `Grid` component, primitive injection) — the convenience
  is real, but generics don't flow through the factory (casts everywhere), and in practice
  real pages outgrow a pre-bound component: they need full prop control and a shared grid api.
- **agGrid3** (headless hook + `gridProps` spread) — idiomatic, zero casts. Kept as the base.
- **agGrid4** = agGrid3 + the agGrid2 convenience returned safely: instead of producing a
  component from the hook, the component takes the hook's result as a `controller` prop.
  Types stay intact, wiring is one prop.

## Layers

| File | deps | What |
|------|------|------|
| `core.ts` | none | `createGridBuffer` closure factory: buffer, add/update/remove delivery, `sync`, `attach`/`detach` lifecycle |
| `agGrid4.tsx` | ag-grid | `useAgGrid` (headless hook over the core) + `AgGridMy` (memoized component with defaults) |
| `theme.ts` | ag-grid | `buildAgTheme` (pure) + `useAgGridTheme` |

## Optimizations vs agGrid2/3

- **Single update path.** The hook no longer duplicates the buffer-vs-grid branch — the core's
  `updateData` always updates the buffer and delivers to the grid only when attached.
- **In-place row merge.** `Object.assign(buf[id] ?? {}, row)` instead of spreading a fresh
  object per update — no per-tick garbage under a streaming feed. Safe: ag-grid resolves the
  row by `getRowId`, so passing the mutated buffer object to `update` is fine.
- **`inGrid: Set` instead of `api.getRowNode` per row.** Add-vs-update is decided by set
  membership; the core's grid contract shrinks accordingly.
- **Lifecycle is owned.** `attach` (onGridReady) syncs the grid to the buffer; `detach`
  (onGridPreDestroyed) clears the api ref — no manual `ref.current = null` at call sites.
- **Update batching** is delegated to the grid itself (`applyTransactionAsync` +
  `asyncTransactionWaitMillis`, set by `AgGridMy`).

## Usage

```tsx
// controller + component (main pattern)
const grid = useAgGrid<Row>({ getId })
<AgGridMy<Row> controller={grid} columnDefs={cols} />
grid.update({ newData })

// declarative (no controller)
<AgGridMy<Row> data={rows} columnDefs={cols} />

// headless (no AgGridMy) — agGrid3 mode still works
<AgGridReact<Row> {...grid.props} columnDefs={cols} />

// outside React (worker, tests): the core alone
const core = createGridBuffer<Row>({ getId })
core.api.updateData({ newData })
core.control.attach(gridApi)
```

`AgGridMy` defaults (all overridable via props): dark alpine theme, `memo`, auto column
sizing via `ResizeObserver`, `multiRow` selection, `suppressCellFocus`,
`asyncTransactionWaitMillis: 50`, `sortable/resizable/filter` in `defaultColDef`,
`getRowId` wired to the controller.

Anti-race guarantee (unchanged from agGrid2/3): data may arrive before the grid exists —
it lands in the buffer; `attach` → `sync` brings the grid up to date. An external buffer
(plain object above the component) survives route remounts.

## Type checking

The module is part of the library graph (exported through `src/common/api.tsx`):

```sh
npx tsc --noEmit -p tsconfig.json
```

## Module registration

ag-grid v35 requires module registration. `useAgGrid`/`AgGridMy` register
`AllCommunityModule` lazily on the first hook call (idempotently, while package imports
stay side-effect-free). A separate `GridStyleDefault()` call is no longer required.
