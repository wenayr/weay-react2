// Layer 1 (core): pure buffer logic, implemented as a closure factory. No React, no ag-grid.
// Buffer = the last known row state by id (a memory point). All race handling is here.
//
// Differences from agGrid2/3 (optimizations):
//  - dependencies (getId, buffer, api) are captured by the factory once: one entry point,
//    updateData, instead of duplicating buffer/grid branching in the hook;
//  - in-place row merge (Object.assign), with no new object allocated for each update
//    (important on streams: less garbage for GC);
//  - mirror add vs update is decided by a Set of delivered ids; overlay checks the grid by row id.

export type RowId = string

/** Gets a stable row id. Works with partial data too. */
export type GetId<T> = (data: Partial<T>) => RowId

export type BufferTable<T> = Record<RowId, Partial<T>>

export type GridTransaction<T> = {
    add?: T[]
    update?: T[]
    remove?: T[]
}

/** Minimal grid api contract (the real GridApi is structurally compatible). */
export type GridApiLike<T> = {
    /** Used by overlay mode: row ownership belongs to rowData, not to this buffer. */
    getRowNode?(id: RowId): { data?: T } | undefined
    forEachNode(callback: (node: { data?: T }) => void): void
    applyTransaction(tx: GridTransaction<T>): unknown
    applyTransactionAsync(tx: GridTransaction<T>): void
}

export type GridBufferMode = 'mirror' | 'overlay'

export type PushOptions = {
    add?: boolean
    update?: boolean
    remove?: boolean
    /** add+update in one SYNCHRONOUS transaction. Default: add is sync, update is async (batched). */
    sync?: boolean
}

export type UpdateArgs<T> = {
    newData?: Partial<T>[]
    removeData?: Partial<T>[]
    /** Only update the buffer; do not touch the grid. */
    onlyMemo?: boolean
    option?: PushOptions
}

export type CleanArgs = {
    /** Only clear the buffer; do not remove rows from a mirror-owned grid. */
    onlyMemo?: boolean
}

export type CreateGridBufferOptions<T> = {
    getId: GetId<T>
    /** External buffer (object above the component) survives route remounts. Otherwise use an internal one. */
    externalBuffer?: BufferTable<T>
    /**
     * mirror (default): the buffer is the source of truth; sync adds, updates and removes grid rows.
     * overlay: external rowData owns rows; sync only refreshes rows that already exist in the grid.
     */
    mode?: GridBufferMode
    /** Delivery defaults for updateData, e.g. { add: false } for rowData-owned streaming overlays. */
    pushDefaults?: PushOptions
}

/**
 * Table core: buffer + delivery to the grid. Lifecycle:
 *  1. updateData at any time: the buffer is always updated, the grid only if attached;
 *  2. attach(api) on onGridReady: sync catches up with everything that arrived earlier;
 *  3. detach() on grid destroy: the core accumulates in the buffer again until the next attach.
 */
export function createGridBuffer<T>(deps: CreateGridBufferOptions<T>) {
    const { getId, mode = 'mirror', pushDefaults } = deps
    const buf: BufferTable<T> = deps.externalBuffer ?? {}
    const inGrid = new Set<RowId>() // ids already delivered to the grid
    let api: GridApiLike<T> | null = null

    function gridHas(id: RowId) {
        if (!api) return false
        if (mode == 'mirror') return inGrid.has(id)
        const node = api.getRowNode?.(id)
        if (node) return !!node.data
        let found = false
        api.forEachNode(rowNode => {
            if (!found && rowNode.data && getId(rowNode.data) == id) found = true
        })
        return found
    }

    // --- Buffer ----------------------------------------------------------------

    function upsert(rows: Partial<T>[]) {
        for (const row of rows) {
            const id = getId(row)
            buf[id] = Object.assign(buf[id] ?? {}, row)
        }
    }

    // --- Grid delivery ---------------------------------------------------------

    /** Main entry point: push data any time; the buffer decides whether it reaches the grid. */
    function updateData(args: UpdateArgs<T>) {
        const { newData, removeData, onlyMemo, option } = args
        if (newData) upsert(newData)
        if (removeData) for (const row of removeData) delete buf[getId(row)]

        if (onlyMemo || !api) return

        const opt = { add: true, update: true, remove: true, sync: false, ...pushDefaults, ...option }
        const toAdd: T[] = []
        const toUpdate: T[] = []
        const seen = new Set<RowId>()
        for (const row of newData ?? []) {
            const id = getId(row)
            if (seen.has(id)) continue
            seen.add(id)
            const merged = buf[id] as T
            if (gridHas(id)) toUpdate.push(merged)
            else toAdd.push(merged)
        }

        const add = opt.add ? toAdd : []
        const update = opt.update ? toUpdate : []
        // Mark as delivered only the rows that are actually sent to the grid.
        for (const row of add) inGrid.add(getId(row))
        // ag-grid finds rows for remove through getRowId, so partial data is enough.
        const remove = opt.remove
            ? removeData?.filter(row => {
                const id = getId(row)
                const delivered = inGrid.delete(id)
                return mode == 'overlay' ? gridHas(id) : delivered
            }) as T[] | undefined
            : undefined

        if (opt.sync) {
            api.applyTransaction({ add, update, remove })
            return
        }
        if (add.length || remove?.length) api.applyTransaction({ add, remove })
        // Let the grid itself batch updates (asyncTransactionWaitMillis).
        if (update.length) api.applyTransactionAsync({ update })
    }

    /**
     * Bring the whole grid in line with the buffer (the buffer is the source of truth).
     * Missing from the buffer -> remove; missing from the grid -> add; everything else -> update.
     * In overlay mode, rowData is the source of truth, so sync only updates row intersection.
     */
    function sync() {
        if (!api) return

        if (mode == 'overlay') {
            const update: T[] = []
            api.forEachNode(function refresh(node) {
                if (!node.data) return
                const id = getId(node.data)
                if (buf[id]) update.push(buf[id] as T)
            })
            if (update.length) api.applyTransaction({ update })
            return
        }

        const add: T[] = []
        const update: T[] = []
        const remove: T[] = []
        const gridIds = new Set<RowId>()

        api.forEachNode(function classify(node) {
            if (!node.data) return
            const id = getId(node.data)
            gridIds.add(id)
            if (buf[id]) update.push(buf[id] as T)
            else remove.push(node.data)
        })
        inGrid.clear()
        for (const id in buf) {
            inGrid.add(id)
            if (!gridIds.has(id)) add.push(buf[id] as T)
        }

        if (add.length || update.length || remove.length)
            api.applyTransaction({ add, update, remove })
    }

    /** Clear the buffer. In mirror mode, also remove all current grid rows unless onlyMemo is set. */
    function clean(args: CleanArgs = {}) {
        const remove: T[] = []
        if (!args.onlyMemo && api && mode == 'mirror') {
            api.forEachNode(node => {
                if (node.data) remove.push(node.data)
            })
        }
        for (const id in buf) delete buf[id]
        inGrid.clear()
        if (remove.length) api?.applyTransaction({ remove })
    }

    // --- Lifecycle -------------------------------------------------------------

    function attach(gridApi: GridApiLike<T>) {
        api = gridApi
        sync() // catch up with the race: data may have arrived before onGridReady
    }

    function detach() {
        api = null
        inGrid.clear()
    }

    return {
        // for the React binding (or another grid owner)
        control: { attach, detach },
        // public consumer api
        api: { updateData, clean, sync, getId, buffer: buf },
    }
}

export type GridBufferCore<T> = ReturnType<typeof createGridBuffer<T>>

// --- Utilities ---------------------------------------------------------------

export type NumberPair = [a: number, b: number]

/** Column comparator: numbers as numbers, empty/NaN values last (respecting inversion). */
export function numericComparator<T = any>(map?: (a: any, b: any) => NumberPair) {
    return (a1: any, b1: any, _nodeA?: T, _nodeB?: T, inv?: boolean): number => {
        const [a, b] = map ? map(a1, b1) : [a1, b1]
        const aNum = typeof a == 'number' && !Number.isNaN(a)
        const bNum = typeof b == 'number' && !Number.isNaN(b)
        if (aNum && bNum) return a - b
        if (a == b) return 0
        if (!Number.isNaN(b) && b != null) return inv ? -1 : 1
        return inv ? 1 : -1
    }
}
