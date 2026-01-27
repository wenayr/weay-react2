export function ArrayPromise({ arr, catchF, thenF }) {
    let ok = 0, countError = 0;
    const count = arr.length;
    const a = (data, i) => {
        ++ok;
        return thenF?.(data, i, ok, countError, count) ?? data;
    };
    const b = (error, i) => {
        ++countError;
        if (catchF)
            return catchF?.(error, i, ok, countError, count);
        else
            throw error;
    };
    return arr.map((e, i) => () => e().then(r => a(r, i)).catch((er) => b(er, i)));
}
