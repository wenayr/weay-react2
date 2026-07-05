import { deepClone } from "wenay-common2";
import { renderBy } from "../../updateBy";
import { ExRNDMap3 } from "../components/Dnd/RNDFunc3";
import { mapResiReact } from "../components/Dnd/Resizable";
import { mapRightMenu } from "../components/Menu/RightMenuStore";
import {CacheFuncMap} from "./cache";
import { markDirty } from "./cacheDirty";

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


// WeakSet: a strict Map kept every def object alive forever
const merged = new WeakSet<object>()

export function staticGetAdd<T extends object>(key: any, def: T, options: {abs?: boolean, deepAutoMerge?: boolean, reversDeep?: boolean} = {reversDeep: false}) {
    if (options.deepAutoMerge && !merged.has(def)) {
        merged.add(def)
        if (!options.reversDeep) staticProps.set(key, deepMergeWithMap(staticProps.get(key) ?? {}, def))
        else staticProps.set(key, deepMergeWithMap(deepClone(def), staticProps.get(key) ?? {}))
    }
    if (options.abs) staticProps.set(key, def)
    const t = (staticProps.has(key) ? staticProps.get(key) : staticProps.set(key, def).get(key)!) as T
    return t// Object.assign(def, t) // t //
}

/** Mark a persisted staticProps entry dirty after a direct mutation of an object taken
 *  from staticGetAdd - such mutations are invisible to the library, someone must announce
 *  them. staticSet/staticGetAdd themselves stay silent: they only initialize/merge. */
export function staticMarkDirty(key: any) {
    markDirty("staticProps", typeof key == "string" ? key : undefined)
}

/** App-facing change of a persisted staticProps entry in one call:
 *  mutate + rerender subscribers + mark the cache dirty. No-op if the key is absent. */
export function staticUpdate<T extends object>(key: any, mutate: (cur: T) => void): T | undefined {
    const cur = staticProps.get(key) as T | undefined
    if (cur === undefined) return undefined
    mutate(cur)
    renderBy(cur)
    staticMarkDirty(key)
    return cur
}

export function staticGetById<T extends object>(key: any, def: T, id: string|number){
    type W = {__id: string|number, data: T}
    const stored = staticProps.get(key) as W | undefined
    if (!stored || stored.__id !== id) {
        const fresh: W = {__id: id, data: def}
        staticProps.set(key, fresh)
        return fresh.data
    }
    return stored.data
}
export const Cash = CacheFuncMap(
    [
        ["mapResiReact", mapResiReact],
        ["ExRNDMap3", ExRNDMap3],
        ["mapRightMenu", mapRightMenu],
        ["staticProps", staticProps]
    ]
)

export const MemoryMap = {
    rnd: ExRNDMap3,
    resize: mapResiReact,
    rightMenu: mapRightMenu,
    other: staticProps
}
