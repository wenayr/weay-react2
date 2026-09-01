import {
    columnGroupKeys,
    columnVisibleKeys,
    copyColumnsConfig,
    defaultColumnsConfig,
    nextColumnSort,
    normalizeColumnsConfig,
} from './columnStateCore.js'
import type {ColumnCoreConfig, ColumnCoreSort} from './columnStateCore.js'

export type NativeColumnMeta = {
    key: string
    title: string
    short?: string
    icon?: unknown
    group?: string
    fixed?: boolean
    defaultVisible?: boolean
    cardRole?: 'title' | 'accent'
}

/** Shape aliases over the shared core: the persisted JSON is one schema, not two. */
export type NativeColumnsSort = ColumnCoreSort
export type NativeColumnsConfig = ColumnCoreConfig
export type NativeColumnStorage = {
    getItem(key: string): Promise<string | null>
    setItem(key: string, value: string): Promise<unknown>
    removeItem?(key: string): Promise<unknown>
}
export type NativeColumnStateError = {phase: 'read' | 'parse' | 'write', error: unknown}

/** Headless, platform-neutral column controller. AsyncStorage satisfies storage directly. */
export function createNativeColumnState(opts: {
    key: string
    columns: readonly NativeColumnMeta[]
    def?: Partial<NativeColumnsConfig>
    storage?: NativeColumnStorage
    saveMs?: number
    onError?: (event: NativeColumnStateError) => void
}) {
    const columns = opts.columns.slice()
    const byKey = new Map(columns.map(column => [column.key, column]))
    const known = new Set(byKey.keys())
    const groupKeys = columnGroupKeys(columns)
    const listeners = new Set<(config: NativeColumnsConfig) => void>()
    let revision = 0
    let hydrated = !opts.storage
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let writes = Promise.resolve()

    const defaults = (): NativeColumnsConfig => defaultColumnsConfig(columns, opts.def)
    /** native keeps its "a missing order/visible falls back to the caller's def" behaviour;
     *  the web side falls back to empty. See NormalizeColumnsOptions. */
    const normalize = (value?: Partial<NativeColumnsConfig> | null): NativeColumnsConfig =>
        normalizeColumnsConfig(columns, value, {def: opts.def, fallbackToDefaults: true})

    let config = normalize(defaults())
    const emit = () => {
        const snapshot = copyColumnsConfig(config)
        for (const listener of listeners) listener(snapshot)
    }
    const report = (phase: NativeColumnStateError['phase'], error: unknown) => opts.onError?.({phase, error})
    function enqueue(snapshot: NativeColumnsConfig) {
        if (!opts.storage || disposed) return
        writes = writes.then(async function save() {
            try { await opts.storage!.setItem(opts.key, JSON.stringify(snapshot)) }
            catch (error) { report('write', error) }
        })
    }
    function schedule() {
        if (!opts.storage || !hydrated || disposed) return
        clearTimeout(timer)
        timer = setTimeout(function saveLater() {
            timer = undefined
            enqueue(copyColumnsConfig(config))
        }, opts.saveMs ?? 100)
    }
    function commit(next: Partial<NativeColumnsConfig>) {
        if (disposed) return
        config = normalize(next)
        revision++
        emit()
        schedule()
    }

    const ready = (async function hydrate() {
        if (!opts.storage) return copyColumnsConfig(config)
        const before = revision
        try {
            const raw = await opts.storage.getItem(opts.key)
            if (raw != null && revision == before) {
                try {
                    config = normalize(JSON.parse(raw) as Partial<NativeColumnsConfig>)
                    emit()
                } catch (error) { report('parse', error) }
            }
        } catch (error) { report('read', error) }
        finally {
            hydrated = true
            if (revision != before) schedule()
        }
        return copyColumnsConfig(config)
    })()

    const getConfig = () => copyColumnsConfig(config)
    const subscribe = (listener: (config: NativeColumnsConfig) => void) => {
        listeners.add(listener)
        return function unsubscribe() { listeners.delete(listener) }
    }
    function show(key: string, visible: boolean) {
        if (!known.has(key) || byKey.get(key)?.fixed) return
        commit({...config, visible: {...config.visible, [key]: visible}})
    }
    function move(order: string[]) { commit({...config, order}) }
    function moveKey(key: string, to: number) {
        if (!known.has(key) || byKey.get(key)?.fixed) return
        const order = config.order.slice()
        const from = order.indexOf(key)
        if (from == -1) return
        order.splice(from, 1)
        order.splice(Math.max(0, Math.min(order.length, to)), 0, key)
        move(order)
    }
    function setSort(sort: NativeColumnsSort | null) { commit({...config, sort}) }
    function toggleSort(key: string) {
        if (!known.has(key)) return
        setSort(nextColumnSort(config.sort, key))
    }
    function setFilter(key: string, value: unknown) {
        if (!known.has(key)) return
        const filter = {...config.filter}
        if (value == null) delete filter[key]
        else filter[key] = value
        commit({...config, filter})
    }
    function setGroup(group: string, keys: string[]) {
        if (!groupKeys.includes(group)) return
        commit({...config, groups: {...config.groups, [group]: keys}})
    }
    const visibleKeys = () => columnVisibleKeys(config, columns)
    function reset() { commit(defaults()) }
    async function flush() {
        clearTimeout(timer)
        timer = undefined
        await ready
        enqueue(copyColumnsConfig(config))
        await writes
    }
    function dispose() {
        disposed = true
        clearTimeout(timer)
        listeners.clear()
    }

    return {
        columns: columns as readonly NativeColumnMeta[],
        ready,
        api: {getConfig, setConfig: (next: NativeColumnsConfig) => commit(next), subscribe, show, move, moveKey,
            setSort, toggleSort, setFilter, setGroup, visibleKeys, reset, flush},
        dispose,
    }
}

export type NativeColumnStateController = ReturnType<typeof createNativeColumnState>
