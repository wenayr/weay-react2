# wenay-react2 - BRIEF cheat sheet (canonical UI/controller API)

> Root import: `import { ... } from "wenay-react2"`.
> Notation: `name(args) -> ret`. JSX examples show the intended public path, not every prop.
> Short controller-style names are canonical. Removed names are recorded in
> **WENAY_REACT2_RENAMES.md** for migration only; old aliases are not exported.

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
updateBy(obj, cb)                                // imperative callback instead of a re-render;
                                                 //   cb goes through a ref - inline identity is fine
renderBy(obj, ms?)                               // emit render for subscribers
renderByRevers(obj, ms?, reverse?=true)          // reverse/last affect ONLY React subscribers;
renderByLast(obj, ms?)                           //   updateBy(obj, cb) callbacks always all run first

const state = { count: 0 }
const api = createUpdateApi(state)
api.use()                                        // hook subscription
api.emit(ms?)                                    // renderBy(state)
api.on(obj => {}) -> off

const api2 = useUpdateByApi(state)               // hook + controller in one call
```

Persistent process memory:
```
memoryGetOrCreate(key, def, {abs?, deepAutoMerge?, reversDeep?}) -> def-or-stored
memoryGetById(key, def, id) -> stored only while id is the same
memorySet(key, data)
memoryGet(key)
memoryUpdate(key, mutate) -> cur?               // mutate + rerender + announce in one call
memoryMarkDirty(key)                            // announce an in-place mutation of a memoryGetOrCreate object
createSearchHistory({key, max?})                 // reusable small persisted search history controller
memoryMaps                                       // rnd / resize / other maps
```

Persistence contract (memoryCache): the library NEVER writes storage by itself. The persisted maps
(floatingWindowMap, mapResiReact, mapRightMenu, memoryProps) are `ObservableMap`s - set/delete/clear
announce themselves, in-place mutations are announced at the commit points (drag/resize stop,
menu drag end, setPlace). memoryCache observes the maps it owns; the app owns the write policy:
```
memoryCache.load()                                      // once on start; remembers the saved snapshot
memoryCache.onDirty((scope?, key?) => ...) -> off       // dirty channel (coalesced, async)
memoryCache.saveDebounced(ms?) / save() / flush()       // write only payloads that differ from the snapshot
memoryCache.isDirty()                                   // cheap hint, e.g. a beforeunload guard

memoryCache.load()
const off = memoryCache.onDirty(() => memoryCache.saveDebounced(800))
document.addEventListener("visibilitychange",
    () => { if (document.visibilityState == "hidden") void memoryCache.flush() })
window.addEventListener("pagehide", () => { void memoryCache.flush() })  // backstop: flush is async
```

The load + dirty->saveDebounced part of that contract as one hook (React components):
```
const persistence = useCacheMapPersistence(memoryCache, delayMs?=300)
persistence.isDirty(); persistence.flush(); persistence.save(); persistence.reload()  // reload = load() alias
```
The pagehide/visibility flush backstops stay app-side (see above) - the hook deliberately does not own them.

## Outside Click / Buttons
```
const outside = useOutside({onOutside, enabled?})
<div {...outside.props} />
outside.enable()
outside.disable()
outside.contains(event.target)

<OutsideClickArea outsideClick={close} status={open}>...</OutsideClickArea>

<Button button={<button>Open</button>} outClick keyForSave?>{...}</Button>   // keySave = deprecated alias
<OutsideButton button={...}>{...}</OutsideButton>
<HoverButton button={...}>{...}</HoverButton>
<AbsoluteButton button={...}>{...}</AbsoluteButton>
```

## Element Size / Resize Observer
```
const box = useResizeObserver<HTMLDivElement>(() => onResize())   // shared singleton observer
<div ref={box.ref} />; box.element()

const size = useElementSize<HTMLDivElement>()    // "want the size -> get the value/method"
<div ref={size.ref} />
size.width; size.height                          // state, rounded, no-op resize does not re-render
size.getSize()                                   // live getter (exact, no render wait)

setResizeableElement(el) / removeResizeableElement(el)   // legacy imperative auto-shrink path, unchanged
```
Both hooks ride the same module-level `CResizeObserver` singleton (one native `ResizeObserver` for the whole app). QA card 19.

## Drag / Floating Windows
```
const drag = useDraggableApi({initialPosition, holdMs?, onDragStart?, onDragEnd?, onMove?, trackState?})
<div {...drag.bind} style={{transform: `translate(${drag.position.x}px, ${drag.position.y}px)`}} />
drag.setPosition({x, y})
drag.resetPosition()
drag.cancelDrag()
// imperative path: onMove(p) fires per move tick (through a ref); trackState:false stops
// per-tick re-renders - position lives only in drag.positionRef/onMove (DragBox is this shape)

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

<FloatingWindow keyForSave="tool" size={{width: 320, height: 240}} header={<div>Tool</div>}
                onClickClose={() => setOpen(false)}>   {/* onCLickClose (typo) = deprecated alias */}
    <Panel />
</FloatingWindow>

const wnd = useFloatingWindowController({keyForSave: "custom-tool", size: {width: 320, height: 240}})
wnd.position                 // {x,y}; bind wnd.onHeaderMouseDown/onHeaderTouchStart for custom chrome
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
modal(null)                                      // callable shortcut for clearing
```

Input helpers:
```
const text = useTextInputPanel({callback: txt => {}, txt: ""})  // headless value + submit API
const file = useFileInputPanel({callback: file => {}})          // headless file + submit API
<TextInputPanel callback={txt => {}} name="Name" txt="" />     // thin visual wrapper over hook
<FileInputPanel callback={file => {}} name="File" />            // thin visual wrapper over hook
<TextInputModal callback={...} outClick={modal.close} />
<FileInputModal callback={...} outClick={modal.close} />
<FreeModal outClick={modal.close} size={{width: 400, height: 260}}>...</FreeModal>
```

## Settings Dialog
```
<SettingsDialog trigger={<span>settings</span>} sections={[{key, name, render, children?, parentKey?, searchText?, keywords?}]} defaultSection? /> // searchable tree + persisted search history/selected section/tree expansion; history closes when search focus leaves
const settings = useSettingsDialogController({sections, defaultSection?}) // open/search/tree/history/resize actions for custom chrome
registerSettingsSection({key, name, render, parentKey?, searchText?, keywords?}) -> unregister
```

## UI Slot
```
const slot = createUiSlot({key, places: {top: "Top bar", side: "Sidebar"}, def: "top"})

<slot.Slot place="top">{content}</slot.Slot>     // each mount point decides by itself
<slot.PlacementSetting />                        // segmented place switcher; setPlace marks memoryCache dirty
```

## Toolbar
```
const tb = createToolbar({key, items: [{key, title, icon?, short?, render?, onClick?, defaultVisible?, fixed?}], def?, settingsItem?, resetItem?, source?, sourceMode?})

<tb.Bar settings reset? />   // the live bar; settings adds a gear; reset is hidden by default; item moves animate
<tb.Settings />              // the PURE config editor - same element drops into a settings section
tb.api.useConfig() / getConfig() / setConfig(next) / setOrder(order) / show(key,on) / setDensity(key) / reset()
tb.api.showSettings(on) / showReset(on)             // pseudo-controls visibility
tb.api.useItems()            // headless bar: ordered visible [{item, density, content}] - custom markup
tb.api.onChange.on(cfg => ...) -> off        // fires on every edit
tb.api.dispose()             // release the external-source subscription (HMR/remounts); persisted config stays

registerToolbarDensity({key, name, renderItem?}) -> unregister   // built-ins: 'icon', 'label'
toolbarItemIcon(item)        // the item's icon, or its first letters as a text pseudo-icon
```
Config `{order, visible, density}` is serializable and persisted like createUiSlot
(memoryGetOrCreate -> memoryCache, the app owns the write policy). Items added in an app update are merged
into a stale persisted config (appended, default-visible), removed ones are ignored. `icon` is
optional: in icon density an icon-less item renders the first letters of its short/title.
The gear and reset button are pseudo-items: `settingsItem: {title?, icon?}` and `resetItem` re-skin them,
and the editor has separated toggle rows for them (`visible['__settings']` / `visible['__reset']`, no order slots - they always sit at the bar edge). Settings is visible by default; reset is hidden by default unless `resetItem.defaultVisible: true` or `api.showReset(true)` enables it. `resetItem: false` removes the reset feature.

`source?` makes the toolbar a VIEW over an external `UiListSource`. Default `sourceMode:"orderVisible"`
means the source owns item order and item visibility, so one config can drive a grid, its icon menu
AND the toolbar together (`columnState.api.listSource`, QA card 31). `sourceMode:"order"` shares only
the source-key order; item membership, density, pseudo-controls, and extra non-source item positions
stay in the toolbar store (QA card 30). Without `source` the toolbar keeps its own store (standalone mode).

## Callback Hub
```
const hub = createCallbackHub<[Args]>(emit => api.onX(emit))  // one slot -> many subscribers
hub.on(cb) -> off
```

## Params
```
<ParamsEditor
    params={params}
    onChange={next => setParams(next)}
    onExpand={next => setParams(next)}
    expandStatus?
    expandStatusLvl?
/>

const controller = useParamsEditorController({params, onChange, onExpand?})

<ParamsEdit params={params} onSave={next => save(next)} />
<ParamRow name="Name">...</ParamRow>
```

## Menu
```
type MenuItem = { name, actionKey?, onClick?, next?, func?, status? } | false | null | undefined

<Menu data={items} coordinate={{x: 0, y: 0}} />

<contextMenu.Layer>{children}</contextMenu.Layer>
contextMenu.openAt(event, [{name: "Copy", actionKey: "grid.copy", onClick: copy}], {source: "grid"})
contextMenu.stats.getSnapshot()   // local counters: opens, source/layer usage, actionTotals, keyed actions
contextMenu.close()
```

Use `contextMenu.openAt(e, items, {source?})` for new right-click integrations. `contextMenu.map` still exists as a legacy Layer queue, but it is not the recommended path for new code. `contextMenu.stats` is an in-memory diagnostics API; it never persists data, never reports over the network, and records per-action counters only for explicit `actionKey` values. Unkeyed items are counted in aggregate totals without storing labels.

`Menu` keeps the hovered/open item in internal React state. `status` is only an initial open hint and a compatibility field passed to custom renderers; menu objects are not mutated.

Floating right menu:
```
<DropdownMenu elements={items} trigger={iconOrRender} classNames={...} styles={...} />
const menu = useRightMenuController({elements, keyForSave?})
```

`DropdownMenu` is a floating action menu with caller-owned trigger/content styling, not the main context-menu primitive. `useRightMenuController` exposes the same open/fixed/select/submenu/drag state for custom views; `DropdownMenu` remains the compatible visual wrapper.

## agGrid4
Plain declarative rows:
```
<AgGridTable<Row> rowData={rows} columnDefs={cols} />
```

Buffered mirror table:
```
const grid = useAgGrid<Row>({getId: row => row.id})
<AgGridTable<Row> controller={grid} columnDefs={cols} />

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
<AgGridTable<Row> controller={grid} columnDefs={cols} />
```

Overlay patches over React-owned `rowData`:
```
const core = createGridBuffer<Row>({getId, mode: "overlay", pushDefaults: {add: false}})
const grid = useAgGrid({core})

<AgGridTable<Row> controller={grid} rowData={rows} columnDefs={cols} getRowId={p => getId(p.data)} />
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


## columnState
A persisted column layer over a keyed column set - order / visibility / width / sort / filter in a
standalone config store, with an OPTIONAL two-way ag-grid adapter. Mobile card views consume the
SAME config with no ag-grid at all. agGrid4 wrappers are never modified: this is the app-level
column wrapper `WRAPPER.md` postulates, packaged as a primitive.
```
const cs = createColumnState({key, columns: [{key, title, short?, icon?, group?, fixed?, defaultVisible?, cardRole?}], def?, saveMs?})

cs.columns                                       // the descriptors (UI renders from these + config)
cs.api.useConfig() / getConfig() / setConfig(next) / reset()
cs.api.show(key, on) / move(order) / setSort({key, dir} | null) / toggleSort(key)   // asc->desc->off
cs.api.visibleKeys()                             // keys to render, in order (group-gated)
cs.api.onChange.on(cfg => ...) -> off
cs.api.usePresent() / isPresent(key) / setPresent(keys | null)   // live-grid presence
cs.api.getPresentGate() / setPresentGate(keys | null)           // app runtime availability gate, not persisted
cs.api.listSource                                // {order, visible} slice as a Toolbar `source`
```
Config `{v, order, visible, width, sort, filter, groups}` is serializable and persisted like
createToolbar (memoryGetOrCreate(key) -> memoryCache, the app owns the write policy); a stale config migrates
softly (unknown keys dropped, new columns appended default-visible, `fixed` pinned). `sort` is
STICKY: independent of visibility/selection, may point at a hidden or grid-absent column, changes
only by an explicit toggle/header click.

Two-way ag-grid adapter (opt-in, agGrid4 untouched):
```
<AgGridTable columnDefs={cols} autoSizeColumns={false}
    onGridReady={e => cs.grid.attach(e.api)}          // restore saved layout, then watch the grid
    onGridPreDestroyed={() => cs.grid.detach()} />     // config survives remounts
```
Grid drag/resize/hide/sort/filter fold back into the config; UI edits apply to the grid; a column
removed from the live grid (dynamic defs) keeps its config entry and reads `isPresent==false`.

Icon menu - a 1:1 grid mirror (reorder in the grid <-> reorder the buttons):
```
<ColumnsMenu state={cs} compact? marks? tail? onItem? onTail? reorder? />      // default click = toggle visibility
<MenuStrip items={[{key, title, state:'on'|'off'|'disabled', marks?, fixed?}]} onItem? onMove? tail? compact? />
```
`ColumnsMenu` binds `MenuStrip` - a presentation-only layer that reports clicks/drags but never
interprets them - to the config. `compact` = icon-only buttons; an item with no icon shows its
first letters. `tail` = trailing non-column buttons (a table-standards cycler etc.). For new
settings-integrated toolbar/grid surfaces prefer `createToolbar({source: cs.api.listSource})`;
keep `ColumnsMenu` for compact button strips or custom presentation-only menus.

Mobile (no ag-grid): dots selector + card rows over the same config:
```
<ColumnDots state={cs} max?=8 />                 // track of marks; dots = shown columns; tap empty=add,
                                                 //   drag=LIVE replace (every empty mark crossed swaps the shown
                                                 //   column immediately + small label names it - column search
                                                 //   by finger), swipe up=remove, tap dot=select, sort cycles
<CardList<Row> state={cs} data={rows} getId? renderValue? />   // visible cols -> card fields; cardRole:'title'/'accent'
```

Default wrapper for repeated grid/menu/mobile use:
```
const cg = createColumnGrid<Row>({
    key: "orders.columns",
    columnDefs: cols,                              // ColumnMeta inferred from colId/field/headerName
    data: rows,                                    // optional default; View props can override
    getId: r => r.id,
    autoSizeOnColumnCountChange: true,             // optional fit when visible column count changes
    columns: [{key: "name", fixed: true, cardRole: "title"}], // optional overrides
})

<cg.View mode="table" />                           // default controls="auto" -> dots overlay
<cg.View mode="cards" data={otherRows} />
<cg.Table rowData={rows} getRowId={p => p.data.id} />
<cg.Menu compact />
<cg.Dots />                                        // no wrapper max; defaults to all columns
<cg.Toolbar settings />
<cg.Settings />
```
`createColumnGrid` returns `{state, toolbar, chrome, api, grid, tableProps, Table, Menu, Dots, Cards, Toolbar, Settings, Chrome, View, dispose}`; `dispose()` releases factory-lifetime subscriptions (config onChange, toolbar source, pending fit) without touching the persisted config. The columnState BARREL stays ag-grid-free; `createColumnGrid` ships from its own module (both are exported from the package root).
Its `Table`/`tableProps()` attach/detach the columnState grid adapter automatically and default
`autoSizeColumns=false` so restored widths are not overwritten. `autoSizeOnColumnCountChange` is
separate and only calls `sizeColumnsToFit()` when the visible column count changes. `useColumnGrid(opts)`
is the same controller captured once for component-local setups; keep module-level `createColumnGrid`
when the controller must survive route/component remounts.

## Grid Chrome
`createGridChrome({columnState?, copy?, autoSize?, saveColumns?, commands?, contextItems?})` is an optional
adaptive command surface over one already-owned GridApi. It owns only the compact trigger,
popover, feedback, and its late-bound API reference; it never creates or attaches a second
`createColumnState`. `createColumnGrid({chrome})` injects its own state and composes the same
ready/pre-destroy lifecycle, while `cg.Chrome` renders the reserved trigger slot where the app's
table header/control area needs it.

```
const chrome = createGridChrome<Row>({
  columnState: cs,
  copy: ({rows}) => writeRows(rows),
  saveColumns: ({columnState}) => saveLayout(columnState?.api.getConfig()),
  contextItems: event => [{name: 'Inspect', onClick: () => inspect(event.node?.data)}],
  commands: [{key: 'reload', group: 'table', name: 'Reload', run: () => reload()}],
})
chrome.grid.attach(api) / chrome.grid.detach(api)   // standalone lifecycle
<chrome.Chrome />
```

Groups are `columns`, `size`, `data`, `table`, or a custom string. The built-in Columns group
uses the supplied state (show/hide, drag order, reset, persisted save); `saveColumns` is the
optional app persistence hook; the copy callback is
injected so this library has no domain row format. `chrome.api.openContextMenu(event, appItems?)`
selects a different clicked row before making a fresh selected-row snapshot and appends
“Копировать строки” without mutating existing menu items. It intentionally has no Ctrl/Cmd+C or
long-touch listener, so browser text selection and existing context-menu layers retain control.

QA cards 28 (grid layer + F5 restore), 29 (mobile dots + cards), 30 (toolbar icon menu + grouped sub-column mode button), 31 (Toolbar over the same config), 32 (createColumnGrid wrapper + dots driving table/cards).


## Observe React Adapter
`wenay-common2` owns the store/listen/RPC primitives. `wenay-react2` owns React lifecycle hooks around them.

```ts
import { Observe } from "wenay-common2"
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

### common2 Resource and AI clients

`wenay-common2@1.0.77` adds account-filtered file/job clients; `1.0.78` adds
provider-neutral AI-run clients. Create and own the common2 client at the RPC
boundary, then hand that already-created resource to React:

```tsx
import {Ai, Resource} from "wenay-common2"
import {useAiRunClient, useFileJobClient} from "wenay-react2"

const aiClient = Ai.createAiRunClient({remote: rpc.func.ai})
const fileClient = Resource.createFileJobClient({remote: rpc.func.files})

function AssistantPanel() {
    const ai = useAiRunClient(aiClient)
    const files = useFileJobClient(fileClient)
    // ai.runs / approvals / inputs are durable Store state.
    // ai.lastEvent is the latest replayed semantic event (delta, progress, completion...).
    // files.files / files.jobs are the account-filtered Resource Store state.
}
```

The hooks only subscribe to the local Store and `ready`/event lifecycle. They do
not create or close the clients, retry `createRun`, put raw input in React state,
or choose provider, storage, upload, ACL, transport, or server runner behavior.
Keep the common2 request idempotency and server-side security boundary intact.

## Replay React Adapter
Client-side hooks over the wenay-common2 Replay stack (snapshot + sequenced delta line). Server parts (`conflateReplay`, `archiveReplay`, `createRpcServerAuto` replayOpts) are per-connection and stay hook-free by design.

```ts
import { useReplaySubscribe, useReplayRouteSubscribe, useStoreReplaySync, useStoreReplayMirror, useStoreReplayRouteSync, useStoreReplayRouteMirror, useStoreReplayEach, useReplayFrame, useReplayHistory } from "wenay-react2"

// any replay line ({line, since, keyframe, frame?, frameLine?} remote)
const sub = useReplaySubscribe(remote, (frame) => draw(frame), {onSeq?, onError?, since?, enabled?, staleMs?, onStale?, policy?, hint?})
sub.ready; sub.error; sub.seq(); sub.restart()
sub.stale; sub.lastTs()   // freshness (needs staleMs): stale re-renders on fresh<->stale transitions ONLY; lastTs() is a getter like seq()
// policy: 'queue' (default, nothing skipped) | 'frame' (rides the server frameLine when present: on lag the
// server drops and recovers with a mini-frame; old servers/in-proc degrade to 'queue'). hint -> the line's frame condenser.

// explicit route hand-off over the same logical replay line (relay <-> direct, etc.)
const routed = useReplayRouteSubscribe(relayRemote, (frame) => draw(frame), {label: "relay", onRoute?})
await routed.switchRoute(directRemote, {label: "direct"})
routed.ready; routed.switching; routed.route; routed.seq(); routed.label(); routed.active()
// route hooks do not expose stale/lastTs yet; use non-route hooks when freshness is required.
// store patch line (Observe.exposeStoreReplay(...).api.replay)
const mirror = useStoreReplayMirror(remote, initial, {enabled?})   // creates the mirror store; same staleMs/stale/policy surface
mirror.store; mirror.ready; mirror.seq(); mirror.restart()
const sync = useStoreReplaySync(existingStore, remote)              // same, store supplied by the app
const routedSync = useStoreReplayRouteSync(existingStore, relayRemote, {label: "relay"})   // same store, switchRoute() replaces the route after catch-up
const routedMirror = useStoreReplayRouteMirror(relayRemote, initial, {label: "relay"}) // mirror store + route hand-off controller

// per-key fold over the same line (Observe.syncStoreReplayEach counterpart): cb per CHANGED top-level key,
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

Route hand-off here is the MANUAL surface (`switchRoute`). common2 1.0.67 `Replay.createRouteCoordinator` moves route decisions (policy, promote/fallback/shadow) out of the consumer; a coordinator `link.subscribe(cb)` handle has the same shape (`ready, seq(), label(), active()`) and survives every route change, so components consuming a coordinator link do not need `switchRoute` at all. common2 1.0.68 supplies the direct transport for it: `createWebRtcConnector` with an app-injected `rtc: () => new RTCPeerConnection(cfg)` factory (the browser — i.e. the React app — owns that injection) and signaling over the existing RPC socket (`createSignalHub`). common2 1.0.69 wraps the whole stack into the `Peer` SDK (`wenay-common2/peer`): `createPeerClient(...).peer(account)` returns a live mirrored store (works with `useStoreNode`/`useStoreKeys` as-is) + route control, surviving relay<->direct hand-offs in one seq space. `usePeer(client, account)` is the thin React adapter: it returns that mirror plus low-frequency route/status and explicit route/resync controls; it does not own journal, repair or transport state. `usePeerCalls(manager)` binds a `Peer.createCallManager` to rings/active/call UI state without owning `manager.close()` or signal policy. The exact interactive components used by QA cards 41–44 ship from `wenay-react2/demo/peer-media`; [`doc/examples/peer-call-media.tsx`](examples/peer-call-media.tsx) shows the import. `usePeerPresence(fragment.presence)` subscribes before reading the host snapshot and exposes online/offline edges. For calls with media, wire `Peer.createMediaRelay` on the server (`publishOf(owner)`, `watchOf(watcher)`, `canWatch`) and attach viewers only when the server-owned call policy grants access; React must never make the ACL decision.

Conference composition ships as a live example: `wenay-react2/demo/peer-conference` (QA card 46) builds a 3-way host-star room where group calling is COMPOSED from pairwise calls (one CallManager holds N-1 concurrent outgoing calls; the roster of active calls is the single ACL authority), the grid rides `Peer.createMediaRelay` fan-out, and a focus pair rides `Replay.createRouteCoordinator` over ONE owner-sequenced line served by BOTH routes — an in-proc `serveReplayChannel` hop and a WebRTC datachannel (`createWebRtcConnector`/`acceptWebRtcDirect`) — so hand-offs are gap-free by seq. Never serve a coordinator route from `relay.watchOf` lines: those are per-watcher re-sequenced journals. `useRouteState(coordinator, link)` is the thin React binding for the route chip: state, last reason, 500ms connector metrics and a short hand-off log; the caller owns coordinator/link lifecycle. The real-backend variant lives in [`doc/examples/conference-server.mjs`](examples/conference-server.mjs) + [`conference-client.html`](examples/conference-client.html): the Node server owns the peer host, the room policy (accepted calls join both parties; offers are brokered only inside a shared room) and the media relay; browser seats connect over Socket.IO, and each peer-store pair can `promoteDirect()` to a real RTCPeerConnection negotiated through that same server hub.

Media lines (common2 1.0.66 `Media.createAudioSource` / `Media.createVideoSource`) are ordinary binary Listen sources; with `replay:true` their `listen` is a replay line, so `useReplaySubscribe` / `useReplayFrame` consume mic/camera frames with no media-specific hook. `useMediaSource(kind, options)` is only the capture lifecycle adapter (`start`, `stop`, device selection, state and stats); it stops a started source on unmount and returns `listen` unchanged. Each frame is one `Uint8Array` (`Media.decodeMediaFrame`); draw/play it via ref (canvas, AudioContext), never useState — the same rule as any high-frequency line. Without `replay`, the plain `listen` works with the listen hooks above.

Contract: `off()` on unmount, StrictMode-safe; seq survives resubscribes inside one mount (keepSeq, default on) — a resubscribe reconnects with `{since}` and gets the journal tail, not a keyframe. Across a FULL unmount/remount keep the position outside via `onSeq` and pass it back as `since`. With `wenay-common2@^1.0.75`, a temporary RPC transport disconnect/reconnect keeps the same logical `remote`: common2 rebinds its physical Listen subscription, catches up from its own last delivered seq, and deduplicates racing live events. React must not call `restart()`, remount, change a key, or add Socket.IO listeners for that case. `policy: "queue"` is the lossless choice; `"frame"` is deliberately conflated. A retained-history gap without a keyframe is a terminal `error`, not a fresh start. Deliberate `client.dispose()`/`close()` and hub `connect()`/`setToken()` are hard teardown boundaries, not auto-reconnects. `seq()` is a getter — high-frequency lines (video frames, ticks) do not re-render per event; draw to canvas via ref, bypassing VDOM. Freshness: detection lives in wenay-common2 (`staleMs` watchdog); the non-route hooks mirror its edge-triggered `onStale` into `stale`, so a fresh 100 ev/s line causes zero extra renders. Route hand-off is explicit through `switchRoute(nextRemote, {label?, since?, reset?, policy?, hint?})`: old route stays live while the replacement catches up by `seq`, then closes. `useReplayHistory` is archive playback — staleness does not apply. QA cards 23 (video line + conflation + time travel + freshness), 24 (store sync), 25 (per-key feed), and 26 (route hand-off) are the live examples.

## Logs
```
logsApi.addLogs({id: "api", time: new Date(), txt: "done", var: 1})
<logsApi.React.Message />
<logsApi.React.PageLogs />
<logsApi.React.Setting />

const customLogs = getLogsApi<MyFields>({limitPer: 500, limit?: 50, varMin?: 0, settingsKey?: "myLogs"})
// each getLogsApi call now owns ISOLATED full/mini/settings state (settingsKey persists the
// instance settings; omitted = fresh non-persisted). The global logsApi keeps the legacy shared state.
const headless = createLogsController<MyFields>({options: {limitPer: 500, limit: 50}})

const messageNotifications = useMessageEventLogsController({maxVisible: 4})
<MessageEventLogsView controller={messageNotifications} zIndex={80} />

const contextTable = useLogsTableController()
const contextNotifications = useLogsNotificationsController()

const mini = useMiniLogsTable({data: rows, onClick: e => console.log(e.data)})
<AgGridTable {...mini.props} />
<MiniLogsTable data={rows} />

const table = useLogsPageTable()                 // full-page logs grid controller
<AgGridTable {...table.gridProps} />
table.fit(); table.applyImportanceFilter(min?); table.appendRow(row); table.getApi()
```

Logger notification/tabs chrome uses `--logs-*` CSS variables; apps can theme it without forking logger components. `createLogsController` owns the headless append/limit/settings state for custom integrations. `useMessageEventLogsController` owns the global notification queue/timers/settings, `MessageEventLogsView` draws it, and `MessageEventLogs` / `logsApi.React.Message` remain compatibility wrappers. `MiniLogs` remains the compatibility wrapper; new compact-table code can use `useMiniLogsTable` or `MiniLogsTable`. `useLogsPageTable` owns the full-page table (mount-time row snapshot, transaction reconciliation to the controller's bounded state, one importance-filter method); `PageLogs` / `logsApi.React.PageLogs` remain the thin compatibility wrappers over it.

## Styles / Theme
```
tokens.color.bgDark
tokens.menu.outlineColor
tokens.logs.notificationAccent
tokens.zIndex.modal

GridStyleDefault()                               // inject legacy grid CSS vars/classes
StyleGridDefault                                 // common ag-grid style object
buildAgTheme("dark" | "light")
useAgGridTheme("dark" | "light")
colDefCentered / colDefWrap / numericComparator
```

Shared CSS variables include `--menu-outline-color`, `--logs-*`, `--dlg-*`, `--wnd-*`, `--tb-*`, `--cols-grid-*`, `--cols-menu-*`, `--cols-dots-*`, and `--cols-card-*`.

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
