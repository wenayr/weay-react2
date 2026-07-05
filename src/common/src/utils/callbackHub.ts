/** Multiplexer for a single-slot callback API (onX(cb | null)): many subscribers share
 *  one slot instead of silently overwriting each other.
 *  bind(emit) is called lazily, ONCE, on the first on() - not at creation time, because
 *  the slot may still be taken by app initialization. */
export function createCallbackHub<Args extends any[]>(
    bind: (emit: (...a: Args) => void) => void
) {
    const subs = new Set<(...a: Args) => void>()
    let bound = false
    // copy before iterating: an unsubscribe from inside a callback must not skip the rest
    const emit = (...a: Args) => { [...subs].forEach(cb => cb(...a)) }
    return {
        /** Subscribe; the returned function unsubscribes without touching other subscribers.
         *  The callback is registered BEFORE bind runs, so it also catches synchronous emits. */
        on(cb: (...a: Args) => void): () => void {
            subs.add(cb)
            if (!bound) {
                bound = true
                bind(emit)
            }
            return () => { subs.delete(cb) }
        },
        count: () => subs.size,
    }
}
