// Column core: a lifecycle buffer for dynamic column names. No React and no column layout policy.
// The caller owns how names are translated into columnDefs; this core only stores names
// and replays them when a grid api is attached.
import type { GridApi } from 'ag-grid-community'

export type ColumnApplyContext<TData = any> = {
    api: GridApi<TData>
    names: readonly string[]
}

export type ColumnAttach<TData = any> = {
    /** Project/page wrapper decides how names affect the grid. */
    apply: (context: ColumnApplyContext<TData>) => void
}

/**
 * Buffer for the exact set of dynamic column names.
 * setNames() means exactly this dynamic set; attach() applies the saved set; detach() keeps names.
 * This utility deliberately knows nothing about groups, columnDefs shape, or business names.
 */
export function createColumnBuffer<TData = any>() {
    let names: string[] = []
    let attachOptions: ColumnAttach<TData> | null = null
    let api: GridApi<TData> | null = null

    function apply() {
        if (api && attachOptions) attachOptions.apply({ api, names })
    }

    function attach(gridApi: GridApi<TData>, opts: ColumnAttach<TData>) {
        api = gridApi
        attachOptions = opts
        apply()
    }

    function detach() {
        api = null
        attachOptions = null
    }

    function sameNames(next: readonly string[]) {
        if (next.length != names.length) return false
        for (let i = 0; i < next.length; i++) if (next[i] != names[i]) return false
        return true
    }

    function setNames(list: string[]) {
        const next = [...new Set(list)]
        // Streams re-announce the same dynamic set on every tick. An unchanged set is
        // a no-op: rebuilding columnDefs would drop grid-side column state for nothing.
        // apply() stays the explicit force path when the caller DOES want a re-apply.
        if (sameNames(next)) return
        names = next
        apply()
    }

    return {
        control: { attach, detach },
        api: {
            setNames,
            apply,
            get names() {
                return names
            },
        },
    }
}

export type ColumnBuffer<TData = any> = ReturnType<typeof createColumnBuffer<TData>>