/** Public utils surface (2.0.0). Was `export *` over every module, which leaked implementation
 *  detail into the root barrel: `BrowserCacheStorage`, `LocalStorageCache`, `restoreDates`,
 *  `DirtyListener`, `deepMergeWithMap`, plus three dead modules. The list below is now explicit
 *  and matches what ./react and ./core already publish; the leaked names stay exported from
 *  their own modules for internal use, they are just no longer part of the package surface.
 *  Deliberately absent (documented at its declaration site): `cx`.
 *  The persistence primitives (cache, memoryStore, observableMap, persistedController,
 *  persistedMaps, searchHistory) moved to ../persist and own the ./persist entrypoint
 *  (src/persist/index.ts); they stay re-exported here so the root barrel remains a superset of
 *  every subpath entry (the barrel parity test). */

export {
    createCacheMap,
    createCacheMapWithStorage,
    browserCacheStorage,
    localStorageCache,
} from '../persist/cache.js';
export type {CacheMap, CacheStorage} from '../persist/cache.js';

export {createCallbackHub} from './callbackHub.js';

export {movedOrderWithFixed, pinFixedOrder} from './fixedOrder.js';
export type {FixedOrderDescriptor} from './fixedOrder.js';

export {setAutoStepForElement} from './inputAutoStep.js';

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
} from '../persist/memoryStore.js';

export {ObservableMap} from '../persist/observableMap.js';
export type {MapChangeListener} from '../persist/observableMap.js';

export {createPersistedController} from '../persist/persistedController.js';
export type {PersistedController, PersistedControllerOptions} from '../persist/persistedController.js';

export {buttonStatusMap, floatingWindowMap, mapResiReact, mapRightMenu} from '../persist/persistedMaps.js';
export type {
    ButtonSavedState,
    MenuRightPosition,
    MenuRightSavedState,
    MenuRightVerticalPosition,
    ResizableSavedSize,
} from '../persist/persistedMaps.js';

export {createSearchHistory} from '../persist/searchHistory.js';
export type {SearchHistoryApi, SearchHistoryState} from '../persist/searchHistory.js';

export {structEqual} from './structEqual.js';
