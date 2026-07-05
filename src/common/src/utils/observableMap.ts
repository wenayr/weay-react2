/** Map that announces its own mutations. The persisted-state maps (ExRNDMap3, mapResiReact,
 *  mapRightMenu, staticProps) are ObservableMap instances, so the dirty signal originates in
 *  the data layer itself: set/delete/clear emit automatically, touch(key) announces an
 *  in-place mutation of a stored object (invisible to map methods). CacheFuncMapBase
 *  subscribes to the maps it owns - mutation sites never talk to the cache directly. */

export type tMapChangeListener<K> = (key?: K) => void

export class ObservableMap<K, V> extends Map<K, V> {
    // no initializer: Map's constructor calls this.set() before class fields are assigned
    private listeners?: Set<tMapChangeListener<K>>

    /** Subscribe to mutations (set/delete/clear/touch); returns unsubscribe. */
    onChange(cb: tMapChangeListener<K>): () => void {
        (this.listeners ??= new Set()).add(cb)
        return () => { this.listeners?.delete(cb) }
    }

    /** Announce an in-place mutation of a stored value. */
    touch(key?: K): void { this.emit(key) }

    private emit(key?: K): void {
        if (!this.listeners?.size) return
        // copy before iterating: an unsubscribe from inside a callback must not skip the rest
        for (const cb of [...this.listeners]) cb(key)
    }

    set(key: K, value: V): this {
        super.set(key, value)
        this.emit(key)
        return this
    }

    delete(key: K): boolean {
        const existed = super.delete(key)
        if (existed) this.emit(key)
        return existed
    }

    clear(): void {
        const hadEntries = this.size > 0
        super.clear()
        if (hadEntries) this.emit()
    }
}
