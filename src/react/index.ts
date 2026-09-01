export {
    createUpdateApi,
    renderBy,
    renderByLast,
    renderByRevers,
    useUpdateBy,
    useUpdateByApi,
} from "../internal/updateBy.js";
export type {UpdateApi, UpdateCallback} from "../internal/updateBy.js";

export {useOutside, useOutsideApi, useOutsideRef} from "../internal/hooks/useOutside.js";
export type {UseOutsideApi, UseOutsideOptions} from "../internal/hooks/useOutside.js";
export {keyboard, keyboardState, useKeyboard} from "../internal/hooks/useKeyboard.js";
export type {KeyboardApi} from "../internal/hooks/useKeyboard.js";
export {useDraggable, useDraggableApi} from "../internal/hooks/useDraggable.js";
export type {
    Position,
    UseDraggableApi,
    UseDraggableOptions,
    UseDraggableReturn,
} from "../internal/hooks/useDraggable.js";
export {useReorder} from "../internal/hooks/useReorder.js";
export type {ReorderItem, ReorderOptions} from "../internal/hooks/useReorder.js";
export {useReorderBoard} from "../internal/hooks/useReorderBoard.js";
export type {
    BoardColumn,
    BoardPosition,
    ReorderBoardOptions,
} from "../internal/hooks/useReorderBoard.js";

export {
    useListenArgs,
    useListenEffect,
    useListenValue,
    useStoreChangedPaths,
    useStoreEach,
    useStoreKeys,
    useStoreMirror,
    useStoreNode,
    useStoreSelect,
} from "../internal/hooks/useObserveStore.js";
export type {
    ListenLike,
    RemoteStoreLike,
    StoreChange,
    StoreChangedPathsController,
    StoreDrain,
    StoreEachCtx,
    StoreKeysController,
    StoreMask,
    StoreMirrorController,
    StoreNode,
    StoreNodeController,
    StorePick,
    StoreSelection,
    StoreSelectionController,
    StoreSubOpts,
    StoreSyncOpts,
    UseStoreEachOptions,
    UseStoreMirrorOptions,
    UseStoreNodeOptions,
    UseStoreSelectOptions,
} from "../internal/hooks/useObserveStore.js";
export {
    useReplayFrame,
    useReplayHistory,
    useReplayRouteSubscribe,
    useReplaySubscribe,
    useStoreLazyLineMirror,
    useStoreLazyLineSync,
    useStoreReplayEach,
    useStoreReplayMirror,
    useStoreReplayRouteMirror,
    useStoreReplayRouteSync,
    useStoreReplaySync,
} from "../internal/hooks/useReplay.js";
export type {
    ReplayFrameController,
    ReplayHistoryController,
    ReplayHistoryLike,
    ReplayRouteController,
    ReplayRouteEvent,
    ReplayRouteSwitchOptions,
    ReplaySubscribeController,
    StoreLazyLineMirrorController,
    StoreLazyLineSyncController,
    StoreReplayMirrorController,
    StoreReplayRouteMirrorController,
    StoreReplayRouteSyncController,
    StoreReplaySyncController,
    UseReplayFrameOptions,
    UseReplayHistoryOptions,
    UseReplayRouteSubscribeOptions,
    UseReplaySubscribeOptions,
    UseStoreLazyLineSyncOptions,
    UseStoreReplayEachOptions,
    UseStoreReplayRouteSyncOptions,
    UseStoreReplaySyncOptions,
} from "../internal/hooks/useReplay.js";
export {useRouteState} from "../internal/hooks/useRoute.js";
export type {RouteLogEntry} from "../internal/hooks/useRoute.js";
export {
    useAiRunClient,
    useClientStore,
    useFileJobClient,
} from "../internal/hooks/useWorkflows.js";
export type {
    AiRunClientController,
    ClientStoreController,
    FileJobClientController,
    StoreBackedClient,
} from "../internal/hooks/useWorkflows.js";
export {useContractSlot} from "../internal/hooks/useContractRuntime.js";
export type {ContractSlotController} from "../internal/hooks/useContractRuntime.js";

// Persistence. ./grid (createColumnState), ./windows (FloatingWindow) and ./react (Button
// keyForSave) all write into memoryCache, but the documented contract - "the library never
// writes storage on its own, the app decides when" - was unreachable from any subpath barrel:
// memoryCache lived only in the root surface, so switching it on meant importing the whole
// library plus its CSS and ag-grid. These live in ./react rather than ./core because cache.ts
// pulls in React (useCacheMapPersistence) and the core boundary check forbids that.
export {
    memoryCache,
    memoryMaps,
    memoryGet,
    memoryGetById,
    memoryGetOrCreate,
    memoryMarkDirty,
    memorySet,
    memoryUpdate,
} from "../internal/utils/memoryStore.js";
export {
    createCacheMap,
    createCacheMapWithStorage,
    browserCacheStorage,
    localStorageCache,
} from "../internal/utils/cache.js";
export type {CacheMap, CacheStorage} from "../internal/utils/cache.js";
export {useCacheMapPersistence} from "../internal/hooks/useCacheMapPersistence.js";
export {createSearchHistory} from "../internal/utils/searchHistory.js";

// The project's only shared ResizeObserver. It lives under components/ for historical reasons,
// which kept it out of this barrel entirely - so every consumer (and the chart engines) rolled
// their own observer instead.
export {CResizeObserver, useElementSize, useResizeObserver} from "../internal/components/MyResizeObserver.js";
export type {ObserveID} from "../internal/components/MyResizeObserver.js";
