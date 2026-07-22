import {TextDecoder, TextEncoder} from 'node:util'

// jsdom 20 (used by Jest 29) does not install the Encoding API. common2's
// artifact hashing initializes it at module load, so expose Node's equivalent
// before any test imports the package.
Object.assign(globalThis, {TextDecoder, TextEncoder})
