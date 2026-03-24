import {ColDef, GridReadyEvent} from "ag-grid-community";

const optionsDef = {
    update: true,
    add: true,
    updateBuffer: true,
    sync: false,
}
type options = Partial<typeof optionsDef>

export function applyTransactionAsyncUpdate<T>(
    grid: GridReadyEvent<T, any> | null | undefined,
    newData: (Partial<T>)[],
    getId: (...a: any[]) => string,
    bufTable: { [id: string]: Partial<T> },
    option?: options
) {
    const op = {...optionsDef, ...(option ?? {})};
    if (!grid?.api.getRowNode) return

    const arrNew: T[] = [];
    const arr = newData.map(e => {
        const id = getId(e);
        const merged = {...(bufTable[id] ?? {}), ...e} as T
        if (op.updateBuffer) bufTable[id] = merged
        const existing = grid.api.getRowNode(id)?.data;
        if (!existing) { arrNew.push(merged); return null }
        return merged;
    }).filter(e => e) as T[];

    if (op.sync) {
        grid.api.applyTransaction({
            add: op.add ? arrNew : [],
            update: op.update ? arr : [],
        });
        return
    }

    if (arrNew.length && op.add)
        grid.api.applyTransaction({add: arrNew});

    if (arr.length && op.update)
        grid.api.applyTransactionAsync({update: arr});
}

const map = new WeakMap()

export function getUpdateTable<T>(
    grid: GridReadyEvent<T, any> | null | undefined,
    newData: (Partial<T>)[],
    getId: (...a: any[]) => string,
    bufTable: { [id: string]: Partial<T> },
    option?: options) {

    return {}
}

type CommonParams<T> = {
    getId: (...a: any[]) => string;
    bufTable: { [id: string]: Partial<T> };
    option?: options;
}

type params<T> = CommonParams<T> & (
    | {
        newData?: (Partial<T>)[];
        removeData?: (Partial<T>)[];
        synchronization?: never;
        gridRef?: React.RefObject<GridReadyEvent<T, any> | null | undefined>;
        grid?: GridReadyEvent<T, any> | null | undefined;
    }
    | ({
        newData?: never;
        removeData?: never;
        synchronization: true;
    } & (
        | { grid: GridReadyEvent<T, any> | null | undefined; gridRef?: never }
        | { gridRef: React.RefObject<GridReadyEvent<T, any> | null | undefined>; grid?: never }
    ))
);

function resolveGrid<T>(params: params<T>): GridReadyEvent<T, any> | null {
    if (params.grid?.api?.getRowNode) return params.grid
    const ref = ('gridRef' in params) ? params.gridRef : undefined
    if (ref?.current?.api?.getRowNode) return ref.current
    return null
}

export function applyTransactionAsyncUpdate2<T>(params: params<T>) {
    const {getId, bufTable} = params;
    const op = {...optionsDef, ...(params.option ?? {})};
    const g = resolveGrid(params);

    if (g) {
        if (params.synchronization) {
            // === СИНХРОНИЗАЦИЯ: bufTable — истина ===
            const bufIds = new Set(Object.keys(bufTable));
            const gridIds = new Set<string>();
            const arrAdd: T[] = [];
            const arrUpdate: T[] = [];
            const arrRemove: T[] = [];

            g.api.forEachNode(node => {
                if (!node.data) return
                const id = getId(node.data);
                gridIds.add(id);
                if (!bufIds.has(id)) arrRemove.push(node.data);
                else arrUpdate.push(bufTable[id] as T);
            });

            for (const id of bufIds)
                if (!gridIds.has(id)) arrAdd.push(bufTable[id] as T);

            if (arrAdd.length || arrUpdate.length || arrRemove.length)
                g.api.applyTransaction({
                    add: op.add ? arrAdd : [],
                    update: op.update ? arrUpdate : [],
                    remove: arrRemove,
                });
        } else {
            const newData = 'newData' in params ? params.newData : undefined;
            const removeData = 'removeData' in params ? params.removeData : undefined;

            // Сначала удаляем — чтобы async update не конфликтовал
            if (removeData?.length) {
                const toRemove: T[] = [];
                removeData.forEach(e => {
                    const id = getId(e);
                    delete bufTable[id];
                    const existing = g.api.getRowNode(id)?.data;
                    if (existing) toRemove.push(existing);
                });
                if (toRemove.length)
                    g.api.applyTransaction({remove: toRemove});
            }

            if (newData?.length)
                applyTransactionAsyncUpdate(g, newData, getId, bufTable, op);
        }
    } else {
        // === ГРИД НЕ ГОТОВ — работаем только с буфером ===
        if (!map.has(bufTable)) map.set(bufTable, new Set())
        const m = map.get(bufTable) as Set<string> | undefined

        const newData = 'newData' in params ? params.newData : undefined;
        const removeData = 'removeData' in params ? params.removeData : undefined;

        if (newData)
            newData.forEach(e => {
                const id = getId(e);
                m?.add(id)
                if (op.updateBuffer) bufTable[id] = {...(bufTable[id] ?? {}), ...e} as T
            });

        if (removeData)
            removeData.forEach(e => {
                const id = getId(e);
                m?.delete(id);
                delete bufTable[id];
            });
    }
}


type UnUndefined<T extends (any | undefined)> = T extends undefined ? never : T
type t1<T = any> = ColDef<T>["comparator"]
type paramsCompare<TData = any> = Parameters<Extract<UnUndefined<t1>, (...args: any) => any>>

export function getComparatorGrid<T = any>(func?: (...param: paramsCompare<T>) => [a: number, b: number]): t1 {
    return (...param) => {
        const [a1, b1, modeA, modeB, inv] = param; // Распаковка параметров в функцию
        const [a, b] = func ? func(...param) : [a1, b1]; // Использование преобразующей функции func, если передана
        return (
            (typeof a == "number" && !Number.isNaN(a)) &&
            (typeof b == "number" && !Number.isNaN(b))
        ) // Если оба a и b - валидные числа
            ? a - b // Разница между числами
            : a == b
                ? 0 // Если значения равны, возвращаем 0
                : (!Number.isNaN(b) && b != undefined)
                    ? (inv ? -1 : 1) // Если b существует: порядок определяется inv
                    : (inv ? 1 : -1); // Если b отсутствует: порядок определяется inv
    }
}