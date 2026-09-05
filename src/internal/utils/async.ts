/** Tiny async helpers the menu layer needs. Local on purpose: wenay-common2 is CommonJS, so
 *  importing `sleepAsync` / `promiseProgress` from `wenay-common2/client` cost the whole client
 *  barrel (~61 KB gzip) in every entry that renders a menu. Same contracts as the originals. */

export function sleepAsync(msec = 0): Promise<void> {
    return new Promise(resolve => { setTimeout(resolve, msec) })
}

type ProgressTask<T> = Promise<T> | (() => Promise<T>)
type OkListener<T> = (data: T, index: number, ok: number, error: number, count: number) => void
type ErrorListener = (error: unknown, index: number, ok: number, error_: number, count: number) => void

/** Fan-in over a list of promises / promise factories with ok/error counters. Factories start
 *  lazily on the first all()/allSettled()/items(); plain promises are already running. */
export function promiseProgress<T>(array: ProgressTask<T>[]) {
    let ok = 0, errorCount = 0
    const count = array.length
    const okListeners = new Set<OkListener<T>>()
    const errorListeners = new Set<ErrorListener>()
    const wrap = (promise: Promise<T>, i: number) => promise.then(result => {
        ++ok
        for (const cb of [...okListeners]) cb(result, i, ok, errorCount, count)
        return result
    }, (error: unknown) => {
        ++errorCount
        for (const cb of [...errorListeners]) cb(error, i, ok, errorCount, count)
        throw error
    })
    const started: Promise<T>[] = []
    const startAll = () => array.map((task, i) => started[i] ??= wrap(
        typeof task == "function" ? (async () => task())() : task, i))
    return {
        onOk(cb: OkListener<T>) { okListeners.add(cb); return () => { okListeners.delete(cb) } },
        onError(cb: ErrorListener) { errorListeners.add(cb); return () => { errorListeners.delete(cb) } },
        all: () => Promise.all(startAll()),
        allSettled: () => Promise.allSettled(startAll()),
        items: () => startAll(),
        stats: () => ({ok, error: errorCount, count}),
    }
}
