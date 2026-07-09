# Target — очередь задач

Правила ведения: [README.md](README.md). Ниже — статус по задачам; **исходные надиктовки сохранены дословно в конце файла** (ничего не удаляю).

## In Progress

- **Второй проход по публичной поверхности `wenay-react2`: нормализация внутренних слоёв библиотеки** — идём от простых useful passes к более рискованным; сомнительные задачи пропускаем и помечаем.
  - Прогресс: [../progress/public-surface-normalization.md](../progress/public-surface-normalization.md)
  - Правило прохода: обновлять не только production-код, но и `doc/EXAMPLE_USAGE.md`, `src/common/testUseReact/qa.tsx` cards, `replayVideo.tsx`, `agGrid4/example.tsx`/docs, если меняется canonical usage; если пример уже корректен — записывать, что менять не нужно.
  - Hook/controller-first стандарт: новый reusable функционал проектировать через `use*` hook или `create*` controller с API управления; визуальный компонент делать тонким слоем сверху, старое имя оставлять compatibility wrapper, если это не ломает код.
  - Оценка задач: эффективность high/medium/low, простота simple/medium/hard, риск low/medium/high. Low-effectiveness или hard/high-risk без явного выигрыша пропускать и помечать причиной.
  - Сделано: `useKeyboard.ts` переведён с прямого `renderBy(keyboardState)` на `createUpdateApi(keyboardState)`; публичный `keyboard` / `useKeyboard` API не менялся.
  - Сделано: `MiniLogs` / `PageLogs` используют `colDefCentered` + локальный `wrapText: true` вместо ручного `defaultColDef`.
  - Сделано: `MiniLogs` / `PageLogs` переведены с raw `AgGridReact` на `AgGridTable` без переписывания logger state/timing; card 9 готова для ручной проверки.
  - Сделано: `createModalElementStore` / `createModalRenderStore` переведены с прямого `renderBy/updateBy(data)` на `createUpdateApi(data)` без изменения публичного compatibility API.
  - Сделано: `createUiSlot` переведён с прямого `renderBy/updateBy(st)` на `createUpdateApi(st)`; card 21 проверена как usage-пример, менять не нужно.
  - Сделано: `Toolbar.tsx` density registry переведён с прямого `renderBy/updateBy(densities)` на `createUpdateApi(densities)`; card 25 проверена как usage-пример, менять не нужно.
  - Сделано: `SettingsDialog.tsx` section registry переведён с прямого `renderBy/updateBy(registry)` на `createUpdateApi(registry)`; card 20 проверена как usage-пример, менять не нужно; layout-store пропущен как low-effectiveness без явного consumer.
  - Сделано: `columnState.ts` runtime `rt` (`present/presentGate`) и persisted `st` переведены на `createUpdateApi`; cards 28-31 проверены как usage-примеры, менять не нужно.
  - Сделано: `createSearchHistory` переведён на `createUpdateApi`; публичный API истории поиска не менялся.
  - Сделано: `createToolbar` local persisted store `st` переведён на `createUpdateApi`; `sourceMode`, external source hook и memory dirty flow не менялись.
  - Сделано: `FloatingWindow.tsx` open-window z-index registry переведён на `createUpdateApi`; drag/resize geometry не менялась.
  - Сделано: `LeftModal.tsx` menuStore переведён на `createUpdateApi`; compatibility `ApiLeftMenu.renderBy()` сохранён.
  - Сделано: отдельный audit-pass по hook/controller-first кандидатам записан в [../progress/hook-controller-opportunities.md](../progress/hook-controller-opportunities.md); в очередь попали только задачи с понятной пользой/риском, сомнительные отмечены как skip.
  - Сделано: `MiniLogs` layered redesign — добавлены `useMiniLogsTable`, `MiniLogsView`, `MiniLogsTable`, старый `MiniLogs` оставлен compatibility wrapper; store/history намеренно не добавлялись без consumer.
  - Сделано: `Menu` action-level stats — добавлен явный `actionKey`, `actionTotals`/`actions` counters, focused tests и QA card 4; полный `useMenuActionController` split отложен как отдельный более крупный pass.
  - Сделано: `RightMenu` cleanup — добавлен `useRightMenuController`, `DropdownMenu` оставлен compatibility wrapper, `createRightMenuController().Render` сохранён; registry rewrite пропущен как низкоэффективный без нового consumer.
  - Сделано: `ParamsEditor` first controller layer — добавлен `useParamsEditorController` для draft clone / immediate+delayed notify / expand / cleanup; full renderer/view split и `ParamsEdit` async-save hook отложены как hard/high-risk без отдельного pass.
  - Сделано: Logs inventory + low-risk primitive reuse — `logsContext.LogsTable` переведён на `AgGridTable`/`colDefCentered`, `PageLogs` copy action получил `actionKey: "logs.copyCell"`.
  - Сделано: Logs headless controller — добавлен `createLogsController` / `createLogsControllerState` для append/limits/latest/settings emitters; `getLogsApi` оставлен compatibility wrapper, UI/timers/tabs не переписывались.
  - Сделано: `SettingsDialog` first controller layer — добавлен `useSettingsDialogController` для open/search/history/tree-cycle/nav-resize/Escape actions; JSX/portal/FloatingWindow/classes не переписывались.
  - Сделано: context logger UI hooks — добавлены `useLogsTableController` и `useLogsNotificationsController`; `LogsTable`/`LogsNotifications` оставлены compatibility wrappers.
  - Сделано: `FloatingWindow` first controller layer — добавлен `useFloatingWindowController` для saved geometry / update counter / z-index stack / drag state / resize callbacks / viewport clamp; `FloatingWindowBase` оставлен compatibility wrapper над тем же `Rnd` и DOM/classes.
  - Пропущено: `FResizableReact` hook — в `src`/`__test` нет render-consumers, только export/docs и `mapResiReact` persistence wiring; без consumer это low-effectiveness speculative refactor.
  - Hook/controller-first backlog после audit-pass выполнен; дальше не делать `memoryStore`, `PageVisibilityProvider`, `StickerMenu`, `DragBox` broad rewrite или `FResizableReact` hook без отдельного consumer/test сценария.
  - Сделано: final primitive-reuse inventory — raw `AgGridReact` / `useGrid.tsx`, `logsContext.localStorage`, PageVisibility/replay/chart timers, Settings/Toolbar registries and ModalProvider paths проверены; оставшиеся места помечены как low-effectiveness/high-risk без отдельного consumer/test.
  - Сделано: QA card 25 toolbar `tb.api.onChange` переведён с ручного `useEffect(() => listen.on(...))` на `useListenEffect(tb.api.onChange, ...)` как canonical listen-hook usage.
  - Сделано: `Toolbar.Bar` получил FLIP-анимацию перемещения элементов; cards 25 и 31 теперь ведут себя как card 30-эталон, card 30 не переписывался.

## Ready

_Пусто._

## Inbox

_Actionable задач по текущему repo-pass нет; пункты ниже оставлены как исходные specs со статусом выполнено/parked._

- **Недоиспользуемые методы `wenay-react2`: пройти по коду и внедрять свои primitives там, где они реально заменяют ручной код**.
  - Порядок выполнения: начинать с самых простых и низкорисковых замен; если место спорное — пропускать, фиксировать причину в progress-файле и идти дальше.
  - Grid helpers: искать локальные `comparator`, `cellStyle`, `wrapText`, theme/defaultColDef и заменять на `numericComparator`, `colDefCentered`, `colDefWrap`, `useAgGridTheme` / `buildAgTheme`, когда это не меняет UX.
  - `AgGridTable`: искать голый `AgGridReact` и ручное lifecycle/resize/getRowId wiring; переводить на `AgGridTable` / `useAgGrid` только там, где можно сохранить текущую тему, selection, events и row identity.
  - `createColumnBuffer`: проверить места с динамическими колонками и ручным хранением набора имён; использовать буфер, если нужен reusable lifecycle exact-set/apply/detach.
  - Store/listen hooks: заменить ручные `listen.on(...) + useEffect/useState` и чтение `Observe.Store` на `useListenEffect`, `useListenValue`, `useListenArgs`, `useStoreNode`, `useStoreSelect`, `useStoreEach`, `useStoreMirror`, где есть явный `wenay-common2` store/listen source.
  - Settings/Toolbar registries: активнее использовать `registerSettingsSection` для саморегистрации настроек и `registerToolbarDensity` для стандартных режимов плотности вместо локальных вариантов кнопок.
  - Modal layer: для новых модалок использовать `ModalProvider` + `useModal`; старые imperative modal stores оставлять только как compatibility path.
  - Replay hooks: применять `useReplaySubscribe`, route-варианты, `useStoreReplayEach`, `useReplayFrame`, `useReplayHistory` только в местах с реальным streaming/history/replay сценарием; не внедрять в обычный UI ради переиспользования.
  - Page visibility: проверить polling, анимации, replay/canvas и тяжёлые обновления; если поведение должно паузиться в скрытой вкладке, использовать `PageVisibilityProvider` / `PageVisibilityContext`.
  - Статус текущего repo-pass: выполнено в рамках [../progress/public-surface-normalization.md](../progress/public-surface-normalization.md); новые пункты добавлять сюда только при появлении реального consumer/test сценария.
- **Hook/controller-first backlog после audit-pass**.
  - Прогресс/детали: [../progress/hook-controller-opportunities.md](../progress/hook-controller-opportunities.md)
  - Очередь по смыслу выполнена: `FloatingWindow` first controller layer сделан; `FResizableReact` hook пропущен до появления реального consumer.
  - Не делать сейчас без отдельного consumer/test: `memoryStore` core rewrite, `PageVisibilityProvider` в обычный UI, `StickerMenu` как shared primitive, broad rewrite `DragBox`.
  - Оценка: после `FloatingWindow` first layer осмысленных hook/controller задач без новых consumers не осталось; дальнейшие пункты из audit-pass имеют низкую эффективность или высокий риск.

## Verify
- **Hook-first архитектура для функционала библиотеки** — первый inventory pass и safe input hook extraction готовы, ждут ручной/релизной проверки.
  - Прогресс: [../progress/hook-first-architecture.md](../progress/hook-first-architecture.md)
  - Сделано: зафиксирован inventory по `SettingsDialog`, `ParamsEditor`, `FloatingWindow`, `Input` helpers, `LeftModal` / app-shell helpers.
  - Сделано: добавлены `useTextInputPanel` и `useFileInputPanel`; старые `TextInputPanel`, `FileInputPanel`, `TextInputModal`, `FileInputModal` остались совместимыми визуальными wrappers.
  - Документация: обновлены `doc/wenay-react2.md`, `doc/PROJECT_FUNCTIONALITY.md`, `doc/changes/v1.0.39.md`.
  - Проверено: `npx tsc -p tsconfig.qa-check.json --noEmit`; `npm run testjest -- --runInBand __test/inputPanelHooks.test.tsx`; `npm run testjest -- --runInBand`; `npm run build`; `git diff --check`.
  - Не сделано: `SettingsDialog`, `ParamsEditor`, `FloatingWindow`, `LeftModal` broad extractions — оставлены для отдельных passes, потому что без отдельного API/test плана это риск поведения.
- **Система стилей и CSS variables для shared primitives** — default contract inventory и низкорисковые token fixes готовы, ждут ручной/релизной проверки.
  - Прогресс: [../progress/style-system-normalization.md](../progress/style-system-normalization.md)
  - Сделано: зафиксирована карта style source-of-truth (`src/style/tokens.css`, `src/common/src/styles/tokens.ts`, `src/style/style.css`, `src/style/menuRight.css`) и default visual contracts по публичным primitive groups.
  - Сделано: `ColumnsMenu/MenuStrip` переведён на `.wenayColsMenu*` + `--cols-menu-*`; runtime reorder transform/drag geometry оставлен inline.
  - Сделано: `ColumnDots/CardList` восстановленный card-29 baseline переведён на `--cols-dots-*` / `--cols-card-*` с теми же fallback-значениями; component runtime geometry не менялась.
  - Проверено: `npx tsc -p tsconfig.qa-check.json --noEmit`; `npm run testjest -- --runInBand`; `npm run build`; `git diff --check`.
  - Не сделано: `ParamsEditor` / `Input` broad visual migration отложен до hook-first/API решения; там нельзя безопасно менять только CSS без риска зацепить поведение.
- **Аудит свежих QA cards и внутренних primitives на переиспользование своих технологий** — findings-pass и два safe scoped fixes готовы, ждут ручной/релизной проверки.
  - Прогресс: [../progress/qa-primitives-reuse-audit.md](../progress/qa-primitives-reuse-audit.md)
  - Сделано: зафиксированы findings по `useReorderBoard`, `ColumnDots/CardList`, card 30 toolbar menu, card 31 toolbar/columnState integration, `ColumnsMenu/MenuStrip` inline styles.
  - Сделано: уточнена документация по canonical surface для `columnState`: `createToolbar({source: cs.api.listSource})` для settings-integrated flow, `ColumnsMenu` для compact/presentation menu.
  - Сделано: card 27 `BoardDemo` получил локальные style helpers для stand-only board styles без изменения `useReorderBoard` поведения.
  - Проверено: `npx tsc -p tsconfig.qa-check.json --noEmit`; `npm run testjest -- --runInBand`; `git diff --check`.
  - Не сделано: спорные UX-решения card 27 add/delete semantics, shared `Qa30AnimatedMenuBar` API и перенос `ColumnsMenu` inline styles — оставлены для отдельных target/style-system решений.

- **Совместимость старых API и статистика меню** — open-level stats и action-level stats готовы, ждут ручной/релизной проверки.
  - Прогресс: [../progress/menu-compat-stats.md](../progress/menu-compat-stats.md)
  - Сделано: добавлен `contextMenu.stats.getSnapshot/reset/onChange` с локальными in-memory counters для `openAt`, `openAtPoint`, legacy Layer queued opens, empty opens, close/replace и `source`/`layerId` usage.
  - Сделано: добавлен явный `MenuItemStrict.actionKey` contract; `contextMenu.stats` считает `actionTotals` и `actions[actionKey]` для click/ok/error/task/submenu/func/focus outcomes, не сохраняя labels/errors.
  - Сделано: старый `contextMenu.map` путь сохранён; legacy Layer open теперь учитывается в статистике и после consume очищает map как раньше.
  - Документация: обновлены `doc/wenay-react2.md`, `doc/wenay-react2-rare.md`, `doc/EXAMPLE_USAGE.md`, `doc/changes/v1.0.39.md`.
  - Проверено: `npx tsc -p tsconfig.qa-check.json --noEmit`; `npm run testjest -- --runInBand contextMenuStats.test.tsx`; финальный full test/build pass будет выполнен после текущей очереди.
  - Не сделано в этом проходе: полный `useMenuActionController` split и RightMenu/DropdownMenu diagnostics — вынесено в следующие осмысленные задачи.
- **Global Settings: история поиска и компактное управление деревом** — реализация готова, ждёт ручной проверки стенда.
  - Прогресс: [../progress/settings-dialog-search-history.md](../progress/settings-dialog-search-history.md)
  - Сделано: добавлен reusable `createSearchHistory({key,max?})`, экспортирован из utils; `SettingsDialog` search пишет историю через memory store / `memoryCache` dirty channel.
  - Сделано: три отдельные кнопки управления деревом заменены одним dotted cycle control в строке поиска; control скрывается, когда в дереве мало веток.
  - Сделано: card 29 primitives `ColumnDots` / `CardList` переведены с inline/raw visual styles на `.wenayColDots*` / `.wenayCardList*` CSS classes; follow-up: `ColumnDots` max поднят до 8, stand card 29 показывает 8 полей и нижний overlay-control поверх карточек.
  - Документация: обновлены `doc/wenay-react2.md`, `doc/wenay-react2-rare.md`, `doc/EXAMPLE_USAGE.md`, `doc/changes/v1.0.38.md`.
  - Проверено: `npx tsc -p tsconfig.qa-check.json --noEmit`; `npm run testjest -- --runInBand __test/settingsDialog.test.tsx`; `npm run testjest -- --runInBand`; `npm run build`; `git diff --check`.
  - Ручная приемка: card 20 — в Settings search ввести запрос, Enter добавляет в history, history button показывает список, выбор восстанавливает запрос; клик/фокус вне search box закрывает history; dotted tree control циклит expanded/current/collapsed. card 29 — нижний overlay с dots лежит на последней карточке, позволяет показать до 8 полей и не ломает CardList.
- **React-хуки для Replay route hand-off из `wenay-common2@1.0.65`** — реализация готова, ждёт ручной проверки стенда.
  - Прогресс: [../progress/replay-route-handoff.md](../progress/replay-route-handoff.md)
  - Сделано: добавлены `useReplayRouteSubscribe`, `useStoreReplayRouteSync`, `useStoreReplayRouteMirror`; существующие `useReplaySubscribe` / `useStoreReplaySync` не меняли поведение; route hand-off выполняется явно через `switchRoute(...)`.
  - Сделано: добавлены unit-тесты route switch / failed replacement fallback / unmount cleanup / store mirror convergence; добавлена QA card 26 с canvas video demo direct/relay/fail.
  - Документация: обновлены `doc/wenay-react2.md`, `doc/wenay-react2-rare.md`, `doc/changes/v1.0.38.md`.
  - Проверено: `npm run testjest -- --runInBand`; `tsc -p tsconfig.qa-check.json --noEmit`; `npm run build`; QA stand `http://127.0.0.1:3004/` вернул HTTP 200.
  - Ручная приемка: card 26 — canvas продолжает рисовать при `switch direct` / `switch relay`; `fail route` показывает ошибку, label остаётся предыдущим, кадры продолжают идти.


- **Групповой столбец с режимами показа подстолбцов в card 30** — реализация готова, ждёт ручной проверки стенда.
  - Прогресс: [../progress/group-subcolumns-display-mode.md](../progress/group-subcolumns-display-mode.md)
  - Сделано: в card 30 добавлен grouped `Mode block` из трёх leaf-колонок (`Values`, `Zeros`, `Empty`) и отдельный mode action в верхнем toolbar; режим работает через стабильные `columnDefs` + runtime `presentGate`, нижний старый `ColumnsMenu` из card 30 убран.
  - Проверено: `tsc -p tsconfig.qa-check.json --noEmit`; `npm run build`; `npm run testjest -- --runInBand`; QA stand `http://127.0.0.1:3002/` вернул HTTP 200.
  - Ручная приемка: верхняя 3-буквенная mode-кнопка с вертикальными точками циклит 1/2/3/4 состояния; grouped block показывает 3/1/2/0 подстолбцов; видимых `all/empty/skip` подписей и нижнего меню нет; исчезнувшие leaf-кнопки остаются dashed/inert и оживают при возврате режима.

- **Меню столбцов в функционале «Макета 25» (createToolbar) на макетах 30/31** — реализация готова, ждёт ручной проверки стенда.
  - Прогресс: [../progress/columns-menu-into-toolbar.md](../progress/columns-menu-into-toolbar.md)
  - Сделано: focused API тулбара (`setOrder`, `show`, `setDensity`, `showSettings`, `showReset`), `sourceMode:"order"`, reset-псевдокнопка (`__reset` / `<Bar reset>`, скрыта по умолчанию), card 30 переведён на order-only source поверх `columnState.api.listSource`.
  - Проверено: `tsc -p tsconfig.qa-check.json --noEmit`; `npm run build`; `npm run testjest -- --runInBand`; QA stand `http://127.0.0.1:3002/` вернул HTTP 200.
  - Ручная приемка: card 25 — reset action внутри Settings row, reset icon скрыт по умолчанию и show/hide работает; card 30 — grid drag меняет порядок верхнего меню, Settings window не дёргается.

## Blocked — уровень приложения (не эта React-библиотека)

Эти задачи живут на стороне приложения (`clientBacktest` / супер-админка), а не в этой библиотеке. Держим как источник, пока не будет доступа к тем репозиториям.

- **Balance / Client Backtest**: total по категориям и общий total; фильтры по каждой категории; количество монет в базовой валюте (или фильтр относительно прайса, как на главной странице — есть спец-фильтр для кредитов); кликабельность — возврат займа (по одной и массово, правой кнопкой), панель займа как на главной, трансфер в spot/др. (в т.ч. массовый), массовая очистка лимиток, массовое закрытие позиций на фьючерсах; окно рыночной сделки (buy/sell по выбранному рынку) по кнопке Asset и по BaseOne.
- **Уровень прав пользователя через супер-админку**: IP супер-админки статичен (хардкод-константа в коде, не ENV); узнавать уровень/права клиента через супер-админку (клиентские страницы и так открываются через неё); нужно комплексное решение — bootstrap прав при открытии клиентской страницы.

---

## Исходные надиктовки (дословно)

> Тут я буду надиктовывать различные задачи через Transkriptor, э-э-э, поэтому могут быть какие-тооо опечатки в словах, это нужно понимать. Вот. И вот этот главный пункт — это как бы ты запишешь как README таргета, что ли, а-а-а, файл README. Это твоя первая задача, по сути. А-а-а, потом суть данного направления в том, что типа я просто надиктовываю задачи, которые хочу сделать в порядке какой-нибудь очереди, ну, чтобы про них потом не забыть. Иии потом ты- Угу действия начинаешь выполнять, ты делаешь согласно своих правил, там, у тебя правила записаны, как поступать. Типааа прогрееесс, там, файл, типа, и прочее, ход выполнения. Иии к-- если ты её взял на разработку, то ты как-то должен помечать, типа, вот взял на разработку. Типа, доделано, недоделано — это мы уже потом по прогрессу будем смотреть. Вот и всё. Ну и удалять отсюда, чтобы всегда подчищать документ. То есть я сюда- выкидываю задачи. Можно даже сделать несколько слоёв. Слой, типа, от меня, как задачи, слой, который выполняется, пока не выполнен полностью, и тот, который выполнен и уже очищен. Ну, вот, я думаю, это так будет наиболее правильно.

> Нам нужнооо Используя технологию из библиотек, наших же, а-а-а, изменить Ниньо. А точнее, давай не миньо, начнем с баланса. А-а-а, вот есть Binance, а-а-а, баланс нааа Client Backtest. Э-э-э, там есть кнопка, так и называется она Баланс есть. И там есть для спота, для кросса, для фьючерсов отдельные записи. Хотелось бы видеть там же total общий, а-а-а, в базе в его соответствиях, также total по категории. Такжеяя ты сделал таблицу, нооо Лучшеее разрешить таммм вот эти фильтрыыы везде. Который, ну, м-можно было, чтоб каждую категорию фильтровать. Ну, в общем, как обычно. Потом А, кстати, вас бы, чтобы палатка кабельность То есть важно Чтооо, допустим, количество монет мне нужно фильтровать в базовой валюте, ну, типа относительно. Ну, тут есть хотя бы базовая валюта. Я могу по этому столбцу фильтровать. Вот. Ну, либо писать там, как бы в скобках, сколько это будет в базовой валюте, как, ну, как на главной странице. Иии фильтр-- ну, тоже сделать всё, как на главной странице: фильтр относительно прайса. Там у нас специальный фильтр для кредитов для этого написан, и он там используется. Потоммм А, добавить кликабельность, наверное. Что я имею в виду под кликабельностью? Ну, типа чтобы можно было нажать там на «Борууу» и можно было вернуть займ. Вот. Чтобы можно было выделить массово и вернуть займ везде правой кнопкой, допустим, а-а-а, либо по одной монете вернуть займ. Вот. Чтобы при клике на «Борууу» именно открывалась панелька займа, как с главной страницы. Ну, это касаемо кросс. Вот. Чтобы я мог нажать правую кнопку, нажать «Перевести трансфер» иии просто перекинуть её, а-а-а, в spot или куда-нибудь ещё, чтобы я мог массово выделить и сделать массовый трансфер. Вот. Хоть получается у нас много где такие правды, но всё-таки. Также по лимиткам хочу иметь возможность очистить данную лимитку, также массово выбрать, очистить массово лимитки. Вот. А-а-а, на фьючерсах Закрыть позиции массово. А-а-а, также я хочу при нажатии на кнопку «Asset» Чтобы у меняяя, наверное, открывалось окно возможности конвертации данной монеты, но без кон-- ну и без системы конвертации рыночной, типа buy-sell. По различным рынкам. Ну, типа, чтобы мне предполагалось, м-м-м, на как-- по какому рынку я хочу открыть диалоговое окно на покупку-продажу. Вот. Ну, типа, чтобы на месте я мог Выбрать, куда я хочу Стифом продать или купить. А-а-а, потом. А-а-а, м-м-м Как бы, конверт у BaseOne. А-а-а, конвертировать базовую валюту. Но опять же, это ещё не конвертация, а именно сделка по рынку, по ASL. Вот, а-а-а Точно так же хотелось бы отцу-то её иметь.

> Смотри, нам, короче, нужно как-то брать. У нас есть, короче, супер-админка, и его-- и ее IP-шник, как правило, пока что статичен. Можно хардкодить временно, ну, либо использовать как через переменную, хардкодить через переменную статическую, чтобы было-- ну, не через ENW, а в коде прям, короче. Вот. И просто у нас есть некоторые моменты, которые требуются только для определенных вещей, и нам бы узнавать уровень пользователя. Типа, ну, есть ли права, а-а-а, в клиентской системе, э-э-э, типа для такого-то режима. А узнать уровень пользователя мы можем только через супер-админку. Вот. Как это правильнее сделать? Я пока не понимаю. Ну, типа, к примеру, вот мы на фронте показываем APK. Пока что понятно для отладки, у нас пока так и оставляем. Ну, это больше задачааа, которая требует, наверное, комплексного решения. Скорее всего, нам нужно просто открывать клиентскую страницу через суперадминку. Кстати, мы так и делаем. Все клиентские страницы мы открываем через суперадминку.

> wenay-common2 Обнови эту библиотеку на последней версии. Посмотри, что там есть новое, можем ли это использовать. Если можем, тооо создай в таргете цели использовать это. И что необходимо сделать в качестве задач.
