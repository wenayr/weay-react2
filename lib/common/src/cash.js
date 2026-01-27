import { renderBy } from "../updateBy";
const HostName = location.toString();
export class CSaveToCache {
    async set(key, value) {
        const t = new Response(JSON.stringify(value));
        if (window.caches) {
            const Cache = await caches.open(key);
            await Cache.put(HostName, t);
            return true;
        }
        return false;
    }
    async get(key) {
        if (window.caches) {
            const Cache = await caches.open(key);
            const cachedResponse = await Cache.match(HostName);
            if (cachedResponse) {
                return (await cachedResponse.json());
            }
        }
        return null;
    }
    async delete(key) {
        if (window.caches) {
            return await caches.delete(key);
        }
        return false;
    }
}
export class CSaveToLocalStorage {
    async set(key, value) {
        const t = new Response(JSON.stringify(value));
        // console.log("CacheG set ",window.caches, HostName)
        if (window.localStorage) {
            await localStorage.setItem(key, JSON.stringify(value));
            // const Cache = await localStorage.open(key)
            // Cache.put(HostName, t);
            return true;
        }
        return false;
    }
    async get(key) {
        // console.log("CacheG get ",window.caches, HostName)
        if (window.localStorage) {
            const st = await localStorage.getItem(key);
            if (st)
                return JSON.parse(st);
        }
        return null;
    }
    async delete(key) {
        if (window.localStorage) {
            localStorage.removeItem(key);
            return true;
        }
        return false;
    }
    async deleteAll() {
        if (window.localStorage) {
            await localStorage.clear();
            return true;
        }
        return false;
    }
}
// CacheG
export const CacheG = new CSaveToCache;
export const CacheLocal = new CSaveToLocalStorage;
async function addDataToMap(data, map) {
    if (data) {
        for (let [k, v] of data) {
            const tr = (map.get(k) || map.set(k, v).get(k));
            if (tr) {
                Object.assign(tr, v);
                renderBy(tr);
            }
        }
    }
}
export const ObjectStringToDate = (obj) => {
    if (typeof obj == "object" && obj) {
        if (Array.isArray(obj))
            obj.forEach(ObjectStringToDate);
        else
            Object.entries(obj).forEach(([k, v]) => {
                if (typeof v == "string") {
                    if (isDate(v)) {
                        obj[k] = new Date(v);
                    }
                }
                if (typeof v == "object")
                    ObjectStringToDate(v);
            });
    }
};
function isDate(_date) {
    const _regExp = new RegExp('^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?$');
    return _regExp.test(_date);
}
export function CashFuncMapBase(arr, Save) {
    return {
        async load() {
            for (let [k, v] of arr) {
                const t = await Save.get(k);
                ObjectStringToDate(t);
                await addDataToMap(t, v);
            }
        },
        async save() {
            for (let [k, v] of arr) {
                await Save.set(k, [...v.entries()]);
            }
        },
        async clean() {
            for (let [k, v] of arr) {
                await Save.delete(k);
            }
        },
        getArr: arr
    };
}
export function CashFuncMapCash(arr) {
    return CashFuncMapBase(arr, CacheLocal);
}
