# Migration Plan for the clientBacktest Frontend to agGrid4

The library canon is `exampleAGrid/agGrid4` (see README.md). This is the project plan: what to migrate, in what order, and with what risk. The inventory was collected by auditing all of `src/front` (2026-06-12).

## Inventory: 20+ Grids in 13 Files

| # | Location | Grids | Current data path | getRowId | Buffer |
|---|----------|-------|-------------------|----------|--------|
| 1 | `pages/clientPage/main.tsx:866` | 1 (main table) | applyTransactionAsyncUpdate2 x6, streams | yes | `datum.tableArr` (module) |
| 2 | `components/selectSymbols/selectSymbol.tsx:870` | 1 (+1 small :1134) | **local v1** x24, streams | yes / no | `bufTable` (module) |
| 3 | `pages/clientPage/mini/services.tsx:68` | 1 | **v1 from wenay-react2** x2, events | yes | `object` (useRef) |
| 4 | `pages/clientPage/exchange/binance.tsx:860` | 1 (History Transfer modal) | v2 x2 | yes | `bufferTableHistory` (module) |
| 5 | `pages/clientPage/exchange/gateio.tsx:577` | 1 (loans modal) | declarative rowData | yes | - |
| 6 | `pages/clientPage/portfolioTable.tsx:233` | 1 | rowData + setRows | yes | - |
| 7 | `pages/clientPage/elements.tsx:15` | 1 (TableSymbols) | rowData prop | **no** | - |
| 8 | `components/selectHistory.tsx:298,400,599` | 3 | rowData + setRows | yes | Map (module) |
| 9 | `components/graph.tsx:391,453,495` | 3 | rowData + setGridOption | yes/no | WeakMap |
| 10 | `components/SelectStrategy.tsx:104` | 1 | rowData + setRows | **no** | - |
| 11 | `components/selectSymbols/selectTable.tsx:23` | 1 | setGridOption("rowData") | **no** | - |
| 12 | `components/selectSymbols/utilsReact.tsx:93` | 1 | rowData rebuild | **no** | - |
| 13 | `pages/pageTest2.tsx:82`, `pageTest3.tsx:15` | 2 | static | no | - |

The `components/customAgGrid3.tsx` wrapper is the current production helper; after migration it should be removed.

## Found Defects (Audit, Line-Checked)

1. **selectSymbol.tsx:31-49: local v1 loses data.** The whole body sits under `if (grid?.api.getRowNode)`: when the grid is not ready, the update is silently dropped and is not even written to the buffer. `applyTransaction({add})` is commented out (:43-46), so new rows never arrive through a transaction. There are 24 call sites (:357-575).
2. **binance.tsx History Transfer: buffer key mismatch.** Fill path: `getId: e=>e.timestamp` (:855), sync path: `getId: e=>String(e.id)` (:868), `getRowId: e.data.id` (:874). The buffer is keyed by timestamp, but sync looks by id, so sync compares the wrong keys. Also `id: (a++).toString()` (:854) is not deterministic across loads.
3. **Grids without getRowId** (index identity, transactions impossible or unsafe): elements.tsx TableSymbols, SelectStrategy, selectTable, utilsReact, selectSymbol:1134, graph buffer grids.
4. **main.tsx `useAgGrid()` (:254) is unused**: `Grid`/`updateData` are dead; the page renders a bare AgGridReact. Remove this together with the customAgGrid3 import.
5. **main.tsx `TableA = useMemo(..., [true])` (:864)**: the closure is frozen forever. `colDefsMain` is recomputed on every render (:858), but never reaches the grid; columns are added imperatively through `setGridOption("columnDefs")` (:690). During migration: either stabilize columnDefs with useMemo and real deps, or keep the imperative path, but do not pass a new array to a memo component on each render.
6. **elements.tsx EmptyColumn/ShowQuote** call `grid.current.api` with no null guard; they are called from both onGridReady and buttons.
7. **selectTable.tsx:16-22** has two identical updateBy watchers (duplicate).
8. **Unowned destroy**: except for main.tsx, no grid clears its ref on onGridPreDestroyed.
9. **Dead code**: main.tsx :401-412 (loadSymbols), :488-546, :768-788, :823-852 (old v1 blocks); selectSymbol :839-867; graph getTableMaiBuffer is commented out in UI.
10. **Theme**: production grids do NOT pass theme (v35 gives default Quartz / legacy CSS through GridStyleDefault from wenay-react2, imported in src/index.ts). AgGridMy sets Alpine dark, so **the appearance will change**. Decide in the pilot: either accept Alpine or pass through the current theme.

## Stages

Order: inject -> verify -> improve -> tighten; restructuring and removal happen at the end. Complexity: L/M/H. Risk: L/M/H.

### Stage 0. Connect the Library [Complexity L, Risk L]
- Move `exampleAGrid/agGrid4/` -> `src/front/components/agGrid4/` (`exampleAGrid` is outside tsconfig include).
- Smoke test on the sandbox `pageTest3.tsx` (throwaway static grid): `<AgGridMy data=...>`; check theme, resize, and selection live.
- Decide the theme question here (defect 10): compare AgGridMy against the current production grid.

### Stage 1. Pilot: selectSymbol.tsx [Complexity M, Risk M]
The most race-heavy grid, and it fixes real data loss (defect 1).
- `useAgGrid({ getId: getRowIdSymbols, externalBuffer: bufTable })`; 24 local v1 calls -> `grid.update({newData})`. Mechanical replacement (signatures are close).
- **Behavioral risk**: v1 did not add rows. With agGrid4, new rows will start appearing. If the current "updates only for already loaded rows" semantics is intentional, do the first pass with `option: {add: false}` and enable add as a separate deliberate step.
- Grid :870 -> `<AgGridMy controller>`; keep rowData-useState (:238) as initial state, then remove it in favor of the buffer in a second iteration.
- Remove the local v1 function (it is exported, so check external imports; main.tsx imports it only in comments).

### Stage 2. Main Table: main.tsx [Complexity H, Risk H]
Largest impact and the most consumers.
- `useAgGrid<tRow>({ getId: getIdMainTable, externalBuffer: datum.tableArr })`.
- `updateTable`/`updateTableByBaseAsset` -> `grid.update({newData, option:{sync}})` (6 call sites).
- Bare AgGridReact -> `<AgGridMy controller>`: keep existing onGridReady side effects (filter model, tableReady, EmptyColumn, renderBy), chaining them after the wiring; remove manual sync and manual ref clearing (lifecycle is in the wrapper).
- **Most labor-intensive part: ref consumers**: `stParams` (:1031), EmptyColumn, ShowQuote/ShowColumn/ShowEmptyRows/ShowEmptyColumn (elements.tsx), getMenuR, PageShow are moved from `RefObject<GridReadyEvent>` to `grid.apiRef` (`RefObject<GridApi>`); inside, `*.current.api.X` -> `*.current.X`. Also add null guards (defect 6).
- columnDefs: stabilize (defect 5). Either useMemo with real deps + declarative columns, or explicitly keep the imperative addColumn path and the frozen array (document the choice).
- Remove dead code: `useAgGrid()` (:254) + import, v1 comments, loadSymbols.
- `rowData={getRowData()}` -> do not pass it (the buffer flows through attach->sync).
- Check: initial quoteAsset filter, checkbox selection, empty rows/columns, selected-row menus, streams from all 4 exchanges, route leave/return (module buffer should catch up).

### Stage 3. services.tsx [Complexity L, Risk L]
- Last consumer of v1 from wenay-react2 -> `useAgGrid({ getId, externalBuffer: object.current })`; 2 calls -> `update`. Grid -> AgGridMy. This removes the v1 dependency entirely.

### Stage 4. Exchange Modal Grids [Complexity L, Risk L]
- binance.tsx History Transfer: -> controller + AgGridMy; fix keys (defect 2): a single `getId: e=>String(e.tranId)` (stable natural key) instead of timestamp/`a++`.
- gateio.tsx loans: declarative `<AgGridMy data={getRowData()}>` or just the AgGridMy wrapper; clear refs through the controller (currently not cleared).

### Stage 5. Static/Declarative Grids [Complexity L, Risk L, Volume ~10 Grids]
selectTable, utilsReact, SelectStrategy, selectHistory x3, portfolioTable, elements TableSymbols, graph x3, pageTest2.
- Everywhere: `<AgGridMy data={rows} columnDefs=...>` (or controller where imperative access exists); add getRowId where missing (defect 3); remove custom ResizeObserver/sizeColumnsToFit.
- Small fixes along the way: duplicate selectTable watchers (defect 7), remount patterns (`getTable` arrows/useCallback with empty deps), graph selection sync moved into an effect.
- Can be split by file; the steps are independent.

### Stage 6. Removal and Cleanup [Complexity L, Risk L, Only After Stages 1-5]
- Remove `customAgGrid3.tsx` (the last consumer is the dead destructuring in main.tsx from stage 2).
- Remove local v1 in selectSymbol (stage 1), and imports of `applyTransactionAsyncUpdate*` from wenay-react2.
- Remove dead commented blocks (defect 9).
- Decide the fate of agGrid2/agGrid3 in exampleAGrid (keep as history or remove).

## Risk Summary

| Risk | Where | Mitigation |
|------|-------|------------|
| Appearance change (Alpine dark vs current theme) | all grids | Stage 0: sandbox comparison; AgGridMy accepts `theme` |
| Enabling add changes the visible row set | selectSymbol | `option:{add:false}` on the first pass |
| grid-ref consumers (GridReadyEvent -> GridApi) | main.tsx + elements/getMenuR/menuPages | mechanical `.api.X` -> `.X`, but many sites, so use a separate commit |
| Memo + unstable columnDefs = column reset | main.tsx | stabilize with useMemo before replacing the wrapper |
| Filter/selection behavior on route remount | main.tsx | manual leave/return scenario check |
| v1 "silently drop" semantics might be expected by someone | selectSymbol, services | pilot + observe, log buffer mismatches |

## Commit Order
Each stage is a separate commit (stage 2 becomes two: "ref consumers" and "the grid itself"). After each stage: `npx tsc` for the project + manual smoke test of the affected page.