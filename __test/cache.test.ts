import {BrowserCacheStorage, LocalStorageCache} from "../src/internal/utils/cache";

type CacheEntryMap = Map<string, Response>;

class TestResponse {
    constructor(private readonly body: string) {}

    async json() {
        return JSON.parse(this.body);
    }

    clone() {
        return new TestResponse(this.body);
    }
}

const originalResponse = globalThis.Response;

beforeAll(() => {
    Object.defineProperty(globalThis, "Response", {
        configurable: true,
        value: TestResponse,
    });
});

afterAll(() => {
    Object.defineProperty(globalThis, "Response", {
        configurable: true,
        value: originalResponse,
    });
});

function installCacheApi(entries: CacheEntryMap) {
    const cache = {
        put: jest.fn(async (request: RequestInfo | URL, response: Response) => {
            entries.set(String(request), response);
        }),
        match: jest.fn(async (request: RequestInfo | URL) => entries.get(String(request))),
        delete: jest.fn(async (request: RequestInfo | URL) => entries.delete(String(request))),
    };
    const storage = {
        open: jest.fn(async () => cache),
        delete: jest.fn(async () => true),
    };
    Object.defineProperty(globalThis, "caches", {
        configurable: true,
        value: storage,
    });
    return {cache, storage};
}

afterEach(() => {
    Object.defineProperty(globalThis, "caches", {
        configurable: true,
        value: undefined,
    });
    window.history.replaceState({}, "", "/");
});

test("BrowserCacheStorage keeps one Cache API entry across SPA routes", async () => {
    const entries: CacheEntryMap = new Map();
    installCacheApi(entries);
    const storage = new BrowserCacheStorage();

    window.history.replaceState({}, "", "/first?filter=open#grid");
    await storage.set("rows", {count: 3});

    expect([...entries.keys()]).toEqual([
        `${window.location.origin}/__wenay-react2-cache__`,
    ]);

    window.history.replaceState({}, "", "/second?filter=closed#details");
    await expect(storage.get<{count: number}>("rows")).resolves.toEqual({count: 3});
});

test("BrowserCacheStorage migrates the legacy full-location entry", async () => {
    const entries: CacheEntryMap = new Map();
    const {cache} = installCacheApi(entries);
    const storage = new BrowserCacheStorage();

    window.history.replaceState({}, "", "/legacy?tab=one#cache");
    const legacyKey = window.location.toString();
    const stableKey = `${window.location.origin}/__wenay-react2-cache__`;
    entries.set(legacyKey, new Response(JSON.stringify({restored: true})));

    await expect(storage.get<{restored: boolean}>("rows")).resolves.toEqual({
        restored: true,
    });
    expect(cache.put).toHaveBeenCalledWith(stableKey, expect.any(Response));
    expect(cache.delete).toHaveBeenCalledWith(legacyKey);
    expect(entries.has(legacyKey)).toBe(false);
    expect(entries.has(stableKey)).toBe(true);
});

test("LocalStorageCache deleteAll preserves unrelated application keys", async () => {
    localStorage.clear();
    const storage = new LocalStorageCache();

    localStorage.setItem("app.session", "keep");
    await storage.set("wenay.settings", {theme: "dark"});
    await storage.set("wenay.columns", {order: ["name"]});

    await expect(storage.deleteAll()).resolves.toBe(true);
    expect(localStorage.getItem("app.session")).toBe("keep");
    expect(localStorage.getItem("wenay.settings")).toBeNull();
    expect(localStorage.getItem("wenay.columns")).toBeNull();
});

test("save serializes each changed scope exactly once and hands the raw payload to setRaw", async () => {
    const {createCacheMapWithStorage} = await import("../src/internal/utils/cache");
    const {ObservableMap} = await import("../src/internal/utils/observableMap");

    const written: [string, string][] = [];
    const parsed: object[] = [];
    const storage = {
        async set(key: string, value: object) { parsed.push(value); return true },
        async get<T extends object>(_key: string): Promise<T | null> { return null },
        async delete(_key: string) { return true },
        async setRaw(key: string, payload: string) { written.push([key, payload]); return true },
    };

    const rows = new ObservableMap<string, unknown>();
    const cols = new ObservableMap<string, unknown>();
    const cache = createCacheMapWithStorage([["rows", rows], ["cols", cols]], storage);

    await cache.load();
    rows.set("a", {n: 1});

    const stringify = jest.spyOn(JSON, "stringify");
    const parse = jest.spyOn(JSON, "parse");
    try {
        await cache.save();
        // one serialization per scope for the diff, and NOT a second one inside the storage:
        // the already built payload goes straight to setRaw
        expect(stringify).toHaveBeenCalledTimes(2);
        expect(parse).not.toHaveBeenCalled();
    } finally {
        stringify.mockRestore();
        parse.mockRestore();
    }

    // only the changed scope is written, and the payload is the exact serialized snapshot
    expect(written).toEqual([["rows", JSON.stringify([["a", {n: 1}]])]]);
    expect(parsed).toEqual([]);
    cache.dispose();
});

test("save falls back to set(object) for a storage without setRaw", async () => {
    const {createCacheMapWithStorage} = await import("../src/internal/utils/cache");
    const {ObservableMap} = await import("../src/internal/utils/observableMap");

    const parsed: [string, object][] = [];
    const storage = {
        async set(key: string, value: object) { parsed.push([key, value]); return true },
        async get<T extends object>(_key: string): Promise<T | null> { return null },
        async delete(_key: string) { return true },
    };

    const rows = new ObservableMap<string, unknown>();
    const cache = createCacheMapWithStorage([["rows", rows]], storage);
    await cache.load();
    rows.set("a", {n: 1});
    await cache.save();

    expect(parsed).toEqual([["rows", [["a", {n: 1}]]]]);
    cache.dispose();
});

test("saveDebounced keeps the pending timer across a burst and writes delay after the FIRST change", async () => {
    jest.useFakeTimers();
    try {
        const {createCacheMapWithStorage} = await import("../src/internal/utils/cache");
        const {ObservableMap} = await import("../src/internal/utils/observableMap");

        const writes: string[] = [];
        const storage = {
            async set(_key: string, _value: object) { return true },
            async get<T extends object>(_key: string): Promise<T | null> { return null },
            async delete(_key: string) { return true },
            async setRaw(key: string, _payload: string) { writes.push(key); return true },
        };

        const rows = new ObservableMap<string, unknown>();
        const cache = createCacheMapWithStorage([["rows", rows]], storage);
        await cache.load();

        const setTimeoutSpy = jest.spyOn(globalThis, "setTimeout");
        const clearTimeoutSpy = jest.spyOn(globalThis, "clearTimeout");

        // a burst of dirty keys: only the first call arms a timer, the rest are no-ops
        for (let i = 0; i < 5; i++) {
            rows.set("k" + i, {i});
            cache.saveDebounced(300);
        }
        expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
        expect(clearTimeoutSpy).not.toHaveBeenCalled();

        // ... and it fires 300ms after the FIRST change, not after the last one
        jest.advanceTimersByTime(300);
        await Promise.resolve();
        await Promise.resolve();
        expect(writes).toEqual(["rows"]);

        // a different delay re-arms rather than being swallowed
        setTimeoutSpy.mockClear();
        cache.saveDebounced(300);
        cache.saveDebounced(50);
        expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
        expect(clearTimeoutSpy).toHaveBeenCalled();

        setTimeoutSpy.mockRestore();
        clearTimeoutSpy.mockRestore();
        cache.dispose();
    } finally {
        jest.useRealTimers();
    }
});
