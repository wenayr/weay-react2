import { deepClone } from "wenay-common2";
import { renderBy } from "../../updateBy";
import { floatingWindowMap } from "../components/Dnd/FloatingWindow";
import { mapResiReact } from "../components/Dnd/Resizable";
import { mapRightMenu } from "../components/Menu/RightMenuStore";
import {createCacheMap} from "./cache";
import { ObservableMap } from "./observableMap";

// observable - memoryCache marks itself dirty on its mutations
const memoryProps = new ObservableMap<string,object>()

export function memorySet(key: any, data: object) {
    if (!memoryProps.has(key)) memoryProps.set(key,data)
}

export function memoryGet(key: any) {
    return memoryProps.get(key)
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


// WeakSet: a strict Map kept every def object alive forever
const merged = new WeakSet<object>()

export function memoryGetOrCreate<T extends object>(key: any, def: T, options: {abs?: boolean, deepAutoMerge?: boolean, reversDeep?: boolean} = {reversDeep: false}) {
    if (options.deepAutoMerge && !merged.has(def)) {
        merged.add(def)
        if (!options.reversDeep) memoryProps.set(key, deepMergeWithMap(memoryProps.get(key) ?? {}, def))
        else memoryProps.set(key, deepMergeWithMap(deepClone(def), memoryProps.get(key) ?? {}))
    }
    if (options.abs) memoryProps.set(key, def)
    const t = (memoryProps.has(key) ? memoryProps.get(key) : memoryProps.set(key, def).get(key)!) as T
    return t// Object.assign(def, t) // t //
}

/** Announce a direct in-place mutation of an object taken from memoryGetOrCreate - such
 *  mutations are invisible to map methods. memorySet/memoryGetOrCreate need no announcement:
 *  their set() calls are observed by memoryCache automatically. */
export function memoryMarkDirty(key: any) {
    memoryProps.touch(typeof key == "string" ? key : undefined)
}

/** App-facing change of a persisted memoryProps entry in one call:
 *  mutate + rerender subscribers + mark the cache dirty. No-op if the key is absent. */
export function memoryUpdate<T extends object>(key: any, mutate: (cur: T) => void): T | undefined {
    const cur = memoryProps.get(key) as T | undefined
    if (cur === undefined) return undefined
    mutate(cur)
    renderBy(cur)
    memoryMarkDirty(key)
    return cur
}

export function memoryGetById<T extends object>(key: any, def: T, id: string|number){
    type W = {__id: string|number, data: T}
    const stored = memoryProps.get(key) as W | undefined
    if (!stored || stored.__id !== id) {
        const fresh: W = {__id: id, data: def}
        memoryProps.set(key, fresh)
        return fresh.data
    }
    return stored.data
}
export const memoryCache = createCacheMap(
    [
        ["mapResiReact", mapResiReact],
        ["floatingWindowMap", floatingWindowMap],
        ["mapRightMenu", mapRightMenu],
        ["memoryProps", memoryProps]
    ]
)

export const memoryMaps = {
    rnd: floatingWindowMap,
    resize: mapResiReact,
    rightMenu: mapRightMenu,
    other: memoryProps
}
