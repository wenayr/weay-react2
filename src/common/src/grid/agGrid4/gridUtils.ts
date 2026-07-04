// Horizontal column helpers: pure, reusable defaults with no app business logic.
import type { ColDef } from 'ag-grid-community'
import { StyleGridDefault } from '../../styles/styleGrid'
export { numericComparator } from './core'
export type { NumberPair } from './core'

/** Centered cells + sort/filter defaults for dense data tables. */
export const colDefCentered = {
    headerClass: () => 'gridTable-header',
    resizable: true,
    cellStyle: { textAlign: 'center' },
    sortable: true,
    filter: true,
} satisfies ColDef<any>

/** Wrapped text cells for list/selection grids. */
export const colDefWrap = {
    headerClass: () => 'gridTable-header',
    resizable: true,
    cellClass: 'cell-wrap-text',
    cellStyle: { ...StyleGridDefault },
} satisfies ColDef<any>