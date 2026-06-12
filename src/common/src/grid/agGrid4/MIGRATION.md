# План миграции фронта clientBacktest на agGrid4

Канон библиотеки — `exampleAGrid/agGrid4` (см. README.md). Здесь — проектный план: что, в каком
порядке, с каким риском. Инвентарь собран аудитом всего `src/front` (2026-06-12).

## Инвентарь: 20+ гридов в 13 файлах

| # | Место | Гридов | Путь данных сейчас | getRowId | Буфер |
|---|-------|--------|--------------------|----------|-------|
| 1 | `pages/clientPage/main.tsx:866` | 1 (главная таблица) | applyTransactionAsyncUpdate2 ×6, стримы | есть | `datum.tableArr` (модуль) |
| 2 | `components/selectSymbols/selectSymbol.tsx:870` | 1 (+1 мелкий :1134) | **локальный v1** ×24, стримы | есть / нет | `bufTable` (модуль) |
| 3 | `pages/clientPage/mini/services.tsx:68` | 1 | **v1 из wenay-react2** ×2, события | есть | `object` (useRef) |
| 4 | `pages/clientPage/exchange/binance.tsx:860` | 1 (модалка History Transfer) | v2 ×2 | есть | `bufferTableHistory` (модуль) |
| 5 | `pages/clientPage/exchange/gateio.tsx:577` | 1 (модалка займов) | rowData декларативно | есть | — |
| 6 | `pages/clientPage/portfolioTable.tsx:233` | 1 | rowData + setRows | есть | — |
| 7 | `pages/clientPage/elements.tsx:15` | 1 (TableSymbols) | rowData проп | **нет** | — |
| 8 | `components/selectHistory.tsx:298,400,599` | 3 | rowData + setRows | есть | Map (модуль) |
| 9 | `components/graph.tsx:391,453,495` | 3 | rowData + setGridOption | есть/нет | WeakMap |
| 10 | `components/SelectStrategy.tsx:104` | 1 | rowData + setRows | **нет** | — |
| 11 | `components/selectSymbols/selectTable.tsx:23` | 1 | setGridOption("rowData") | **нет** | — |
| 12 | `components/selectSymbols/utilsReact.tsx:93` | 1 | rowData пересборка | **нет** | — |
| 13 | `pages/pageTest2.tsx:82`, `pageTest3.tsx:15` | 2 | статика | нет | — |

Обёртка `components/customAgGrid3.tsx` — текущий прод-хелпер, после миграции под снос.

## Найденные дефекты (аудит, сверено по строкам)

1. **selectSymbol.tsx:31-49 — локальный v1 теряет данные.** Всё тело под `if (grid?.api.getRowNode)`:
   грид не готов → апдейт молча выброшен (даже в буфер не пишется). `applyTransaction({add})`
   закомментирован (:43-46) → новые строки никогда не доезжают транзакцией. 24 колл-сайта (:357-575).
2. **binance.tsx History Transfer — рассинхрон ключей буфера.** Заполнение: `getId: e=>e.timestamp`
   (:855), синхронизация: `getId: e=>String(e.id)` (:868), `getRowId: e.data.id` (:874). Буфер ключуется
   по timestamp, sync ищет по id → sync сравнивает не те ключи. Плюс `id: (a++).toString()` (:854) —
   id недетерминированы между загрузками.
3. **Гриды без getRowId** (идентификация по индексу, транзакции невозможны/опасны):
   elements.tsx TableSymbols, SelectStrategy, selectTable, utilsReact, selectSymbol:1134, graph buffer-гриды.
4. **main.tsx `useAgGrid()` (:254) не используется** — `Grid`/`updateData` мертвы; страница рендерит голый
   AgGridReact. Удалить вместе с импортом customAgGrid3.
5. **main.tsx `TableA = useMemo(..., [true])` (:864)** — замыкание заморожено навсегда; `colDefsMain`
   пересчитывается каждый рендер (:858), но в грид не попадает — колонки добавляются императивно
   `setGridOption("columnDefs")` (:690). При миграции: либо стабилизировать columnDefs через useMemo,
   либо сохранить императивный путь — НО не отдавать в memo-компонент новый массив каждый рендер.
6. **elements.tsx EmptyColumn/ShowQuote** зовут `grid.current.api` без null-гарда; зовутся и из
   onGridReady, и с кнопок.
7. **selectTable.tsx:16-22** — два одинаковых updateBy-вотчера (дубль).
8. **Ничейный destroy**: кроме main.tsx, ни один грид не зануляет свой ref на onGridPreDestroyed.
9. **Мёртвый код**: main.tsx :401-412 (loadSymbols), :488-546, :768-788, :823-852 (старые v1-блоки);
   selectSymbol :839-867; graph getTableMaiBuffer закомментирован в UI.
10. **Тема**: прод-гриды НЕ передают theme (v35 даёт дефолтную Quartz / легаси-CSS через
    GridStyleDefault из wenay-react2, импорт в src/index.ts). AgGridMy ставит Alpine dark —
    **внешний вид изменится**. Решить на пилоте: либо принять Alpine, либо прокинуть текущую тему.

## Этапы

Порядок — по принципу inject → verify → improve → tighten; реструктуризация и снос — в конце.
Сложность: Н/С/В. Риск: Н/С/В.

### Этап 0. Подключение библиотеки [Сложность Н, Риск Н]
- Перенести `exampleAGrid/agGrid4/` → `src/front/components/agGrid4/` (exampleAGrid вне tsconfig include).
- Смоук на песочнице `pageTest3.tsx` (мусорный статический грид): `<AgGridMy data=...>` —
  проверить тему, resize, selection вживую.
- Здесь же решить вопрос темы (дефект 10): сверить вид AgGridMy против текущего прод-грида.

### Этап 1. Пилот: selectSymbol.tsx [Сложность С, Риск С]
Самый гонко-нагруженный + чинит реальную потерю данных (дефект 1).
- `useAgGrid({ getId: getRowIdSymbols, externalBuffer: bufTable })`; 24 вызова локального v1 →
  `grid.updateData({newData})`. Механическая замена (сигнатуры близки).
- **Поведенческий риск**: v1 не делал add. С agGrid4 новые строки начнут появляться. Если текущая
  семантика «только апдейты по уже загруженным строкам» намеренная — первый проход с
  `option: {add: false}`, включение add — отдельным осознанным шагом.
- Грид :870 → `<AgGridMy controller>`; rowData-useState (:238) оставить как initial → потом убрать
  в пользу буфера (вторая итерация).
- Локальную v1-функцию удалить (экспортируется — проверить внешние импорты; main.tsx импортирует
  только в комментариях).

### Этап 2. Главная таблица: main.tsx [Сложность В, Риск В]
Наибольший эффект, больше всего потребителей.
- `useAgGrid<tRow>({ getId: getIdMainTable, externalBuffer: datum.tableArr })`.
- `updateTable`/`updateTableByBaseAsset` → `grid.updateData({newData, option:{sync}})` (6 колл-сайтов).
- Голый AgGridReact → `<AgGridMy controller>`: свои onGridReady-сайд-эффекты (фильтр-модель,
  tableReady, EmptyColumn, renderBy) остаются — чейнятся после связки; ручной sync и ручное
  зануление ref удалить (lifecycle в обёртке).
- **Самая трудоёмкая часть — потребители ref**: `stParams` (:1031), EmptyColumn, ShowQuote/ShowColumn/
  ShowEmptyRows/ShowEmptyColumn (elements.tsx), getMenuR, PageShow — переводятся с
  `RefObject<GridReadyEvent>` на `grid.apiRef` (`RefObject<GridApi>`); внутри `*.current.api.X` → `*.current.X`.
  Плюс добавить null-гарды (дефект 6).
- columnDefs: стабилизировать (дефект 5) — либо useMemo с настоящими deps + декларативные колонки,
  либо явно оставить императивный addColumn и заморозку (задокументировать выбор).
- Удалить мёртвое: `useAgGrid()` (:254) + импорт, v1-комментарии, loadSymbols.
- `rowData={getRowData()}` → не передавать (буфер вливается через attach→sync).
- Проверка: фильтр quoteAsset на старте, чекбоксы selection, пустые строки/колонки, меню по
  selected rows, стримы всех 4 бирж, уход/возврат на роут (буфер модульный — должен догнать).

### Этап 3. services.tsx [Сложность Н, Риск Н]
- Последний потребитель v1 из wenay-react2 → `useAgGrid({ getId, externalBuffer: object.current })`,
  2 вызова → `updateData`. Грид → AgGridMy. Снимает зависимость от v1 целиком.

### Этап 4. Модальные гриды бирж [Сложность Н, Риск Н]
- binance.tsx History Transfer: → controller + AgGridMy; починить ключи (дефект 2): единый
  `getId: e=>String(e.tranId)` (стабильный природный ключ) вместо timestamp/`a++`.
- gateio.tsx займы: декларативный `<AgGridMy data={getRowData()}>` либо просто AgGridMy-обёртка;
  занулять ref через controller (сейчас не зануляется).

### Этап 5. Статические/декларативные гриды [Сложность Н, Риск Н, объём ~10 гридов]
selectTable, utilsReact, SelectStrategy, selectHistory ×3, portfolioTable, elements TableSymbols,
graph ×3, pageTest2.
- Везде: `<AgGridMy data={rows} columnDefs=...>` (или controller, где есть императив);
  добавить getRowId, где нет (дефект 3); убрать самодельные ResizeObserver/sizeColumnsToFit.
- Попутные мелкие фиксы: дубль-вотчеры selectTable (дефект 7), remount-паттерны
  (`getTable`-стрелки/useCallback с пустыми deps), graph — синхронизацию selection вынести в эффект.
- Можно дробить по одному файлу — независимые шаги.

### Этап 6. Снос и зачистка [Сложность Н, Риск Н — только после этапов 1-5]
- Удалить `customAgGrid3.tsx` (последний потребитель — мёртвый деструктуринг main.tsx из этапа 2).
- Удалить локальный v1 selectSymbol (этап 1), импорты `applyTransactionAsyncUpdate*` из wenay-react2.
- Снести мёртвые комментарии-блоки (дефект 9).
- Решить судьбу agGrid2/agGrid3 в exampleAGrid (оставить как историю или снести).

## Сводка рисков

| Риск | Где | Митигация |
|------|-----|-----------|
| Смена внешнего вида (тема Alpine dark vs текущая) | все гриды | Этап 0: сверка на песочнице; AgGridMy принимает `theme` |
| Включение add меняет видимый набор строк | selectSymbol | `option:{add:false}` на первом проходе |
| Потребители grid-ref (GridReadyEvent → GridApi) | main.tsx + elements/getMenuR/menuPages | механическая замена `.api.X` → `.X`, но много мест — отдельный коммит |
| Memo + нестабильные columnDefs = сброс колонок | main.tsx | стабилизировать useMemo'м до смены обёртки |
| Поведение фильтров/selection при ремаунте роута | main.tsx | ручная проверка сценария уход/возврат |
| v1-семантика «молча терять» кем-то ожидается | selectSymbol, services | пилот + наблюдение, буфер логировать при расхождениях |

## Порядок коммитов
Каждый этап — отдельный коммит (этап 2 — два: «потребители ref» и «сам грид»). После каждого:
`npx tsc` по проекту + ручной смоук затронутой страницы.
