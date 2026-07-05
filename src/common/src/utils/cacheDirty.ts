/** Global dirty channel for persisted state (the Cash maps).
 *  Mutation sites only ANNOUNCE "persisted state changed" - they never write storage.
 *  The app decides whether to subscribe (onDirty) and when to save (saveDebounced/flush).
 *  Deliberately a plain module-level bus, not a hook and not a Cash method at the core:
 *  components (DivRnd3, Resizable, RightMenu, UiSlot) must emit without importing
 *  mapMemory - mapMemory imports their maps, so the reverse import would be a cycle. */

export type tDirtyListener = (scope?: string, key?: string) => void

const listeners = new Set<tDirtyListener>()
let dirty = false
let suppress = 0

/** Announce a persisted-state change. Remembers the dirty fact and emits to subscribers.
 *  Never saves by itself. scope/key are event metadata only (top-level Cash entry name
 *  and map key) - WHAT gets written is decided by Cash's serialized-snapshot diff, so a
 *  missed markDirty degrades to "saved later", an extra one to a no-op write. */
export function markDirty(scope?: string, key?: string): void {
    if (suppress > 0) return
    dirty = true
    // copy before iterating: an unsubscribe from inside a callback must not skip the rest
    for (const cb of [...listeners]) cb(scope, key)
}

/** Subscribe to dirty events; returns unsubscribe. Multiple subscribers coexist. */
export function onDirty(cb: tDirtyListener): () => void {
    listeners.add(cb)
    return () => { listeners.delete(cb) }
}

/** Cheap hint (e.g. a beforeunload guard). Cleared when a save cycle starts and by
 *  load/clear. Can be a false positive (marked but value unchanged) - the save diff
 *  is the source of truth. */
export function isDirty(): boolean { return dirty }

/** Internal for Cash: drop the dirty fact (save cycle start, after load/clear). */
export function resetDirty(): void { dirty = false }

/** Internal for Cash.load(): mutations made while loading are not user changes. */
export async function suppressDirty<T>(fn: () => Promise<T>): Promise<T> {
    suppress++
    try { return await fn() } finally { suppress-- }
}
