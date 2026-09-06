import * as persist from "../src/persist/index";
import type {CacheStorage} from "../src/persist/index";

/** ./persist is the storage-neutral persistence block: the surface below is what a React
 *  Native host (AsyncStorage) or a server-backed app is promised, so the names are pinned as
 *  runtime values and the adapter contract is exercised end to end with a storage that is
 *  neither localStorage nor the Cache API. */

test("the entry exposes the block's runtime names", () => {
    expect(typeof persist.memoryCache).toBe("object");
    expect(typeof persist.memoryCache.load).toBe("function");
    expect(typeof persist.createCacheMap).toBe("function");
    expect(typeof persist.createCacheMapWithStorage).toBe("function");
    expect(typeof persist.ObservableMap).toBe("function");
    expect(typeof persist.createPersistedController).toBe("function");
    expect(typeof persist.createSearchHistory).toBe("function");
    expect(typeof persist.useCacheMapPersistence).toBe("function");
    expect(typeof persist.memoryGetOrCreate).toBe("function");
    expect(typeof persist.memoryUpdate).toBe("function");
    expect(typeof persist.memoryCommit).toBe("function");
    expect(persist.floatingWindowMap).toBeInstanceOf(persist.ObservableMap);
    expect(persist.buttonStatusMap).toBeInstanceOf(persist.ObservableMap);
    expect(persist.mapResiReact).toBeInstanceOf(persist.ObservableMap);
    expect(persist.mapRightMenu).toBeInstanceOf(persist.ObservableMap);
    expect(persist.localStorageCache).toBeDefined();
});

test("memoryCache is the registry over the persisted maps", () => {
    const scopes = persist.memoryCache.getArr.map(([name]) => name);
    expect(scopes).toEqual(expect.arrayContaining(["floatingWindowMap", "buttonStatusMap", "mapResiReact", "mapRightMenu", "memoryProps"]));
    expect(persist.memoryMaps.rnd).toBe(persist.floatingWindowMap);
});

/** The smallest CacheStorage: three async methods over a plain Map - the shape an
 *  AsyncStorage adapter has on React Native. No setRaw, so the object contract is used. */
function memoryStorage() {
    const rows = new Map<string, object>();
    const storage: CacheStorage = {
        async set(key, value) { rows.set(key, JSON.parse(JSON.stringify(value)) as object); return true },
        async get<T extends object>(key: string) { return (rows.get(key) as T | undefined) ?? null },
        async delete(key) { return rows.delete(key) },
    };
    return {rows, storage};
}

test("a custom CacheStorage adapter round-trips an ObservableMap through save() and load()", async () => {
    const {rows, storage} = memoryStorage();

    const settings = new persist.ObservableMap<string, unknown>();
    const cache = persist.createCacheMapWithStorage([["settings", settings]], storage);
    await cache.load();
    expect(cache.isDirty()).toBe(false);

    settings.set("theme", {dark: true, when: new Date("2026-01-02T03:04:05.000Z")});
    expect(cache.isDirty()).toBe(true);
    await cache.save();

    // the storage holds the serialized entries of the scope, under the scope name
    expect(rows.get("settings")).toEqual([["theme", {dark: true, when: "2026-01-02T03:04:05.000Z"}]]);
    expect(cache.isDirty()).toBe(false);
    cache.dispose();

    // a fresh cache over a fresh map restores the entry (and revives the Date)
    const restored = new persist.ObservableMap<string, unknown>();
    const second = persist.createCacheMapWithStorage([["settings", restored]], storage);
    await second.load();
    expect(restored.get("theme")).toEqual({dark: true, when: new Date("2026-01-02T03:04:05.000Z")});
    expect(second.isDirty()).toBe(false);
    second.dispose();
});

test("memoryUpdate and createPersistedController share the commit idiom", () => {
    const key = "test.persistEntry.commit";
    const c = persist.createPersistedController<{n: number}>({key, def: {n: 0}});
    let renders = 0;
    const off = c.api.on(() => { renders++ });

    c.commit(cur => { cur.n = 1 });
    expect(renders).toBe(1);

    const cur = persist.memoryUpdate<{n: number}>(key, s => { s.n = 2 });
    expect(cur).toBe(c.state);
    expect(c.state.n).toBe(2);
    expect(renders).toBe(2);
    expect(persist.memoryCache.isDirty()).toBe(true);

    expect(persist.memoryUpdate("test.persistEntry.absent", () => {})).toBeUndefined();
    off();
});
