/// <reference types="react" />
type tFunc2 = Map<object, (a?: any) => void>;
export declare const map3: WeakMap<object, tFunc2>;
export declare const mapWait: Map<object, {
    refreshAsync: (ms: number, func: () => any) => void;
    refreshAsync2: (ms: number, func: () => any) => Promise<void>;
}>;
export declare function renderBy(a: object, ms?: number): void;
export declare function renderByRevers(a: object, ms?: number, reverse?: boolean): void;
export declare function renderByLast(a: object, ms?: number): void;
export declare function useUpdateBy<T extends object>(a: T, f?: React.Dispatch<React.SetStateAction<T>> | ((a: T) => void)): void;
export declare function updateBy<T extends object>(a: T, f?: React.Dispatch<React.SetStateAction<T>> | ((a: T) => void)): void;
export {};
