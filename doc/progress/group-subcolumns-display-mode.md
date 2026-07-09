# Групповой столбец с режимами показа подстолбцов

**Goal:** на QA card 30 добавить пример column group из 3 leaf-подстолбцов и отдельную mode-кнопку с точками. Итоговая реализация держит `columnDefs` стабильными и переключает режим через runtime `columnState.api.setPresentGate(...)`, чтобы grid не пересоздавал схему и не прыгал порядком.

## Чекпоинты
- [x] Добавить данные: один подстолбец с произвольными значениями, один с нулями, один пустой.
- [x] Добавить ag-grid group column и `ColumnMeta.group` для этих leaf-колонок.
- [x] Добавить runtime `presentGate` в `columnState`: gated-out leaf скрывается в grid, кнопка становится dashed/inert, persisted `visible` не меняется.
- [x] Добавить 4 режима блока: 1/2/3/4 вертикальные точки (all, empty+zero, empty-only, skip whole block внутри логики, без видимых подписей).
- [x] Показать режим кнопкой с вертикальными dots в верхнем toolbar; нижний старый ColumnsMenu убрать из card 30.
- [x] Проверить типы/сборку.

## Проверки
- `./node_modules/.bin/tsc -p tsconfig.qa-check.json --noEmit`
- `npm run build`
- `npm run testjest -- --runInBand`
- QA stand `http://127.0.0.1:3002/` вернул HTTP 200.
