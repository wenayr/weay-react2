/** Shared "fixed entries pin back to their descriptor index" invariant.
 *
 *  columnState.normalize(), ColumnsMenu.movedOrder(), Toolbar.normalize() and
 *  Toolbar.Settings.movedOrder() used to inline byte-identical copies of this idiom, with
 *  comments demanding they stay in sync (the drag preview must land exactly where the commit
 *  does). One implementation makes that invariant structural instead of disciplinary.
 *
 *  That one implementation now lives in src/native/columnStateCore.ts, because the React Native
 *  entrypoint may not import a value out of the shared tree (__test/nativeIsolation.test.ts)
 *  while the shared tree may import from native. This module stays as the shared tree's name
 *  for it and delegates. */
import {pinFixedColumns} from '../../native/columnStateCore.js'

export type FixedOrderDescriptor = { key: string, fixed?: boolean }

/** Drop fixed keys from `order`, then pin every fixed descriptor back at its descriptor index. */
export function pinFixedOrder(order: readonly string[], descriptors: readonly FixedOrderDescriptor[]): string[] {
    return pinFixedColumns(order, descriptors)
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
