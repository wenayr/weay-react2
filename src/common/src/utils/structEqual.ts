/** Structural deep equality for plain config/data trees (objects, arrays, primitives).
 *
 *  Replacement for the `JSON.stringify(a) == JSON.stringify(b)` idiom, with the same
 *  tolerance but none of its key-order sensitivity:
 *  - object key ORDER does not matter (stringify's false-positive "changed");
 *  - object props with `undefined` values count as absent (JSON drops them);
 *  - `NaN` equals `NaN` (JSON serializes both to `null`);
 *  - no serialization cost, early exit on first difference.
 *
 *  Not for class instances / Maps / Sets / cycles - data that would not survive
 *  JSON round-tripping did not work with the stringify idiom either. */
export function structEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true
    if (typeof a == 'number' && typeof b == 'number') return Number.isNaN(a) && Number.isNaN(b)
    if (typeof a != 'object' || typeof b != 'object' || a == null || b == null) return false
    const aArr = Array.isArray(a)
    if (aArr != Array.isArray(b)) return false
    if (aArr) {
        const x = a as unknown[], y = b as unknown[]
        if (x.length != y.length) return false
        for (let i = 0; i < x.length; i++) if (!structEqual(x[i], y[i])) return false
        return true
    }
    const ao = a as {[k: string]: unknown}, bo = b as {[k: string]: unknown}
    const ka = Object.keys(ao).filter(k => ao[k] !== undefined)
    const kb = Object.keys(bo).filter(k => bo[k] !== undefined)
    if (ka.length != kb.length) return false
    for (const k of ka) if (!structEqual(ao[k], bo[k])) return false
    return true
}
