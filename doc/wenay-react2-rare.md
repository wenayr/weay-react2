# wenay-react2 - EXTENDED / rare surface

> Everyday API lives in **`wenay-react2.md`**.
> This file lists compatibility names, low-level primitives, and migration notes.
> Root import: `import { ... } from "wenay-react2"`.

## Migration Rule
```
New code teaches and imports the short canonical surface:
  useModal(), useOutside(), useDraggableApi(), useAgGrid(), createGridBuffer(), createColumnBuffer()

Old names remain exported for existing apps unless a project deliberately removes them.
Do not add new examples with Get*, FuncJSX, *2/*3, or business-specific helper names.
If a primitive needs app policy, build a small app wrapper above it.
```

Canonical method vocabulary:
```
open / close / set / replace       // modal-like state
update / remove / clean / sync     // data-buffer state
fit / flush                        // ag-grid visual/transaction lifecycle
props / bind                       // spreadable element props
get / set / reset / cancel         // local hook/controller state
on -> off                          // subscriptions
```

## Root Namespaces
```
import { v2 } from "wenay-react2"

v2.hooks
v2.dnd
v2.utils
v2.grid
v2.modal
v2.menu
v2.logs
v2.updateBy
```

The root export is still flat. `v2` is useful when a large file needs grouped names.

## Modal Compatibility
```
useModalOld()                      // alias of useModal(); deprecated
useModalApi()                      // returns ModalApi; use useModal()

GetModalJSX()                      // imperative JSX store; use ModalProvider/useModal
GetModalFuncJSX()                  // function JSX store; use ModalProvider/useModal
inputModal({setModalJSX, func, name?, txt?})
confirmModal({setModalJSX, func, password?})
```

`inputModal` and `confirmModal` accept either a legacy setter function or the `useModal()` controller.

Left-side modal/menu helpers:
```
LeftModal({arr, zIndex})
ApiLeftMenu
getApiLeftMenu()
TestLeft333()
```

These are app-shell style utilities. Prefer local app wrappers for new layouts.

## Settings Dialog / UI Slot / Callback Hub Details
Settings dialog (centered panel ~640x420, max 92vw/82vh; sections column left, content right):
```
type tSettingsSection = {key: string, name: string, render: () => ReactNode}

<SettingsDialog
    trigger={...}                     // wrapper span is clickable
    sections?                         // static sections, listed first
    defaultSection?                   // falls back to the first section when missing/unmounted
    sectionClassName?                 // apps pass their own .chip; default .wenayDlgSection
    sectionActiveClassName?           // apps pass their own .chipActive; default .wenayDlgSectionActive
/>

registerSettingsSection(s) -> unregister
getSettingsSections() -> readonly tSettingsSection[]
```
The registry is a module singleton on updateBy/renderBy (no React context). Registering the same
`key` replaces the previous section; unregister removes by identity, so a stale unregister after a
replacement is a no-op. Closes on the x, a scrim click, and Escape.
Styling: `--dlg-scrim / bg / border / radius / shadow / nav-bg / nav-width` tokens (tokens.css,
mirror `tokens.dlg`), classes `.wenayDlgScrim / .wenayDlg / .wenayDlgNav / .wenayDlgContent /
.wenayDlgClose` in style.css; dark defaults, apps re-skin via `:root[data-theme]` like `--wnd-*`.

UI slot:
```
createUiSlot({key, places, def}) -> {Slot, PlacementSetting, getPlace, setPlace}
<slot.PlacementSetting className? activeClassName? />   // defaults .wenaySegBtn / .wenaySegBtnActive
```
State lives in `staticGetAdd(key)` -> persisted with the rest of staticProps; `setPlace`
announces the in-place mutation via `staticMarkDirty(key)` and the APP decides when to save
via `Cash.onDirty` (the library never writes storage itself, same as window state).
A stored place that no longer exists in `places` falls back to `def`. `getPlace()` is not reactive;
Slot/PlacementSetting subscribe internally via updateBy.

Callback hub (for single-slot callback APIs `onX(cb | null)` whose subscribers silently
overwrite each other):
```
createCallbackHub<Args>(bind) -> {on, count}
```
`bind(emit)` runs lazily, ONCE, on the first `on()` - not at creation time, because the slot may
still be taken by app initialization. The first callback is registered before bind runs, so it
also catches synchronous emits. `on(cb) -> off`; off removes only that subscriber.

## Outside / Buttons Compatibility
```
useOutsideOld(options) -> ref       // use useOutside(options).ref / .props
DivOutsideClick2                   // alias of DivOutsideClick

StyleOtherRow
StyleOtherColum
```

`Button`, `ButtonOutClick`, `ButtonHover`, and `ButtonAbs` are still direct components rather than hook controllers.

## Drag / Resize Low Level
```
DivRndBase3(props)                  // lower-level react-rnd wrapper
DivRnd3(props)                      // canonical floating window component
ExRNDMap3                           // persisted RND map (ObservableMap)
tRndUpdate

Drag22(props)                       // old movement component
Drag2(props)                        // older component from RNDFunc.tsx
FResizableReact(props)
mapResiReact                        // persisted resize map (ObservableMap)
DraggableOutlineDiv()
```

For new pointer logic, prefer:
```
const drag = useDraggableApi(...)
<div {...drag.bind} />
```

`useDraggable(...)` is kept as the simple hook wrapper; `useDraggableApi(...)` is the controller-style shape.

## agGrid Legacy Utilities
```
applyTransactionAsyncUpdate(params)
applyTransactionAsyncUpdate2(params)
getUpdateTable(params)
getComparatorGrid(map?)
```

Use `agGrid4` for new tables:
```
createGridBuffer()
useAgGrid()
AgGridMy
createColumnBuffer()
numericComparator()
colDefCentered
colDefWrap
```

Important agGrid4 contracts:
```
mirror mode:  buffer owns row set; sync can add/update/remove grid rows.
overlay mode: rowData owns row set; sync updates only existing grid rows.
clean():      clears buffer; mirror also removes grid rows, overlay does not remove declarative rows.
flush():      React/controller method that calls ag-grid flushAsyncTransactions().
```

Plain declarative `rowData` should preserve AgGridReact defaults unless the caller provides `getRowId`.
Buffered paths need a stable `getId`.

Dynamic columns:
```
createColumnBuffer().api.setNames(names)          // exact set, dedupe preserving order
createColumnBuffer().api.apply()                  // replay last attached apply callback
createColumnBuffer().control.attach(api, {apply})
createColumnBuffer().control.detach()             // keep names
```

The primitive must not contain product group names, base `columnDefs`, visibility rules, or app naming policy.

## Params / Generated Editors
```
ParametersReact({params, onChange, onExpand?, expandStatus?, expandStatusLvl?})
EditParams2({params, onSave})        // canonical compact editor
EditParams3({params, onSave})        // alternate/legacy editor
CParameter({param, onClick, type?})
FButton(name)
FNameButton(type, name)
```

`ParametersReact` receives wenay-common2 `Params.IParamsExpandableReadonly` shape.

## Menu Low Level
```
MenuBase({other, children, ...})
MenuElement
TimeNum
tMenuReactStrictly / tMenuReact

GetMenuR()                           // lower-level right-click menu factory
mouseMenuApi                         // shared global mouse menu API

DropdownMenu({elements, style?, position?, position2?, keyForSave?})
MenuRightApi()
mapRightMenu                         // persisted right-menu state (ObservableMap, RightMenuStore)
MenuRightPosition / MenuRightPosition2 / MenuRightSavedState / MenuRightRenderProps
StickerMenu                          // components/Menu re-export
```

`mouseMenuApi.map` is intentionally generic. Keys are app-owned.


## ObserveAll2 / Listen React Hooks
Canonical React adapter names:
```
useStoreNode(node, {mode?, fallback?, drain?, key?})
useStoreKeys(node, {fallback?, drain?, key?})       // object-shape changes: add/delete keys
useStoreChangedPaths(changedPathsListen, {initial?, key?})
useStoreSelect(selection, {fallback?, drain?, key?})
useStoreMirror(remote, initial, {mask, current?=true, drain?, key?, auto?=true, partial?, onError?})
useListenEffect(listen, cb, {current?, key?})
useListenArgs(listen, {initial?, current?, key?})
useListenValue(listen, {initial?, current?, key?, map?})
```

These hooks are intentionally in `wenay-react2`, not in `wenay-common2`.
Do not add React hooks for every helper in `wenay-common2-rare.md`; hooks are useful only around subscriptions, lifecycle, or external resources.
Network sync stays explicit through `useStoreMirror`; reading a node must not secretly start RPC/fetch/WebSocket work. When `remote.changedPaths` exists and `partial !== false`, mirror uses common2 partial sync; otherwise it falls back to `remote.changed -> get(mask)`. `initial` seeds the mirror only. Structurally equal inline masks are stable, because StoreMask is expected to be a small plain object/tree.

QA stand coverage:
```
/__qa/observe-store/get       // HTTP snapshot/mask read
/__qa/observe-store/mutate    // HTTP server mutation, including deep leaf and deep key add/delete
/__qa/observe-store/events    // SSE changed stream
/__qa/observe-store/events-paths // SSE changedPaths stream
```

## Replay React Hooks (details)
`src/common/src/hooks/useReplay.ts`. Client side of the wenay-common2 Replay stack only.
```
useReplaySubscribe(remote, cb, {since?, keepSeq?=true, enabled?=true, onSeq?, onError?, staleMs?, onStale?})
  -> {ready, error, stale, seq(), lastTs(), restart(since?)}
useStoreReplaySync(store, remote, sameOpts)  -> same controller       // ObserveAll2.syncStoreReplay wrapper
useStoreReplayMirror(remote, initial, sameOpts) -> controller & {store}   // creates the mirror store in a ref
useReplayHistory(history, apply, {head?, reset?, tickMs?=300, autoPlay?=true})
  -> {live, seq, head, pause(), play(), seek({seq?|ts?})}
```
Semantics that are easy to get wrong:
- `cb`/`apply` go through refs: new function identity does NOT resubscribe. Resubscribe identity is `[remote, enabled, epoch, staleMs]` — changing `staleMs` resubscribes (it is subscribe-time config in common2; under keepSeq the reconnect is a journal tail, so it is cheap). `onStale` goes through a ref like `cb`.
- Freshness (`staleMs`): detection is 100% wenay-common2's watchdog (`ReplaySubscribeOpts.staleMs/onStale`, edge-triggered); the hook only mirrors the edges into `stale` state, so a fresh high-frequency line causes zero extra renders. `lastTs()` is a plain getter like `seq()` (producer ts of the last delivered event, 0 before the first delivery / while unsubscribed). Without `staleMs`: no watchdog, no state updates, `stale` stays `false`.
- Freshness on resubscribe/restart: the hook does NOT reset `stale` to `false` at effect start — it re-syncs from common2 after catch-up (mirrors the `onStale` edge fired during catch-up, plus `isStale()` once `ready` resolves), so a snapshot/tail carrying an old producer ts is stale from the first paint with no fresh-flicker. Caveat: common2's in-proc `keyframe()` stamps `ts` at request time, so a brand-new client on a stalled in-proc line reads as fresh at delivery and flips stale after `staleMs` via the arrival-gap watchdog; old-ts detection kicks in when the tail/keyframe actually carries producer timestamps (real relays, archives).
- `useReplayHistory` is archive playback — staleness intentionally does not apply there.
- `keepSeq`: within one mount, a resubscribe (StrictMode double effect, `enabled` toggle, `restart()`) reconnects with `{since: lastSeq}` -> journal tail. A NEW `remote` identity always resets seq (another line's seq is meaningless). A full unmount loses the refs: persist the position in the parent via `onSeq` and pass it back as `since` (QA card 23, client A).
- `seq()` and `useReplayHistory`'s interval-driven `seq/head` keep high-frequency lines from re-rendering per event. Frames/ticks should fold into a canvas/ref/store, not useState.
- `useReplayHistory.seek` kills the live subscription imperatively (guarded off, double-call safe), folds `history.at(where)` through `apply` (keyframe + tail; a keyframe fully redefines consumer state, so `reset` is rarely needed), and freezes. `play()` resubscribes `{since: pos}` -> archive tail -> live handover.
- Server primitives (`conflateReplay` per connection, `archiveReplay`) intentionally have no hooks: they live where the RPC server is built.

QA cards 23/24 (`testUseReact/replayVideo.tsx`, all in-proc): synthetic 10fps jpeg-frame producer on `UseReplayListen({history, current})`; client A = direct `exposeReplay` remote; client B = simulated slow wire (1 envelope per rateMs) behind `conflateReplay({pending: () => buf.length, highWater: 4, lowWater: 1, keyOf: () => "frame"})`; client C = `archiveReplay` + `openHistory` scrubber; client D = freshness (`staleMs: 2000`, `React.memo` + no tick, mounted inside a local `<StrictMode>`; the flat renders counter under growing frames is the no-per-event-render proof; "stall producer" toggles the emit interval, "new client" remounts by key for the stalled-mount case; card 24 has the same via `staleMs: 2500` on the mirror). `window.__replayVideoDemo` is exposed for debugging (wire.setRateMs, stats). Node-verified: slow wire delivered 12/36 envelopes yet converged to the last frame with bounded buffer (coalesced tail recovery); `syncStoreReplay` off() freezes the mirror and `{since}` resubscribe catches up by tail. Browser QA of throttling-sensitive behavior needs a VISIBLE tab: hidden-tab timer/effect throttling stalls the producer and delays passive effects (known stand caveat).
## Logs
Frequent legacy/global logger:
```
getLogsApi({limit?, limitPer, varMin?})
logsApi
PageLogs({update?})
MessageEventLogs({zIndex?})
PageLogs2({update?})
MiniLogs({data, onClick?})
```

React-context logger:
```
LogsProvider
useLogsContext()
LogsTable()
LogsNotifications()
LogsSettings()
MainPage()
```

The context logger is a larger UI surface; the global `logsApi` is still the shorter integration point.

## Cache / Memory / Browser Utilities
```
CacheG
CacheLocal
ObjectStringToDate(obj)
CacheFuncMapBase(entries, save)
CacheFuncMap(entries)

ObservableMap<K,V> extends Map      // set/delete/clear announce themselves; touch(key?)
  .onChange(cb) -> off              //   announces an in-place mutation; tMapChangeListener<K>
Cash.onDirty(cb) -> off             // instance dirty channel (coalesced, async); tDirtyListener
Cash.isDirty()
Cash.markDirty(scope?, key?)        // manual announce, for plain-Map entries only

staticSet(key, data)
staticGet(key)
staticGetAdd(key, def, options?)
staticGetById(key, def, id)
staticUpdate(key, mutate)
staticMarkDirty(key)
deepMergeWithMap(target, source)
Cash
MemoryMap

ArrayPromise({arr, catchF?, thenF?})
PageVisibilityProvider
PageVisibilityContext
SetAutoStepForElement(input, {minStep?, maxStep?})
```

Cache helpers are process/browser storage utilities, not React state management.

Dirty/save contract: the dirty signal originates in the data layer. The persisted maps are
`ObservableMap`s, so `set/delete/clear` announce themselves; in-place mutations of stored
objects are invisible to map methods and are announced with `map.touch(key)` at the commit
points (DivRnd3 drag/resize stop, FResizableReact resize stop, createUiSlot.setPlace) or,
app-side, with `staticUpdate(key, mutate)` / `staticMarkDirty(key)`. `CacheFuncMapBase`
subscribes to the ObservableMaps it owns - the channel is per instance, there is no global
bus; plain Maps in `arr` stay silent (announce those via `Cash.markDirty`). Announcements
never save anything: scope/key are event metadata, WHAT gets written is decided by the
save-side serialized-snapshot diff, so a missed announcement degrades to "saved later" and
an extra one to a no-op write. `isDirty()` is set synchronously; `onDirty` delivery is
coalesced through a microtask (safe to mutate maps inside render/init paths; not throttled
in background tabs the way timers are). `Cash.load()` ignores its own map events while
loading and resets dirty after; a save cycle waits out an in-flight load() (a save racing
a load could overwrite storage with in-memory defaults) and resets the flag at its START
so a change arriving mid-write survives. Caveat: `flush()` is async - on pagehide
localStorage writes usually complete but are not guaranteed (Cache API is not); prefer
visibilitychange->hidden as the primary final save.

## Resize Observer
```
CResizeObserver
setResizeableElement(el)
removeResizeableElement(el)
ObserveID
```

Use these only when a component must participate in the shared resize observer map.

## Styles
```
GridStyleDefault()
StyleGridDefault
StyleCSSHeadGridEdit(name, rules)
StyleCSSHeadGrid()
tCallFuncAgGrid<T>
tokens
```

`tokens` is the canonical source for inline styles and z-index values.

## Charts
Canvas chart:
```
createChartCanvas(config) -> IChartCanvas
ChartDemo()
```

Chart engine:
```
createDataSet(params)
createDataModel()
createPanelManager()
createRenderer()
createInteraction(...)
createChartEngine(canvas)
generateIncrementalData(...)
MyChartEngine
```

The chart engine exports many internal interfaces (`DataPoint`, `DataSet`, `Panel`, `Renderer`, `Transform`,
`Interaction`, `ChartEngine`). Treat them as low-level until an app wrapper fixes product-level behavior.

## Deprecated Naming Smells
```
Get*             // usually a factory from older style; prefer create* or use*
*FuncJSX         // imperative JSX store; prefer React context/controller
*2 / *3          // version suffix; document the intended canonical one in brief
applyTransactionAsyncUpdate* // old grid path; prefer agGrid4
```

Do not add new generic utilities with app words in their signature. For example, a column primitive should accept
`names` and `apply`, while a product wrapper decides group ids, column ids, and labels.



