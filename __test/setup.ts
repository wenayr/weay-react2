import {TextDecoder, TextEncoder} from 'node:util'

// jsdom 20 (used by Jest 29) does not install the Encoding API. common2's
// artifact hashing initializes it at module load, so expose Node's equivalent
// before any test imports the package.
Object.assign(globalThis, {TextDecoder, TextEncoder})

// The floating-window drag loop coalesces pointer moves into one requestAnimationFrame, and
// jsdom runs rAF on a timer - a synchronous test would assert before the frame ever fired.
// Keep the real scheduling and add a manual drain the drag tests call after each move.
type FrameHarness = {flush(): void}
const frameGlobal = globalThis as typeof globalThis & {__wenayFrameHarness?: FrameHarness}

if (!frameGlobal.__wenayFrameHarness) {
    const pending = new Map<number, FrameRequestCallback>()
    let sequence = 0
    const nativeRequest = typeof globalThis.requestAnimationFrame == 'function'
        ? globalThis.requestAnimationFrame.bind(globalThis)
        : undefined

    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
        const id = ++sequence
        pending.set(id, callback)
        const run = () => {
            const scheduled = pending.get(id)
            if (!scheduled) return
            pending.delete(id)
            scheduled(Date.now())
        }
        if (nativeRequest) nativeRequest(run)
        else setTimeout(run, 16)
        return id
    }
    globalThis.cancelAnimationFrame = (id: number) => { pending.delete(id) }

    frameGlobal.__wenayFrameHarness = {
        flush() {
            const scheduled = Array.from(pending.values())
            pending.clear()
            scheduled.forEach(callback => callback(Date.now()))
        },
    }
}

/** Run every animation-frame callback scheduled so far, synchronously. */
export function flushAnimationFrames() {
    frameGlobal.__wenayFrameHarness?.flush()
}
