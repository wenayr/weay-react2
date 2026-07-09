# wenay-react2 Project Functionality

This document describes what this project provides and why each area exists.
It is not a README and not a full API reference.

Read this together with:

- `doc/wenay-react2.md` for everyday signatures.
- `doc/wenay-react2-rare.md` for low-level details and edge cases.
- `doc/EXAMPLE_USAGE.md` for usage standards and examples.
- `src/common/testUseReact/qa.tsx` for the live QA stand.

## Project Role

`wenay-react2` is a shared React UI/controller package for wenay apps.
Its main job is to package recurring UI infrastructure so products do not keep
rebuilding table buffers, floating windows, context menus, settings editors,
toolbar persistence, React subscriptions, and replay/store adapters.

The package should stay generic. It may know lifecycle, rendering,
persistence mechanics, and UI contracts. It must not know product business
terms such as exchange names, portfolio rules, strategy policy, domain column
groups, account behavior, or screen-specific layout decisions.

## Core Design Contract

New shared functionality should follow these rules:

- A primitive owns one generic problem.
- App policy belongs in an app wrapper above the primitive.
- Shared behavior starts as a headless hook/controller whenever it has lifecycle, state, persistence, subscription, selection, or user interaction rules.
- React hooks own subscription/lifecycle wiring and may return a small API, not only plain X/Y data.
- Controllers expose a small imperative API when state must outlive a render.
- Serializable UI config is stored through `memoryGetOrCreate` and announced
  through `memoryCache`, but the app decides when to write storage.
- Visual components and QA stand layers should be thin renderers over the hook/controller surface.
- Demos should prove the primitive's contract, not hide product policy inside
  the library.

Canonical controller vocabulary:

```ts
open / close / set / replace       // modal-like state
update / remove / clean / sync     // buffered data state
fit / flush                        // ag-grid lifecycle
props / bind                       // spreadable DOM props
get / set / reset / cancel         // local controller state
on -> off                          // subscriptions
```

## Public Entry

Consumers import from the package root:

```ts
import { createToolbar, useAgGrid, createColumnState } from "wenay-react2"
```

`src/common/api.tsx` is the root export aggregator. It also exports `kit` for
large files that prefer grouped namespaces:

```ts
import { kit } from "wenay-react2"

kit.grid
kit.modal
kit.menu
kit.logs
kit.updateBy
```

## Compatibility Policy

New hook/controller surfaces should prefer migration without breaking old public APIs, but compatibility is not absolute. An aggressive migration is allowed only as an explicit migration cut: separate task, changelog, migration notes, and a clear list of changed imports/behavior. Default visual styles have a stricter rule: do not remove a default class/style contract unless the replacement class/token path already exists and is documented.

For diagnostics, the library may expose local counters/listeners, but it must not send hidden analytics. Apps decide whether to read, persist, or report those counters.

## Functional Areas

### Render Memory

Purpose: bridge external mutable objects into React renders.

Main APIs:

- `updateBy`, `useUpdateBy`, `renderBy`, `renderByRevers`, `renderByLast`
- `createUpdateApi`, `useUpdateByApi`
- `memoryGetOrCreate`, `memoryUpdate`, `memoryMarkDirty`, `memoryCache`

Use this when a module-level controller or persisted config needs React views
to refresh without moving all state into component-local `useState`.

Do not use this as a default replacement for normal React state. If a state is
local to one component and has no external lifecycle, `useState` is simpler.

### Persistence And Memory Cache

Purpose: centralize process/browser memory maps used by shared UI surfaces.

Shared primitives can mark config as dirty. They do not choose a write policy.
The application should call `memoryCache.load()` on startup and decide whether
to save on debounce, route leave, visibility change, pagehide, or explicit user
action.

This matters because toolbar layout, UI slot placement, column state, floating
window geometry, and resize maps are all user-facing preferences. The library
should not silently write storage at surprising times.

### Outside Click, Buttons, And Floating UI

Purpose: reusable interaction wrappers for menus, popups, and floating panels.

Main APIs:

- `useOutside`, `OutsideClickArea`
- `Button`, `OutsideButton`, `HoverButton`, `AbsoluteButton`
- `FloatingWindow`
- `useDraggableApi`, `useReorder`, `useReorderBoard`

Use these when the UI problem is generic: outside-click closing, draggable
position, ordered drag-and-drop, or a persistent floating window.

Do not hide business flow inside these components. For example, a trade ticket
window is an app component that may use `FloatingWindow`, not a library
primitive.

### Modal And Input Helpers

Purpose: common modal lifecycle and simple text/file input flows.

Main APIs:

- `ModalProvider`, `useModal`
- `FreeModal`, `TextInputModal`, `FileInputModal`
- `inputModal`, `confirmModal` for low-level compatibility paths

Use `ModalProvider` + `useModal` for new code. Low-level JSX stores exist for
compatibility and rare cases.

### Settings Dialog, UI Slot, And Toolbar

Purpose: configurable product chrome without each app inventing its own
settings registry, placement switcher, and toolbar editor.

Main APIs:

- `SettingsDialog`, `registerSettingsSection`
- `createUiSlot`
- `createToolbar`, `registerToolbarDensity`, `toolbarItemIcon`

Use `SettingsDialog` when the app has multiple settings sections or needs a
searchable settings tree.

Use `createUiSlot` when the same UI fragment may live in several places and
the user can choose the placement.

Use `createToolbar` when a command strip needs:

- persistent item order and visibility;
- density modes such as icon-only or icon+label;
- a reusable settings editor;
- optional source-owned order/visibility via `UiListSource`.

`createToolbar({source})` is important: it lets the toolbar become a view over
another config. The main example is `columnState.api.listSource`, where grid,
column menu, and toolbar should all mirror one column order/visibility source.

### Menus

Purpose: generic menu rendering and context-menu coordination.

Main APIs:

- `Menu`
- `contextMenu.Layer`
- `contextMenu.openAt(event, items)`
- `DropdownMenu`

Use `contextMenu.openAt(e, items)` for new right-click integrations. It opens
one current menu from a concrete event/point. Older queued/global paths remain
for compatibility through `1.x` but should not be taught in new examples.

`DropdownMenu` is a floating action menu with caller-owned trigger/content
styling. It is not the main right-click primitive.

Menu diagnostics should start from the right-click surface: count `openAt` vs legacy queued opens, sources/layers, close reasons, item clicks by explicit stable keys, submenu opens, and async menu errors. These counters should be local/opt-in, not hidden analytics.

### agGrid4

Purpose: shared ag-grid lifecycle, row buffering, dynamic columns, and common
grid defaults.

Main APIs:

- `createGridBuffer`
- `useAgGrid`
- `AgGridTable`
- `createColumnBuffer`
- `useAgGridTheme`, `buildAgTheme`
- `numericComparator`, `colDefCentered`, `colDefWrap`

Use plain `AgGridTable` for declarative `rowData`.

Use `useAgGrid` or `createGridBuffer` when row updates arrive as patches,
streams, or imperative transactions.

Use overlay mode when React-owned `rowData` owns the row set and external
patches should update only already-present rows.

Use `createColumnBuffer` for generic dynamic column-name lifecycle. The shared
buffer stores names and replays them; the app wrapper decides target group,
column shape, `colId`, labels, and domain rules.

Low-level `applyGridRows` exists, but it is not the preferred path for new
React examples. Prefer the controller path because it owns attach/detach/sync
and reduces race conditions around grid readiness.

### Column State

Purpose: one persisted column config that can drive desktop grids, icon menus,
toolbars, and mobile card views.

Main APIs:

- `createColumnState`
- `ColumnsMenu`, `MenuStrip`
- `ColumnDots`
- `CardList`
- `columnState.grid.attach(api)` and `detach()`
- `columnState.api.listSource`

Use this when the user can change column order, visibility, width, sort,
filter, or mobile field selection.

Key idea: column config is independent from ag-grid. ag-grid is one adapter
over it. Mobile cards and toolbar buttons read the same config without needing
ag-grid at all.

Runtime presence (`setPresent`, `setPresentGate`) is not persisted. It is for
modes where some stable schema columns are currently unavailable.

### Observe React Adapter

Purpose: React hooks around `wenay-common2` Observe stores and listen objects.

Main APIs:

- `useStoreNode`, `useStoreKeys`, `useStoreSelect`
- `useStoreMirror`
- `useStoreEach`
- `useListenEffect`, `useListenValue`, `useListenArgs`

Use these when React needs to subscribe to external stores or listens. Network
sync stays explicit through `useStoreMirror`; merely reading a node should not
start hidden transport work.

### Replay React Adapter

Purpose: React-side lifecycle over `wenay-common2` Replay lines, store replay,
route hand-off, pull frames, and archive playback.

Main APIs:

- `useReplaySubscribe`
- `useReplayRouteSubscribe`
- `useStoreReplaySync`, `useStoreReplayMirror`
- `useStoreReplayRouteSync`, `useStoreReplayRouteMirror`
- `useStoreReplayEach`
- `useReplayFrame`
- `useReplayHistory`

Use these for high-frequency event lines, state sync from a replay source, and
route hand-off between relay/direct transports.

Avoid storing every frame in React state. High-frequency lines should fold into
canvas, refs, external stores, or grid controllers. The controller exposes
`seq()` and related getters so consumers can observe position without
rerendering on every event.

### Logs

Purpose: shared logging UI and notification/table chrome.

Main APIs:

- `logsApi`
- `getLogsApi`
- `logsApi.React.Message`, `PageLogs`, `Setting`
- context logger components in the rare surface

Use `logsApi` for quick global logging. Use context logger components when an
app needs a larger logger surface.

### Params

Purpose: editable parameter UIs over `wenay-common2` Params structures and
simple row/section editors.

Main APIs:

- `ParamsEditor`
- `ParamsEdit`
- `ParamRow`
- `useTextInputPanel`, `useFileInputPanel`
- `TextInputPanel`, `FileInputPanel`

Use these for generic param editing. Product-specific validation and save
policy stay in the app.

### Styles And Theme

Purpose: shared visual tokens and theme hooks for library primitives.

Main files:

- `src/style/tokens.css`
- `src/common/src/styles/tokens.ts`
- `src/style/style.css`
- `src/style/menuRight.css`
- `src/common/src/styles/styleGrid.ts`
- `src/common/src/grid/agGrid4/theme.ts`

New shared UI should try existing tokens first. Add tokens when the value is
part of a reusable primitive or expected to be themed by apps. One-off QA or
app styles should stay in the app/demo wrapper.

Default styles are part of the public usability contract. A primitive should remain usable after importing the package CSS; apps may override variables, but should not need to copy internal CSS just to avoid a broken surface. Runtime geometry can stay inline when it is computed from state; colors, spacing, borders, shadows, typography, and hover/active states should move to classes and CSS variables.

### Charts

Purpose: low-level chart engine and React chart demo surface.

Main APIs:

- `MyChartEngine`
- `createChartCanvas`
- chart engine internals exported through the rare surface

The chart engine is intentionally low-level. Product apps should wrap it before
using it as a domain chart.

## QA Stand

The live stand is `src/common/testUseReact/qa.tsx`.

Run:

```sh
npm run testReact
```

The stand has active cards and an archive. Use active cards as the strongest
signal for current behavior. Archive cards are regression checks and may show
older or lower-level API paths.

Important current cards:

- 23-26: Replay hooks, store sync, per-key feed, route hand-off.
- 28: `createColumnState` with ag-grid adapter.
- 29: mobile `ColumnDots` + `CardList`.
- 30: grouped sub-column mode above toolbar/columnState.
- 31: `createToolbar` over `columnState.api.listSource`.

Known audit note: archive card 5 and `src/common/testUseReact/useGrid.tsx`
still demonstrate direct `applyGridRows`. That is useful as a regression
check for the low-level helper, but new examples should teach `useAgGrid`,
`AgGridTable`, or `createGridBuffer` first.

## Adding A New Feature

Before adding a shared primitive:

1. Check whether an existing primitive already owns the problem.
2. Decide the generic boundary: what belongs in the library, what belongs in
   the product wrapper.
3. Add an everyday example to `doc/wenay-react2.md` only if it is a public
   everyday API.
4. Prefer a `use*` hook or `create*` controller as the public behavior surface; add a visual component only as a layer over it.
5. Add edge-case details to `doc/wenay-react2-rare.md`.
6. Add or update a QA stand card when behavior is visual, interactive, or hard
   to prove through unit tests alone.
7. Add a changelog entry under `doc/changes/`.

## Non-Goals

`wenay-react2` should not become:

- a product shell;
- a business-domain library;
- a hidden persistence service;
- a transport selector;
- a replacement for normal React local state;
- a place for one-off app styling.

The package should provide strong generic tools. Apps compose those tools into
business behavior.
