/// <reference types="react" />
import { ColDef, GridReadyEvent } from "ag-grid-community";
declare const optionsDef: {
    update: boolean;
    add: boolean;
    updateBuffer: boolean;
    sync: boolean;
};
type options = Partial<typeof optionsDef>;
export declare function applyTransactionAsyncUpdate<T>(grid: GridReadyEvent<T, any> | null | undefined, newData: (Partial<T>)[], getId: (...a: any[]) => string, bufTable: {
    [id: string]: Partial<T>;
}, option?: options): void;
export declare function getUpdateTable<T>(grid: GridReadyEvent<T, any> | null | undefined, newData: (Partial<T>)[], getId: (...a: any[]) => string, bufTable: {
    [id: string]: Partial<T>;
}, option?: options): {};
type CommonParams<T> = {
    getId: (...a: any[]) => string;
    bufTable: {
        [id: string]: Partial<T>;
    };
    option?: options;
};
type params<T> = CommonParams<T> & ({
    newData: (Partial<T>)[];
    synchronization?: never;
    gridRef?: React.RefObject<GridReadyEvent<T, any> | null | undefined>;
    grid?: GridReadyEvent<T, any> | null | undefined;
} | ({
    newData?: never;
    synchronization: true;
} & ({
    grid: GridReadyEvent<T, any> | null | undefined;
    gridRef?: never;
} | {
    gridRef: React.RefObject<GridReadyEvent<T, any> | null | undefined>;
    grid?: never;
})));
export declare function applyTransactionAsyncUpdate2<T>(params: params<T>): void;
type UnUndefined<T extends (any | undefined)> = T extends undefined ? never : T;
type t1<T = any> = ColDef<T>["comparator"];
type paramsCompare<TData = any> = Parameters<UnUndefined<t1>>;
export declare function getComparatorGrid<T = any>(func?: (...param: paramsCompare<T>) => [a: number, b: number]): t1;
export {};
