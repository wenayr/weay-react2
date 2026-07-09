/** Shared "fixed entries pin back to their descriptor index" invariant.
 *
 *  columnState.normalize(), ColumnsMenu.movedOrder(), Toolbar.normalize() and
 *  Toolbar.Settings.movedOrder() used to inline byte-identical copies of this idiom, with
 *  comments demanding they stay in sync (the drag preview must land exactly where the commit
 *  does). One implementation makes that invariant structural instead of disciplinary. */

export type FixedOrderDescriptor = { key: string, fixed?: boolean }

/** Drop fixed keys from `order`, then pin every fixed descriptor back at its descriptor index. */
export function pinFixedOrder(order: readonly string[], descriptors: readonly FixedOrderDescriptor[]): string[] {
    const fixed = new Set<string>()
    for (const d of descriptors) if (d.fixed) fixed.add(d.key)
    const res = order.filter(k => !fixed.has(k))
    descriptors.forEach(function pinFixed(d, i) {
        if (d.fixed) res.splice(Math.min(i, res.length), 0, d.key)
    })
    return res
}

/** The shared drag preview: splice-move `key` to index `to`, then re-pin fixed entries.
 *  Same result as committing the move through normalize(). */
export function movedOrderWithFixed(order: readonly string[], key: string, to: number, descriptors: readonly FixedOrderDescriptor[]): string[] {
    const next = order.slice()
    const from = next.indexOf(key)
    if (from == -1) return next
    next.splice(from, 1)
    next.splice(Math.max(0, Math.min(next.length, to)), 0, key)
    return pinFixedOrder(next, descriptors)
}
