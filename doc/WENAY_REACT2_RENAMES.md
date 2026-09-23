# wenay-react2 Rename Map

## 4.0.0 migration cut (2026-09-24)

4.0.0 removes the root entry and renames the legacy names of the 3.x Cleanup Inventory. One CLI
run migrates a 3.x consumer: it moves root imports to canonical subpaths and imports every
renamed name under its old local name (`{renderByReverse as renderByRevers}`), so the code below
the imports keeps compiling unchanged. Run it from the consumer repository after installing 4.0.0:

```sh
npm i -D @babel/parser          # optional peer, only needed for the migration run
node node_modules/wenay-react2/scripts/migrate-root-imports.mjs src           # preview
node node_modules/wenay-react2/scripts/migrate-root-imports.mjs --write src
node node_modules/wenay-react2/scripts/migrate-root-imports.mjs --check src   # 0 = nothing left
```

The CLI handles named imports and re-exports, from the root and from subpaths. A name removed
without a replacement stops the batch (no file is written). Namespace imports
(`import * as r from "wenay-react2/react"` with `r.renderByRevers`), dynamic imports and type
queries need a manual edit; TypeScript reports each of them. Rename the aliased locals later at
your own pace.

### Removed

| 3.x | 4.0.0 |
| --- | --- |
| root `wenay-react2` (`import {...} from "wenay-react2"`; manifest `main` / `types` / `"."`) | the canonical subpaths; the CLI rewrites the imports |
| `__observerStateForTests` (`./react`) | none: a test-only probe, imported from `src/internal/updateBy` inside this repository |

### Renamed

| 3.x | 4.0.0 | Entries |
| --- | --- | --- |
| `renderByRevers` | `renderByReverse` | `./react` |
| `mapResiReact` | `resizableSizeMap` | `./ui`, `./persist` |
| `mapRightMenu` | `rightMenuMap` | `./menu`, `./persist` |
| `FResizableReact` | `ResizableBox` | `./ui` |
| `CResizeObserver` | `ResizeObserverHub` | `./react` |
| `memorySet` | `memorySetIfAbsent` (same behaviour: an existing entry wins) | `./react`, `./persist` |

Storage is unaffected: `memoryCache` keeps writing the `"mapResiReact"` and `"mapRightMenu"`
scopes, so saved sizes and menus load as before.

### Changed signatures (TypeScript reports every use)

| 3.x | 4.0.0 |
| --- | --- |
| `memoryGetOrCreate(key, def, {reversDeep})` | `{reverseDeep}` |
| memory API `key: any` (`memoryGet`, `memoryGetOrCreate`, `memorySetIfAbsent`, `memoryGetById`, `memoryUpdate`, `memoryCommit`, `memoryMarkDirty`) | `key: string` |
| `createColumnState().api.onChange`, `createToolbar().api.onChange`: the common2 `ListenApi` (`on`, `emit`, `close`, `off`, `count`, ...) | a read-only `ListenLike` view `{on(cb, opts?) -> off}`; `.on(cb)` and `useListenEffect(api.onChange, cb)` are unchanged |
| `FloatingWindowController.onResize` / `onResizeStart` / `onResizeStop` typed with react-rnd's `RndResizeCallback` / `RndResizeStartCallback` | `FloatingWindowResizeHandler` / `FloatingWindowResizeStartHandler` from `./windows`, same parameters |
| `FloatingWindowUpdate.dir: string` | `FloatingWindowResizeDirection` |
| `@babel/parser` as a runtime dependency | an optional peer, needed only by the migration CLI |
| peer `wenay-common2@^2.21.1` | `^3.0.0` plus `wenay-exchange@^1.0.0`; exchange data (`Bars`, `CQuotesHistory*`, `OHLC`, ...) imports from `wenay-exchange` |

Details and verification: `doc/changes/v4.0.0.md`.

## 3.0.0 entry map (2026-09-06)

Not a rename: every name kept its binding, and in 3.x the root barrel `wenay-react2` still
exported all of them. What changed was the canonical import path. The root was a compatibility
union, deprecated in 3.x and removed in 4.0.0; the tables below stay as the map for 3.x code,
and the 4.0.0 CLI applies them automatically. Details: `doc/changes/v3.0.0.md`. `./native` is
untouched.

### Automated migration (3.5.0; 4.0.0 adds the renames)

From the consumer repository, run:

```sh
npm i -D @babel/parser          # since 4.0.0 an optional peer, not installed with the package
node node_modules/wenay-react2/scripts/migrate-root-imports.mjs src
node node_modules/wenay-react2/scripts/migrate-root-imports.mjs --write src
node node_modules/wenay-react2/scripts/migrate-root-imports.mjs --check src
```

The first command previews without writing. `--check` returns 1 when imports need migration,
2 for unsupported syntax/names. Named imports and re-exports are split with aliases,
type-only specifiers, comments, quote style and semicolons preserved. No file is written if
any input has an unsupported case. Namespace/default/star/dynamic imports, type queries and
module augmentations need manual decisions. The script does not rewrite strings/regexes in
import-contract tests: review those, then run consumer types, tests and builds.

The map comes from the installed package's declarations, with duplicate priority:
core → persist → react → grid → windows → logs → communication → params → modal → menu → chart → ui.
This deliberately picks `/persist` for shared persistence maps even where the table also
lists a UI home. The CLI parses with `@babel/parser`, an optional peer since 4.0.0 (3.5.x
installed it as a runtime dependency of every consumer): install it for the migration run and
remove it afterwards if nothing else needs it. Without it the CLI exits 2 with that hint.
TypeScript compiler API changes between 5/6 and 7 do not affect it. Node 20+ is required, as
for the package.

In 3.5.x the root names carried per-specifier `@deprecated` tags; since 4.0.0 there is no root
to import from. Use `--check` in CI to prohibit remaining root named imports. `/native` is not
part of this map.

### Root import -> canonical subpath (names that were root-only before 3.0.0)

| Root name | Canonical subpath |
| --- | --- |
| `Button`, `HoverButton`, `OutsideButton`, `AbsoluteButton`, `MiniButton`, `PopupButton` | `wenay-react2/ui` |
| `OutsideClickArea`, `Overlay` | `wenay-react2/ui` |
| `setResizeableElement`, `removeResizeableElement`, `FResizableReact`, `mapResiReact` | `wenay-react2/ui` (`mapResiReact` also on `/persist`) |
| `createUiSlot` | `wenay-react2/ui` |
| `createToolbar`, `registerToolbarDensity`, `getToolbarDensities`, `toolbarItemIcon` | `wenay-react2/ui` |
| `SettingsDialog`, `useSettingsDialogController`, `registerSettingsSection`, `getSettingsSections` | `wenay-react2/ui` |
| `ModalProvider`, `useModal` | `wenay-react2/modal` |
| `confirmModal`, `inputModal`, `createModalElementStore`, `createModalRenderStore` | `wenay-react2/modal` |
| `LeftModal`, `getApiLeftMenu` | `wenay-react2/modal` |
| `FreeModal`, `TextInputModal`, `TextInputPanel`, `useTextInputPanel`, `FileInputModal`, `FileInputPanel`, `useFileInputPanel` | `wenay-react2/modal` |
| `Menu`, `MenuItemElement`, `MenuProgress` | `wenay-react2/menu` |
| `contextMenu`, `createContextMenu` | `wenay-react2/menu` |
| `DropdownMenu`, `createRightMenuController`, `useRightMenuController`, `mapRightMenu` | `wenay-react2/menu` (`mapRightMenu` also on `/persist`) |
| `ParamsEditor`, `useParamsEditorController` | `wenay-react2/params` |
| `ParamRow`, `ParamLabelContent`, `ParamToggleLabel` | `wenay-react2/params` |
| `ParamsEdit`, `ParamsArrayEdit`, `setAutoStepForElement` | `wenay-react2/params` |
| `Sparkline` | `wenay-react2/chart` |
| `createChartEngine`, `createDataModel`, `createDataSet`, `createPanelManager`, `createRenderer`, `createInteraction` | `wenay-react2/chart` |
| `GridStyleDefault`, `StyleGridDefault`, `StyleCSSHeadGrid`, `StyleCSSHeadGridEdit` (type `AgGridClassRule`) | `wenay-react2/grid` |
| `logsApi`, `getLogsApi`, `PageLogs`, `MiniLogs`, `MessageEventLogs` | `wenay-react2/logs` |
| `updateBy`, `__observerStateForTests` | `wenay-react2/react` |
| `floatingWindowMap` | `wenay-react2/windows` (also on `/persist`) |

### New on the root and on `wenay-react2/persist` (3.0.0)

| Name | Canonical subpath |
| --- | --- |
| `createPersistedController` (types `PersistedController`, `PersistedControllerOptions`) | `wenay-react2/persist` |
| `memoryCommit` | `wenay-react2/persist` |
| `buttonStatusMap`, `floatingWindowMap`, `mapResiReact`, `mapRightMenu` | `wenay-react2/persist` |
| `memoryCache`, `memoryMaps`, `memoryGet`, `memoryGetById`, `memoryGetOrCreate`, `memorySet`, `memoryUpdate`, `memoryMarkDirty` | `wenay-react2/persist` (`/react` keeps re-exporting them) |
| `createCacheMap`, `createCacheMapWithStorage`, `browserCacheStorage`, `localStorageCache`, `useCacheMapPersistence`, `createSearchHistory`, `ObservableMap` | `wenay-react2/persist` (`ObservableMap` also on `/core`; `/react` re-exports the rest) |
| types `CacheMap`, `CacheStorage`, `DirtyListener`, `MapChangeListener`, `CacheMapPersistence`, `SearchHistoryApi`, `SearchHistoryState`, `ButtonSavedState`, `ResizableSavedSize`, `MenuRightPosition`, `MenuRightSavedState`, `MenuRightVerticalPosition`, `FloatingWindowCloseReason`, `FloatingWindowMode`, `FloatingWindowPosition`, `FloatingWindowSavedGeometry`, `FloatingWindowSize`, `FloatingWindowSnapRegion` | `wenay-react2/persist` |

Internal moves in the same release (never a public path): `src/internal/utils/{memoryStore,
cache, persistedMaps, persistedController, observableMap, floatingWindowTypes, searchHistory}`
and `src/internal/hooks/useCacheMapPersistence` -> `src/internal/persist/`.

## 2.0.0 migration cut (2026-09-02)

Breaking by design; documented here and in `doc/changes/v2.0.0.md`. Nothing below has an alias.

### Package surface

| Old | New |
| --- | --- |
| CSS loaded as a side effect of `wenay-react2`, `/grid`, `/windows`, `/logs`, `/communication` | import once: `import "wenay-react2/styles"` (+ `"wenay-react2/styles/menu-right"` if RightMenu is used); every entrypoint is CSS-free |
| `VideoCall` visuals inside `wenay-react2/styles` (2.1.0) | `import "wenay-react2/styles/communication"` next to `styles`; the block was a quarter of the stylesheet and only `./communication` needs it |
| `import { kit } from "wenay-react2"` (`kit.grid`, `kit.menu.context`, ...) | removed; import names directly or from a subpath (`/react`, `/grid`, `/windows`, `/logs`, `/communication`, `/core`, `/native`) |
| `wenay-react2/lib/common/api.js` | removed; use the root |
| `wenay-react2/demo/stand` (`QABoard`) | not published; run the stand from the repository (`npm run testReact`, `src/stand/`) |
| `socket.io-client` optionalDependency | removed (only the unpublished stand used it) |
| source layout `src/common/src/**`, `src/common/api.tsx`, `src/common/updateBy.ts` | `src/internal/**`, `src/api.tsx`, `src/internal/updateBy.ts`; demos/stand/calls under `src/stand/` (only `./demo/peer-media` and `./demo/peer-conference` are compiled and published, from `lib/stand/demo/`) |

### Removed exports

| Removed | Where it was | Use instead |
| --- | --- | --- |
| `createRightClickMenu` / `MenuR` | `menu/menuR.tsx` (deleted) | `contextMenu.Layer` + `contextMenu.openAt`; the gesture lives in `useContextMenuGesture` |
| `StickerMenu` | `components/Menu` | none (no consumers) |
| `RightMenuDemo`, `OutlineDragDemo` | `components/Menu/RightMenu.tsx`, `components/Dnd` | stand-only (`src/stand/testUseReact/`) |
| `ApiLeftMenu` (eager singleton), `TestLeft333` | `components/Modal/LeftModal.tsx` | `getApiLeftMenu()` called by the app |
| `LogsPage` | `logs/logs.tsx` | compose tabs in the app over `useLogsPageTable` / `PageLogs` + `logsApi.React.Setting` (import `logsApi` from `/logs`) |
| `LogsProvider`, `useLogsContext`, `LogsTable`, `LogsNotifications`, `LogsSettings` (component), `MainPage`, `AppLogs` | `logs/logsContext.tsx` (deleted) | `createLogsController` + `useLogsPageTable` / `useMiniLogsTable` / `useMessageEventLogsController`; `LogEntry`/`LogInput`/`LogsSettings` now mean the controller types on every entrypoint |
| `createChartCanvas`, `IChartCanvas`, `IChartConfig`, `IChartPoint`, `ChartDemo` | `myChart/1/` (deleted) | `Sparkline` or `createChartEngine` |
| `MyChartEngine`, `generateIncrementalData` | `myChart/chartEngine` | stand-only demo; build your own component over `createChartEngine` |
| `applyGridRows`, `GridRowsOptions`, `ApplyGridRowsParams` | `utils/gridRows.ts` (deleted) | `useAgGrid` / `createGridBuffer` |
| `ArrayPromise` | `utils/arrayPromise.tsx` (deleted) | none |
| `PageVisibilityContext`, `PageVisibilityProvider` | `utils/pageVisibilityContext.tsx` (deleted) | none |
| `DragArea` | `components/Dnd/DragArea.tsx` (deleted) | `useDraggableApi` / `DragBox` |
| `BrowserCacheStorage`, `LocalStorageCache`, `deepMergeWithMap` | root barrel (`utils` `export *`) | not public; use `browserCacheStorage` / `localStorageCache` / `createCacheMapWithStorage` |
| `restoreDates` | removed from root in 2.0.0 | public again in 3.5.0: `wenay-react2/persist`; mutates JSON-shaped objects/arrays in place, returns void |
| `DirtyListener` | removed from root in 2.0.0 | public type on `wenay-react2/persist` since 3.0.0 |
| `map3`, `mapWait` | `updateBy.ts` | module-private; `__observerStateForTests(obj)` read-only probe |
| `FloatingWindowProps.onCLickClose` | typo alias | `onClickClose` |
| `Button` `keySave` | alias | `keyForSave` |
| `StyleOtherRow`, `StyleOtherColumn` | `hooks/useOutside.tsx` | none |

Added: `Overlay` / `OverlayProps` (the scrim/Escape stack, so app dialogs can join it), `BuildAgThemeOptions`, `useContextMenuGesture`. Behaviour notes: `createUpdateApi.on` listeners now run inside the per-callback try/catch and before React notifiers; `GridStyleDefault()` returns a cached theme object (built on `buildAgTheme('dark', {browserColorScheme: false})`, params unchanged).


Date: 2026-07-08

This is a breaking rename map. The package does not keep old aliases for these names.

## Root

| Old | New |
| --- | --- |
| `v2` | `kit` |
| `test()` | removed |
| `LegacyMenuElement` | `MenuItemElement` |

## Persistent Memory

| Old | New |
| --- | --- |
| `Cash` | `memoryCache` |
| `MemoryMap` | `memoryMaps` |
| `staticGetAdd` | `memoryGetOrCreate` |
| `staticGetById` | `memoryGetById` |
| `staticSet` | `memorySet` |
| `staticGet` | `memoryGet` |
| `staticUpdate` | `memoryUpdate` |
| `staticMarkDirty` | `memoryMarkDirty` |
| `staticProps` | `memoryProps` |
| `mapMemory.tsx` | `memoryStore.tsx` |

## Outside Click And Keyboard

| Old | New |
| --- | --- |
| `DivOutsideClick` | `OutsideClickArea` |
| `DivOutsideClick2` | `OutsideClickArea` |
| `ButtonOutClick` | `OutsideButton` |
| `ButtonHover` | `HoverButton` |
| `ButtonAbs` | `AbsoluteButton` |
| `StyleOtherColum` | `StyleOtherColumn` |
| `useOutsideOld` | `useOutsideRef` |
| `useAddDownAnyKey` | `useKeyboard` |
| `useKeyDown` | `useKeyboard` |
| `useAnyKey` | `useKeyboard` |
| `keyDownApi` | `keyboard` |
| `KeyDown` | `keyboardState` |
| `AnyKeyDownApi` | `KeyboardApi` |
| `addDownAnyKey` | removed |
| `useAddDownAnyKeyOld` | removed |
| `useAddDownAnyKey.ts` | `useKeyboard.ts` |

## Floating Windows And Drag

| Old | New |
| --- | --- |
| `DraggableOutlineDiv` | `OutlineDragDemo` |
| `DivRnd3` | `FloatingWindow` |
| `DivRndBase3` | `FloatingWindowBase` |
| `ExRNDMap3` | `floatingWindowMap` |
| `tRndUpdate` | `FloatingWindowUpdate` |
| `Drag22` | `DragBox` |
| `Drag2Props` | `DragBoxProps` |
| `Drag2` | `DragArea` |
| `RNDFunc3.tsx` | `FloatingWindow.tsx` |
| `RNDFunc.tsx` | `DragArea.tsx` |

## Modal And Inputs

| Old | New |
| --- | --- |
| `InputPage` | `TextInputPanel` |
| `InputPageModal` | `TextInputModal` |
| `InputFile` | `FileInputPanel` |
| `InputFileModal` | `FileInputModal` |
| `PageModalFree` | `FreeModal` |
| `GetModalJSX` | `createModalElementStore` |
| `GetModalFuncJSX` | `createModalRenderStore` |
| `setModalJSX` argument | `modal` argument |
| `LegacyModalSetter` | `ModalSetter` |
| `useModalOld` | removed |
| `useModalApi` | removed |

## Params

| Old | New |
| --- | --- |
| `ParametersReact` | `ParamsEditor` |
| `ParametersBaseReact` | `ParamsEditorBase` |
| `ParametersEngine.tsx` | `ParamsEditor.tsx` |
| `EditParams2` | `ParamsEdit` |
| `EditParams3` | `ParamsArrayEdit` |
| `CParameter` | `ParamRow` |
| `FButton` | `ParamLabelContent` |
| `FNameButton` | `ParamToggleLabel` |
| `SetAutoStepForElement` | `setAutoStepForElement` |

## Menu

| Old | New |
| --- | --- |
| `MenuBase` | `Menu` |
| `MenuBaseProps` | `MenuProps` |
| `tMenuReact` | `MenuItem` |
| `tMenuReactStrictly` | `MenuItemStrict` |
| `TimeNum` | `MenuProgress` |
| `tCounters` | `MenuProgressCounters` |
| `GetMouseMenuApi` | `createContextMenu` |
| `mouseMenuApi` | `contextMenu` |
| `ReactMouse` | `Layer` |
| `ReactMenu` | `MenuView` |
| `GetMenuR` | `createRightClickMenu` |
| `MenuRightApi` | `createRightMenuController` |
| `DropdownMenuTest` | `RightMenuDemo` |

## Buttons And Grid

| Old | New |
| --- | --- |
| `MiniButton2` | `PopupButton` |
| `MiniButton3` | removed |
| `AgGridMy` | `AgGridTable` |
| `AgGridMyProps` | `AgGridTableProps` |
| `AgGridMyInner` | `AgGridTableInner` |
| `applyTransactionAsyncUpdate2` | `applyGridRows` |
| `applyTransactionAsyncUpdate` | removed; use `applyGridRows` or `useAgGrid` |
| `getUpdateTable` | removed |
| `getComparatorGrid` | removed; use `numericComparator` |
| `applyTransactionAsyncUpdate.tsx` | `gridRows.ts` |



## Cache Helpers

| Old | New |
| --- | --- |
| `tDirtyListener` | `DirtyListener` |
| `IServerSaveBasePromise` | `CacheStorage` |
| `CSaveToCache` | `BrowserCacheStorage` |
| `CSaveToLocalStorage` | `LocalStorageCache` |
| `CacheG` | `browserCacheStorage` |
| `CacheLocal` | `localStorageCache` |
| `CacheFuncMapBase` | `createCacheMapWithStorage` |
| `CacheFuncMap` | `createCacheMap` |
| `ObjectStringToDate` | `restoreDates` |
## Public Type Prefix Cleanup

| Old | New |
| --- | --- |
| `tToolbarItem` | `ToolbarItem` |
| `tToolbarConfig` | `ToolbarConfig` |
| `tToolbarDensity` | `ToolbarDensity` |
| `tUiListConfig` | `UiListConfig` |
| `tUiListSource` | `UiListSource` |
| `tColumnMeta` | `ColumnMeta` |
| `tColumnsSort` | `ColumnsSort` |
| `tColumnsConfig` | `ColumnsConfig` |
| `tMenuStripItem` | `MenuStripItem` |
| `tReorderOptions` | `ReorderOptions` |
| `tReorderItem` | `ReorderItem` |
| `tReorderBoardOptions` | `ReorderBoardOptions` |
| `tBoardPos` | `BoardPosition` |
| `tBoardColumn` | `BoardColumn` |
| `tSettingsSection` | `SettingsSection` |
| `tThemeMode` | `ThemeMode` |
| `tMapChangeListener` | `MapChangeListener` |
| `tCallFuncAgGrid` | `AgGridClassRule` |
| `tLogsInput` | `LogInput` |
| `tLogs` | `LogEntry` |
| `MenuRightPosition2` | `MenuRightVerticalPosition` |
| `position2` prop/state | `verticalPosition` |
| `PageLogs2` | `LogsPage` |
| `logs3.tsx` | `logsContext.tsx` |
## wenay-common2 Names Used Here

| Old common2 alias | New name used in this package |
| --- | --- |
| `GetDblPrecision` / `GetDblPrecision2` | `decimals` |
| `NormalizeDouble` | `round` |
