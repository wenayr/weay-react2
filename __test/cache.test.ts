import {BrowserCacheStorage} from "../src/common/src/utils/cache";

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
