# Код-ревью библиотеки wenay-react2 (2026-07-02)

> **Статус применения (2026-07-02): все находки исправлены** (проверено `tsc --noEmit`; jest-тестов в репо нет — нужна проверка на стенде `localhost:3010`), **кроме осознанно отложенного:**
> - `logs3.tsx` мёртвый generic `tLogs<T>`/`tLogsInput<T>` и `mapMemory` `key: any` — тип-брейкинг, только в мажоре (как и рекомендовано ниже);
> - `useOutside.tsx` Button — запись `saveStatus` внутри state-апдейтера оставлена (идемпотентна, вынос удлиняет код);
> - `chartEngineReact.tsx` `(activePanel?.left ?? 0)` в onWheel — оставлено (сейчас no-op, станет нужным при панелях с `left != 0`);
> - `styleGrid.ts` — сделана только идемпотентность; подозрительный селектор не менялся (нужна визуальная проверка на стенде, возможно правила мёртвые при Theming API v33+);
> - `ParametersEngine.tsx` `@ts-ignore` перед `isDate(value)` — `isDate` импортируется из wenay-common2, type guard надо типизировать там.
>
> Поведенческие изменения для проверки на стенде: ресайз панелей chart мышью (нижняя граница последней панели больше не тянется — она всегда добирает остаток), тач-драг Drag22 (сброс на жест, как у мыши), уведомления logs3 (каждое скрывается по своему таймеру), прогресс в меню после array-onClick исчезает через 500 мс, `Modal2` принимает `menuKey` вместо нерабочего `key`.

> Полное ревью `src/` (~9,7 тыс. строк) с приоритетами владельца: **лаконичность**, **производительность**, **дженерики вместо лишних рантайм-проверок**. Всё, что уже зафиксировано в `REFACTOR_PLAN.md` (сделано или осознанно отложено), сюда **не включено** — это только новые находки.
>
> Метод: 5 параллельных ревью-агентов по зонам (chart-движок; DnD+хуки; logs+меню; Parameters+Modal; utils+grid+API), каждый сверялся с REFACTOR_PLAN перед отчётом.
>
> Правило прежнее: публичный API не ломать; каждая правка проверяется `tsc --noEmit` + стенд `localhost:3010`.
>
> **Про «мёртвый код»:** любой экспорт — это публичный API, даже если внутри репо он никем не используется. Пометка «удалить» в этом отчёте относится **только** к внутреннему коду (локальные функции, refs, ветки, импорты, закомментированные куски). Для публичных экспортов максимум — JSDoc `@deprecated`; удаление — только в мажоре. Все находки ниже перепроверены на это: `getUpdateTable`, `getComparatorGrid`, `DraggableOutlineDiv`, `StyleCSSHeadGrid` — только `@deprecated`; `SettingLogsReact` (logs.tsx:43) — локальная const внутри `getLogsApi`, наружу торчит только свойство `Setting` — его контракт сохраняется; `onMouseUp` (chartEngineReact.tsx:789) — локальная незарегистрированная функция; `export * from './StickerMenu'` реэкспортирует ничего (в файле только default) — сам публичный default-реэкспорт строкой выше остаётся.

## Топ-10 по соотношению эффект/риск

| # | Находка | Файл | Категория | Риск |
|---|---------|------|-----------|------|
| 1 | `subscribe` пересоздаётся каждый рендер → переподписка useSyncExternalStore + сброс `version` через `map3.delete` → лишний форс-ререндер у каждого подписчика | updateBy.ts:93-107 | баг+перф | средний |
| 2 | Ресайз панелей мышью — no-op: `resizePanel` меняет `heightPct`, но `layoutPanels` не вызывается | chartEngineReact.tsx:762 | баг | низкий |
| 3 | Drag22: `onStop` стреляет на маунте (гейт `wasDragging` из K1 есть в Drag2, но не портирован сюда) | RNDFunc3.tsx:455-459 | баг | низкий |
| 4 | Modal2: проп `key` вырезается React'ом — всегда `undefined`, контракт «несколько меню по ключам» мёртв | LeftModal.tsx:377,388 | баг | низкий |
| 5 | ParametersReact: `useMemo(..., [data.params])` замораживает `onChange`/`onExpand` — stale closure | ParametersEngine.tsx:312-316 | баг | средний |
| 6 | Крэш MessageEventLogs: `datumMiniConst.last[0]` без guard при `params.set()` до первого лога | logs.tsx:249-256 | баг | низкий |
| 7 | logs3: cleanup эффекта отменяет таймер удаления предыдущего уведомления — авто-скрывается только последнее | logs3.tsx:261-276 | баг | низкий |
| 8 | Chart: `updatePanels` (полный min/max-скан) дважды на событие и на каждый mousemove без нажатия | chartEngineReact.tsx:957,743 | перф | низкий |
| 9 | Chart `addData`: полный O(n) rebuild всех чанков на каждом пересечении границы чанка → O(n²) на стриме | chartEngineReact.tsx:115-135 | перф | низк.-средн. |
| 10 | Условный вызов хука `useContext(A) ?? useContext(B)` + избыточный дублирующий контекст | ModalContextProvider.tsx:77-79 | баг+лакон. | низкий |

---

## 1. Баги

### Ядро реактивности (updateBy.ts)

- **updateBy.ts:93-107, 102, 117** — `subscribe` — инлайн-стрелка, новая на каждом рендере → React делает unsubscribe→subscribe каждый рендер. При unsubscribe срабатывает `if (listeners.size === 0) map3.delete(a)` — состояние с `version` уничтожается и пересоздаётся с 0, `getSnapshot` меняет значение → лишний форс-ререндер каждый раз, когда `version > 0`. **Фикс:** `useCallback` с deps `[a, f]`; удалить оба `map3.delete(a)` (map3 — WeakMap, GC соберёт сам, сброс version вреден). Риск: средний (ядро — стенд + tsc).
- **updateBy.ts:34-57,149-154** — две параллельные системы подписок: `renderByLast`/`renderByRevers` действуют только на React-подписчиков (`state.listeners`), императивные `on`-подписчики всегда вызываются все и в прямом порядке. **Фикс:** унифицировать или задокументировать. Риск: средний (минимум — комментарий).

### Chart

- **chartEngineReact.tsx:762-767 + 292-311 + 1041** — `DragMode.ResizePanel` меняет только `p.heightPct`; пиксельные `top`/`height` пересчитываются лишь в ResizeObserver контейнера → фича `resizable: true` визуально не работает. Заодно ресайз последней панели всегда затирается (`layoutPanels` перезаписывает её `heightPct`). **Фикс:** после `resizePanel(...)` вызвать `panelManager.layoutPanels(cW, cH)`; для последней панели — ресайзить предыдущую с обратным знаком. Риск: низкий.

### DnD

- **RNDFunc3.tsx:455-459 (Drag22)** — `onStop?.()` при `!draggingMouse && !draggingTouch` → срабатывает на маунте и при смене identity колбэков. Реально проявляется: `LeftModal.tsx:270` получает `stop()` без единого драга. **Фикс:** портировать гейт `wasDragging` из `RNDFunc.tsx:39-45`. Риск: низкий.
- **RNDFunc3.tsx:533-541 vs 544-554 (Drag22)** — асимметрия мыши и тача: `handleMouseDown` сбрасывает `posRef` в (0,0), `handleTouchStart` — нет → повторные тач-драги накапливают смещение (дрейф). **Фикс:** обнулять `posRef` и в тач-ветке; заодно после обнуления `posRef.current.x - e.clientX` = `-e.clientX` (минус три строки). Риск: средний (меняет поведение тача, но текущее — дрейф).
- **RNDFunc3.tsx:316-317** — `onResizeStop`: `+height + delta.height` при `height: string` (`"100%"` допустим типом `tSize`) даёт `NaN` → окно после первого ресайза ломается. **Фикс:** брать `elementRef.offsetWidth/offsetHeight` из аргументов колбэка react-rnd. Риск: средний (числовые размеры не изменятся).
- **RNDFunc3.tsx:525 (Drag22), RNDFunc.tsx:128 (Drag2)** — колбэки в deps эффекта: при inline-колбэках потребителя эффект на каждый mousemove переподписывает document-слушатели и **повторно вызывает `onStart?.()`** (multi-fire за один жест). **Фикс:** паттерн `limitRef` уже есть в этом файле — положить 4 колбэка в ref, deps сузить до `[draggingMouse, draggingTouch]`. Риск: низкий.

### Modal / Parameters

- **LeftModal.tsx:377,388 (Modal2)** — `key` — зарезервированный проп React, в компонент не попадает → `setMenu(menu, key)` всегда пишет под `"base"`. **Фикс:** добавить `menuKey?: string`, `key` оставить в типе с `@deprecated`. Риск: низкий (он и так не работал).
- **ParametersEngine.tsx:312-316** — `useMemo(..., [data.params])` замораживает `data.onChange`/`data.onExpand`/`expandStatus`: если потребитель пересоздаёт `onChange`, а `params` по identity не меняет — изменения уходят в устаревший колбэк. **Фикс:** колбэки в ref (обновлять каждый рендер), внутрь — стабильные обёртки. Риск: средний (стенд).
- **ParametersEngine.tsx:329-334** — синхронизация `p → myParams` через `useEffect + Refresh()`: кадр устаревших данных + лишний ре-рендер на каждое обновление props. **Фикс:** синхронизировать во время рендера (`if (myParams.current !== p) myParams.current = p`), эффект удалить. Риск: низкий/средний.
- **ModalContextProvider.tsx:77-79** — `useContext(ModalApiContext) ?? useContext(ModalContext)`: правая часть вычисляется условно (нарушение Rules of Hooks). При этом `ModalApiContext` полностью дублирует `ModalContext` (оба провайдера несут одно значение). **Фикс:** оставить один контекст, `useModalApi = () => useContext(ModalContext)`. Поведение байт-в-байт то же. Риск: низкий.
- **LeftModal.tsx:101-126** — `animateToPosition` не отменяется при unmount (`setX`/`setOpen` на размонтированном, цепочка таймеров живёт до target); на :122 `animate()` без `await` — внешний `await animate()` ждёт только первый шаг. **Фикс:** флаг отмены в ref + cleanup; убрать фиктивные await. Делать вместе с отложенными LeftModal-пунктами плана (нужна QA-карточка). Риск: средний.
- **LeftModal.tsx:352-363** — `currentMenuLength` считается **до** `menuStore.set(key, ...)` и включает старые элементы того же ключа → повторный `setMenu` с тем же key сдвигает дефолтные цвета. **Фикс:** `getAllMenuItems().length - (menuStore.get(key)?.length ?? 0)`. Риск: низкий.
- **Parameters.tsx:51** — `commentary.join("\n")` в HTML схлопывается в одну строку. **Фикс:** `whiteSpace: "pre-line"`. Риск: низкий.

### Logs / Меню

- **logs.tsx:249-256** — колбэк `updateBy(datumMiniConst, cb)` берёт `datumMiniConst.last[0]` без guard: `logsApi.params.set()` до первого лога → крэш (`last.var` или `logs.var` в Message). В PageLogs guard есть, здесь — нет. **Фикс:** `if (!last) return;`. Риск: низкий.
- **logs3.tsx:261-276** — cleanup эффекта (deps `[logs, minVarMessage, timeShow]`) отменяет таймер удаления предыдущего уведомления → авто-скрывается только последнее, остальные копятся; смена `minVarMessage`/`timeShow` повторно добавляет тот же лог. **Фикс:** таймеры per-item в ref (чистить все только на unmount), гейт по `newestLog.num`. Риск: низкий.
- **menuR.tsx:34** — координаты тача `let x = 0, y = 0` в теле компонента: любой ререндер между touchstart и touchmove обнуляет их, ломая детект «скролл vs долгое нажатие». **Фикс:** `useRef`. Риск: низкий.
- **StickerMenu.tsx:61-71,88-90** — меню двигается с указателем → после mouseup над элементом стреляет `click`: `finishDrag` переключил `isOpen`, `handleClick` откатывает обратно. **Фикс:** ref-флаг `movedRef` при `|delta| > порога`, игнорировать следующий click. Риск: низкий.
- **logs.tsx:259-264** — при ≥8 уведомлениях в `tt` истёкшие остаются на экране (`renderBy` только `if length < max`). **Фикс:** безусловный `renderBy(tt, 100)` (дебаунс в updateBy сохранит защиту от шторма). Проверить на стенде. Риск: средний.

### Grid / стили

- **styleGrid.ts:48-61** — `StyleCSSHeadGridEdit` не идемпотентен (каждый вызов добавляет новый `<style>` в head); селектор `.ag-theme-alpine-dark .ag-theme-alpine ...` требует вложенности alpine в alpine-dark — похоже на потерянную запятую; при Theming API v33+ (`GridStyleDefault`) классы `.ag-theme-alpine*` вообще не вешаются — правила, вероятно, мёртвые. **Фикс:** идемпотентность через переиспользование одного style-элемента; проверить на стенде применимость → если мёртво, `@deprecated`. Риск: низкий/средний.
- **agGrid4.tsx:129-139** — RAF из ResizeObserver не отменяется в cleanup (queued `fit()` может дёрнуть грид в процессе destroy) и ставится по одному на entry. **Фикс:** хранить id RAF, отменять в cleanup, один RAF на пачку. Риск: низкий.

---

## 2. Производительность

- **chartEngineReact.tsx:957 + 743-751 + 992-994** — `onTransformChanged` = `invalidate() + updatePanels()`, но renderLoop при dirty-кадре сам вызывает `updatePanels()` — работа задваивается; `onMouseMove` без нажатия (кроссхейр) тоже дёргает полный min/max-скан по всем чанкам. **Фикс:** колбэк свести к одному `invalidate` — `updatePanels` останется только в renderLoop (максимум раз в кадр). Риск: низкий.
- **chartEngineReact.tsx:115-135** — `addData` при стриминге по 1 точке: каждые `chunkSize` точек полный `buildMinMaxChunks()` (все чанки с нуля, `slice` на каждый) → суммарно O(n²/chunkSize). **Фикс:** пересчитывать только хвостовые чанки от `floor((len - arr.length)/chunkSize)`; ветка с `remainder` тогда не нужна. Риск: низк.-средн. (желателен точечный тест на границе чанка).
- **chartEngineReact.tsx:966-970 + 172-186** — на каждую панель на каждый dirty-кадр аллоцируется замыкание-фильтр `(ds) => p.dataSets.includes(ds)` + O(панели × все датасеты) скан через `getGlobalMinMaxY`. **Фикс:** прямой цикл `for (const ds of p.dataSets)` — 5 строк без замыканий, математика идентична. Риск: низкий.
- **myChart.ts:101-118** — min/max по видимым точкам считается на каждый кадр даже при `autoScaleY = false`, результат затирается фиксированным 0..100. **Фикс:** обернуть цикл в `if (state.autoScaleY)`. Заодно проверка `minY === Infinity` недостижима — удалить. Риск: низкий.
- **RNDFunc3.tsx:255-269** — inline ref-callback у `headerD`: пересоздаётся каждый рендер → React вызывает его с null/элементом на каждый рендер, каждый вызов — `getBoundingClientRect()` (forced reflow). Во время драга рендер на каждый mousemove = reflow×2 на тик. **Фикс:** `useLayoutEffect` с deps `[x, y, width, height, sizeByWindow]`. Риск: средний (QA-карточка 2).
- **updateBy.ts:141-168** — `useUpdateByApi` создаёт объект api с 9 замыканиями на каждый рендер (ломает memo-детей при передаче пропсом). **Фикс:** кэш `WeakMap<object, UpdateApi>` внутри `createUpdateApi`. Риск: низкий.
- **menu.tsx:118-145 + 41-58** — после array-onClick прогресс не сбрасывается: `TimeNum` с `setInterval(30)` живёт до анмаунта (ререндер каждые 30 мс), подписки `listenOk`/`listenError` висят. Промис-путь сбрасывает через 500 мс — array-путь нет. **Фикс:** при `countOk+countError >= count` — как в промис-пути: sleep(500) → `setProgress(null)` + unsub. Риск: средний (видимое, но консистентное изменение).
- **logs3.tsx:90-95** — `staticGetAdd("logSettings")` (localStorage.getItem + JSON.parse) в теле `LogsProvider` на каждый `addLog`-ререндер, результат выбрасывается. **Фикс:** `useState(() => staticGetAdd(...))`. Риск: низкий.
- **mapMemory.tsx:43-48** — утечка: строгий `Map<object, boolean>` для меток `def` не чистится никогда — каждый уникальный `def` удерживается навсегда. **Фикс:** `WeakSet`. Заодно вложенный `if (options.deepAutoMerge)` уже проверен внешним условием. Риск: низкий.
- **cache.ts:99-102** — `isDate` создаёт `new RegExp` на каждый вызов (для каждой строки каждого объекта при загрузке кэша); в паттерне неэкранированная точка (`00:00:00x123Z` матчится как дата). **Фикс:** модульная константа `const ISO_DATE_RE = /.../ ` с `\.`. Риск: низкий.
- **useOutside.tsx:110-119 (DivOutsideClick)** — комбинированный ref пересоздаётся каждый рендер → detach/attach каждый рендер. **Фикс:** `useCallback([forwardedRef, internalRef])`. Туда же :29,33 — два новых noop `() => {}` за рендер. Риск: низкий.
- **theme.ts:20-22** — тема ag-grid строится на каждый экземпляр компонента, режимов всего два. **Фикс:** модульный кэш `Record<tThemeMode, Theme>`. Риск: низкий.
- **miniLogs.tsx:8-33** — columns пересоздаются каждый рендер; не зависят от props. **Фикс:** вынести на уровень модуля как `ColDef[]` (заодно уйдёт `as any`); `apiGrid`-ref не нужен. Риск: низкий.
- **chartEngineReact.tsx:1160-1170** — демо `MyChartEngine`: `setInterval(..., 1)` — точки на максимальной частоте, данные растут неограниченно. Для демо достаточно 50-100 мс. Риск: низкий (но публичный компонент — скорость демо наблюдаема).

---

## 3. Типизация / дженерики

- **RNDFunc3.tsx:19** — `onUpdate?: (data: any) => void` — единственный `any` наружу в DnD-зоне; payload полностью известен (`{e, dir, elementRef, delta, position}`). Объявить тип — потребители получат вывод бесплатно. Риск: средний (потребитель с явно неверным типом параметра перестанет компилироваться — но он и так был неверен).
- **miniLogs.tsx:6** — `data: any[]` в публичной сигнатуре → `MiniLogs<T = any>` (default сохраняет совместимость). Риск: низкий.
- **Resizable.tsx:18,31** — `onResize?: (size?: tSaveMap) => void` объявлен с параметром, но вызывается без аргументов — всегда `undefined`. **Фикс:** передавать `obj` в вызов — сигнатура не меняется. Риск: низк.-средн.
- **updateBy.ts:91,124,137-138,155-158** — union `Dispatch<SetStateAction<T>> | ((a: T) => void)` повторён 6 раз → `export type UpdateCallback<T>`. Footgun отметить в JSDoc: listener вызывается тем же мутированным объектом → `setState(тот же ref)` бэйлаутится без ререндера. Риск: низкий.
- **mapMemory.tsx:8,12,45,58** — `key: any` при хранилище `Map<string, object>`: число и `"5"` — разные ключи молча. Сузить до `string | number` — только в мажоре. Риск: средний.
- **logs3.tsx:22,30** — мёртвый generic `<T extends object = {}>` на экспортируемых `tLogsInput`/`tLogs` (T не используется). Как с `cache.ts delete<T>` из плана: пометить, удалить в major. Риск: средний.
- **logs.tsx:31-35** — опция `limit?: number` в `getLogsApi` не используется (лимит захардкожен 50). **Фикс:** реализовать (`setting.limit ?? 50`) — контракт станет честным. Риск: низкий.
- **MyResizeObserver.tsx:56-58** — non-null assertion `!` рядом с проверкой на null: `parent.parentElement!; if (!parentParent)` — `!` лжёт компилятору. Убрать `!`, оставить проверки. Риск: низкий.
- **ParametersEngine.tsx** — мелочи: `:8` неиспользуемый `<T>` у внутренней `getTimeStep` (не экспортируется — удалять безопасно); `:44` `style?: any` → `React.CSSProperties`; `:385` `(data: any)` → `boolean | string`; `:439` `@ts-ignore` снимается, если `isDate` типизировать как type guard. Риск: низкий.
- **cache.ts:77,108-110** — каст в non-null массив скрывает `null` от `Save.get`, а null ловится рантайм-проверкой `if (data)` внутри `addDataToMap`, противоречащей типу. **Фикс:** убрать каст, ранний `continue`, удалить `if (data)`. Риск: низкий.

---

## 4. Избыточные проверки (кандидаты на удаление)

- **RNDFunc3.tsx:137-142, RNDFunc.tsx:51-53** — «страховочная» инициализация `lastC` в mousemove недостижима (mousedown всегда ставит её раньше), а при срабатывании дала бы `newX = 2*clientX`. **Фикс:** ранний return или убрать целиком.
- **RNDFunc3.tsx:108-111** — `position?.x ?? 0`, `?? 30`, `?? 400`: к этой точке position/size гарантированы спредом с дефолтами (:83-92) — все ветки `??` мёртвые.
- **chartEngineReact.tsx:294** — `idx >= panels.length` после `findIndex` невозможно → `if (idx < 0) return`.
- **chartEngineReact.tsx:368-369** — `let step = 1; if (norm < 2) step = 1;` → `const step = (norm < 2 ? 1 : norm < 5 ? 2 : 5) * mag`.
- **menuMouse.tsx:27** — `{...(agr ?? {})}` при не-optional `agr`, читаемом тут же без guard; `agr.other ? agr.other : other` → `agr.other ?? other`.
- **menu.tsx:426-428** — `ref={(el) => { if (el) refMenu.current = el; }}` → `ref={refMenu}`.
- **logs.tsx:267,278** — `tr` — массив, всегда truthy: оба guard `{tr && ...}` мёртвые; на :278 то же выражение пересчитано заново вместо использования `tr`.
- **Input.tsx:44** — каст `(e.target as HTMLInputElement)` при уже типизированном `ChangeEvent<HTMLInputElement>`.
- **Other.tsx:20,41** — `onSave?.()` под уже проверенным `{onSave && ...}`.
- **arrayPromise.tsx:21** — `if (catchF) return catchF?.(...)` → `return catchF(...)`.
- **myChart.ts:109-113** — проверка `minY === Infinity` недостижима при выполнении цикла (см. раздел «Производительность»).

---

## 5. Лаконичность / дублирование / мёртвый код

- **updateBy.ts:59-87** — `renderBy`/`renderByRevers`/`renderByLast` — три идентичных тела; один приватный `schedule(a, ms, reverse, lastOnly)` + три однострочных делегата.
- **Modal.tsx:45-137** — `GetModalJSX` и `GetModalFuncJSX` — дубликаты на ~90 строк (различие — способ рендера значения). Свести к generic-фабрике `createJsxStore<T>(renderItem)`: ~90 → ~50 строк, сигнатуры не меняются.
- **chartEngineReact.tsx:215-222, 231-237, 881-887, 1055-1061** — inline-тип конфига панели выписан 4 раза → `export interface PanelConfig` (структурная совместимость сохраняет API байт-в-байт, −20 строк).
- **chartEngineReact.tsx:789-794** — мёртвый `onMouseUp` (не регистрируется нигде; document-слушатель делает то же).
- **chartEngineReact.tsx:933,1001,622-629** — `isYRightAxis` — мёртвый параметр через весь пайплайн (ось всегда справа); константу убрать, в интерфейсе пометить «ignored».
- **chartEngineReact.tsx:474-475,555-557,996-997** — расчёт `xMinVisible/xMaxVisible` продублирован в 3-4 местах → хелпер `visibleXRange(width, transform)`.
- **chartEngineReact.tsx:563-568** — `pyBase` инвариантен, но вычисляется внутри цикла по барам.
- **chartEngineReact.tsx:1017-1019** — `unobserve` перед `disconnect` избыточен.
- **logs.tsx:43-49 vs 81-90** — `SettingLogsReact` дословно дублирует `InputSettingLogs` → `Setting: InputSettingLogs`.
- **logs.tsx:94-97,121-127** — no-op `time: e.time` при спреде; `flatMap(e => e.map(...))` → `.flat()`.
- **RNDFunc3.tsx:95-97** — пустой блок `if (sizeByWindow) {}`; **:2,5** — неиспользуемые импорты `memo`/`useMemo`.
- **RNDFunc3.tsx:49-56** — `DivRndBase3(...)` вызывается как функция (хуки уезжают в фибер DivRnd3, компонент пропадает из devtools) → `<DivRndBase3 {...a}/>`.
- **menuMouse.tsx:24-28** — то же: `return MenuR({...})` вместо JSX — хрупко к порядку хуков. Риск среднее (state переедет — проверить открытие/закрытие меню и инвариант bb на стенде).
- **menu.tsx:42-44** — мёртвый `refCounter` в TimeNum (пишется, не читается) → `useState(0)`.
- **menu.tsx:381-384** — `filter((e) => e as ...)` — каст как truthy-фильтр → `filter(Boolean) as tMenuReactStrictly[]`. Deps `[data, data.length]` не трогать (намеренно ловят мутации).
- **components/Menu/index.ts:2** — мёртвый `export * from './StickerMenu'` (там только default).
- **MyResizeObserver.tsx:25-28** — `new class { [Symbol.species] = this }()` на каждый `add()` → `{} as ObserveID`.
- **useOutside.tsx:142-148 (Button)** — запись `saveStatus[keySave]` внутри state-апдейтера (идемпотентно, но чище вынести наружу).
- **ParametersEngine.tsx:311-313** — мёртвый ref `params` (пишется в useMemo, не читается).
- **ParametersEngine.tsx** — ~25 строк закомментированных экспериментов (78-85, 110-112, 139, 142, 151-153, 236-238 и др.); `:117` `new Date().toString()` → `Date.now()`; `:116` дефолт `"2015.01.01"` → ISO `"2015-01-01"`.
- **ParametersEngine.tsx:571** — голый блок `{ return ... }`.
- **applyTransactionAsyncUpdate.tsx:66-74** — `getUpdateTable` — мёртвая заглушка `return {}` (публичная — только `@deprecated`).
- **applyTransactionAsyncUpdate.tsx:168-183 vs core.ts:162-172** — `getComparatorGrid` дублирует `numericComparator` из agGrid4 → `@deprecated` со ссылкой на замену.
- **agGrid4.tsx:66-71,86-91** — `fit` и `sizeColumnsToFit` — два идентичных тела → `sizeColumnsToFit: fit`.
- **api.tsx:1,74** — мусорные комментарии `// ... existing code ...`.
- **DraggableOutlineDiv.tsx** — публичный демо-компонент с захардкоженным контентом → `@deprecated`; неиспользуемый импорт `FC`.
- **MiniButton.tsx:45-46** — `// Deprecated:` обычным комментарием → JSDoc `/** @deprecated */` (IDE зачеркнёт).
- **LeftModal.tsx:384-389 (Modal2)** — при inline-массиве `menu` полный setMenu+renderBy на каждый рендер родителя → shallow-сравнение или док «мемоизируйте menu».

---

## Что проверено и чисто

- `useAddDownAnyKey.ts`, `useDraggable.tsx` (после K2-переписывания), `pageVisibilityContext.tsx`, `core.ts` (agGrid4), `tokens.ts`, `inputAutoStep.ts`, `src/index.ts` — без замечаний.
- `any`/`{}` в публичных сигнатурах chart-зоны не найдено.
- Паттерн cleanup из ref-колбэков (`setResizeableElement`) корректен для React 19 (peer `^19.2.0`).

## Рекомендуемый порядок

1. **updateBy.ts №1** (subscribe + map3.delete) — ядро, эффект на всех подписчиков; стенд + tsc.
2. Дешёвые баг-фиксы низкого риска одним заходом: Drag22 onStop-гейт, logs.tsx guard, menuR touch-ref, StickerMenu movedRef, Modal2 menuKey, ModalContextProvider один контекст, LeftModal currentMenuLength, chart resizePanel→layoutPanels.
3. Перф-пакет chart (updatePanels×1, addData хвостовой rebuild, прямой цикл по dataSets, myChart autoScaleY) — заметнее всего на стенде с графиками.
4. Средний риск по одному с проверкой на стенде: ParametersReact stale closure, headerD ref→layoutEffect, Drag22 тач-дрейф, onResizeStop offsetWidth/Height, logs3 таймеры.
5. Чистка (разделы 4-5) — один коммит «лаконичность», проверка только tsc + смоук стенда.
