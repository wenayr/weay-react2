# wenay-common2 — BRIEF cheat sheet (notation)

> Root import: `import { ... } from "wenay-common2"`.
> Notation: `name(args: types) -> ret  // note`. Types are shown where they decide a correct call (callback shape,
> overloads, return). Short names are **canonical**; older long names are `@deprecated` (listed as `// alias:`).
> Full surface → **`wenay-common2-rare.md`**. Code style → `CLAUDE.md`. Full RPC guide → `rpc.md`.

## ⭐ events — `UseListen` (the workhorse pub/sub)
```
UseListen<T>(opts?) -> [emit, listen]            // T = tuple of args; single value ok: UseListen<number>()
emit(...args: T)                                 // dispatch to all listeners; args = the tuple T spread (UseListen<number> -> emit(5))
listen.on(cb: (...args: T) => void, {key?: string, cbClose?: () => void}) -> off: () => void   // subscribe (RxJS/EE idiom); key overwrites by key
listen.once(cb: (...args: T) => void, {key?: string}) -> off: () => void                       // one event, then auto-off
listen.onClose(cb: () => void) -> off            // subscribe to stream close
listen.close()                                   // complete: clear listeners + fire onClose + teardown producer
listen.count() -> number                         // live subscriber count (0<->1 transitions drive the lazy source)
listen.isRun() -> boolean
opts: { fast? = true, event?(t: 'add'|'remove', count: number, api), addListenClose? }   // event = lazy source attach/detach
// deprecated aliases kept only for old code: addListen->on · removeListen->off() · eventClose->onClose
```
```
UseListenTransform<TIn, TOut>(src, map: (...a: TIn) => TOut | null, opts?) -> [emit, listen]   // map+filter (null skips); lazy subscribe
joinListens(listens | ports, keyExtractor?) -> { listen, add(port, key?), pending: number, clear(tid?) }   // zip by key
```

## ⭐ sleep
```
sleepAsync(ms = 0) -> Promise<void>
```

## ⏱️ async
```
createThrottle() -> { throttle(ms: number, fn: () => void) -> void,
                      debounce(ms: number, fn: () => void) -> Promise<void> }
  // fn is a ZERO-ARG thunk the scheduler runs itself; NOT a lodash-style wrapper that returns a callable
  // ONE createThrottle() = ONE shared limiter (shared busy/pending) — use a SEPARATE instance per operation;
  //   throttle + debounce on the SAME instance contend (a busy throttle silently drops the debounce's trailing run)
createAsyncQueue(concurrency = 1) -> { add<R>(task: () => Promise<R>) -> Promise<R>, onIdle() -> Promise<void>, size: number }   // p-queue
createReadyGate() -> { add(fn: () => void), ready() }                  // buffer fns until ready(), then run them in order
PromiseArrayListen<T>(arr: (Promise<T> | (() => Promise<T>))[]) -> {
  listenOk(cb), listenError(cb), promise: { all() -> Promise<any[]>, allSettled() }, getData(), status() -> { ok: number, error: number, count: number } }
  // factory entries start on .all()/.allSettled()/getData() (once); .all() NEVER rejects — read the real outcome via status()
// alias: enhancedWaitRun->createThrottle · createTaskQueue->createReadyGate(.setReady->.ready) · createAsyncQueue.enqueue->add · .getQueueSize->size
```

## 🧰 core — clone / compare
```
clone<T>(v: T) -> T            // deep: cycles + Map/Set/Date, rebinds functions      (alias: deepClone)
shallowClone<T>(v: T) -> T
isEqual(a, b) -> boolean       // PLAIN object/array trees ONLY; on Map/Set/Date it returns a vacuous `true` — don't use it on them   (alias: deepEqual)
shallowEqual(a, b) · arrayShallowEqual(a, b) -> boolean      // strict-by-key vs loose-by-index — both kept on purpose
toImmutable<T>(o: T) -> T      // deep-frozen clone + Mutable:false marker
JSON_clone<T>(o: T) -> T       // JSON round-trip; DROPS Map/Set (-> {}) and turns Date -> string. NOT a rich clone — use clone() for those
```

## 🧰 core — binary search / maps / mutex / memo
```
BSearch<T>(arr: ArrayLike<T>, value: T | comparer, match?: 'equal'|'lessOrEqual'|'greatOrEqual', sort?: SortMode) -> number
  // comparer is (item: T) => number  OR  (a: T, b) => number; without it, T must have valueOf():number
BSearchNearest<T>(arr: ArrayLike<T>, value: number, getter?: (el: T) => number, maxDelta?: number) -> number
new MapExt<K,V>() / new WeakMapExt<K,V>():  .getOrSet(k, () => v) -> V          // lazy insert (a plain value is also accepted)
new Mutex():  .runExclusive<T>(fn: () => T | Promise<T>) -> Promise<T>   |   .lock() -> Promise<release: () => void>   // runExclusive: was dispatch
MemoFunc<A extends any[], R>(opts?: { timeDelta?: number, maxLimits?: number }) -> { func(...a: A) -> R, cleanAll(), memo }   // TTL + LRU; per-call {timeDelta, reSave}
```

## 🔢 core — number (frequent)
```
round(value: number, digits = 0) -> number                  // round to N decimals          (alias: NormalizeDouble)
roundSig(value: number, { digitsR?: number /*total significant digits*/, digitsPoint? = 4, type?: 'max'|'min' }) -> number
  // round to N significant digits — roundSig(1234.5678, {digitsR: 3}) -> 1230     (alias: NormalizeDoubleAnd)
gcd(a: number, b: number, digits = 8) -> number   |   gcd(values: Iterable<number>, digits = 8) -> number
  // floats ok; in the ITERABLE overload the 2nd arg is PRECISION digits, not an operand   (alias: MaxCommonDivisor[OnArray])
formatAuto(value: number, maxDigits = 8) -> string          // shortest decimal string      (alias: DblToStrAuto)
decimals(value: number, maxDigits = 8, minDigits = 0) -> number   // count of meaningful decimals (alias: GetDblPrecision)
```

## ⏰ time
```
format(date: Date, pattern, { utc? = true }) -> string     // (alias of 11 timeToStr_*/timeLocalToStr_*)
  pattern: 'HH:mm:ss' | 'HH:mm:ss.SSS' | 'yyyy-MM-dd'
         | 'yyyy-MM-dd HH:mm' | 'yyyy-MM-dd HH:mm:ss' | 'yyyy-MM-dd HH:mm:ss.SSS'
         | 'yyyy-MM-dd HH:mm O' | 'yyyy-MM-dd HH:mm:ss O'   // O = GMT offset (local)
  { utc: false } -> local variants
formatDuration(ms: number, pattern?: 'H:mm:ss' | 'H:mm:ss.SSS') -> string   // clock; hours unbounded
durationToStr(ms: number) -> string                        // humanized
minDate(a: Date | null, b: Date | null) / maxDate(a, b) -> Date | null      // null-tolerant   (alias: MinTime/MaxTime)
convertDatesToStrings(obj)                                 // Date -> strings, recursively (logs)
const:  H1_S D1_S W1_S · M1_MS H1_MS D1_MS W1_MS
```

## 🌐 rpc (brief) — transport is ALWAYS caller-supplied (`{emit,on}`); there is NO url / built-in socket
```
// SERVER: `object` is the impl tree, `socket` is a {emit,on} transport adapter
createRpcServerAuto({ socket: {emit, on}, object, socketKey: string, auth?, limits?, maxPerListen?, throttle?, opt? }) -> { api, ... }
createRpcServer(opts)        // lower-level core (same { socket, object, socketKey })
noStrict(obj)                // mark a dynamic subtree (no schema)
endCallback(fn)              // mark an RPC stream-callback's end   (alias: rpcEndCallback)

// CLIENT hub: takes TWO functions — a socket factory + a schema builder; it is NOT an {url} or an options bag
createRpcClientHub(
  createSocket: (token: string | null) => socket,             // YOU build the socket, e.g. socket.io io(url, {auth:{token}})
  schemaBuilder: (rpc) => ({ key: rpc<Api>('socketKey') }),   // declare each socketKey's typed API
  hubOpts?: { opt? },
) -> hub
hub:     connect(token) -> Promise<clients>  ·  reauth(token)  ·  facade  ·  promise  ·  socket  ·  onConnect/onDisconnect   // connect: was setToken
         // connect()'s promise resolves on the socket's 'connect' event; for in-proc/loopback (no 'connect') use hub.facade + await hub.promise
client (on clients[key], NOT on the hub):  func (proxy) · strict (schema-safe) · close() · ready() · init() · subscriptions()
         // pipe = batch a server chain in one packet · space = fire-and-forget

// minimal wiring (the part no signature can show):
const [tick, ticks] = UseListen<[number]>()
createRpcServerAuto({ socket, object: { math: { add: (a, b) => a + b, ticks } }, socketKey: 'math' })
const hub = createRpcClientHub((t) => io(url, { auth: { t } }), (rpc) => ({ math: rpc<Api>('math') }))
const c = await hub.connect(token)               // c = facade of per-socketKey clients
await c.math.ready();  await c.math.func.add(2, 3)
const l = c.math.func as unknown as DeepSocketListen<Api>  // typed Listen projection; wrap as webListen(c.math) in app code
const off = l.ticks.on(v => console.log(v))                // canonical stream subscribe; off is callable and awaitable
off()                                                     // unsubscribe; .callback/.removeCallback are legacy compat, don't teach them
l.ticks.once(v => console.log(v))                         // one event, then auto-off
// full guide + examples → rpc.md
```

## 🔁 Observable — in-house reactive lib (the everyday reactive API)
> `import { Observable } from "wenay-common2"` → `Observable.createCell(...)` (a namespace). 0-dep.
> Cheap-until-subscribed (0 listeners = a closure + a field). Every node is also a real Listen via `.listen()`
> → drops into RPC / `listen-deep` unchanged.
```
// primitives — a value you read/write like plain data that is ALSO a subscription source
createCell<T>(initial: T, { equals?, recycle? }) -> Cell<T>
  .get() -> T · .set(v: T) -> changed: boolean · .update(fn: (prev: T) => T) · .subscribe(cb: (v: T) => void, { current? }) -> off
  .map<R>(fn: (v: T) => R, { equals? }) -> Computed<R> · .count() -> number · .listen() -> Listen (RPC) · .close()
createRObject<T>(initial: T) -> RObject<T>          // per-key streams + a whole-object [key, value] stream
  .get(k) · .set(k, v) -> boolean · .update(k, fn) · .snapshot() -> T · .key(k) -> per-key view (Cell-like, cb is (value))
  .subscribe(cb: (key, value) => void, { current? }) -> off · .listen() · .close()
createRMap<K,V>(entries?: Iterable<[K,V]>) -> RMap<K,V>      // same model over a real Map; a delete emits undefined (-> null over the wire)
  .get(k) · .has(k) · .set(k, v) · .delete(k) · .update(k, fn) · get size · .keys() · .entries() · .snapshot()
  .key(k) -> per-key view (cb is (value)) · .subscribe(cb: (k, v) => void, { current? }) -> off · .listen() · .close()
```
```
// derived — graph stays COLD (no upstream cost) until a leaf subscriber appears
combine<R>(sources: Source[], compute: (values) => R, { equals? }) -> Computed<R>     // .get() recomputes even with no listeners
computed<T,R>(source, fn: (v: T) => R, { equals? }) -> Computed<R>                     // = combine over one source
computedAuto<R>(fn: (use) => R) -> ComputedAuto<R>            // auto-tracked: use(s) returns s.get() AND tracks it; use.untrack(s) reads w/o tracking
// a Computed is a full reactive Source: .get() · .subscribe(cb)->off · .map(fn) · .listen() · .count() · .close() — pass to an effect's use(), or subscribe directly
```
```
// effects — first run is SYNCHRONOUS (establishes deps), then re-runs on any tracked-dep change
createEffect(fn: (use) => void) -> { dispose }       // use(s) tracks the dep + returns its value; use.untrack(s) reads without tracking
onCleanup(cb: () => void)  ·  createRoot<T>(fn: (dispose) => T) -> { result: T, dispose }   // teardown · own (and dispose) a subtree of effects
batch<T>(fn: () => T) -> T                           // coalesce: N changes inside fn => one re-run / one emit
```
```
// store — path-addressed reactive tree; replace a whole branch, only the changed leaves fire. NOT generic (no <T>)
createTransportStore(initial?: object | Map) -> TransportStore         // one uniform node facade at every depth
  reads:  .get(k?) · .snapshot() · .has(k) · .keys()    writes: .set(k, v) · .replace(v) · .setIn(path: string[], v) · .delete(k)
  nav:    .key(k) -> node · .at(path: string[]) -> node
  subscribe: .value(cb: (v) => void, {current?}) (element) · .entries(cb: (k, v) => void, {current?}) (category) · .deep(cb: (path: string[], v) => void, {current?}) (anywhere)
  .listen() -> Listen                                  // the level stream, for RPC
```
