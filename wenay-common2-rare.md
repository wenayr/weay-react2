# wenay-common2 — EXTENDED cheat sheet (notation)

> The full surface. For everyday helpers use **`wenay-common2.md`** (brief). Root import:
> `import { ... } from "wenay-common2"`. Notation: `name(args) -> ret  // note`. Short names are
> canonical; `// alias:` marks the older `@deprecated` long names (still exported, byte-for-byte).

## 🔔 events (rare)
```
new CObjectEventsArr<T>() / new CObjectEventsList<T>(log?=true)        // handler collections
  .add(item, {at?:'start'|'end'})   // item: { func?, func2?, del?, OnDel? }; default end (func2 = run-once-then-del)
  .emit(data?) · .clear() · get size · .OnSpecEvent(fn)
  // alias: Add/AddEnd->add · AddStart->add(_, {at:'start'}) · OnEvent->emit · Clean->clear · count/length->size
  // CObjectEventsList warns at >20 subscriptions (leak detector)

funcListenCallbackBase<T>(producer, opts?)        // low-level base behind UseListen; producer b(emit) sets up source, returns cleanup
funcListenCallback = funcListenCallbackBase  ·  funcListenCallbackFast<T>(producer)
UseListen2<T>(opts?) -> [emit, listen2]  ·  toListen2(full) -> listen2     // slim Listen2 view
full Listen: .on(cb,{key?,cbClose?})->off · .once(cb,{key?})->off · .onClose(cb)->off · .close() · .count()
  // deprecated full-api compat: .addListen/.removeListen/.eventClose/.removeEventClose; new code keeps the off() returned by .on/.once/.onClose
Listen2: .on(cb,{key?})->off · .close() · .count()
isListenCallback(obj) -> boolean                  // duck-type a funcListenCallback* result
socketBuffer3(...) · funcListenCallbackSnapshot(...)   // snapshot/buffer adapters over a realSocket2
```

## 🔢 number formatting & math (full)
```
round(value, digits=0)                            // alias: NormalizeDouble
roundSig(value, {digitsPoint?, digitsR?, type?: 'max'|'min'})           // alias: NormalizeDoubleAnd
formatAuto(value, maxDigits=8) -> string          // alias: DblToStrAuto  (negative maxDigits = significant digits)
formatSig(value, {digitsPoint?, digitsR?, type?}) -> string             // alias: DblToStrAnd (pairs with roundSig)
decimals(value, maxDigits=8, minDigits=0) -> number                     // alias: GetDblPrecision / GetDblPrecision2
gcd(a, b, digits?=8) | gcd(values: Iterable<number>, digits?=8)         // alias: MaxCommonDivisor / MaxCommonDivisorOnArray
CorrelationRollingByBuffer(data)                  // rolling Pearson correlation over a ring buffer
```

## 🗺️ niche data structures
```
class MyMap<K extends {valueOf():number}, V>      // sorted keys
  .set/.get/.has/.delete/.clear · get size · .clone()    // JS-Map surface
  // alias: Set/Get/Contains/Remove/Clear/Count->set/get/has/delete/clear/size · Clone->clone
  // (no keys()/values()/entries() — use getters: sortedKeys: readonly K[], Values: readonly V[])
class MyNumMap<V> extends MyMap<number,V>          // also indexable: map[5]=v / map[5]
class StructMap<TKey, TResult> { set/get/has/keys/values/entries }      // tuple / multi-part keys
class StructSet<TKey>          { add/has/keys/values }
class ArrayMap<TKey extends number|string, TVal> extends StructMap<readonly TKey[], TVal>
class ArraySet<TKey extends number|string>        extends StructSet<readonly TKey[]>
new VirtualItems<T>(getItem:(i)=>T, getLength:()=>number)               // lazy array via Proxy; indexable+iterable, .length
class CCachedValue2<TKey extends [any,any], TVal> { getOrSet(key, ()=>val) }   // recompute when any key element changes
class CObjectID<TObject, TOwner> { value:number; static getInfo/getObjectByOwner }   // opaque typed ids
```

## ⏳ cancellation & timers
```
class CancelablePromise<T> extends Promise<T> { constructor(exec, onCancel?); cancel(msg?); static resolve }
class CancelToken { get aborted; abort() }         // poll-only (NOT a full AbortSignal). alias: isCancelled->aborted · cancel->abort
createCancellableTimer(interval_ms, onTimer:()=>boolean|void, onStop?) -> CancelablePromise<never>   // onTimer()===false stops
createCancellableTaskWrapper<T>(task, isStopped, interval_ms=50)
class MyTimerInterval { constructor(period_ms, onTimer, onStop?); stop() }
```

## 🧭 object paths · linked list · byte stream
```
objectGet(obj, path:string[]) -> T                 // THROWS on missing/non-object segment   (alias: objectGetValueByPath)
objectSet(obj, path, value) -> void                                                          (alias: objectSetValueByPath)
objectUnset(obj, path) -> boolean                                                            (alias: objectDeleteValueByPath)
deepEntries(obj, filter?) -> Generator<[key, value, path]>                                   (alias: iterateDeepObjectEntries)

class CList<T> implements Iterable {
  get first/last · get size (=length/count) · push(v)/unshift(v) -> node · pop()/shift() -> T|undefined
  delete(valueOrNode)/deleteFirst()/deleteLast()/clear() · find(v)/findLast(v) · nodes()/reversedNodes()
}   // immutable views: IList<T>, IListReadonly<T>, IListImmutable<T>

class ByteStreamW / ByteStreamR                    // pushNumber(value, type)/readNumber(type) over NumericTypes union
nullable(type: NumericTypes)                       // typed push*/read* (int8..uint64/float/double) stay as extended surface
```

## 🎀 decorators
```
wrap(fn, { beforeParams?, modifyParams?, afterParams?, onResult?, modifyResult?, onCatch?, onFinally? }) -> (...args)=>R
  // hooks around a call (sync or async-aware). NOTE the error hook is `onCatch` (not onError). alias: enhancedDecorator
around(fn, ([args, fn]) => R) -> (...args) => R    // AOP around-advice, fn passed UN-CALLED (lodash _.wrap). alias: Transformer
// also @deprecated -> wrap/around: enhancedTransformer, Decorator, TransformerResult
```

## ⏰ timeframes & periods
```
class TF {                                          // S1, M1, H1, D1, ...
  static get(name) -> TF|null  ·  static getAsserted(name) -> TF  ·  static fromSec(sec)
  static createCustom(unit, count) · createCustomFromSec(sec) · readonly all · S1 S5 M1 M5 H1 D1 ...
  get sec/msec/name              // alias: fromName->get
}
class Period { get tf/index/startTime/endTime; static StartTimeForIndex(tf, index) }
class PeriodSpan · class CDelayer                   // deferred-run helper
durationToStr_h_mm_ss(ms) / _ms · durationToStrNullable(ms)   // (alias: -> formatDuration)
toPrintObject(obj)                                  // = convertDatesToStrings
```

## 🎨 color
```
rgb(r, g, b) -> ColorString
hue(value=180, count=100, index=1) -> ColorString          // distinct palette color   (alias: colorGeneratorByCount)
hueRGB(value=180, count=100, index=1) -> [r,g,b]                                          (alias: colorGeneratorByCount2)
toRGBA(str: ColorString) -> [r,g,b,a]  |  toRGBA(str: string) -> [r,g,b,a]|undefined      (alias: colorStringToRGBA)
toColorString(str) -> ColorString                          // validates, else throws
isSimilarColors(c1, c2, maxDelta=32) -> boolean
```

## 🖥️ console · proxy · id · rate-window · input
```
callerLine(lvl=0) -> "file:line:col  func"          // V8 caller frame   (alias: __LineFile2; __LineFile/__LineFiles->callerLines)
callerLines(start=0, end=5) -> string[]             // (alias: __LineFiles)
enable(flag=true) / disable()                       // clickable source links in console (IDE)
installProxyTracking()                              // call once at startup (browser fallback). isProxy(v)->boolean   (alias: isProxyInit)
createIdPool() -> { next() -> number, release(id) }                                       // reuses released ids
createRateWindow() -> { add(item), prune(type, ms?), sumWeight(type), readyAt(...), ...legacy }   // alias: funcTimeW
rateWindow                                          // shared default createRateWindow() instance   (= FuncTimeWait)
SetAutoStepForElement(el, { minStep?, maxStep? })   // browser input
copyToClipboard(text) -> Promise<void>  ·  GetEnumKeys(E)  ·  isDate(v)
```

## ⚠️ errors
```
class MyError<D> extends Error { toJSON() -> tWire<D> }     // wire-serializable error
toError = { ... }                                          // build/normalize MyError from unknown
```

## 🌐 rpc (full)
```
// servers
createRpcServerAuto(opts)                           // canonical: nested object -> typed client proxy (auto Listen handling)
createRpcServer(opts)                               // lower-level core
createRpcServerAuto2(opts)                          // + legacy/v2 protocol auto-detection (createRpcServerAutoWithProtocolDetection)
createRpcServerInProc(...)                          // in-process fast path (no socket)
// clients
createRpcClientHub(opts) + rpc                      // multiplexing client hub: connect(token)/reauth(token)/onConnect
  // alias: hub.setToken->connect
client members: func (proxy) · strict (schema-safe) · schema() · auth() · reauth() · onDisconnect()
                close(reason?, {socketAlive?}) · ready() · init(obj?) · api.subscriptions()
  // alias: dispose->close · readyStrict->ready · initStrict->init
noStrict(obj) / isNoStrict(obj)                     // dynamic (no-schema) subtree
endCallback(fn)                                     // alias: rpcEndCallback
// subscription primitives (rare/manual; createRpcServerAuto/createRpcClientHub are the normal path)
listenSocket(parent, opts?) · listenSocketFirst · listenSocketAll · listenSocketSmart
deepListenFirst(obj, opts?) · deepListenAll · deepListenSmart
RPC Listen surface on client: stream.on(cb)->off · stream.once(cb)->off · stream.close()
  // typed projection: client.func as unknown as DeepSocketListen<ServerFacade> (usually hidden behind a local webListen(client) helper).
  // off is callable + thenable: off() unsubscribes; await off waits for stream end. Legacy .callback/.removeCallback/.unsubscribe exist for old code only.
  // *First/*All/*Smart differ only in callback arity: first arg / all args / single-vs-tuple smart.
matchKeys(a,b) · matchKeysList(a, keys) · deepMapByKeys · deepMapByKeysList
// modes: func (proxy) · strict (schema-safe) · pipe (whole chain in one packet) · space (fire-and-forget)
// legacy (oldCommonsServer.ts, @deprecated forwarders onto oldCommonsServerMini - identical wire):
//   funcPromiseServer->promiseServer · funcForWebSocket->wsWrapper · funcScreenerClient2->createClientProxy
//   CreatAPIFacadeServerOld->createAPIFacadeServer ; CreatAPIFacadeClientOld & funcPromiseServer2 kept as-is
```

## 📈 exchange — params (`CParams`)
```
class CParams / CParamsReadonly implements IParams
toValues(params) -> SimpleParams                    // IParams -> plain enabled values   (alias: GetSimpleParams)
fromValues(infos, values) -> IParams                // inverse                            (alias: mergeParamValuesToInfos)
isSimpleParams(params) -> boolean                   // (isSimpleParams2 @deprecated)
isParamBase(p) · isParamGroup(p) · isParamGroupOrArray(p)
enableAllParams(params, enabled=true) -> clone
// types: IParam (the union) + IParamBase are the entry points; the per-flavour IParamNum/IParamEnum/IParamTime*/...
//        and *Readonly twins exist but read the union — wrap with ReadonlyFull<T> rather than the *Readonly aliases.
```

## 📈 exchange — bars (`Bars`)
```
class OHLC · class CBar extends CBarBase (IBar)
class CBars (IBarsImmutable) · class CBarsMutable / CBarsMutableExt (IBarsExt)
  .push(bars|bar)        // append            (alias: Add)
  .updateLast(bar) · .addTick(tick) · .addTicks(ticks)        (alias: AddTick/AddTicks)
createRandomBars(tf, startTime, endTime|count, startPrice?, volatility?, tickSize?) -> CBars   // alias: CreateRandomBars
class CTimeSeries<T=number> (ITimeseries) · CTimeSeriesReadonly<T>
findBarsShallow(srcBars, barsToFind) -> number
```

## 📈 exchange — market data (`MarketData`)
```
class CQuotesHistory
  .get(tf) -> IBarsImmutable|null                   // build-on-demand   (alias: Bars(tf))
class CQuotesHistoryMutable / CQuotesHistoryMutable2 extends CQuotesHistory
  .append(bars[, tf])    (alias: AddEndBars)  ·  .prepend(bars[, tf])   (alias: AddStartBars)
  .addTicks(ticks)       (alias: AddTicks; replaces last bar)  ·  AddNewTicks (strict append-only, rare)
  .deleteBefore(time)
```

## 🧩 server / socket helpers
```
SocketServerHook(opt?) · WebSocketServerHook(hook, params?, disconnect?)    // server-side socket wiring
saveKeyValue({ dirDef, key? }) -> SaveKeyValueStore                          // fs-backed key/value store
createWebhookServer(params) · createWebhookClient(opts) · buildSelfWebhookUrl(ip, raw)
createSignatureFunction(hmacCreator) -> SignatureFunction
```

## 🧬 type utilities (`core/type.ts`, `core/BaseTypes.ts`)
```
Nullable<T> · PartialBy<T,K> · RequiredBy<T,K> · StringKeys<T> · ObjectEntries<T>
ArrayElementType<T> · TupleFirst<T>/TupleLast<T> · MapKeyType<T>/MapValueType<T> · ResolvedReturnType<T>
ReadonlyFull<T> · MutableFull<T> · Mutable<T> · Immutable<T> · const_Date
KeysByType<T,P> · PickTypes<T,P> · OmitTypes<T,E> · ReplaceKeyType<S,K,New>
```

## 🔁 Observable — legacy sandbox (`observable/`, not root-exported)
> Older layered experiment: core→primitives→derived→transit→batch/effects→store→wire/sync.
> Every node is a `Source<T> = { get, addListen, removeListen }` internally AND exposes a real Listen
> via `.listen()` → drops into RPC / `listen-deep` unchanged. Kept as source/sandbox; prefer root-exported `ObserveAll2` for the new fact-based API.
```
// primitives (reactive.ts)
createCell<T>(initial, {equals?, recycle?}) -> Cell<T>
  .get() · .set(v)->changed:bool · .update(prev=>next) · .subscribe(cb, {current?})->off()
  .map(fn, {equals?})->Computed · .count() · .listen()->Listen · .close()       // use listen().on(cb)->off; raw .addListen/.removeListen are legacy-shaped internals
createRObject<T>(initial, {equals?, recycle?}) -> RObject<T>     // per-key streams (lazy: 1 Listen per subscribed key) + whole-object [key,value]
  .get(k) · .set(k,v)->bool · .update(k,fn) · .snapshot() · .key(k)->per-key Cell-like view
  .subscribe(cb(key,value), {current?})->off() · .listen() · .close()
createRMap<K,V>(initial?, {equals?, recycle?}) -> RMap<K,V>      // same model over a real Map; a delete emits `undefined`
  .get(k) · .has(k) · .set(k,v) · .delete(k) · .update(k,fn) · get size · .keys() · .entries() · .snapshot()
  .key(k)->view · .subscribe(cb(k,v), {current?})->off() · .listen() · .close()
createLazyListen<Args>({recycle?, coalesce?, onActive?}) -> LazyListen   // the lazy multicast under every node (resource/core layer)
```
```
// derived — pull+push graph, COLD (zero upstream subs) until a leaf subscriber appears (reactive.ts / autotrack.ts)
combine([...sources], values=>R, {equals?}) -> Computed<R>      // .get() recomputes even with no listeners; subscribes upstream on 1st listener
computed(source, v=>R, {equals?})                               // = combine over a single source
computedAuto(use => use(a)+use(b), {equals?}) -> ComputedAuto   // auto-tracked deps; use.untrack(s) reads WITHOUT subscribing
// every derived also has: .get() · .subscribe(cb,{current?})->off() · .map(fn) · .count() · .listen() · .close()
```
```
// effects / ownership (schedule.ts)
createEffect(use => { ... use(src) ... }) -> { dispose }        // runs now + re-runs on tracked-dep change; deps diffed each run
  // use(s) tracks the dep; use.untrack(s) reads its value WITHOUT subscribing (control-flow peeks)
onCleanup(cb)                                                   // teardown bound to the current effect run (or owner, outside an effect)
createRoot(dispose => T) -> { result, dispose }                 // own a subtree of effects; nested roots dispose with the parent
getOwner()
// batching (batch.ts)
batch(fn) -> T  ·  inBatch() -> bool  ·  deferring(...)  ·  enqueue(node, flush)   // N dirties in a batch => one effect run / one coalesced emit
```
```
// transit operators — lazy, refcounted (hot iff a downstream consumer exists) (transit.ts)
filter(source, v=>bool, {hold?=true, equals?}) -> Source        // drop non-matching; hold keeps last passing value for .get(); equals dedups live pushes
route(source, keys, pick: v=>K) -> { outputs:{[K]:Source}, out(k)->Source, close() }   // each value to ONE branch; a cold branch drops at the source
switchOn(source, pred) -> route(_, ['on','off'])                // 2-way sugar
merge([...sources]) -> Source  ·  isOurTransit(x) -> boolean
```
```
// store — path-addressed reactive tree (store.ts): "throw a whole new Map, only the changed leaves fire"
createTransportStore(initial?: object|Map, opts?) -> TransportStore     // opts: { opaque?(path)->bool, deepEqual? }
  // ONE uniform facade at every depth — root, .key(k), .at(path) all return the same node shape:
  reads:   .get(k?) · .snapshot() · .has(k) · .keys() · .path
  writes:  .set(k,v) · .replace(v)  (whole-node, diffs) · .setIn(path,v) · .delete(k)
  nav:     .key(k)->node · .at(path|key)->node
  subscribe by granularity:  .value(cb,{current?})  (this element) · .entries(cb(k,v),{current?})  (one category) · .deep(cb(path,v),{current?})  (anywhere below)
  coarse:  .rev()->int  (monotonic, bumped on ANY subtree change — poll it) · .onRev(cb)  (no-arg "something changed" trigger)
  RPC:     .listen()  (category/level stream) · .listenValue()  (this node's value) · .listenDeep()  (whole subtree)
  kind:    .containerKind() / .setContainerKind('map'|'object')  ·  .deepEqual() / .setDeepEqual(on=true)   // wire fidelity / leaf-compare
flatten(store) -> [path, value][]   // current state as leaf deltas (chunkable for sync)   ·   deepEqual(a,b)   // structural compare
```
```
// wire / sync / codec / rate — send a reactive store over the network (advanced; see observable/*-PLAN.md)
encodeValue(v) / decodeValue(w)                                 // rich values: Date / BigInt / Map / Set / RegExp / binary (codec.ts)
createPendingChanges · createRetry · createSync                 // optimistic LWW sync; remote + persist are injected PORTS (DI) (sync.ts)
encodeSnapshot · streamDeltas · createMirror · CMD · OP         // numeric wire protocol + client-side mirror (wire.ts)
throttle(source, {ms?=0, mode?='trailing', equals?}) -> Throttled    (rate.ts)
createShapeCodec                                                // adaptive: learn-shape -> positional+bitmask -> deopt-on-break (shapewire.ts)
createRateMeter · createDirtyTrigger · createAdaptiveWatch      // adaptive observation granularity (meter.ts)
```

## 🔁 ObserveAll2 — coarse reactive object (`ObserveAll2`, fact-based)
> `import { ObserveAll2 } from "wenay-common2"` → `ObserveAll2.reactive(...)`.
> Different from `Observable`: no deltas, no string paths, no computed graph in core.
> Subscribe to the fact that a subtree changed, then re-read the current state.
```
const state = ObserveAll2.reactive({
  account: {
    balances: {BTC: 100, ETH: 400},
    positions: {BTC: {qty: 0.5, entry: 60000}},
  }
})

ObserveAll2.onUpdate(state.account, () => console.log("account changed"))
ObserveAll2.onUpdate(state.account.positions, () => console.log("positions changed"))
ObserveAll2.onUpdate(state.account.positions.BTC, () => console.log("BTC changed"))

state.account.positions = {BTC: {qty: 3, entry: 59000}, SOL: {qty: 10, entry: 130}}
await ObserveAll2.flushReactive(state)
```
```
reactive<T extends object>(obj, opts?) -> T
onUpdate(node, cb)->off
flushReactive(node)->Promise<void>
listenUpdate(node)->Listen<void>        // RPC bridge: createRpcServerAuto recognizes it

opts: {
  drain?: 'immediate' | 'micro' | number | ((flush)=>void)
  depth?: number
  eager?: boolean
}
```
RPC stacking:
```
const facade = {
  getAccount: () => state.account,
  accountChanged: ObserveAll2.listenUpdate(state.account),
  btcChanged: ObserveAll2.listenUpdate(state.account.positions.BTC),
}
// createRpcServerAuto({ object: facade, ... }) exposes accountChanged/btcChanged
// as normal RPC Listen subscriptions. This is a notification stream, not a full
// automatic snapshot mirror; send/read snapshots explicitly via facade methods.
```

