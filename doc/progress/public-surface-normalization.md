# Public surface normalization

Задача из target: пройти второй слой публичной поверхности `wenay-react2` и внедрять только те primitives, которые реально заменяют ручной код.

## Status

In progress.

## Usage/example sources

Обновляем вместе с кодом, если меняется canonical usage:
- `doc/EXAMPLE_USAGE.md` — главный standards/example файл;
- `src/common/testUseReact/qa.tsx` — QA cards как живые примеры использования, особенно cards 20-31;
- `src/common/testUseReact/replayVideo.tsx` — Replay usage examples для cards 23-26;
- `src/common/src/grid/agGrid4/example.tsx`, `README.md`, `WRAPPER.md`, `MIGRATION.md` — grid wrapper examples/docs.

Legacy/compat examples (`src/common/testUseReact/use.tsx`, `useGrid.tsx`, отдельные старые cards) не переписывать автоматически; если они показывают low-level path, помечать как regression/compat, а не canonical pattern.

Правило прохода: для каждого изменения проверять, есть ли affected card/example. Если публичный API не менялся и пример уже показывает правильный usage, фиксировать "пример проверен, менять не нужно".

## Task scoring

Перед выполнением следующего кандидата ставим оценку:
- эффективность: high / medium / low;
- простота: simple / medium / hard;
- риск: low / medium / high.

Делаем сразу только high/medium эффективность при simple/medium сложности и понятном риске. Low-effectiveness или hard/high-risk без явного выигрыша — пропускать и записывать причину.

## Pass 1 — low-risk controller reuse

### `createUpdateApi` / `useUpdateByApi`

Проверено:
- `src/common/src/hooks/useKeyboard.ts` содержит простой mutable singleton `keyboardState` и прямые вызовы `renderBy(keyboardState)`.

Сделано:
- `useKeyboard.ts` переведён на `createUpdateApi(keyboardState)` для локального render-controller.
- Публичный API `keyboard`, `keyboardState`, `useKeyboard`, `keyboard.on/subscribe` не менялся.

Почему это не высосано из пальца:
- это ровно contract `createUpdateApi`: mutable object + render/subscribe controller;
- изменение маленькое и не тянет UI-поведение.

Ограничение:
- широкая замена `updateBy/renderBy` в `Toolbar`, `SettingsDialog`, `columnState` пока не делалась. Там controller может быть полезен, но риск выше, потому что эти объекты имеют persistence, registry или grid side effects.

## Pass 1 — tasks intentionally not implemented yet

### `ArrayPromise`

Статус: пока не внедрять.

Причина:
- в текущей библиотеке нет потребителя, где явно нужен именно последовательный набор promise-thunks с progress counters;
- для параллельных batch operations counters у `ArrayPromise` не являются стабильным контрактом;
- внедрение без конкретной batch-команды будет искусственным.

Что считать подходящим местом позже:
- реальные последовательные операции: массовое закрытие позиций, очистка лимиток, transfer step-by-step;
- если операции параллельные, нужен другой progress contract, не `ArrayPromise` counters.

### `DragBox` / `DragArea`

Статус: не использовать в новом коде как high-level стандарт.

Причина:
- это low-level/legacy movement components;
- для нового кода уже есть hook-first путь `useDraggableApi`, а для окон — `FloatingWindow`.


## Pass 2 — grid helpers without grid lifecycle change

### Log tables default column definition

Проверено:
- `src/common/src/logs/miniLogs.tsx` и `src/common/src/logs/logs.tsx` дублировали один и тот же `defaultColDef`: `headerClass`, `resizable`, centered `cellStyle`, `sortable`, `filter`, `wrapText`.

Сделано:
- оба места переведены на общий `colDefCentered` + локальный `wrapText: true`.
- `AgGridReact` намеренно оставлен на месте: перевод на `AgGridTable` может изменить тему, row selection и lifecycle, поэтому это отдельная задача после визуальной проверки.

Почему это не высосано из пальца:
- helper `colDefCentered` уже существует именно для такого dense table default;
- замена убирает ручное дублирование, но не трогает grid lifecycle.


## Pass 3 — compatibility modal store controller

### `createModalElementStore` / `createModalRenderStore`

Проверено:
- `src/common/src/components/Modal/Modal.tsx` содержит общий `createJsxStore`, где mutable object `data` одновременно используется как render subscription target.

Сделано:
- прямые `renderBy(data)` / `updateBy(data)` заменены на `createUpdateApi(data)` (`dataApi.render()` / `dataApi.use()`).
- публичные compatibility APIs `createModalElementStore()` и `createModalRenderStore()` не менялись.

Почему это не высосано из пальца:
- store уже был построен на mutable object + render subscription;
- `createUpdateApi` делает этот контракт явным без изменения поведения.
## Pass 4 — persisted slot controller

### `createUiSlot`

Проверено:
- `src/common/src/components/UiSlot/UiSlot.tsx` содержит persisted mutable store `st` из `memoryGetOrCreate` и прямые `renderBy(st)` / `updateBy(st)`.

Сделано:
- `createUiSlot` переведён на `createUpdateApi(st)` (`stApi.render()` / `stApi.use()`).
- публичный API `Slot`, `PlacementSetting`, `getPlace`, `setPlace` не менялся.
- usage example проверен: card 21 (createUiSlot - configurable block placement) уже использует публичный API; менять card не нужно, потому что refactor внутренний.

Почему это не высосано из пальца:
- это тот же contract, что в `useKeyboard` и compatibility modal store: mutable object + render subscription;
- persistence через `memoryMarkDirty` оставлен без изменений.

## Pass 5 — toolbar density registry controller

### `registerToolbarDensity` / toolbar density consumers

Оценка перед выполнением:
- эффективность: medium;
- простота: simple;
- риск: low.

Проверено:
- `src/common/src/components/Toolbar/Toolbar.tsx` содержит module-level mutable registry `densities` и прямые `renderBy(densities)` / `updateBy(densities)`.
- card 25 использует `registerToolbarDensity` как usage example.

Сделано:
- только registry `densities` переведён на `createUpdateApi(densities)` (`densitiesApi.render()` / `densitiesApi.use()`).
- persisted toolbar config `st`, `sourceMode`, external `listSource`, `memoryMarkDirty` не трогались.
- usage example проверен: card 25 (`createToolbar - customizable toolbar`) уже использует публичный `registerToolbarDensity`; менять card не нужно, потому что refactor внутренний.

Почему это не высосано из пальца:
- `densities` ровно module singleton + subscription target;
- изменение уменьшает прямой `renderBy/updateBy` там, где нет persistence/grid side effects.

## Pass 6 — settings section registry controller

### `registerSettingsSection` / `SettingsDialog`

Оценка перед выполнением:
- эффективность: medium;
- простота: medium;
- риск: medium.

Проверено:
- `src/common/src/components/Settings/SettingsDialog.tsx` содержит module-level mutable registry `registry` и прямые `renderBy(registry)` / `updateBy(registry)`.
- card 20 использует `registerSettingsSection` как usage example.

Сделано:
- только section registry переведён на `createUpdateApi(registry)` (`registryApi.render()` / `registryApi.use()`).
- search history, tree UX, resize behavior и `settingsDialogLayout` не менялись.
- usage example проверен: card 20 (`SettingsDialog - searchable settings tree + registry`) уже использует публичный `registerSettingsSection`; менять card не нужно, потому что refactor внутренний.

Low-effectiveness skip:
- `settingsDialogLayout` пока не переводился: сейчас нет явного `updateBy(settingsDialogLayout)` consumer, а nav width живёт в React state и сохраняется через `memoryMarkDirty`. Отдельный controller здесь мало что даст без изменения layout contract.

## Pass 7 — columnState controller split

### `createColumnState` runtime `rt` and persisted `st`

Оценка перед выполнением:
- `rt` present/presentGate: эффективность medium, простота simple, риск low-medium;
- `st` persisted config: эффективность medium, простота medium, риск medium.

Проверено:
- `src/common/src/grid/columnState/columnState.ts` содержит runtime store `rt` для `present` / `presentGate` и persisted store `st` для column config.
- cards 29/30 используют `usePresent` / `setPresentGate`; cards 28-31 используют persisted config через `useConfig`, grid adapter, menu, toolbar source.

Сделано:
- `rt` переведён на `createUpdateApi(rt)` (`rtApi.render()` / `rtApi.use()`).
- `st` переведён на `createUpdateApi(st)` (`stApi.render()` / `stApi.use()`).
- `commit`, `memoryMarkDirty`, `applyToGrid`, `emitChange`, `listSource` и grid adapter flow не менялись.
- usage examples проверены: cards 28-31 уже используют публичный `createColumnState` API; менять cards не нужно, потому что refactor внутренний.

## Pass 8 — search history controller

### `createSearchHistory`

Оценка перед выполнением:
- эффективность: high;
- простота: simple;
- риск: low.

Проверено:
- `src/common/src/utils/searchHistory.ts` содержит persisted mutable store `st` и прямые `renderBy(st)` / `updateBy(st)`.
- `SettingsDialog` и card 20 используют этот primitive для истории поиска.

Сделано:
- `createSearchHistory` переведён на `createUpdateApi(st)` (`stApi.render()` / `stApi.use()`).
- публичный API `items`, `use`, `add`, `remove`, `clear` не менялся.
- usage docs уже рекомендуют `createSearchHistory({key})`; менять пример не нужно.

## Pass 9 — toolbar persisted config controller

### `createToolbar` local `st`

Оценка перед выполнением:
- эффективность: medium;
- простота: medium;
- риск: medium.

Проверено:
- `src/common/src/components/Toolbar/Toolbar.tsx` после density-registry pass всё ещё содержал persisted config store `st` с прямыми `renderBy(st)` / `updateBy(st)`.
- cards 25, 30, 31 используют `createToolbar` local/external source flows.

Сделано:
- local toolbar store `st` переведён на `createUpdateApi(st)` (`stApi.render()` / `stApi.use()`).
- external source hook `ext?.useConfig()`, `sourceMode`, `memoryMarkDirty`, `emitChange` не менялись.
- usage examples проверены: cards 25/30/31 уже используют публичный API; менять cards не нужно, потому что refactor внутренний.

## Pass 10 — window/menu controller normalization

### `FloatingWindow` open-window registry

Оценка перед выполнением:
- эффективность: medium;
- простота: medium;
- риск: medium.

Проверено:
- `src/common/src/components/Dnd/FloatingWindow.tsx` содержит module-level `openWindows` registry для z-index order и прямые `renderBy(openWindows)` / `updateBy(openWindows, cb)`.
- card 2 и Settings/Dialog flows используют `FloatingWindow` как usage examples.

Сделано:
- `openWindows` переведён на `createUpdateApi(openWindows)` (`openWindowsApi.render()` / `openWindowsApi.use(cb)`).
- drag/resize geometry, document listeners, `floatingWindowMap` persistence и `DragBox` не менялись.

### `LeftModal` menu store

Оценка перед выполнением:
- эффективность: medium;
- простота: simple;
- риск: medium.

Проверено:
- `src/common/src/components/Modal/LeftModal.tsx` содержит local `menuStore` Map внутри `getApiLeftMenu()` и прямые `renderBy(menuStore)` / `updateBy(menuStore)`.

Сделано:
- `menuStore` переведён на `createUpdateApi(menuStore)` (`menuStoreApi.render()` / `menuStoreApi.use()`).
- compatibility method `ApiLeftMenu.renderBy()` оставлен, но внутри вызывает `menuStoreApi.render()`.
- `createModalElementStore()` path уже был переведён раньше; меню/модалка публично не менялись.


## Pass 11 — log tables wrapper transition

### `PageLogs` / `MiniLogs`

Оценка перед выполнением:
- эффективность: medium/high;
- простота: medium;
- риск: medium, потому что внешний вид/theme/resize могут измениться, но QA stand это покрывает вручную.

Проверено:
- `src/common/src/logs/logs.tsx` и `src/common/src/logs/miniLogs.tsx` после defaultColDef pass всё ещё использовали raw `AgGridReact`.
- card 9 (`Logs - time format`) использует `logsApi.React.PageLogs` и подходит для ручной проверки основного log table path.

Сделано:
- `PageLogs` и `MiniLogs` переведены на `AgGridTable`.
- logger state/timing, `logsApi`, `MessageEventLogs`, `contextMenu` copy action, filter update path и row transaction path не менялись.
- `logsContext.tsx` намеренно не трогался: это отдельный older/context logger implementation with localStorage + raw grid.

Ручная проверка:
- card 9: нажать `add log`, время форматируется как `HH:mm:ss`, строка появляется в таблице, правый клик по ячейке даёт copy menu.
- если `MiniLogs` есть в app/stand consumer, проверить: таблица растягивается по контейнеру, click callback на ячейке вызывается.

## Pass 12 — MiniLogs hook/controller layering

### `useMiniLogsTable` / `MiniLogsView` / `MiniLogsTable`

Оценка перед выполнением:
- эффективность: medium/high;
- простота: medium;
- риск: medium.

Проверено:
- прямых runtime-использований `MiniLogs` в repo не найдено, но public barrel уже экспортирует `miniLogs.tsx` через `src/common/api.tsx`;
- card 9 покрывал `PageLogs`, но не `MiniLogs`, поэтому QA example требовал обновления;
- row identity нельзя менять на `AgGridTable data={...}` / default `id`, потому логовый `id` может повторяться по source area.

Сделано:
- `MiniLogs` разделён на hook/controller `useMiniLogsTable`, pure visual `MiniLogsView`, convenience `MiniLogsTable` и compatibility wrapper `MiniLogs`;
- hook отдаёт `props/tableProps/gridProps`, `apiRef`, `fit`, `getApi`, `withApi` и callbacks, но не создаёт внутренний `useAgGrid` controller;
- сохранён `rowData` path и старый `CellMouseDownEvent<T>` click contract;
- QA card 9 получил прямой `MiniLogsTable` block;
- docs обновлены в `doc/EXAMPLE_USAGE.md`, `doc/wenay-react2.md`, `doc/wenay-react2-rare.md`;
- добавлен `__test/miniLogs.test.tsx` на hook props/click/grid helpers.

Почему store не добавлен:
- MiniLogs сейчас table-view над внешним `data`; нет реального consumer для append/limit/history store;
- MiniLogs-owned state лучше добавлять позже только вместе с `createLogsController` или конкретным app consumer.

## Next candidates

1. `logs.tsx` logger internals — эффективность medium, простота hard, риск medium-high. Там несколько stores, callback-subscriptions, notification timing и table rendering; не делать как small pass без отдельного logger plan.
2. `logsContext.tsx` — эффективность medium, простота hard, риск medium-high. Есть прямой `localStorage` и голый `AgGridReact`, но split нужен отдельно: persistence contract + grid lifecycle/visual check.
3. `memoryStore.tsx` direct `renderBy(cur)` — эффективность low/medium, простота medium, риск medium. Подробно:
   - прямой вызов есть только в `memoryUpdate(key, mutate)`: он ререндерит подписчиков именно на объект `cur`, который лежит внутри `memoryProps`;
   - `memoryProps` сам является `ObservableMap` и уже наблюдается `memoryCache`, поэтому `memorySet`, `memoryGetOrCreate`, `memoryMarkDirty` идут по map/cache dirty channel, а не по React-subscription API;
   - перевод `memoryUpdate` на `createUpdateApi(cur)` технически возможен, но почти ничего не меняет для публичного contract, потому что API создаётся на лету для произвольного stored object;
   - риск в том, что это core persistence helper: им пользуются toolbar/columnState/UiSlot/search history/settings/window/right menu flows, и ошибка ударит не по одному widget, а по всему сохранению UI-конфига;
   - делать стоит только если появится конкретный consumer/test на `memoryUpdate` или если мы явно вводим стандарт “memory object update controller” и покрываем это тестом: subscribe to stored object -> `memoryUpdate` -> rerender + `memoryCache.onDirty`.
4. `SettingsDialog.layout` controller — эффективность low, простота simple, риск low. Сейчас нет `updateBy(settingsDialogLayout)` consumer, поэтому пропущено как малоэффективное.
5. `PageVisibilityProvider` candidates — эффективность low до появления реального polling/replay/canvas consumer. Сейчас не внедрять в обычный UI ради helper.
6. Store/listen hooks — эффективность low внутри shared library без настоящего `Observe.Store` / `listen` consumer. Больше смысла искать в QA/app examples.

## Verification

- `npx tsc -p tsconfig.qa-check.json --noEmit` — passed after Pass 12.
- `npm run testjest -- --runInBand miniLogs.test.tsx` — passed after Pass 12: 1 suite, 2 tests.
- `npm run testjest -- --runInBand` — passed after Pass 12: 10 suites, 27 tests.
- `npm run build` — passed after Pass 12.
- `git diff --check` — passed after Pass 12; only LF/CRLF normalization warnings.

## Pass 13 — final inventory of remaining primitive-reuse candidates

Дата: 2026-07-09.

Цель: после hook/controller-first очереди повторно проверить широкий пункт `Недоиспользуемые методы wenay-react2` и не делать задачи ради задач.

Проверено:
- raw `AgGridReact`: остался только внутри самого wrapper `agGrid4.tsx` и в `src/common/testUseReact/useGrid.tsx`;
- `src/common/testUseReact/useGrid.tsx` уже документирован в `doc/EXAMPLE_USAGE.md` / `doc/PROJECT_FUNCTIONALITY.md` как legacy/regression example для низкоуровневого `applyGridRows`, а не canonical grid pattern;
- `logsContext.tsx` всё ещё имеет прямой `localStorage`, но это публичное legacy/compat поведение provider-а; перевод на `memoryCache` изменит contract, потому что app должен будет сам вызывать `memoryCache.load/save`;
- `PageVisibilityProvider` candidates есть только в тяжёлых timer/canvas/replay/chart местах (`useReplay`, chart engines, QA replay demos), где нужно отдельное policy-решение: продолжать catch-up в hidden tab или паузить;
- ручные `listen.on` / `useEffect` в QA в основном демонстрируют compatibility APIs или сами hook implementations; единственный useful cleanup — card 25 toolbar `tb.api.onChange` — безопасно переведён на `useListenEffect`;
- Settings/Toolbar registries уже показаны активными QA cards 20/25/30/31; новых low-risk registry migrations без app consumer не найдено;
- ModalProvider/useModal уже есть active QA card 13; imperative modal stores оставлены documented compatibility path.

Решение:
- `qa.tsx` card 25: `tb.api.onChange.on(...)` заменён на `useListenEffect(tb.api.onChange, ...)`;
- `useGrid.tsx` не переводить на `AgGridTable`, пока он нужен как regression для `applyGridRows`;
- `logsContext` storage не менять без отдельной задачи “context logger persistence contract”;
- PageVisibility/replay/chart timers не менять без явного UX-policy;
- broad primitive-reuse target считать выполненным на текущем repository surface: оставшиеся пункты low-effectiveness или high-risk без нового consumer/test.

## Verification update

- `npx tsc -p tsconfig.qa-check.json --noEmit` — passed after FloatingWindow / final inventory / QA listen cleanup.
- `npm run testjest -- --runInBand createToolbar.test.ts` — passed after QA listen cleanup.
- `npm run testjest -- --runInBand floatingWindowController.test.tsx settingsDialog.test.tsx` — passed: 2 suites, 6 tests.
- `npm run testjest -- --runInBand` — passed: 14 suites, 44 tests.
- `npm run build` — passed.
- `git diff --check` — passed; only LF/CRLF normalization warnings.
## Pass 14 — Toolbar.Bar movement animation

Дата: 2026-07-09.

Задача: пользователь подтвердил card 30 как эталон и попросил такую же анимацию горизонтального меню в cards 25 и 31.

Сделано:
- `createToolbar().Bar` получил общий FLIP-pass (`useToolbarFlip`): при изменении order/visibility/density элементы получают временный `translate(dx,dy)` и возвращаются через `transform 180ms ease`;
- card 25 and card 31 используют стандартный `Toolbar.Bar`, поэтому получили анимацию без копирования stand-only `Qa30AnimatedMenuBar`;
- card 30 оставлен эталоном и не переписывался;
- публичный API `createToolbar`, `ToolbarItem`, `ToolbarConfig` не менялся.

Проверка:
- `npx tsc -p tsconfig.qa-check.json --noEmit`;
- `npm run testjest -- --runInBand createToolbar.test.ts`;
- full test/build перед публикацией v1.0.40.

Оценка пользы:
- UI-польза: high для cards 25/31, потому order/density changes теперь визуально читаются так же, как в card 30;
- архитектурная польза: medium/high, потому поведение находится в shared `Toolbar.Bar`, а не в каждом stand/example отдельно;
- performance-польза: low/medium, это не ускорение вычислений, а FLIP-анимация с одним layout read pass на изменение меню.