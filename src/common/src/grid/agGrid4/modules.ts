import {
    CellStyleModule,
    ClientSideRowModelApiModule,
    ClientSideRowModelModule,
    ColumnApiModule,
    ColumnAutoSizeModule,
    DateFilterModule,
    enableDevValidations,
    EventApiModule,
    ModuleRegistry,
    NumberFilterModule,
    RenderApiModule,
    RowApiModule,
    RowSelectionModule,
    RowStyleModule,
    ScrollApiModule,
    TextFilterModule,
    TooltipModule,
    type Module,
} from 'ag-grid-community'

/**
 * Features used by AgGridTable/useAgGrid and their production consumers.
 *
 * Keep optional features grid-scoped through AgGridReact's `modules` prop instead
 * of growing this shared baseline.
 */
export const defaultAgGridModules: Module[] = [
    ClientSideRowModelModule,
    ClientSideRowModelApiModule,
    ColumnApiModule,
    ColumnAutoSizeModule,
    EventApiModule,
    RenderApiModule,
    RowApiModule,
    ScrollApiModule,
    RowSelectionModule,
    CellStyleModule,
    RowStyleModule,
    TextFilterModule,
    NumberFilterModule,
    DateFilterModule,
    TooltipModule,
]

declare const process: {env: {NODE_ENV?: string}}

let modulesRegistered = false

/**
 * Register the shared module baseline globally before the first grid is created.
 * Repeated wrapper/hook renders do not touch ModuleRegistry again.
 */
export function ensureAgGridModules() {
    if (modulesRegistered) return

    // Vite/esbuild replace this expression in production, which lets the
    // ValidationModule implementation disappear from production bundles.
    if (process.env.NODE_ENV != 'production')
        enableDevValidations()

    ModuleRegistry.registerModules(defaultAgGridModules)
    modulesRegistered = true
}
