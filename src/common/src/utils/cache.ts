import {useEffect, useMemo} from "react";
import {renderBy} from "../../updateBy.js";
import {ObservableMap} from "./observableMap.js";

export type DirtyListener = (scope?: string, key?: string) => void

export interface CacheStorage {
    set(key: string, value: object): Promise<boolean>
    get<T extends (object)>(key: string): Promise<T | null>;
    delete(key: string): Promise<boolean>;
}

// Стабильный ключ запроса внутри Cache: НЕ зависит от текущего маршрута SPA
// (path/query/hash). Legacy-ключ (полный location) читается как fallback с миграцией,
// чтобы не потерять кэши, записанные прежней версией.
const STABLE_CACHE_PATH = "/__wenay-react2-cache__";

function getStableRequestKey() {
    return typeof location != "undefined" ? location.origin + STABLE_CACHE_PATH : "wenay-react2";
}

function getLegacyRequestKey() {
    return typeof location != "undefined" ? location.toString() : "wenay-react2";
}

export class BrowserCacheStorage implements CacheStorage{
    async set(key: string, value: object) : Promise<boolean>  {
        const t = new Response(JSON.stringify(value));
        if (typeof caches != "undefined") {
            const Cache = await caches.open(key)
            await Cache.put(getStableRequestKey(), t);
            return true
        }
        return false
    }
    async get<T extends object>(key: string) : Promise<T|null> {
        if (typeof caches != "undefined") {
            const Cache = await caches.open(key)
            const stableKey = getStableRequestKey()
            let cachedResponse = await Cache.match(stableKey);
            if (!cachedResponse) {
                const legacyKey = getLegacyRequestKey()
                if (legacyKey != stableKey) {
                    const legacyResponse = await Cache.match(legacyKey)
                    if (legacyResponse) {
                        await Cache.put(stableKey, legacyResponse.clone())
                        await Cache.delete(legacyKey)
                        cachedResponse = legacyResponse
                    }
                }
            }
            if (cachedResponse) {
                return ( await cachedResponse.json()) as T
            }
        }
        return null
    }
    async delete<T extends object>(key: string) : Promise<boolean> {
        if (typeof caches != "undefined") {
            return await caches.delete(key)
        }
        return false
    }

}

export class LocalStorageCache implements CacheStorage {
    /** Keys explicitly accessed through this storage instance. `deleteAll()` must never
     * clear unrelated application state from the shared browser localStorage. */
    private readonly keys = new Set<string>()

    async set(key: string, value: object) : Promise<boolean>  {
        if (typeof localStorage != "undefined") {
            localStorage.setItem(key, JSON.stringify(value))
            this.keys.add(key)
            return true
        }
        return false
    }
    async get<T extends object>(key: string) : Promise<T|null> {
        if (typeof localStorage != "undefined") {
            this.keys.add(key)
            const st = localStorage.getItem(key)
            if (st) { try { return JSON.parse(st) } catch { return null } }
        }
        return null
    }
    async delete<T extends object>(key: string) : Promise<boolean> {
        if (typeof localStorage != "undefined") {
            localStorage.removeItem(key)
            this.keys.delete(key)
            return true
        }
        return false
    }

    /** Compatibility helper: clear only keys owned by this instance. */
    async deleteAll() : Promise<boolean> {
        if (typeof localStorage != "undefined") {
            for (const key of this.keys) localStorage.removeItem(key)
            this.keys.clear()
            return true
        }
        return false
    }
}

export const browserCacheStorage = new BrowserCacheStorage()
export const localStorageCache = new LocalStorageCache()

function addDataToMap(data: [k: string,v: unknown][], map: Map<string,unknown>) {
    for (let [k,v] of data) {
        const tr = map.has(k) ? map.get(k) : map.set(k, v).get(k)!
        if (tr && typeof tr === 'object') {
            Object.assign(tr, v)
            renderBy(tr)
        }
    }
}
export const restoreDates = (obj: unknown): void => {
    if (typeof obj == "object" && obj) {
        if (Array.isArray(obj)) obj.forEach(restoreDates)
        else Object.entries(obj).forEach(([k,v])=>{
            if (typeof v == "string") {
                if (isDate(v)) {(obj as Record<string, unknown>)[k] = new Date(v)}
            }
            if (typeof v == "object") restoreDates(v)
        })
    }
}
// module-level constant: this runs for every string of every cached object on load
const ISO_DATE_RE = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\.[0-9]+)?(Z)?$/;
function isDate(_date: string){
    return ISO_DATE_RE.test(_date);
}

export function createCacheMapWithStorage(arr: [k: string, v: Map<string, unknown>][], Save: CacheStorage) {
    const savedPayloadByKey = new Map<string, string>()
    let saveTimer: ReturnType<typeof setTimeout> | null = null
    let runningSave: Promise<void> | null = null

    // Instance dirty channel, fed by the ObservableMaps this instance owns (plain Maps stay
    // silent - announce those via markDirty). The dirty flag is set synchronously; emission
    // to subscribers is coalesced and asynchronous, because map mutations also happen inside
    // render/init paths where subscriber code must not run. scope/key are event metadata
    // only - WHAT gets written is decided by the serialized-snapshot diff, so a missed
    // announcement degrades to "saved later" and an extra one to a no-op write.
    const dirtyListeners = new Set<DirtyListener>()
    const pendingEvents = new Map<string, [scope?: string, key?: string]>()
    let dirty = false
    let loading: Promise<unknown> | null = null
    let emitScheduled = false

    const markDirty = (scope?: string, key?: string) => {
        dirty = true
        if (dirtyListeners.size === 0) return
        pendingEvents.set(scope + "\0" + key, [scope, key])
        if (emitScheduled) return
        emitScheduled = true
        // microtask, not setTimeout: background tabs throttle timers to >=1s,
        // and a microtask still never fires in the middle of a component render
        queueMicrotask(() => {
            emitScheduled = false
            const events = [...pendingEvents.values()]
            pendingEvents.clear()
            for (const [scope, key] of events)
                for (const cb of [...dirtyListeners]) cb(scope, key)
        })
    }
    const offMaps: Array<() => void> = []
    for (const [scope, map] of arr) {
        if (map instanceof ObservableMap) offMaps.push(map.onChange(key => {
            if (loading) return // load()'s own mutations are not user changes
            markDirty(scope, typeof key == "string" ? key : undefined)
        }))
    }

    const getPayloads = () => arr.map(([key, map]) => [key, JSON.stringify([...map.entries()])] as const)
    const rememberCurrentPayloads = () => {
        savedPayloadByKey.clear()
        for (const [key, payload] of getPayloads()) savedPayloadByKey.set(key, payload)
    }
    const cancelDebouncedSave = () => {
        if (saveTimer === null) return
        clearTimeout(saveTimer)
        saveTimer = null
    }
    const saveChangedPayloads = async () => {
        // a save racing an in-flight load() would diff against the pre-load snapshot and
        // overwrite stored data with in-memory defaults - wait the load out first
        while (loading) await loading
        // reset at cycle START: a change arriving mid-write must survive for the next save
        dirty = false
        // Deliberately a full diff, not a scope-filtered one: the docblock above makes the
        // serialized snapshot the source of truth precisely so a MISSED announcement (an
        // in-place mutation without touch()) still degrades to "saved later" rather than
        // "never saved". Scoping the scan would quietly turn that tolerance into data loss.
        for (const [key, payload] of getPayloads()) {
            if (savedPayloadByKey.get(key) === payload) continue
            if (await Save.set(key, JSON.parse(payload) as object)) {
                savedPayloadByKey.set(key, payload)
            }
        }
    }
    const trackSave = (savePromise: Promise<void>) => {
        const trackedPromise = savePromise.catch(() => undefined).finally(() => {
            if (runningSave === trackedPromise) runningSave = null
        })
        runningSave = trackedPromise
        return savePromise
    }
    const queueSave = () => {
        if (runningSave === null) return trackSave(saveChangedPayloads())
        return trackSave(runningSave.then(saveChangedPayloads, saveChangedPayloads))
    }

    return {
        async load(){
            // while loading, the maps emit from addDataToMap - those are not user changes,
            // the onChange subscription above ignores them for as long as `loading` is set
            const run = (async () => {
                for (let [k,v] of arr) {
                    const t = await Save.get<[k: string, v: unknown][]>(k)
                    if (!t) continue
                    restoreDates(t)
                    addDataToMap(t, v)
                }
            })()
            const tracked = run.catch(() => undefined)
            loading = tracked
            try { await run } finally {
                if (loading === tracked) loading = null
            }
            rememberCurrentPayloads()
            dirty = false
        },
        async save(){
            await queueSave()
        },
        saveDebounced(delay = 800){
            cancelDebouncedSave()
            saveTimer = setTimeout(() => {
                saveTimer = null
                void queueSave()
            }, delay)
        },
        async flush(){
            cancelDebouncedSave()
            await queueSave()
        },
        async clear(){
            cancelDebouncedSave()
            savedPayloadByKey.clear()
            dirty = false
            for (let [k,v] of arr) {
                await Save.delete(k)
            }
        },
        /** Manual announcement for state the observable maps cannot see (plain Map entries). */
        markDirty,
        /** Subscribe to this instance's dirty events (coalesced, async); returns unsubscribe. */
        onDirty(cb: DirtyListener): () => void {
            dirtyListeners.add(cb)
            return () => { dirtyListeners.delete(cb) }
        },
        /** Cheap hint (e.g. a beforeunload guard); the save diff is the source of truth. */
        isDirty(): boolean { return dirty },
        /** Release this cache's subscriptions to the maps it was built over. Only needed for
         *  caches created per route/session over longer-lived maps - the module-level
         *  memoryCache lives as long as the page. The maps and storage are left untouched. */
        dispose(): void {
            cancelDebouncedSave()
            for (const off of offMaps) off()
            offMaps.length = 0
            dirtyListeners.clear()
        },
        getArr: arr
    }
}

export function createCacheMap(arr: [k: string, v: Map<string, unknown>][]) {
    return createCacheMapWithStorage(arr, localStorageCache)
}

export type CacheMap = ReturnType<typeof createCacheMapWithStorage>

/** The app-side persistence contract as one hook: load() on mount, then subscribe the dirty
 *  channel to saveDebounced(delay). The app still owns the write policy - this only wires the
 *  documented default (`doc/EXAMPLE_USAGE.md`). Returns pass-through methods for the rare
 *  imperative needs; `reload` is an explicit alias of `load` (a second load() merges storage
 *  on top of current maps - it is not a reset). */
export function useCacheMapPersistence(cache: CacheMap, delay = 300) {
    // two effects on purpose: load() merges storage ON TOP of the current maps, so keeping it
    // in the same effect as the dirty subscription made a changed `delay` re-run the merge and
    // roll unsaved values back
    useEffect(() => { void cache.load() }, [cache])
    useEffect(() => cache.onDirty(() => cache.saveDebounced(delay)), [cache, delay])
    return useMemo(() => ({
        isDirty: () => cache.isDirty(),
        flush: () => cache.flush(),
        save: () => cache.save(),
        reload: () => cache.load(),
    }), [cache])
}
