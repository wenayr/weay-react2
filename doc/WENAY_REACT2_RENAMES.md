# wenay-react2 Rename Map

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
| `LogsPage` | `logs/logs.tsx` | compose tabs in the app over `useLogsPageTable` / `PageLogs` + `InputSettingLogs` |
| `LogsProvider`, `useLogsContext`, `LogsTable`, `LogsNotifications`, `LogsSettings` (component), `MainPage`, `AppLogs` | `logs/logsContext.tsx` (deleted) | `createLogsController` + `useLogsPageTable` / `useMiniLogsTable` / `useMessageEventLogsController`; `LogEntry`/`LogInput`/`LogsSettings` now mean the controller types on every entrypoint |
| `createChartCanvas`, `IChartCanvas`, `IChartConfig`, `IChartPoint`, `ChartDemo` | `myChart/1/` (deleted) | `Sparkline` or `createChartEngine` |
| `MyChartEngine`, `generateIncrementalData` | `myChart/chartEngine` | stand-only demo; build your own component over `createChartEngine` |
| `applyGridRows`, `GridRowsOptions`, `ApplyGridRowsParams` | `utils/gridRows.ts` (deleted) | `useAgGrid` / `createGridBuffer` |
| `ArrayPromise` | `utils/arrayPromise.tsx` (deleted) | none |
| `PageVisibilityContext`, `PageVisibilityProvider` | `utils/pageVisibilityContext.tsx` (deleted) | none |
| `DragArea` | `components/Dnd/DragArea.tsx` (deleted) | `useDraggableApi` / `DragBox` |
| `BrowserCacheStorage`, `LocalStorageCache`, `restoreDates`, `DirtyListener`, `deepMergeWithMap` | root barrel (`utils` `export *`) | still exported from their modules, not public; use `browserCacheStorage` / `localStorageCache` / `createCacheMapWithStorage` |
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