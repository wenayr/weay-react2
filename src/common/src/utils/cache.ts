import {renderBy} from "../../updateBy";

export interface IServerSaveBasePromise {
    set(key: string, value: object): Promise<boolean>
    get<T extends (object)>(key: string): Promise<T | null>;
    delete(key: string): Promise<boolean>;
}

function getHostName() {
    return typeof location != "undefined" ? location.toString() : "wenay-react2";
}

export class CSaveToCache implements IServerSaveBasePromise{
    async set(key: string, value: object) : Promise<boolean>  {
        const t = new Response(JSON.stringify(value));
        if (typeof caches != "undefined") {
            const Cache = await caches.open(key)
            await Cache.put(getHostName(), t);
            return true
        }
        return false
    }
    async get<T extends object>(key: string) : Promise<T|null> {
        if (typeof caches != "undefined") {
            const Cache = await caches.open(key)
            const cachedResponse = await Cache.match(getHostName());
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

export class CSaveToLocalStorage  implements IServerSaveBasePromise{
    async set(key: string, value: object) : Promise<boolean>  {
        if (typeof localStorage != "undefined") {
            await localStorage.setItem(key,JSON.stringify(value))
            return true
        }
        return false
    }
    async get<T extends object>(key: string) : Promise<T|null> {
        if (typeof localStorage != "undefined") {
            const st = await localStorage.getItem(key)
            if (st) { try { return JSON.parse(st) } catch { return null } }
        }
        return null
    }
    async delete<T extends object>(key: string) : Promise<boolean> {
        if (typeof localStorage != "undefined") {
            localStorage.removeItem(key)
            return true
        }
        return false
    }

    async deleteAll() : Promise<boolean> {
        if (typeof localStorage != "undefined") {
            await localStorage.clear()
            return true
        }
        return false
    }
}

export const CacheG = new CSaveToCache()
export const CacheLocal = new CSaveToLocalStorage()

function addDataToMap(data: [k: string,v: unknown][], map: Map<string,unknown>) {
    for (let [k,v] of data) {
        const tr = map.has(k) ? map.get(k) : map.set(k, v).get(k)!
        if (tr && typeof tr === 'object') {
            Object.assign(tr, v)
            renderBy(tr)
        }
    }
}
export const ObjectStringToDate = (obj: unknown): void => {
    if (typeof obj == "object" && obj) {
        if (Array.isArray(obj)) obj.forEach(ObjectStringToDate)
        else Object.entries(obj).forEach(([k,v])=>{
            if (typeof v == "string") {
                if (isDate(v)) {(obj as Record<string, unknown>)[k] = new Date(v)}
            }
            if (typeof v == "object") ObjectStringToDate(v)
        })
    }
}
// module-level constant: this runs for every string of every cached object on load
const ISO_DATE_RE = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\.[0-9]+)?(Z)?$/;
function isDate(_date: string){
    return ISO_DATE_RE.test(_date);
}

export function CacheFuncMapBase(arr: [k: string, v: Map<string, unknown>][], Save: IServerSaveBasePromise) {
    const savedPayloadByKey = new Map<string, string>()
    let saveTimer: ReturnType<typeof setTimeout> | null = null
    let runningSave: Promise<void> | null = null

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
            for (let [k,v] of arr) {
                const t = await Save.get<[k: string, v: unknown][]>(k)
                if (!t) continue
                ObjectStringToDate(t)
                addDataToMap(t, v)
            }
            rememberCurrentPayloads()
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
            for (let [k,v] of arr) {
                await Save.delete(k)
            }
        },
        getArr: arr
    }
}

export function CacheFuncMap(arr: [k: string, v: Map<string, unknown>][]) {
    return CacheFuncMapBase(arr, CacheLocal)
}
