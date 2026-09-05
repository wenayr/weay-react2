/** Structural deep clone for persisted-state defaults (memoryStore). Same contract as
 *  wenay-common2's deepClone - plain objects, arrays, Date, Set, Map, cycles preserved through
 *  the seen-map, functions bound to the clone - but local, because wenay-common2 ships as
 *  CommonJS: importing that one helper from `wenay-common2/client` dragged the whole client
 *  barrel (~61 KB gzip: RPC client, media, exchange bars, ...) into every entry that reaches
 *  memoryStore, and a bundler cannot tree-shake a CommonJS barrel whatever `sideEffects` says. */
export function deepClone<T>(src: T): T {
    return cloneValue(src, new Map()) as T
}

function cloneValue(src: unknown, seen: Map<object, unknown>): unknown {
    if (!src || typeof src != "object") return src
    const cached = seen.get(src)
    if (cached) return cached
    if (src instanceof Date) {
        const copy = new Date(src)
        seen.set(src, copy)
        return copy
    }
    if (src instanceof Set) {
        const copy = new Set<unknown>()
        seen.set(src, copy)
        for (const value of src) copy.add(cloneMember(value, copy, seen))
        return copy
    }
    if (src instanceof Map) {
        const copy = new Map<unknown, unknown>()
        seen.set(src, copy)
        for (const [key, value] of src) copy.set(cloneMember(key, copy, seen), cloneMember(value, copy, seen))
        return copy
    }
    const copy: Record<string, unknown> | unknown[] = Array.isArray(src) ? [] : {}
    seen.set(src, copy)
    for (const [key, value] of Object.entries(src)) (copy as Record<string, unknown>)[key] = cloneMember(value, copy, seen)
    return copy
}

function cloneMember(value: unknown, owner: object, seen: Map<object, unknown>): unknown {
    if (value && typeof value == "object") return cloneValue(value, seen)
    if (typeof value == "function") return (value as (...a: unknown[]) => unknown).bind(owner)
    return value
}
