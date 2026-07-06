# wenay-react2 - BRIEF cheat sheet (canonical UI/controller API)

> Root import: `import { ... } from "wenay-react2"`.
> Notation: `name(args) -> ret`. JSX examples show the intended public path, not every prop.
> Short controller-style names are canonical. Old `Get*`, `*2/*3`, and low-level engine names are in
> **`wenay-react2-rare.md`** for compatibility and migrations.

## Standard
```
Hooks that own lifecycle/state return a small controller:
  api.props / api.bind              // props to spread on an element
  api.open() / close() / set()      // modal/menu-like state
  api.update() / remove() / clean() // data buffers
  api.fit() / flush() / sync()      // ag-grid lifecycle

Components receive controllers when state must outlive the component.
Library primitives never know app-specific terms, domain objects, or group policy.
Put app-specific layout/build rules in an app wrapper above the primitive.
```

## Render Memory
```
updateBy(obj) / useUpdateBy(obj)                 // subscribe current component to renderBy(obj)
renderBy(obj, ms?)                               // emit render for subscribers
renderByRevers(obj, ms?, reverse?=true)
renderByLast(obj, ms?)

const state = { count: 0 }
const api = createUpdateApi(state)
api.use()                                        // hook subscription
api.emit(ms?)                                    // renderBy(state)
api.on(obj => {}) -> off

const api2 = useUpdateByApi(state)               // hook + controller in one call
```

Persistent process memory:
```
staticGetAdd(key, def, {abs?, deepAutoMerge?, reversDeep?}) -> def-or-stored
staticGetById(key, def, id) -> stored only while id is the same
staticSet(key, data)
staticGet(key)
staticUpdate(key, mutate) -> cur?               // mutate + rerender + announce in one call
staticMarkDirty(key)                            // announce an in-place mutation of a staticGetAdd object
MemoryMap                                       // rnd / resize / other maps
```

Persistence contract (Cash): the library NEVER writes storage by itself. The persisted maps
(ExRNDMap3, mapResiReact, mapRightMenu, staticProps) are `ObservableMap`s - set/delete/clear
announce themselves, in-place mutations are announced at the commit points (drag/resize stop,
menu drag end, setPlace). Cash observes the maps it owns; the app owns the write policy:
```
Cash.load()                                      // once on start; remembers the saved snapshot
Cash.onDirty((scope?, key?) => ...) -> off       // dirty channel (coalesced, async)
Cash.saveDebounced(ms?) / save() / flush()       // write only payloads that differ from the snapshot
Cash.isDirty()                                   // cheap hint, e.g. a beforeunload guard

Cash.load()
const off = Cash.onDirty(() => Cash.saveDebounced(800))
document.addEventListener("visibilitychange",
    () => { if (document.visibilityState == "hidden") void Cash.flush() })
window.addEventListener("pagehide", () => { void Cash.flush() })  // backstop: flush is async
```

## Outside Click / Buttons
```
const outside = useOutside({onOutside, enabled?})
<div {...outside.props} />
outside.enable()
outside.disable()
outside.contains(event.target)

<DivOutsideClick outsideClick={close} status={open}>...</DivOutsideClick>

<Button button={<button>Open</button>} outClick>{...}</Button>
<ButtonOutClick button={...}>{...}</ButtonOutClick>
<ButtonHover button={...}>{...}</ButtonHover>
<ButtonAbs button={...}>{...}</ButtonAbs>
```

## Drag / Floating Windows
```
const drag = useDraggableApi({initialPosition, holdMs?, onDragStart?, onDragEnd?})
<div {...drag.bind} style={{transform: `translate(${drag.position.x}px, ${drag.position.y}px)`}} />
drag.setPosition({x, y})
drag.resetPosition()
drag.cancelDrag()

const r = useReorder({order, commit, move?, canDrag?, preview?, holdMs?})   // mini reorder-by-drag
<div ref={r.listRef}>{order.map(k => {                                      // children 1:1 with order
    const it = r.item(k)                                                    // it.dragging / it.active
    return <div key={k} {...it.props} style={{...own, ...it.style}} />      // ONE commit(next) on drop
})}</div>

const b = useReorderBoard({columns: [{key, items}], commit,                 // drag between vertical columns
    canDrag?, holdMs?, onDragStart?, onDragMove?, onOverChange?, onDragEnd?})
<div ref={b.columnRef('todo')}>{items.map(k => ...b.item(k)...)}</div>      // one div per column, any count
b.over                                                                      // {col, index} | null - live target
// column gravity is YOUR CSS: justify-content flex-start packs up, flex-end packs down

<DivRnd3 keyForSave="tool" size={{width: 320, height: 240}} header={<div>Tool</div>}>
    <Panel />
</DivRnd3>
```

## Modal / Input
```
<ModalProvider>
    <App />
</ModalProvider>

const modal = useModal()
modal.open(<Dialog />)
modal.set(<Dialog />)
modal.close()
modal(null)                                      // callable legacy shape, still supported
```

Input helpers:
```
<InputPage callback={txt => {}} name="Name" txt="" />
<InputFile callback={file => {}} name="File" />
<InputPageModal callback={...} outClick={modal.close} />
<InputFileModal callback={...} outClick={modal.close} />
<PageModalFree outClick={modal.close} size={{width: 400, height: 260}}>...</PageModalFree>
```

## Settings Dialog
```
<SettingsDialog trigger={<span>settings</span>} sections={[{key, name, render}]} defaultSection? />
registerSettingsSection({key, name, render}) -> unregister   // external section from any module
```

## UI Slot
```
const slot = createUiSlot({key, places: {top: "Top bar", side: "Sidebar"}, def: "top"})

<slot.Slot place="top">{content}</slot.Slot>     // each mount point decides by itself
<slot.PlacementSetting />                        // segmented place switcher; setPlace marks Cash dirty
```

## Toolbar
```
const tb = createToolbar({key, items: [{key, title, icon, short?, render?, onClick?, defaultVisible?, fixed?}], def?, settingsItem?})

<tb.Bar settings />          // the live bar; settings adds a gear opening Settings in a popover
<tb.Settings />              // the PURE config editor - same element drops into a settings section
tb.api.useConfig() / getConfig() / setConfig(next) / reset()
tb.api.useItems()            // headless bar: ordered visible [{item, density, content}] - custom markup
tb.api.onChange.on(cfg => ...) -> off        // fires on every edit

registerToolbarDensity({key, name, renderItem?}) -> unregister   // built-ins: 'icon', 'label'
```
Config `{order, visible, density}` is serializable and persisted like createUiSlot
(staticGetAdd -> Cash, the app owns the write policy). Items added in an app update are merged
into a stale persisted config (appended, default-visible), removed ones are ignored.
The gear is a pseudo-item: `settingsItem: {title?, icon?}` re-skins it, and the editor has a
separated toggle row for it (`visible['__settings']`, no order slot - it always sits at the bar edge).

## Callback Hub
```
const hub = createCallbackHub<[Args]>(emit => api.onX(emit))  // one slot -> many subscribers
hub.on(cb) -> off
```

## Params
```
<ParametersReact
    params={params}
    onChange={next => setParams(next)}
    onExpand={next => setParams(next)}
    expandStatus?
    expandStatusLvl?
/>

<EditParams2 params={params} onSave={next => save(next)} />
<CParameter param={param} onClick={() => {}} />
```

## Menu
```
type tMenuReact = { name, onClick?, next?, func?, status? } | false | null | undefined

<MenuBase other={() => items}>...</MenuBase>

mouseMenuApi.map.set("page", [{name: "Copy", onClick: copy}])
<mouseMenuApi.ReactMouse>{children}</mouseMenuApi.ReactMouse>
```

`mouseMenuApi.map` is an integration point. The library stores menu items, but the app decides what actions exist.

## agGrid4
Plain declarative rows:
```
<AgGridMy<Row> rowData={rows} columnDefs={cols} />
```

Buffered mirror table:
```
const grid = useAgGrid<Row>({getId: row => row.id})
<AgGridMy<Row> controller={grid} columnDefs={cols} />

grid.update({newData: rows})
grid.remove([{id}])
grid.clean()
grid.fit()
grid.flush()
```

Shared module store:
```
export const mainTable = createGridBuffer<Row>({getId, externalBuffer})

const grid = useAgGrid({core: mainTable})
<AgGridMy<Row> controller={grid} columnDefs={cols} />
```

Overlay patches over React-owned `rowData`:
```
const core = createGridBuffer<Row>({getId, mode: "overlay", pushDefaults: {add: false}})
const grid = useAgGrid({core})

<AgGridMy<Row> controller={grid} rowData={rows} columnDefs={cols} getRowId={p => getId(p.data)} />
```

Dynamic columns are pure names + lifecycle replay:
```
const columns = createColumnBuffer<Row>()

columns.api.setNames(["a", "b"])
columns.control.attach(api, {
    apply: ({api, names}) => api.setGridOption("columnDefs", buildColumnDefs(names)),
})
columns.api.apply()
columns.control.detach()
```

`createColumnBuffer()` knows nothing about groups, `columnDefs`, business names, or where columns live.


## ObserveAll2 React Adapter
`wenay-common2` owns the store/listen/RPC primitives. `wenay-react2` owns React lifecycle hooks around them.

```ts
import { ObserveAll2 } from "wenay-common2"
import { useStoreMirror, useStoreNode, useStoreKeys, useStoreSelect, useStoreChangedPaths, useListenEffect, useListenValue } from "wenay-react2"
```

Node subscription:
```
const price = useStoreNode(store.node.data.BTC)
price.value
price.exists
price.replace(123)
price.refresh()
```

Selection subscription:
```
const sel = useStoreSelect(store.update({data: {BTC: true}, meta: {status: true}}))
sel.value
sel.get()
```

Network mirror is explicit:
```
const mirror = useStoreMirror(remoteStore, {data: {}, meta: {}}, {
    mask: {data: {BTC: true}, meta: {status: true}},
    current: true,
    drain: 250,
})

mirror.value
mirror.ready
mirror.sync()
mirror.stop()
```

Per-key feed (`store.each()` of common2 — one cb per CHANGED top-level key):
```
useStoreEach(store, (key, value, ctx) => {
    value === undefined ? removeRow(key) : upsertRow(key, value)
}, {enabled?})
```
`undefined` = key deleted; a root replace (store.replace / mirror keyframe) expands into one call per key. The fold target should live outside React state (ref/Map/grid api) — the hook renders nothing itself. The wire counterpart is `useStoreReplayEach` below.

Listen helpers:
```
useListenEffect(listen, (...args) => {})
const value = useListenValue(listen, {initial})
const args = useListenArgs(listen)
```

The hook does not choose transport. `remoteStore` needs `{ get(mask?), changed }` and may also provide `changedPaths`; apps may implement it with RPC, WebSocket, SSE, or test HTTP. `changedPaths` is used as a transport optimization: mirror pulls `mask ∩ paths` instead of the whole mask. `initial` is only the local mirror seed; changing it does not reset an existing mirror. `mask` is treated as a small declarative StoreMask, so structurally equal inline masks do not resubscribe. For add/delete keys, subscribe to the parent object node with `useStoreKeys(node)`; this also covers deep objects. If a state key conflicts with StoreNode methods such as `count`, use `store.node.at("count")`.

## Replay React Adapter
Client-side hooks over the wenay-common2 Replay stack (snapshot + sequenced delta line). Server parts (`conflateReplay`, `archiveReplay`, `createRpcServerAuto` replayOpts) are per-connection and stay hook-free by design.

```ts
import { useReplaySubscribe, useStoreReplaySync, useStoreReplayMirror, useStoreReplayEach, useReplayFrame, useReplayHistory } from "wenay-react2"

// any replay line ({line, since, keyframe, frame?, frameLine?} remote)
const sub = useReplaySubscribe(remote, (frame) => draw(frame), {onSeq?, onError?, since?, enabled?, staleMs?, onStale?, policy?, hint?})
sub.ready; sub.error; sub.seq(); sub.restart()
sub.stale; sub.lastTs()   // freshness (needs staleMs): stale re-renders on fresh<->stale transitions ONLY; lastTs() is a getter like seq()
// policy: 'queue' (default, nothing skipped) | 'frame' (rides the server frameLine when present: on lag the
// server drops and recovers with a mini-frame; old servers/in-proc degrade to 'queue'). hint -> the line's frame condenser.

// store patch line (ObserveAll2.exposeStoreReplay(...).api.replay)
const mirror = useStoreReplayMirror(remote, initial, {enabled?})   // creates the mirror store; same staleMs/stale/policy surface
mirror.store; mirror.ready; mirror.seq(); mirror.restart()
const sync = useStoreReplaySync(existingStore, remote)              // same, store supplied by the app

// per-key fold over the same line (ObserveAll2.syncStoreReplayEach counterpart): cb per CHANGED top-level key,
// first delivery = keyframe expanded per key, (key, undefined) = deleted — grid rows without special cases
const feed = useStoreReplayEach<Rows>(remote, (key, row) => row === undefined ? removeRow(key) : upsertRow(key, row), {drain?, initial?})
feed.store; feed.ready; feed.stale; feed.seq(); feed.restart()      // same controller surface as the mirror
// the mirror store lives in a ref: in-mount resubscribes (StrictMode/restart/enabled) reconnect by tail ON TOP of
// kept state — the consumer sees only the diff. After a full unmount: {since: prev.seq(), initial: prev.store.snapshot()}

// pull at YOUR pace (frame model): timer around remote.frame(seq, hint) — server condenses, no backlog, no live socket sub
const pf = useReplayFrame(remote, (quote) => apply(quote), {intervalMs: 500, hint?})
pf.ready; pf.error; pf.seq(); pf.pull(); pf.restart()               // error (e.g. sacred line evicted) STOPS pulling until restart()

// time machine over Replay.openHistory(storage, live?)
const tt = useReplayHistory(history, (frame) => draw(frame), {head: () => replay.head()})
tt.live; tt.seq; tt.head; tt.pause(); tt.play(); tt.seek({seq})
```

Contract: `off()` on unmount, StrictMode-safe; seq survives resubscribes inside one mount (keepSeq, default on) — a resubscribe reconnects with `{since}` and gets the journal tail, not a keyframe. Across a FULL unmount/remount keep the position outside via `onSeq` and pass it back as `since`. `seq()` is a getter — high-frequency lines (video frames, ticks) do not re-render per event; draw to canvas via ref, bypassing VDOM. Freshness: detection lives in wenay-common2 (`staleMs` watchdog); the hooks mirror its edge-triggered `onStale` into `stale`, so a fresh 100 ev/s line causes zero extra renders. `useReplayHistory` is archive playback — staleness does not apply. QA cards 23 (video line + conflation + time travel + freshness), 24 (store sync) and 25 (per-key feed) are the live examples.
## Logs
```
logsApi.addLogs({id: "api", time: new Date(), txt: "done", var: 1})
<logsApi.React.Message />
<logsApi.React.PageLogs />
<logsApi.React.Setting />

const customLogs = getLogsApi<MyFields>({limitPer: 500, limit?: 50, varMin?: 0})
```

## Styles / Theme
```
tokens.color.bgDark
tokens.zIndex.modal

GridStyleDefault()                               // inject legacy grid CSS vars/classes
StyleGridDefault                                 // common ag-grid style object
buildAgTheme("dark" | "light")
useAgGridTheme("dark" | "light")
colDefCentered / colDefWrap / numericComparator
```

## Charts
```
<MyChartEngine style={{height: 400}} />
createChartCanvas(config) -> canvas controller
```

The chart engine surface is still mostly low-level. Keep product-specific chart wrappers in the app.

## QA Stand
```
npm run testReact                                // http://localhost:3010/
```

The stand lives in `src/common/testUseReact/qa.tsx`. Use it for visual checks; agGrid4 overlay/dynamic-column demos are dedicated QA cards.
Two tabs: Active checks (current work) and Verified archive (`#archive`) - verified/fixed cards move
there and stay runnable for regression re-checks.






