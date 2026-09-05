/** Hue-walk RGB generator (port of wenay-common2's colorGenerator2, kept local so LeftModal's
 *  default button colors do not pull the CommonJS client barrel). Yields [r, g, b] triples,
 *  each walking one edge of the RGB hexagon at the given min/max, ending with [-1, -1, -1]. */
export function* colorGenerator2(data?: {min?: number, max?: number}): Generator<[number, number, number]> {
    const max = data?.max ?? 255
    const min = data?.min ?? 0
    function* range(start: number, end: number) {
        const span = (end - start) * 5
        for (let p = span; p > 1; p >>= 2)
            for (let i = 1, step = p >> 2; step * i < span; i++) yield step * i
    }
    const d = max - min
    for (const num of range(min, max)) {
        const buf: [number, number, number] = [min, min, min]
        const p = Math.round(num / d)
        const r = num % d
        if (p == 0) { buf[0] = max; buf[1] = min + r }
        if (p == 1) { buf[0] = max - r; buf[1] = max }
        if (p == 2) { buf[1] = max; buf[2] = min + r }
        if (p == 3) { buf[1] = max - r; buf[2] = max }
        if (p == 4) { buf[2] = max; buf[0] = min + r }
        if (p == 5) { buf[2] = max - r; buf[0] = max }
        yield buf
    }
    yield [-1, -1, -1]
}
