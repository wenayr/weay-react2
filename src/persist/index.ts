/** wenay-react2/persist - the storage-neutral persistence block.
 *
 *  Three layers, bottom up:
 *  - `ObservableMap` - a Map that announces its mutations; every persisted slot is one.
 *  - `CacheStorage` - the adapter contract. `createCacheMapWithStorage(maps, storage)` diffs the
 *    maps into per-scope JSON payloads and hands them to `storage.set/get/delete` (optionally
 *    `setRaw` for the pre-serialized string). `localStorageCache` is the browser default;
 *    React Native (or any other host) plugs in by supplying an object with the same three
 *    async methods over AsyncStorage/SQLite/a server - the block itself never touches the DOM.
 *  - `memoryCache` - the module-level registry: one CacheMap over the persisted maps below
 *    (floatingWindowMap, mapResiReact, mapRightMenu, buttonStatusMap) plus the free-form
 *    `memoryProps` slot behind memoryGetOrCreate/memorySet/memoryUpdate. Components import
 *    their map from here; the app wires load/save once with `useCacheMapPersistence`.
 *
 *  `createPersistedController` is the idiom on top of memoryProps: read-or-create, an updateBy
 *  api, a `commit()` that mutates + renders + marks dirty, and a `version`/`migrate` hook for
 *  shapes that outlive the code that wrote them. `createSearchHistory` is its smallest consumer.
 *
 *  Explicit named exports on purpose: the package probe rejects `export *` in canonical
 *  entries, and a hand-kept list is the documentation of what the block promises. */

export {ObservableMap} from "../internal/persist/observableMap.js";
export type {MapChangeListener} from "../internal/persist/observableMap.js";

export {
    createCacheMap,
    createCacheMapWithStorage,
    browserCacheStorage,
    localStorageCache,
} from "../internal/persist/cache.js";
export type {CacheMap, CacheStorage, DirtyListener} from "../internal/persist/cache.js";

export {
    memoryCache,
    memoryMaps,
    memoryCommit,
    memoryGet,
    memoryGetById,
    memoryGetOrCreate,
    memoryMarkDirty,
    memorySet,
    memoryUpdate,
} from "../internal/persist/memoryStore.js";

export {
    buttonStatusMap,
    floatingWindowMap,
    mapResiReact,
    mapRightMenu,
} from "../internal/persist/persistedMaps.js";
export type {
    ButtonSavedState,
    MenuRightPosition,
    MenuRightSavedState,
    MenuRightVerticalPosition,
    ResizableSavedSize,
} from "../internal/persist/persistedMaps.js";

export type {
    FloatingWindowCloseReason,
    FloatingWindowMode,
    FloatingWindowPosition,
    FloatingWindowSavedGeometry,
    FloatingWindowSize,
    FloatingWindowSnapRegion,
} from "../internal/persist/floatingWindowTypes.js";

export {createPersistedController} from "../internal/persist/persistedController.js";
export type {PersistedController, PersistedControllerOptions} from "../internal/persist/persistedController.js";

export {createSearchHistory} from "../internal/persist/searchHistory.js";
export type {SearchHistoryApi, SearchHistoryState} from "../internal/persist/searchHistory.js";

export {useCacheMapPersistence} from "../internal/persist/useCacheMapPersistence.js";
export type {CacheMapPersistence} from "../internal/persist/useCacheMapPersistence.js";
