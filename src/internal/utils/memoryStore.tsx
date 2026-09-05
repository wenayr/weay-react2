import { deepClone } from "./deepClone.js";
import { renderBy } from "../updateBy.js";
import { buttonStatusMap, floatingWindowMap, mapResiReact, mapRightMenu } from "./persistedMaps.js";
import {createCacheMap} from "./cache.js";
import { ObservableMap } from "./observableMap.js";

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

type MergeStats = {changed: number}

function mergeInto(target: any, source: any, visited: Map<any, any>, stats: MergeStats) {
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            const value = source[key];
            if (isObject(value)) {
                // A source subtree met twice (a shared or cyclic def) must land as the SAME
                // merged target. The map used to store a {} placeholder that was never filled
                // in, so the second occurrence was replaced by an empty object.
                if (visited.has(value)) {
                    const seen = visited.get(value);
                    if (target[key] !== seen) { target[key] = seen; stats.changed++ }
                    continue;
                }
                // A truthy primitive is not a merge base: recursing into it was a no-op that
                // silently dropped the whole source subtree.
                if (!isObject(target[key])) { target[key] = {}; stats.changed++ }
                visited.set(value, target[key]);
                mergeInto(target[key], value, visited, stats);
            }
            // arrays are not merged (source wins, as before) but must not be aliased -
            // a push into the state would otherwise mutate the module-level def forever
            else if (Array.isArray(value)) {
                if (!sameArray(target[key], value)) { target[key] = value.slice(); stats.changed++ }
            }
            else if (target[key] !== value || !(key in target)) { target[key] = value; stats.changed++ }
        }
    }
    return target;
}

function sameArray(a: any, b: readonly any[]): boolean {
    return Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
}

export function deepMergeWithMap(target: any, source: any, visited = new Map<any, any>()) {
    return mergeInto(target, source, visited, {changed: 0});
}


// WeakSet: a strict Map kept every def object alive forever
const merged = new WeakSet<object>()

/** `def` is expected to be a STABLE reference (a module-level constant): the merge dedup is a
 *  WeakSet keyed by its identity. An inline object literal is a new identity on every render,
 *  so the merge re-runs each time - it stays correct, and a no-op merge no longer re-announces
 *  the entry, but the deep walk itself is still paid per render. */
export function memoryGetOrCreate<T extends object>(key: any, def: T, options: {abs?: boolean, deepAutoMerge?: boolean, reversDeep?: boolean} = {reversDeep: false}) {
    if (options.deepAutoMerge && !merged.has(def)) {
        merged.add(def)
        const stats: MergeStats = {changed: 0}
        const had = memoryProps.has(key)
        const next = !options.reversDeep
            ? mergeInto(memoryProps.get(key) ?? {}, def, new Map(), stats)
            : mergeInto(deepClone(def), memoryProps.get(key) ?? {}, new Map(), stats)
        // set() always emits, and the emit reaches memoryCache as a dirty event; with an
        // unstable def that fired on every render even when the merge changed nothing
        if (!had || stats.changed > 0 || memoryProps.get(key) !== next) memoryProps.set(key, next)
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
        ["buttonStatusMap", buttonStatusMap],
        ["memoryProps", memoryProps]
    ]
)

export const memoryMaps = {
    rnd: floatingWindowMap,
    resize: mapResiReact,
    rightMenu: mapRightMenu,
    button: buttonStatusMap,
    other: memoryProps
}
