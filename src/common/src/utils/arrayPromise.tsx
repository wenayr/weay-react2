
/**
 * Оборачивает массив thunk'ов промисов колбэками прогресса.
 * КОНТРАКТ: счётчики countOk/countError корректны только при СТРОГО ПОСЛЕДОВАТЕЛЬНОМ
 * запуске thunk'ов (один за другим). При параллельном запуске (Promise.all)
 * значения счётчиков в колбэках — гонка, полагаться на них нельзя.
 */
export function ArrayPromise<T = unknown>({arr, catchF, thenF}: {
    arr: (() => Promise<T>)[],
    thenF?: (data: T, i: number, countOk: number, countError: number, count: number) => unknown,
    catchF?: (error: unknown, i: number, countOk: number, countError: number, count: number) => unknown
}) {
    let ok = 0, countError = 0
    const count = arr.length
    const a = (data: T, i: number) => {
        ++ok;
        return thenF?.(data, i, ok, countError, count) ?? data
    }
    const b = (error: unknown, i: number) => {
        ++countError;
        if (catchF) return catchF?.(error, i, ok, countError, count)
        else throw error
    }
    return arr.map((e, i) => () => e().then(r => a(r, i)).catch((er: unknown) => b(er, i)))
}