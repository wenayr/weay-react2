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

export type NativeColumnsSort = {key: string, dir: 'asc' | 'desc'}
export type NativeColumnsConfig = {
    v: number
    order: string[]
    visible: {[key: string]: boolean}
    width: {[key: string]: number}
    sort: NativeColumnsSort | null
    filter: {[key: string]: unknown}
    groups: {[group: string]: string[]}
}
export type NativeColumnStorage = {
    getItem(key: string): Promise<string | null>
    setItem(key: string, value: string): Promise<unknown>
    removeItem?(key: string): Promise<unknown>
}
export type NativeColumnStateError = {phase: 'read' | 'parse' | 'write', error: unknown}

const SCHEMA_V = 1

function copy(config: NativeColumnsConfig): NativeColumnsConfig {
    return {
        ...config,
        order: config.order.slice(),
        visible: {...config.visible},
        width: {...config.width},
        sort: config.sort ? {...config.sort} : null,
        filter: {...config.filter},
        groups: Object.fromEntries(Object.entries(config.groups).map(([group, keys]) => [group, keys.slice()])),
    }
}

function pinFixed(order: readonly string[], columns: readonly NativeColumnMeta[]) {
    const fixed = new Set(columns.filter(column => column.fixed).map(column => column.key))
    const result = order.filter(key => !fixed.has(key))
    columns.forEach(function pin(column, index) {
        if (column.fixed) result.splice(Math.min(index, result.length), 0, column.key)
    })
    return result
}

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
    const groupKeys = [...new Set(columns.map(column => column.group).filter((group): group is string => !!group))]
    const listeners = new Set<(config: NativeColumnsConfig) => void>()
    let revision = 0
    let hydrated = !opts.storage
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let writes = Promise.resolve()

    const members = (group: string) => columns.filter(column => column.group == group).map(column => column.key)
    function defaults(): NativeColumnsConfig {
        return {
            v: SCHEMA_V,
            order: opts.def?.order?.slice() ?? columns.map(column => column.key),
            visible: opts.def?.visible ? {...opts.def.visible} : Object.fromEntries(columns.map(column => [column.key, column.defaultVisible != false])),
            width: opts.def?.width ? {...opts.def.width} : {},
            sort: opts.def?.sort ? {...opts.def.sort} : null,
            filter: opts.def?.filter ? {...opts.def.filter} : {},
            groups: opts.def?.groups ? {...opts.def.groups} : Object.fromEntries(groupKeys.map(group => [group, members(group)])),
        }
    }

    function normalize(value?: Partial<NativeColumnsConfig> | null): NativeColumnsConfig {
        const base = defaults()
        const order = (Array.isArray(value?.order) ? value.order : base.order)
            .filter(key => known.has(key) && !byKey.get(key)?.fixed)
        for (const column of columns)
            if (!column.fixed && !order.includes(column.key)) order.push(column.key)
        const rawVisible = value?.visible && typeof value.visible == 'object' ? value.visible : base.visible
        const visible: {[key: string]: boolean} = {}
        for (const column of columns)
            visible[column.key] = column.fixed ? true : (rawVisible[column.key] ?? column.defaultVisible != false)
        const width: {[key: string]: number} = {}
        for (const [key, item] of Object.entries(value?.width ?? {}))
            if (known.has(key) && typeof item == 'number' && isFinite(item) && item > 0) width[key] = item
        const sort = value?.sort && known.has(value.sort.key) && (value.sort.dir == 'asc' || value.sort.dir == 'desc')
            ? {key: value.sort.key, dir: value.sort.dir} as NativeColumnsSort : null
        const filter: {[key: string]: unknown} = {}
        for (const [key, item] of Object.entries(value?.filter ?? {}))
            if (known.has(key)) filter[key] = item
        const groups: {[group: string]: string[]} = {}
        for (const group of groupKeys) {
            const allowed = members(group)
            const raw = value?.groups?.[group]
            groups[group] = Array.isArray(raw) ? raw.filter(key => allowed.includes(key)) : allowed
        }
        return {v: SCHEMA_V, order: pinFixed(order, columns), visible, width, sort, filter, groups}
    }

    let config = normalize(defaults())
    const emit = () => {
        const snapshot = copy(config)
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
            enqueue(copy(config))
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
        if (!opts.storage) return copy(config)
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
        return copy(config)
    })()

    const getConfig = () => copy(config)
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
        const current = config.sort
        setSort(current?.key != key ? {key, dir: 'asc'} : current.dir == 'asc' ? {key, dir: 'desc'} : null)
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
    function visibleKeys() {
        return config.order.filter(key => {
            if (config.visible[key] == false) return false
            const group = byKey.get(key)?.group
            return !group || config.groups[group]?.includes(key)
        })
    }
    function reset() { commit(defaults()) }
    async function flush() {
        clearTimeout(timer)
        timer = undefined
        await ready
        enqueue(copy(config))
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
