/** Public utils surface (2.0.0). Was `export *` over every module, which leaked implementation
 *  detail into the root barrel: `BrowserCacheStorage`, `LocalStorageCache`, `restoreDates`,
 *  `DirtyListener`, `deepMergeWithMap`, plus three dead modules. The list below is now explicit
 *  and matches what ./react and ./core already publish; the leaked names stay exported from
 *  their own modules for internal use, they are just no longer part of the package surface.
 *  Deliberately absent (documented at their declaration sites): `cx`, `persistedController`,
 *  `persistedMaps` - the maps reach the surface through their consuming components. */

export {
    createCacheMap,
    createCacheMapWithStorage,
    browserCacheStorage,
    localStorageCache,
} from './cache.js';
export type {CacheMap, CacheStorage} from './cache.js';

export {createCallbackHub} from './callbackHub.js';

export {movedOrderWithFixed, pinFixedOrder} from './fixedOrder.js';
export type {FixedOrderDescriptor} from './fixedOrder.js';

export {setAutoStepForElement} from './inputAutoStep.js';

export {
    memoryCache,
    memoryMaps,
    memoryGet,
    memoryGetById,
    memoryGetOrCreate,
    memoryMarkDirty,
    memorySet,
    memoryUpdate,
} from './memoryStore.js';

export {ObservableMap} from './observableMap.js';
export type {MapChangeListener} from './observableMap.js';

export {createSearchHistory} from './searchHistory.js';
export type {SearchHistoryApi, SearchHistoryState} from './searchHistory.js';

export {structEqual} from './structEqual.js';
