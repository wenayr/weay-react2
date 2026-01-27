import {mapResiReact} from "./Resizeble";
import {ExRNDMap3} from "./RNDFunc3";
import {CashFuncMapCash} from "./cash";
import { deepClone } from "wenay-common";

const staticProps = new Map<string,object>()

export function staticSet(key: any, data: object) {
    if (!staticProps.has(key)) staticProps.set(key,data)
}

export function staticGet(key: any) {
    return staticProps.get(key)
}

function isObject(item: any): boolean {
    return item !== null && typeof item === 'object' && !Array.isArray(item);
}

export function deepMergeWithMap(target: any, source: any, visited = new Map<any, any>()) {
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) {
                    target[key] = {};
                }
                // Check if the source object has already been visited
                if (!visited.has(source[key])) {
                    visited.set(source[key], {});
                    deepMergeWithMap(target[key], source[key], visited);
                } else {
                    target[key] = visited.get(source[key]);
                }
            } else {
                target[key] = source[key];
            }
        }
    }
    return target;
}


const map = new Map<object, boolean>

export function staticGetAdd<T extends object>(key: any, def: T, options: {abs?: boolean, deepAutoMerge?: boolean, reversDeep?: boolean} = {reversDeep: false}) {
    if (options.deepAutoMerge && !map.get(def)) {
        map.set(def, true)
        if (options.deepAutoMerge) {
            if (!options.reversDeep) staticProps.set(key, deepMergeWithMap(staticProps.get(key) ?? {}, def))
            else staticProps.set(key, deepMergeWithMap(deepClone(def), staticProps.get(key) ?? {}))
        }
    }
    if (options.abs) staticProps.set(key, def)
    const t = (staticProps.get(key) || staticProps.set(key, def).get(key)!) as T
    return t// Object.assign(def, t) // t //
}

export function staticGetById<T extends object>(key: any, def: T, id: string|number){
    const t = map.get(key)
    type t = {__id: string|number, data: T}
    const el: t = {__id: id, data: def}
    if ((el && el.__id != id) || !el) {
        return staticGetAdd(key, el, {abs: true}).data
    }
    return el.data
}
export const Cash = CashFuncMapCash(
    [
        ["mapResiReact", mapResiReact],
        ["ExRNDMap3", ExRNDMap3],
        ["staticProps", staticProps]
    ]
)

export const MemoryMap = {
    rnd: ExRNDMap3,
    resize: mapResiReact,
    other: staticProps
}