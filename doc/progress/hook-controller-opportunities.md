# Hook/controller opportunities audit

Дата: 2026-07-09.

Задача: пройтись по коду библиотеки и записать места, где есть смысл продолжать переводить функционал в стиль `use*` hook / `create*` controller + тонкий visual wrapper. Не записывать задачи ради задач: у каждой позиции есть оценка эффективности, простоты и риска.

## Проверенные зоны

- `src/common/src/logs/miniLogs.tsx`
- `src/common/src/logs/logs.tsx`
- `src/common/src/logs/logsContext.tsx`
- `src/common/src/components/ParamsEditor.tsx`
- `src/common/src/components/Other.tsx`
- `src/common/src/components/Settings/SettingsDialog.tsx`
- `src/common/src/menu/menu.tsx`
- `src/common/src/menu/menuMouse.tsx`
- `src/common/src/components/Menu/RightMenu.tsx`
- `src/common/src/components/Menu/StickerMenu.tsx`
- `src/common/src/components/Dnd/FloatingWindow.tsx`
- `src/common/src/components/Dnd/Resizable.tsx`
- `src/common/src/hooks/useDraggable.tsx`
- `src/common/src/components/MyResizeObserver.tsx`
- QA usage references in `src/common/testUseReact/qa.tsx`

## Execution updates

### MiniLogs layered redesign — done

Сделано:
- добавлены `useMiniLogsTable`, `MiniLogsView`, `MiniLogsTable` и compatibility wrapper `MiniLogs`;
- hook возвращает table props, `gridProps` alias, `apiRef`, `fit`, `getApi`, `withApi`, `onGridReady`, `onGridPreDestroyed`, `onCellMouseDown`;
- сохранён старый `rowData` path, чтобы не менять row identity для повторяющихся log `id`;
- MiniLogs-owned store/append/history не добавлялись: реального consumer для этого пока нет;
- обновлены `doc/EXAMPLE_USAGE.md`, `doc/wenay-react2.md`, `doc/wenay-react2-rare.md`, QA card 9 и добавлен `__test/miniLogs.test.tsx`.

Проверено:
- `npm run testjest -- --runInBand miniLogs.test.tsx`;
- `npx tsc -p tsconfig.qa-check.json --noEmit`;
- `npm run testjest -- --runInBand`;
- `npm run build`;
- `git diff --check`.

## Очередь полезных задач

### 1. MiniLogs layered redesign

Статус: выполнено; оставить как reference implementation для следующих hook/controller passes.

Что сделать:
- слой 1: `useMiniLogsTable(...)` или `createMiniLogsTableController(...)`, который готовит `columns`, `defaultColDef`, callbacks и grid contract;
- слой 2: `MiniLogsTable` / `MiniLogsView` как тонкий visual wrapper на `AgGridTable`;
- слой 3: совместимый `<MiniLogs data onClick />`.

Оценка:
- эффективность: medium/high;
- простота: medium;
- риск: medium.

Почему задача не высосана из пальца:
- текущий `MiniLogs` уже использует наши grid helpers, но сам API остаётся плоским компонентом;
- это небольшой публичный компонент, его можно проверить отдельно без переписывания всего logger API.

Проверка:
- найти или добавить QA usage для `MiniLogs`;
- проверить отображение времени, click callback, fit/resize таблицы.

### 2. ParamsEditor / ParamsEdit controller split

Статус: first controller layer done; full renderer/view split deferred.

Что сделано:
- добавлен `useParamsEditorController(...)` в `ParamsEditor.tsx`;
- controller владеет mutable draft clone, immediate notify, delayed notify, expand callback и cleanup таймера;
- `ParamsEditorBase` использует controller, но сложная JSX-разметка rows/arrays/inputs не переписывалась;
- `ParamsEditor`, `ParamsEdit`, `ParamsArrayEdit` остались compatibility wrappers.

Что не сделано сейчас:
- `ParamsEditorView` / row-model split: слишком большой pass, высокий риск array mutation/resize/autostep UX;
- async load/save hook для `ParamsEdit`/`ParamsArrayEdit`: полезно только отдельным pass с policy tests;
- стили/плотность/buttons add/remove не трогались.

Оценка:
- эффективность: medium/high;
- простота: medium;
- риск: medium, потому что renderer остался на месте.

Проверка:
- `paramsEditorController.test.tsx`: draft clone isolation, delayed notify + unmount cleanup, current `onExpand` callback;
- QA card 7/10 остаются ручными regression points для обычного renderer/save behavior.

### 3. Logs API controller split

Статус: headless controller pass done; full UI split deferred.

Что видно сейчас:
- `logs.tsx` хранит global maps (`cashLogs`, `datumConst`, `datumMiniConst`), settings, rendering API, table UI and notification UI вместе;
- `logsContext.tsx` уже предлагает отдельный context-based logger, но это параллельный surface;
- `PageLogs` и `MiniLogs` уже переведены на `AgGridTable`; `LogsTable` из `logsContext.tsx` теперь тоже переведён на `AgGridTable` + `colDefCentered` без изменения context state;
- right-click copy action in `PageLogs` now has explicit `actionKey: "logs.copyCell"` for contextMenu action stats.

Что сделано:
- добавлен `src/common/src/logs/logsController.ts`;
- экспортированы `LogsApiOptions`, `LogsController`, `LogsControllerState`, `createLogsControllerState`, `createLogsController` через `logs.tsx`;
- `LogInput` / `LogEntry` остались в `logsController.ts`, но не re-export через общий `api.tsx`, потому эти имена уже заняты `logsContext.tsx`;
- вынесен headless state/API слой: `addLogs`, `limit/limitPer`, `num`, `getRows()`, `getMiniRows()`, `getLatest()`, `params.def/get/set`, update emitters;
- `getLogsApi`, `logsApi`, `PageLogs`, `MessageEventLogs`, `LogsPage`, `logsApi.React.*` оставлены compatibility wrappers;
- `logsContext.tsx` не объединялся с global logger.

Оценка:
- эффективность: high для headless controller;
- простота: medium;
- риск: medium, если UI не переписывать.

Дополнительный context logger pass:
- добавлены `useLogsTableController()` и `useLogsNotificationsController()`;
- `LogsTable` и `LogsNotifications` остались compatibility visual wrappers;
- provider state, localStorage settings, notification timers and visual styles не менялись.

Что пропустить:
- публичный конфликт имён `logsContext.LogInput/LogEntry` решать отдельно, если понадобится единый logger contract;
- merge/deprecate `logsContext.tsx` без отдельного решения;
- MiniLogs-owned store/history без реального consumer.
### 4. SettingsDialog controller split

Статус: first controller layer done; full view split deferred.

Что сделано:
- добавлен `useSettingsDialogController(props)`;
- controller владеет open/close, active/search, search history open/commit/pick/clear, expanded tree state, dotted tree cycle, nav resize state/commit, Escape handling and refs;
- `SettingsDialog` остался compatibility wrapper with the same JSX/portal/FloatingWindowBase/classes;
- pure tree/search helpers не переписывались;
- QA card 20 менять не нужно: он продолжает проверять старый visual wrapper.

Что пропущено:
- full `SettingsDialogView` split по файлам: риск выше пользы сейчас;
- переписывание `buildSettingsTree`/search helpers, registry, `settingsDialogLayout` store, `FloatingWindowBase`, CSS/tokens/default trigger;
- любые UX changes search history/divider/dotted tree control ради красивого split.

Оценка:
- эффективность: medium/high;
- простота: medium;
- риск: medium, снижен тем, что JSX и UX остались на месте.

Проверка:
- `settingsDialog.test.tsx`: old search/content/history regression + hook open/search/tree-cycle state;
- QA card 20: search history, outside blur close, dotted tree cycle, divider drag/keyboard/double-click reset, Escape behavior.
### 5. Menu action controller + action-level stats

Статус: action-level stats done; полный action-controller split отложен как более крупный pass.

Что сделано:
- `MenuItemStrict.actionKey?: string | null` стал стабильным diagnostics-key контрактом;
- `MenuActionEvent` / `MenuActionHandler` прокинуты через `Menu`, nested menu layers и `contextMenu.Layer`;
- `contextMenu.stats` теперь считает `actionTotals` и `actions[actionKey]` для click/ok/error/task/submenu/func/focus outcomes;
- stats не падают обратно на `name`/index/source, не хранят labels и errors;
- QA card 4 использует `qa4.*` action keys.

Что осталось отдельной задачей:
- выделить `createMenuActionController(...)` или `useMenuAction(...)`, если нужен более тонкий визуальный слой;
- перенести исполнение item action/progress/loading cleanup из visual components без изменения DOM/classes;
- добавить расширенные async-error tests, если будет выделяться controller.

Оценка выполненного pass:
- эффективность: medium/high;
- простота: medium;
- риск: medium, снижен явным `actionKey` и focused tests.

Проверка:
- unit tests: direct stats, reset/onChange, legacy Layer, keyed action, unkeyed action, keyed submenu;
- QA card 4: right-click menu open/close/click/submenu behavior.

### 6. FloatingWindow / DnD controller split

Статус: first controller layer done; pointer-drag migration deferred.

Что сделано:
- добавлен `useFloatingWindowController(...)` в `FloatingWindow.tsx`;
- controller владеет saved geometry (`position/size`), update counter, z-index stack, drag active state, mouse/touch header handlers, resize callbacks, viewport clamp and persistence `touch`;
- экспортированы `FloatingWindowProps`, `FloatingWindowPosition`, `FloatingWindowSize`, `FloatingWindowSavedGeometry`, `FloatingWindowControllerOptions`, `FloatingWindowController`;
- `FloatingWindowBase` остался compatibility visual wrapper над тем же `Rnd`, с теми же DOM/classes/header/close/overlay paths;
- `FloatingWindow` memo-child wrapper сохранён;
- `openWindows` registry уже использует `createUpdateApi`, отдельный `useWindowStack` не выделялся, чтобы не раздувать API без внешнего consumer.

Что не сделано сейчас:
- перенос drag на `useDraggableApi`/pointer-drag не делался: семантика другая (absolute `x/y`, limit clamp, touch id, z-index, persisted map), риск visual regression высокий;
- `DragBox` не трогался: это отдельный legacy/compat path;
- `SettingsDialog` JSX/portal/classes не менялись, он продолжает использовать `FloatingWindowBase`.

Оценка выполненного pass:
- эффективность: medium/high;
- простота: medium/hard;
- риск: medium, потому что DOM/Rnd/gesture semantics сохранены.

Проверка:
- `floatingWindowController.test.tsx`: restore saved geometry, resize stop commits/touches map, drag clamp and touch, live resize `onUpdate` forwarding;
- manual QA still needed: card 2 drag/resize/z-index/persisted geometry/no listener spam;
- card 20 SettingsDialog remains regression point because it uses `FloatingWindowBase`.

### 7. logsContext migration or deprecation

Статус: полезно решить направление, но не обязательно переписывать.

Что видно сейчас:
- `logsContext.tsx` содержит свою локальную `memoryGetOrCreate` на `localStorage`;
- `LogsTable` использует raw `AgGridReact`, хотя основной путь уже перешёл на `AgGridTable`;
- это выглядит как старый альтернативный logger implementation.

Варианты:
- мигрировать на общий `memoryStore`, `AgGridTable`, `colDefCentered` и общий logs controller;
- или пометить как deprecated/compat example, чтобы не было двух “правильных” logger API.

Оценка:
- эффективность: medium;
- простота: hard;
- риск: medium/high.

Почему не делать как quick fix:
- простая замена `AgGridReact` на `AgGridTable` не решает дублирование logger architecture;
- прямой `localStorage` лучше убирать вместе с решением о будущем этого модуля.

### 8. RightMenu controller cleanup

Статус: hook/controller split done for `DropdownMenu`; deeper registry rewrite skipped as low-effectiveness for now.

Что сделано:
- добавлен `useRightMenuController(...)` для open/fixed/select/submenu/drag-position state;
- `DropdownMenu` стал compatibility visual wrapper поверх hook/controller state;
- `createRightMenuController().Render` сохранён и продолжает рендерить `DropdownMenu`;
- docs и usage examples показывают hook для кастомного DOM, а default wrapper для старого вида.

Что пропущено:
- registry `createRightMenuController` не переводился на `createUpdateApi`: текущий single-render setter уже покрывает реальный consumer/test, а переписывание массива элементов сейчас даст мало пользы при риске совместимости;
- drag save проверен компиляцией и сохранением старого кода, но без отдельного DOM drag unit-test из-за сложности jsdom geometry.

Оценка:
- эффективность: medium;
- простота: medium;
- риск: low/medium после сохранения wrapper API.

Проверка:
- `createRightMenuController` mounted Render rerender;
- `useRightMenuController` direct open/fixed/select/submenu state;
- `DropdownMenu` hover submenu and fixed toggle compatibility.

### 9. Resizable primitive hook

Статус: skipped for now; low-effectiveness without consumers.

Что проверено:
- `rg` по `src`/`__test` нашёл `FResizableReact` только в export/docs and `mapResiReact` persistence wiring через `memoryStore`;
- реальных render-consumers, которые проверили бы новый `useResizableSave`, нет.

Почему не делать:
- hook был бы speculative refactor без проверки behavior;
- `FResizableReact` маленький compatibility wrapper, а риск сломать persisted size/save path выше пользы;
- возвращаться стоит только когда появится consumer или новая resize-секция в стенде.

Оценка:
- эффективность: low сейчас;
- простота: medium;
- риск: medium.

## Задачи, которые сейчас лучше не делать

### memoryStore core helper

Статус: пропускать без конкретного test/consumer.

Причина:
- `memoryStore` является core persistence helper для toolbar/columnState/UiSlot/search history/settings/window/right menu flows;
- `memoryUpdate` можно технически обернуть через `createUpdateApi(cur)`, но это почти не улучшит публичный contract;
- ошибка здесь ударит сразу по нескольким primitives.

Когда возвращаться:
- если появится test на stored object subscription + `memoryUpdate` + dirty event;
- если вводим отдельный стандарт “memory object update controller”.

### PageVisibilityProvider

Статус: не внедрять в обычный UI ради helper.

Причина:
- полезен только для polling, replay/canvas или тяжёлых анимаций, которые должны паузиться в hidden tab;
- без конкретного consumer это будет искусственное усложнение.

### StickerMenu

Статус: не делать shared-standard pass сейчас.

Причина:
- выглядит как standalone/demo-like side menu с hardcoded items and styles;
- прежде чем переписывать, нужно решить: это публичный primitive или legacy/demo.

Если делать:
- сначала определить API и usage card;
- затем уже `useStickerMenuController` + visual wrapper.

### DragBox broad rewrite

Статус: не делать вместе с FloatingWindow.

Причина:
- `DragBox` legacy/compat and low-level;
- новый код лучше вести через `useDraggableApi` или будущий `usePointerDrag`, но существующий compatibility path не ломать без consumer-driven миграции.

## Рекомендуемый порядок выполнения

Текущий hook/controller-first backlog из этого audit-pass выполнен настолько, насколько это осмысленно без новых consumers:

1. Logs API/controller split — done.
2. SettingsDialog controller split — done.
3. FloatingWindow first controller layer — done.
4. Resizable hook — skipped until real consumers appear.

Дальше не выполнять задачи ради задачи: `memoryStore`, обычный UI + `PageVisibilityProvider`, `StickerMenu`, `DragBox` broad rewrite and `FResizableReact` hook требуют отдельного consumer/test сценария.