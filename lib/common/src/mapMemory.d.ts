export declare function staticSet(key: any, data: object): void;
export declare function staticGet(key: any): object | undefined;
export declare function deepMergeWithMap(target: any, source: any, visited?: Map<any, any>): any;
export declare function staticGetAdd<T extends object>(key: any, def: T, options?: {
    abs?: boolean;
    deepAutoMerge?: boolean;
    reversDeep?: boolean;
}): T;
export declare function staticGetById<T extends object>(key: any, def: T, id: string | number): T;
export declare const Cash: {
    load(): Promise<void>;
    save(): Promise<void>;
    clean(): Promise<void>;
    getArr: [k: string, v: Map<string, any>][];
};
export declare const MemoryMap: {
    rnd: Map<string, {
        position: {
            x: number;
            y: number;
        };
        size: {
            height: string | number;
            width: string | number;
        };
    }>;
    resize: Map<string, {
        height?: string | number | undefined;
        width?: string | number | undefined;
    }>;
    other: Map<string, object>;
};
