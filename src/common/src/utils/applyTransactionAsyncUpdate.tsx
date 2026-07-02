import {ColDef, GridReadyEvent} from "ag-grid-community";
// Wrapper to simplify working with the grid through a memory point
const optionsDef = {
    update: true,
    add: true,
    updateBuffer: true,
    sync: false,
}
type options = Partial<typeof optionsDef>

function applyTransactionAsyncUpdate3<T>({getId, bufTable, option, newData, grid, remove} : {
                                             grid: GridReadyEvent<T, any> | null | undefined,
                                             newData: (Partial<T>)[],
                                             remove?: (Partial<T>)[],
                                             getId: (...a: any[]) => string,
                                             bufTable: { [id: string]: Partial<T> },
                                             option?: options
                                         }
) {
    const op = {...optionsDef, ...(option ?? {})};
    if (!grid?.api.getRowNode) return

    // Determine which rows must be added and which only need updates
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
            remove: remove as any,
        });
        return
    }

    // Apply remove once and independently: otherwise removal was lost with empty add/update and duplicated with both
    if ((arrNew.length && op.add) || remove?.length)
        grid.api.applyTransaction({add: (arrNew.length && op.add) ? arrNew : [], remove: remove as any});

    if (arr.length && op.update)
        grid.api.applyTransactionAsync({update: arr});
}
// There is no removal here, but this version may still be used somewhere
/**
 * @deprecated v1: does not support row removal and silently loses data while the grid is not ready.
 * Use `useAgGrid`/`createGridBuffer` (grid/agGrid4) - buffer + attach/sync,
 * or at least `applyTransactionAsyncUpdate2`.
 */
export function applyTransactionAsyncUpdate<T>(
    grid: GridReadyEvent<T, any> | null | undefined,
    newData: (Partial<T>)[],
    getId: (...a: any[]) => string,
    bufTable: { [id: string]: Partial<T> },
    option?: options
) {
    return applyTransactionAsyncUpdate3({getId, option, newData, grid, bufTable})
}

/** @deprecated No-op stub: always returns {}. Never implemented; will be removed in a major version. */
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
    onlyMemo?: boolean;
}
    | ({
    newData?: never;
    removeData?: never;
    synchronization: true;
    onlyMemo?: never;
} & (
    | { grid: GridReadyEvent<T, any> | null | undefined; gridRef?: never }
    | { gridRef: React.RefObject<GridReadyEvent<T, any> | null | undefined>; grid?: never }
    ))
    );

function resolveGrid<T>(params: params<T>): GridReadyEvent<T, any> | null {
    if (params.grid?.api?.getRowNode) return params.grid
    if (params.gridRef?.current?.api?.getRowNode) return params.gridRef.current
    return null
}

export function applyTransactionAsyncUpdate2<T>(params: params<T>) {
    const {getId, bufTable, newData, removeData} = params;
    const op = {...optionsDef, ...(params.option ?? {})};
    const g = resolveGrid(params);

    if (g && params.onlyMemo!=true) {
        if (params.synchronization) {
            // === SYNCHRONIZATION: bufTable is the source of truth ===
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
            const toRemove: T[] = [];
            removeData?.forEach(e => {
                const id = getId(e);
                delete bufTable[id];
                const existing = g.api.getRowNode(id)?.data;
                if (existing) toRemove.push(existing);
            });

            if (newData?.length || toRemove.length)
                applyTransactionAsyncUpdate3({grid:g, newData: newData ?? [], getId, bufTable, option: op, remove: toRemove});
        }
    } else {
        newData?.forEach(e => {
            const id = getId(e);
            bufTable[id] = {...(bufTable[id] ?? {}), ...e} as T
        });

        removeData?.forEach(e => {
            delete bufTable[getId(e)];
        });
    }
}


type UnUndefined<T extends (any | undefined)> = T extends undefined ? never : T
type t1<T = any> = ColDef<T>["comparator"]
type paramsCompare<TData = any> = Parameters<Extract<UnUndefined<t1>, (...args: any) => any>>

/** @deprecated Duplicate of `numericComparator` from grid/agGrid4 (core.ts) - use that instead. */
export function getComparatorGrid<T = any>(func?: (...param: paramsCompare<T>) => [a: number, b: number]): t1 {
    return (...param) => {
        const [a1, b1, modeA, modeB, inv] = param; // Unpack parameters into the function
        const [a, b] = func ? func(...param) : [a1, b1]; // Use the transforming func if provided
        return (
            (typeof a == "number" && !Number.isNaN(a)) &&
            (typeof b == "number" && !Number.isNaN(b))
        ) // If both a and b are valid numbers
            ? a - b // Difference between numbers
            : a == b
                ? 0 // If values are equal, return 0
                : (!Number.isNaN(b) && b != undefined)
                    ? (inv ? -1 : 1) // If b exists: order is determined by inv
                    : (inv ? 1 : -1); // If b is missing: order is determined by inv
    }
}