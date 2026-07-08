# wenay-react2 Rename Map

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