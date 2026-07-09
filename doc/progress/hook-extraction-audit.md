# Hook extraction audit (API-возвращающие хуки)

Дата: 2026-07-09.

Задача (надиктовка): пройти по всему коду фронт-библиотеки и осмысленно найти места,
которые стоит вынести в `use*`/`create*` хуки, где хук **возвращает API** — методы,
которые отдают X, Y, размеры, «сколько», snapshot и т.п. Не «работа ради работы»:
каждый кандидат обязан устранять реальный императивный код/дублирование и иметь
реального consumer (QA card / test / app), иначе он отклоняется.

Метод: multi-agent проход. 7 finder-агентов по подсистемам (chart, menu, grid,
dnd-geometry, replay-logs, settings/params/input, utils-core) → на каждый найденный
кандидат отдельный adversarial critic (проверка фактов grep'ом, сверка с уже
сделанным и запрещённым списком). Всего 27 агентов, 0 ошибок. Итог: 7 кандидатов
прошли verify (3 do-now, 4 parked), 13 отклонено.

Критерий осмысленности (из надиктовки): хочешь получить X,Y/размер/счётчик →
правильный хук отдаёт **метод**, который это возвращает (`getSize()`, `getXY()`,
`toPixel(v)`, `count()`, `isDirty()`). Не рефактор ради стиля.

## Сверка с уже сделанным / запрещённым

Проход НЕ переоткрывает уже сделанное: `useKeyboard`, `useMiniLogsTable`,
`useParamsEditorController`, `useSettingsDialogController`, `useFloatingWindowController`,
`useRightMenuController`, `createLogsController`/`useLogsTableController`/
`useLogsNotificationsController`, `useTextInputPanel`/`useFileInputPanel`, section/density
registries, `createSearchHistory`, `createUiSlot`, `columnState` `createUpdateApi` и др.
И НЕ предлагает запрещённое без consumer: `FResizableReact` hook, `memoryStore` core
rewrite, `PageVisibilityProvider` в обычный UI, `StickerMenu` shared primitive, `DragBox`
broad rewrite. QA card 25 (эталонный toolbar, ~qa.tsx:603) — не трогать.

---

## Прошли verify — DO NOW (3)

### 1. `useResizeObserver` / `useElementSize` — `MyResizeObserver.tsx`

- Эффективность: medium; простота: simple; риск: low.
- Императив сейчас: `CResizeObserver` — это класс + модульный синглтон
  `global_resizeObserver`, чисто side-effect (`add()`/`delete()`), **без React-хука**,
  который бы отдавал измерения.
- Реальный consumer: `qa.tsx` `ResizeBugRepro` (объявлен ~1076, рендерится ~1723)
  вручную городит `new ResizeObserver` + `rAF` + `getBoundingClientRect` +
  `disconnect` в `useState`. Это **не** эталонная card 25.
- Также `REFACTOR_PLAN.md` (строки 187/209/221/309) явно просит `useElementSize`
  вместо ручного `MyResizeObserver` цикла.
- API, который вернёт хук: `{ width, height, getSize(), ref/bind }` — ровно «хочу
  размер → получаю метод/значение».
- Подход: хук оборачивает существующий синглтон `CResizeObserver`, поэтому
  `setResizeableElement`/вызовы из `ParamsEditor` остаются нетронутыми → малый surface.
- Оговорки verify: только один чистый consumer (QA card); упомянутые «места
  переиспользования» (FloatingWindow читает x/y для clamp, не размер; chart/agGrid
  имеют свои ResizeObserver, но сложные) чисто не переходят на width/height API —
  не завышать охват.
- Проверка: `tsc` + `jest`; `ResizeBugRepro` переведён на хук, width/height
  обновляются при ресайзе на стенде; старый `setResizeableElement` путь не сломан.

### 2. `useLogsPageTable` / `useLogsFullTableController` — `logs.tsx`

- Эффективность: medium; простота: medium; риск: medium.
- Императив сейчас: `PageLogs` гоняет ag-grid императивно через `apiGrid` ref;
  блок importance-filter `setFilterModel` **написан дважды** (эффект `updateBy(setting)`
  ~92-103 И `onGridReady` ~160-167); `sizeColumnsToFit()` на update; `applyTransactionAsync`
  append (~105-112).
- Реальный live consumer: `qa.tsx` card 9 (монтирует `<PageLogs />` ~94; assertion ~1765).
- Это последняя logs-таблица, не переведённая на controller-паттерн (MiniLogs и
  `logsContext.LogsTable` — отдельные поверхности, уже сделаны).
- API: `getApi()`, `fit()`, `applyImportanceFilter(min)`, `appendRow(row)`,
  `onGridReady`, `columnDefs`, `gridProps`. Дедуп filter-логики в один метод.
- Подход: `PageLogs` остаётся тонким wrapper; row identity сохранить.
- Проверка: card 9 + стенд, особое внимание filter-timing и `applyTransactionAsync` append.

### 3. `useCacheMapPersistence` — `cache.ts`

- Эффективность: medium; простота: simple; риск: low.
- Императив сейчас: тройное **точное** дублирование
  `useEffect(() => { void cache.load(); return cache.onDirty(() => cache.saveDebounced(300)); }, [])`
  в `qa.tsx`: `SettingsDialogDemo` (1221-1224), `UiSlotDemo` (1247-1251),
  `ToolbarDemo` (1329-1332). `ToolbarDemo` (~1320) — отдельная демка, **не** эталонная
  card 25 (та ~603).
- Совпадает с задокументированным app-контрактом `doc/EXAMPLE_USAGE.md:85-99`,
  `doc/wenay-react2.md:54-63`.
- API: `{ isDirty(), flush(), save(), reload() }`. Внимание: cache отдаёт `load()`,
  а не `reload()` — `reload()` сделать явным alias/ре-экспортом `load()`, не выдумывать
  несуществующий метод.
- Границы: аддитивная обёртка, **НЕ** `memoryStore` rewrite; scope строго
  `load` + `onDirty`→`saveDebounced`, без pagehide/visibility flush.
- Каждый сайт схлопывает ~2-3 строки — польза реальная, но скромная (поэтому
  medium, не high).
- Проверка: card 20/21 и toolbar demo — persistence переживает reload; card 25 не трогать.

---

## Прошли verify — PARKED (4)

Реальны, но сейчас не do-now; причина зафиксирована, вернуть при условии.

### `useChartCanvas` — `myChart/1/myChartTest.tsx`
- Boilerplate реален (`ChartDemo`: `chartRef`+`containerRef`, `useEffect` с
  `createChartCanvas`/`appendData`/`jumpToEnd`/`setInterval`/`destroy`, кнопки через
  `chartRef.current?.method` null-check). `createChartCanvas` уже сам возвращает
  API-объект — хук лишь добавил бы lifecycle и стабильные non-null методы (паттерн
  как `useFloatingWindowController`). API: `containerRef, appendData, clearData,
  scrollX, zoomX, jumpToStart/End/Index, setAutoScaleY, setShowTimeAxis/PriceAxis, draw()`.
- **Почему parked**: единственный consumer — сам example-компонент `ChartDemo`, который
  **не отрендерен ни в одной карточке/тесте** → нельзя проверить на стенде (working-style
  требует tsc+стенд). Польза чисто косметическая/демонстрационная.
- Поправки к автору кандидата: `redraw()` не существует (в `IChartCanvas` это `draw()`);
  `ready` в интерфейсе нет — не тащить в API.
- Вернуть как do-now, когда `ChartDemo` реально появится в карточке/тесте.

### `useContextMenuGesture` — `menuMouse.tsx`
- Дублирование реально: gesture-распознавание (порог 0.05, long-press 300ms,
  right/dbl-click) в `menuMouse` `Layer` (~348-380) и в `menuR` `MenuR` (~55-107).
- **Почему parked**: `menuR.MenuR` — **мёртвый код** (нет app-consumer; заявленный тест
  на самом деле импортит `RightMenu.tsx`, не `menuR`). Единственный live consumer —
  `Layer`. Делить хук с мёртвым кодом — мнимый выигрыш; честный фикс той половины —
  удалить `menuR`. Touch-семантика тонкая, card 4 гоняет только mouse-путь → риск
  touch-регрессии без нового consumer. Это часть уже-parked context-menu controller split.
- Вернуть при: оживлении `menuR` с touch-тестами ИЛИ новом live touch-consumer.

### `columnState.api.reorderPreview(order, key, to)` — `columnState.ts`
- Метод на существующем `createColumnState` контроллере (не новый хук): экспонировать
  move+fixed-pinning preview (+опц. `applyFixedPinning(order)`). Тройное дублирование
  идиомы `filter(!fixed)+pinFixed-splice`: `columnState.ts:140-145`,
  `ColumnsMenu.tsx:187-198`, `Toolbar.tsx:448-459`. Реальный consumer — `ColumnsMenu`
  (qa cards 30/31).
- **Почему parked**: метод дедупит только 1 из 3 копий (копия `Toolbar` — другой
  контроллер над своими `opts.items`, честно вне охвата), и пересекается лишь pin-половина
  → польза low. Брать, если появится общий reorder-контракт для обоих контроллеров.

### `useResizeableFit` — `ParamsEditor.tsx`
- 4x **байт-идентичный** inline ref-callback (`InputTime` 113-117, `InputList` 175-179,
  `InputNumber` 212-216, `InputListArray` 269-273): `setResizeableElement(el)` +
  `removeResizeableElement` cleanup. Consumer — `ParamsEditor` (qa cards 7 и 19).
  Также чинит minor unmount-dispose leak.
- **Почему parked / поправка**: это **не** `use*`-хук — все 4 сайта внутри обычных
  функций-хелперов (`InputTime`/`InputList`/`InputNumber`/`InputListArray`), а не
  компонентов, там нельзя вызывать хуки. Правильная форма — общий **module-level
  стабильный bind callback-ref** (`bind(el)` ставит `setResizeableElement`, возвращает
  `()=>removeResizeableElement`). Не пересекается с done (`useParamsEditorController`
  покрывает только draft/notify) и forbidden (`FResizableReact` — другое). low risk,
  узкая польза — можно сделать как маленький shared primitive отдельным микро-passом.

---

## Отклонено (13) — кратко, для покрытия

- `useChartEngine` (`chartEngineReact.tsx`) — **parked/не conscious**: императивная
  проводка реальна, но НИ ОДИН consumer не читает обратно координатный API
  (`xToPixel/pixelToValue/getViewport/getCrosshair/getPanelCount`); обе точки
  (`qa.tsx:1707` card 6, `use.tsx:187`) рендерят `<MyChartEngine/>` без пропов и ничего
  не считывают. Координатный хук был бы спекулятивным. Вернуть, если появится стенд/тест
  на chart canvas lifecycle или реальный consumer координат.
- `useMenuPlacement` (`menu.tsx`) — **skip**: реальный `useLayoutEffect` + `getBoundingClientRect`,
  но ровно один in-file consumer и ноль дублирования; `RightMenu`/`LeftModal` клампят
  по другой семантике (parent rect / другая ось). Извлекать нечего дедуплицировать.
- `useSidebarMenuController` (`LeftModal.tsx`) — **parked**: движок реален, но заявленные
  consumers ложны (в `use.tsx` — закомментированный блок; `Parameters.tsx` не импортит
  `LeftModal`). Нет live consumer. Совпадает с уже-parked LeftModal split.
- `useStickerMenuDrag` (`StickerMenu.tsx`) — **skip** (overlap forbidden): drag реален,
  но consumer'ов нет (только barrel export + docs). `StickerMenu` в запрещённом списке.
- `useColumnDotsGestures` (`ColumnDots.tsx`) — **skip**: жестовая логика реальна, но
  единственный consumer — card 29, второго нет. Извлечение = вью-модель без внешнего
  X/Y/size/count consumer.
- `useCardModel` (`CardList.tsx`) — **skip**: single-use presentation-деривация (~15 строк),
  без дублирования, consumer только сам `CardList` (card 29). Спекулятивно.
- `useDragArea` / `getXY on DragArea` (`DragArea.tsx`) — **skip** (overlap): у `DragArea`
  нет render-consumers (только export + docs); дублирует `useDraggable`. Мёртвая поверхность.
- `createLogsStore` / `useLogsStore` (`logsContext.tsx`) — **parked** (overlap): store
  реален и дублирует `logsController`, но новых consumer'ов нет (только same-file демо +
  1 unit-test). Это migration/deprecation-решение по `logsContext`, а не быстрый split.
- `useInputAutoStep` (`ParamsEditor.tsx`) — **parked** (overlap): apply-only DOM behavior,
  1 consumer (`InputNumber`), геттеров не читает; есть minor unmount-dispose leak (стоит
  починить точечно). Не тянет на API-хук.
- `useNumericInputDraft` (`ParamsEditor.tsx`) — **parked**: WeakMap-черновик реален, но
  `InputNumber` вызывается как обычная функция (`InputNumber(set,val,range)`, не JSX) →
  хук внутри вызвать нельзя. Блокер до превращения `InputNumber` в компонент.
- `useCallbackHubEffect` (`callbackHub.ts`) — **skip**: `createCallbackHub.on` уже
  возвращает unsubscribe, годный прямо в `useEffect`; обёртка не нужна; 1 demo-consumer.
- `useObservableMap` (`observableMap.ts`) — **skip**: чистый 45-строчный data-layer,
  ноль UI-императива/дублирования; подписчики только внутренние + тесты.
- `usePageVisibility` (`pageVisibilityContext.tsx`) — **parked** (overlap forbidden):
  дублирования нет (`PageVisibilityProvider` уже инкапсулирует listener); хук был бы просто
  `useContext`; consumer'ов ноль. В запрещённом «без consumer» списке.

## Рекомендованный порядок

1. `useCacheMapPersistence` — самый безопасный (simple/low), аддитивный, 3 реальных consumer.
2. `useResizeObserver`/`useElementSize` — simple/low, явный запрос в REFACTOR_PLAN + живой consumer.
3. `useLogsPageTable` — medium/medium, последняя logs-таблица вне controller-паттерна; делать аккуратно (filter-timing).

Каждую задачу — по правилам `doc/target/README.md`: старое имя оставить compatibility
wrapper, публичный API не менять, проверять `tsc -p tsconfig.qa-check.json --noEmit` +
`jest` + сборку + стенд. Версию не бампать, не публиковать, не пушить.
