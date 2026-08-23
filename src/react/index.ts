export {
    createUpdateApi,
    renderBy,
    renderByLast,
    renderByRevers,
    useUpdateBy,
    useUpdateByApi,
} from "../common/updateBy.js";
export type {UpdateApi, UpdateCallback} from "../common/updateBy.js";

export {useOutside, useOutsideApi, useOutsideRef} from "../common/src/hooks/useOutside.js";
export type {UseOutsideApi, UseOutsideOptions} from "../common/src/hooks/useOutside.js";
export {keyboard, keyboardState, useKeyboard} from "../common/src/hooks/useKeyboard.js";
export type {KeyboardApi} from "../common/src/hooks/useKeyboard.js";
export {useDraggable, useDraggableApi} from "../common/src/hooks/useDraggable.js";
export type {
    Position,
    UseDraggableApi,
    UseDraggableOptions,
    UseDraggableReturn,
} from "../common/src/hooks/useDraggable.js";
export {useReorder} from "../common/src/hooks/useReorder.js";
export type {ReorderItem, ReorderOptions} from "../common/src/hooks/useReorder.js";
export {useReorderBoard} from "../common/src/hooks/useReorderBoard.js";
export type {
    BoardColumn,
    BoardPosition,
    ReorderBoardOptions,
} from "../common/src/hooks/useReorderBoard.js";

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
} from "../common/src/hooks/useObserveStore.js";
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
} from "../common/src/hooks/useObserveStore.js";
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
} from "../common/src/hooks/useReplay.js";
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
} from "../common/src/hooks/useReplay.js";
export {useRouteState} from "../common/src/hooks/useRoute.js";
export type {RouteLogEntry} from "../common/src/hooks/useRoute.js";
export {
    useAiRunClient,
    useClientStore,
    useFileJobClient,
} from "../common/src/hooks/useWorkflows.js";
export type {
    AiRunClientController,
    ClientStoreController,
    FileJobClientController,
    StoreBackedClient,
} from "../common/src/hooks/useWorkflows.js";
export {useContractSlot} from "../common/src/hooks/useContractRuntime.js";
export type {ContractSlotController} from "../common/src/hooks/useContractRuntime.js";

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
} from "../common/src/utils/memoryStore.js";
export {
    createCacheMap,
    createCacheMapWithStorage,
    useCacheMapPersistence,
    browserCacheStorage,
    localStorageCache,
} from "../common/src/utils/cache.js";
export type {CacheMap, CacheStorage} from "../common/src/utils/cache.js";
export {createSearchHistory} from "../common/src/utils/searchHistory.js";

// The project's only shared ResizeObserver. It lives under components/ for historical reasons,
// which kept it out of this barrel entirely - so every consumer (and the chart engines) rolled
// their own observer instead.
export {CResizeObserver, useElementSize, useResizeObserver} from "../common/src/components/MyResizeObserver.js";
export type {ObserveID} from "../common/src/components/MyResizeObserver.js";
