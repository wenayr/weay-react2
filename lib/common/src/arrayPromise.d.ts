export declare function ArrayPromise<T extends any = unknown>({ arr, catchF, thenF }: {
    arr: (() => Promise<T>)[];
    thenF?: (data: T, i: number, countOk: number, countError: number, count: number) => any;
    catchF?: (error: unknown, i: number, countOk: number, countError: number, count: number) => any;
}): (() => Promise<any>)[];
