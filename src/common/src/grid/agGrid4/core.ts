// Слой 1 (core): чистая логика буфера — closure-фабрика. Без React, без ag-grid.
// Буфер = последнее известное состояние строк по id («точка памяти»). Вся анти-гонка здесь.
//
// Отличия от agGrid2/3 (оптимизации):
//  - зависимости (getId, буфер, api) захватываются фабрикой один раз — одна точка входа
//    updateData вместо дублирования «буфер/грид» в хуке;
//  - мёрж строки на месте (Object.assign) — без аллокации нового объекта на каждый апдейт
//    (важно на потоке: меньше мусора для GC);
//  - add-vs-update решается по Set доставленных id, без api.getRowNode на каждую строку.

export type RowId = string

/** Достаёт стабильный id строки. Работает и по частичным данным. */
export type GetId<T> = (data: Partial<T>) => RowId

export type BufferTable<T> = Record<RowId, Partial<T>>

export type GridTransaction<T> = {
    add?: T[]
    update?: T[]
    remove?: T[]
}

/** Минимальный контракт grid api (реальный GridApi структурно подходит). */
export type GridApiLike<T> = {
    forEachNode(callback: (node: { data?: T }) => void): void
    applyTransaction(tx: GridTransaction<T>): unknown
    applyTransactionAsync(tx: GridTransaction<T>): void
}

export type PushOptions = {
    add?: boolean
    update?: boolean
    /** add+update одной СИНХРОННОЙ транзакцией. По умолчанию: add — sync, update — async (батч). */
    sync?: boolean
}

export type UpdateArgs<T> = {
    newData?: Partial<T>[]
    removeData?: Partial<T>[]
    /** Только обновить буфер, грид не трогать. */
    onlyMemo?: boolean
    option?: PushOptions
}

/**
 * Ядро таблицы: буфер + доставка в грид. Жизненный цикл:
 *  1. updateData в любой момент — буфер обновится всегда, грид — если подключён;
 *  2. attach(api) на onGridReady — sync догоняет всё, что прилетело раньше;
 *  3. detach() на destroy грида — ядро снова копит в буфер до следующего attach.
 */
export function createGridBuffer<T>(deps: {
    getId: GetId<T>
    /** Внешний буфер (объект выше компонента) — переживает ремаунт роута. Иначе свой. */
    externalBuffer?: BufferTable<T>
}) {
    const { getId } = deps
    const buf: BufferTable<T> = deps.externalBuffer ?? {}
    const inGrid = new Set<RowId>() // id, уже доставленные в грид
    let api: GridApiLike<T> | null = null

    // ─── Буфер ───────────────────────────────────────────────────────────────

    function upsert(rows: Partial<T>[]) {
        for (const row of rows) {
            const id = getId(row)
            buf[id] = Object.assign(buf[id] ?? {}, row)
        }
    }

    // ─── Доставка в грид ─────────────────────────────────────────────────────

    /** Главная точка: льёшь данные когда угодно — буфер сам решит, дошли они до грида или нет. */
    function updateData(args: UpdateArgs<T>) {
        const { newData, removeData, onlyMemo, option } = args
        if (newData) upsert(newData)
        if (removeData) for (const row of removeData) delete buf[getId(row)]

        if (onlyMemo || !api) return

        const opt = { add: true, update: true, sync: false, ...option }
        const toAdd: T[] = []
        const toUpdate: T[] = []
        for (const row of newData ?? []) {
            const id = getId(row)
            const merged = buf[id] as T
            if (inGrid.has(id)) toUpdate.push(merged)
            else toAdd.push(merged)
        }

        const add = opt.add ? toAdd : []
        const update = opt.update ? toUpdate : []
        // помечаем доставленными только то, что реально уедет в грид
        for (const row of add) inGrid.add(getId(row))
        // ag-grid находит строку для remove через getRowId — частичных данных достаточно
        const remove = removeData?.filter(row => inGrid.delete(getId(row))) as T[] | undefined

        if (opt.sync) {
            api.applyTransaction({ add, update, remove })
            return
        }
        if (add.length || remove?.length) api.applyTransaction({ add, remove })
        // батчинг update отдаёт сам грид (asyncTransactionWaitMillis)
        if (update.length) api.applyTransactionAsync({ update })
    }

    /**
     * Привести грид к буферу целиком (буфер — истина).
     * Чего нет в буфере → remove, чего нет в гриде → add, остальное → update.
     */
    function sync() {
        if (!api) return
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

    // ─── Жизненный цикл ──────────────────────────────────────────────────────

    function attach(gridApi: GridApiLike<T>) {
        api = gridApi
        sync() // догнать гонку: данные могли прилететь раньше onGridReady
    }

    function detach() {
        api = null
        inGrid.clear()
    }

    return {
        // в React-биндинг (или другой владелец грида)
        control: { attach, detach },
        // наружу потребителю
        api: { updateData, sync, getId, buffer: buf },
    }
}

export type GridBufferCore<T> = ReturnType<typeof createGridBuffer<T>>

// ─── Утилиты ─────────────────────────────────────────────────────────────────

export type NumberPair = [a: number, b: number]

/** Компаратор колонок: числа — как числа, пустые/NaN вниз (с учётом инверсии). */
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
