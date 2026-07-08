import type {GridReadyEvent} from "ag-grid-community";
import type {RefObject} from "react";

const defaultGridRowsOptions = {
    update: true,
    add: true,
    updateBuffer: true,
    sync: false,
}

export type GridRowsOptions = Partial<typeof defaultGridRowsOptions>

type GridRowsCoreParams<T> = {
    grid: GridReadyEvent<T, any> | null | undefined,
    newData: (Partial<T>)[],
    remove?: (Partial<T>)[],
    getId: (...a: any[]) => string,
    bufTable: { [id: string]: Partial<T> },
    option?: GridRowsOptions
}

function applyGridRowsCore<T>({getId, bufTable, option, newData, grid, remove}: GridRowsCoreParams<T>) {
    const op = {...defaultGridRowsOptions, ...(option ?? {})};
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
            remove: remove as any,
        });
        return
    }

    if ((arrNew.length && op.add) || remove?.length)
        grid.api.applyTransaction({add: (arrNew.length && op.add) ? arrNew : [], remove: remove as any});

    if (arr.length && op.update)
        grid.api.applyTransactionAsync({update: arr});
}

type CommonGridRowsParams<T> = {
    getId: (...a: any[]) => string;
    bufTable: { [id: string]: Partial<T> };
    option?: GridRowsOptions;
}

export type ApplyGridRowsParams<T> = CommonGridRowsParams<T> & (
    | {
    newData?: (Partial<T>)[];
    removeData?: (Partial<T>)[];
    synchronization?: never;
    gridRef?: RefObject<GridReadyEvent<T, any> | null | undefined>;
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
    | { gridRef: RefObject<GridReadyEvent<T, any> | null | undefined>; grid?: never }
    ))
    );

function resolveGrid<T>(params: ApplyGridRowsParams<T>): GridReadyEvent<T, any> | null {
    if (params.grid?.api?.getRowNode) return params.grid
    if (params.gridRef?.current?.api?.getRowNode) return params.gridRef.current
    return null
}

export function applyGridRows<T>(params: ApplyGridRowsParams<T>) {
    const {getId, bufTable, newData, removeData} = params;
    const op = {...defaultGridRowsOptions, ...(params.option ?? {})};
    const g = resolveGrid(params);

    if (g && params.onlyMemo != true) {
        if (params.synchronization) {
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
                applyGridRowsCore({grid: g, newData: newData ?? [], getId, bufTable, option: op, remove: toRemove});
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