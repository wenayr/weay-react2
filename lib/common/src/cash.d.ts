export interface IServerSaveBasePromise {
    set(key: string, value: object): Promise<boolean>;
    get<T extends (object)>(key: string): Promise<T | null>;
    delete(key: string): Promise<boolean>;
}
export declare class CSaveToCache implements IServerSaveBasePromise {
    set(key: string, value: object): Promise<boolean>;
    get<T extends object>(key: string): Promise<T | null>;
    delete<T extends object>(key: string): Promise<boolean>;
}
export declare class CSaveToLocalStorage implements IServerSaveBasePromise {
    set(key: string, value: object): Promise<boolean>;
    get<T extends object>(key: string): Promise<T | null>;
    delete<T extends object>(key: string): Promise<boolean>;
    deleteAll(): Promise<boolean>;
}
export declare const CacheG: CSaveToCache;
export declare const CacheLocal: CSaveToLocalStorage;
export declare const ObjectStringToDate: (obj: any) => void;
export declare function CashFuncMapBase(arr: [k: string, v: Map<string, any>][], Save: IServerSaveBasePromise): {
    load(): Promise<void>;
    save(): Promise<void>;
    clean(): Promise<void>;
    getArr: [k: string, v: Map<string, any>][];
};
export declare function CashFuncMapCash(arr: [k: string, v: Map<string, any>][]): {
    load(): Promise<void>;
    save(): Promise<void>;
    clean(): Promise<void>;
    getArr: [k: string, v: Map<string, any>][];
};
