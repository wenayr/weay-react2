import {useEffect, useMemo} from "react";
import type {CacheMap} from "./cache.js";

/** Moved out of cache.ts: it was the only React hook in utils, and the reason the
 *  persistence primitives could not sit behind ./core. utils/ is now hook-free. */
/** The app-side persistence contract as one hook: load() on mount, then subscribe the dirty
 *  channel to saveDebounced(delay). The app still owns the write policy - this only wires the
 *  documented default (`doc/EXAMPLE_USAGE.md`). Returns pass-through methods for the rare
 *  imperative needs; `reload` is an explicit alias of `load` (a second load() merges storage
 *  on top of current maps - it is not a reset). */
export type CacheMapPersistence = {
    isDirty: () => boolean;
    flush: () => ReturnType<CacheMap["flush"]>;
    save: () => ReturnType<CacheMap["save"]>;
    reload: () => ReturnType<CacheMap["load"]>;
}

export function useCacheMapPersistence(cache: CacheMap, delay = 300): CacheMapPersistence {
    // two effects on purpose: load() merges storage ON TOP of the current maps, so keeping it
    // in the same effect as the dirty subscription made a changed `delay` re-run the merge and
    // roll unsaved values back
    useEffect(() => { void cache.load() }, [cache])
    useEffect(() => cache.onDirty(() => cache.saveDebounced(delay)), [cache, delay])
    return useMemo(() => ({
        isDirty: () => cache.isDirty(),
        flush: () => cache.flush(),
        save: () => cache.save(),
        reload: () => cache.load(),
    }), [cache])
}
