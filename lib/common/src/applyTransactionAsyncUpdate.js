const optionsDef = {
    update: true,
    add: true,
    updateBuffer: true,
    sync: false
};
export function applyTransactionAsyncUpdate(grid, newData, getId, bufTable, option) {
    // Установка параметров (объединение переданных опций с настройками по умолчанию)
    const op = { ...optionsDef, ...(option ?? {}) };
    // Проверка наличия сетки и доступа к данным через API
    if (grid?.api.getRowNode) {
        const arrNew = []; // Массив для новых данных (добавляемые строки)
        // Основная обработка данных (map используется для обновления или создания записей)
        const arr = newData.map(e => {
            // Получение ID для текущей строки
            const id = getId(e);
            const newData = { ...(bufTable[id] ?? {}), ...e };
            if (op.updateBuffer)
                bufTable[id] = newData;
            // Попытка найти существующую строку по ID
            const a = grid.api.getRowNode(id)?.data;
            if (!a) {
                // Если строка не найдена - добавить в массив для добавления
                arrNew.push(newData);
                return null; // Новая строка обрабатывается отдельно
            }
            // Если строка найдена - обновить данные в буфере
            return newData;
        }) // Убираем `null` и оставляем только существующие строки
            .filter(e => e);
        if (op.sync) {
            grid.api.applyTransaction({ add: op.add ? arrNew : [], update: op.update ? arr : [] });
            return;
        }
        // Добавление новых строк (если есть элементы)
        if (arrNew.length && op.add) {
            // добавление элементов должно быть синхронно, т.к. может прейти его update до исполнения
            grid.api.applyTransaction({ add: arrNew });
        }
        // Асинхронное обновление существующих строк
        if (arr.length && op.update) {
            grid.api.applyTransactionAsync({ update: arr });
        }
    }
}
const map = new WeakMap();
export function getUpdateTable(grid, newData, getId, bufTable, option) {
    return {};
}
export function applyTransactionAsyncUpdate2(params) {
    const { grid, gridRef, newData, getId, bufTable } = params;
    // Установка параметров (объединение переданных опций с настройками по умолчанию)
    const op = { ...optionsDef, ...(params.option ?? {}) };
    // Проверка наличия сетки и доступа к данным через API
    if (grid?.api.getRowNode) {
        if (!newData) {
            applyTransactionAsyncUpdate(grid, Object.values(bufTable), getId, bufTable, op);
        }
        else
            applyTransactionAsyncUpdate(grid, newData, getId, bufTable, op);
    }
    else if (gridRef?.current?.api.getRowNode) {
        if (!newData) {
            applyTransactionAsyncUpdate(gridRef.current, Object.values(bufTable), getId, bufTable, op);
        }
        else
            applyTransactionAsyncUpdate(gridRef.current, newData, getId, bufTable, op);
    }
    else {
        if (map.get(bufTable))
            map.set(bufTable, new Set());
        const m = map.get(bufTable);
        if (newData)
            newData.forEach(e => {
                // Получение ID для текущей строки
                const id = getId(e);
                // m? - это странно, но так надо
                m?.add(id);
                if (op.updateBuffer)
                    bufTable[id] = { ...(bufTable[id] ?? {}), ...e };
            }); // Убираем `null` и оставляем только существующие строки
    }
}
export function getComparatorGrid(func) {
    return (...param) => {
        const [a1, b1, modeA, modeB, inv] = param; // Распаковка параметров в функцию
        const [a, b] = func ? func(...param) : [a1, b1]; // Использование преобразующей функции func, если передана
        return ((typeof a == "number" && !Number.isNaN(a)) &&
            (typeof b == "number" && !Number.isNaN(b))) // Если оба a и b - валидные числа
            ? a - b // Разница между числами
            : a == b
                ? 0 // Если значения равны, возвращаем 0
                : (!Number.isNaN(b) && b != undefined)
                    ? (inv ? -1 : 1) // Если b существует: порядок определяется inv
                    : (inv ? 1 : -1); // Если b отсутствует: порядок определяется inv
    };
}
