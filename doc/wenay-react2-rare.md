# wenay-react2 - EXTENDED / rare surface

> Everyday API lives in **`wenay-react2.md`**.
> This file lists compatibility names, low-level primitives, and migration notes.
> Root import: `import { ... } from "wenay-react2"`.

## Migration Rule
```
New code teaches and imports the short canonical surface:
  useModal(), useOutside(), useDraggableApi(), useReorder(), useReorderBoard(),
  useAgGrid(), createGridBuffer(), createColumnBuffer(), createUiSlot(), createToolbar()

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

Toolbar (createToolbar, `components/Toolbar/Toolbar.tsx`):
```
createToolbar({key, items, def?, settingsItem?}) -> {Bar, Settings, api: {useConfig, useItems, getConfig, setConfig, reset, onChange}}
<tb.Bar className? settings? popAlign? />             // default classes .wenayTb / .wenayTbItem; popAlign
                                                      //   'right' (default, top-right bars) | 'left'
<tb.Settings className? activeClassName? />           // density segments default .wenaySegBtn(Active)
registerToolbarDensity({key, name, renderItem?}) / getToolbarDensities()
```
Three decoupled layers: serializable config `{order, visible, density}` (single source of truth,
persisted exactly like createUiSlot: staticGetAdd(key), edits mutate in place + renderBy +
staticMarkDirty, the APP saves via Cash.onDirty), Bar (visible!==false, in order, at density) and
a PURE Settings editor over config - the same element works in the Bar's gear popover and in a
registered settings section, no prop changes. Semantics that are easy to get wrong:
- Merge of stale persist: unknown keys in stored order/visible are ignored (view-level; raw
  storage is untouched until the next setConfig), items missing from the config are APPENDED
  default-visible - an app update never wipes the user's order/visibility.
- `fixed` items: always visible, pinned at normalize() to their index in opts.items (checkbox
  disabled, not draggable) - and the drag PREVIEW already respects the pinning, so they never
  move visually and a drop never lands elsewhere than shown.
- Density is an extensible module registry (like registerSettingsSection): entries may carry
  `renderItem(item)`; item.render(density) always wins; entries without renderItem fall back to
  icon + (short ?? title). A persisted density that is no longer registered falls back to
  def/first. Bar/Settings subscribe to the registry (updateBy), so registering a level updates
  live.
- Reorder rides the library's own `useReorder` (see Drag / Resize Low Level; this editor is its
  first consumer): the WHOLE row drags, mouse+touch, checkbox excluded, and `move` is the SAME
  simulated commit as normalize() (splice + fixed pinning), so preview and drop agree by
  construction. Neighbours glide via transitioned transforms (`.wenayTbRowShift`), ONE setConfig
  on drop. Plus arrow keys on the focused handle (the drag hook preventDefaults mousedown, so the
  row handler focuses the handle itself). No dnd dependency; DivRnd3/react-rnd deliberately not
  used (free-floating windows, wrong tool). `touch-action: none` + `user-select: none` on
  draggable rows (`.wenayTbRowGrab`).
- `api.onChange` is a wenay-common2 UseListen stream; emits the NORMALIZED config after every
  setConfig. useConfig subscribes via updateBy; getConfig is a non-reactive snapshot.
- The gear button is a pseudo-item: reserved visible key `__settings` (always normalized in,
  default true), NO order slot (it always sits at the bar edge), toggled from a separated row at
  the bottom of the editor (`.wenayTbRowMeta`, outside the drag-slot container on purpose).
  Hiding it in the gear's own popover closes the popover - the global settings section is the way
  back. Face via `createToolbar({settingsItem: {title?, icon?}})`.
- `api.useItems()` is the headless bar: ordered, visibility-filtered `[{item, density, content}]`
  for fully custom markup. Refs-out was rejected deliberately: order lives in the config, so the
  consumer re-renders from this list - the library never re-parents foreign DOM nodes.
- v1 non-goals: no overflow/"more" menu (hook point: Bar, after the visible-items map), no
  grouping, no cross-bar drag.
Styling: `--tb-*` tokens (tokens.css, mirror `tokens.tb`), classes `.wenayTb*` in style.css;
dark defaults, apps re-skin via `:root[data-theme]` like `--wnd-*` / `--dlg-*`.

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

Reorder-by-drag (useReorder, `hooks/useReorder.tsx` - extracted from the Toolbar editor, which is
its first consumer):
```
useReorder({order, commit, move?, canDrag?, preview?: 'slots'|'measure', holdMs?})
    -> {listRef, item(key) -> {props, style?, dragging, active}, dragKey, preview}
```
A deliberately SMALL reorder for keyed blocks laid out by CSS - the hook never knows the layout
(vertical list, horizontal bar, wrapped grid all work). Semantics:
- DOM order never changes mid-drag: the dragged block follows the pointer via transform, the rest
  glide to their preview position (consumer adds the transition on `active && !dragging`), ONE
  `commit(next)` on drop, skipped when nothing moved (a plain click is a no-op).
- Targeting = nearest slot center measured at drag START - never against the live layout
  (re-measuring moving blocks oscillates at boundaries; designed out). Pointer deltas (viewport
  px) are normalized by the container's scale factor (rect.width / offsetWidth), so
  `transform: scale` / zoomed ancestors do not skew targeting.
- `move` is the simulated commit: the preview shows exactly `move(order, key, to)` - consumers
  with pinning rules (Toolbar's fixed items) pass their own so preview == drop by construction.
- preview 'slots' (default) transforms between start slot centers - exact when blocks are
  equal-sized. 'measure' is FLIP: the preview order is applied via CSS `order`, layout offsets
  (offsetLeft/Top) are read and reverted in one synchronous pass (never paints), so wrapping with
  ANY block sizes previews exactly; requires a flex/grid container; measured once per target
  change. Offsets, NEVER getBoundingClientRect: rects include mid-flight TRANSITION values
  (style.transform='none' does not stop a running transition within the same synchronous pass),
  so rect-based re-measures accumulated the previous preview's shifts on every target change and
  the blocks flew apart on target oscillation.
- Events from `input/button/select/textarea/a` never start a drag; mouse is left-button only;
  touch works (`touch-action: none` on blocks is the consumer's CSS).
- Non-goals (use a ready-made dnd library instead): nesting, spans/collision packing,
  autoscroll. QA card 26 is the live example. Cross-COLUMN moves live in useReorderBoard below.

Board (useReorderBoard, `hooks/useReorderBoard.tsx` - the columns extension of useReorder):
```
useReorderBoard({columns: [{key, items}], commit(next), canDrag?, holdMs?,
                 onDragStart?, onDragMove?, onOverChange?, onDragEnd?})
    -> {columnRef(col) -> RefCallback, item(key), dragKey, over: {col, index} | null}
```
- Columns are plain consumer divs registered via `columnRef(key)` (live callback-ref registry -
  ADDING a column is just consumer state + one more div, spliced at ANY position of the columns
  array incl. the middle); a column's children must be exactly its items, 1:1, in order. The
  column set/geometry is frozen for the duration of one drag.
- Column gravity is pure consumer CSS (`justify-content: flex-start` packs up, `flex-end` packs
  down) - the hook never knows it, it measures the real layout. Do NOT use `flex-direction:
  column-reverse` (it inverts DOM-vs-visual order; the 1:1 mapping breaks).
- Targeting: nearest column by clamped rect distance, insertion index = how many of that column's
  START item centers sit above the dragged center (start geometry only - anti-oscillation, same
  rule as useReorder). Preview = simulated commit (movedColumns), so preview == drop.
- Cross-column FLIP, offset-based like useReorder: the dragged block leaves flow via
  display:none, survivors get preview CSS `order`, and the landing slot becomes a real
  margin gap (draggedHeight + row-gap) on the neighbour - the column's own gravity then decides
  who moves aside (a flex-end column slides the blocks ABOVE the slot up). Apply-read-revert in
  one synchronous pass, cached per target slot.
- Callbacks: onDragStart (grab), onDragMove (every move, pointer delta in local px),
  onOverChange (only when the target slot changes; compare prev.col != over.col for column
  crossings), onDragEnd (final slot + committed flag; a plain click is committed=false).
  `over`/`dragKey` are also returned reactively for render-time styling (column highlight).
- QA card 27 is the live example (5 columns, mixed gravity, empty column, add-column).

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
useStoreEach(store, cb, {enabled?=true})            // store.each() wrapper: cb(key, value, ctx) per CHANGED top-level key; undefined = deleted; root replace expands per key; renders nothing itself
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
useReplaySubscribe(remote, cb, {since?, keepSeq?=true, enabled?=true, onSeq?, onError?, staleMs?, onStale?, policy?, hint?})
  -> {ready, error, stale, seq(), lastTs(), restart(since?)}
useStoreReplaySync(store, remote, sameOpts)  -> same controller       // ObserveAll2.syncStoreReplay wrapper
useStoreReplayMirror(remote, initial, sameOpts) -> controller & {store}   // creates the mirror store in a ref
useStoreReplayEach(remote, cb, sameOpts & {initial?, drain?}) -> controller & {store}   // per-key fold: ObserveAll2.syncStoreReplayEach counterpart
useReplayFrame(remote, cb, {intervalMs?=300, since?, keepSeq?=true, enabled?=true, hint?, onSeq?, onError?})
  -> {ready, error, seq(), pull(hint?), restart(since?)}              // pull-at-own-pace over remote.frame()
useReplayHistory(history, apply, {head?, reset?, tickMs?=300, autoPlay?=true})
  -> {live, seq, head, pause(), play(), seek({seq?|ts?})}
```
Semantics that are easy to get wrong:
- `cb`/`apply` go through refs: new function identity does NOT resubscribe. Resubscribe identity is `[remote, enabled, epoch, staleMs, policy]` — changing `staleMs` resubscribes (it is subscribe-time config in common2; under keepSeq the reconnect is a journal tail, so it is cheap); `policy` picks the wire surface (line vs frameLine), so it resubscribes too. `onStale` goes through a ref like `cb`.
- Lag policy / hint (frame model, common2 rev2): `policy: 'frame'` rides the server's `frameLine` when the remote has one — on lag the server drops for THIS client and recovers via the line's `frame` lambda (mini-frame); without a frameLine (old server, in-proc `exposeReplay`) common2 silently degrades to `'queue'`, so an in-proc QA of `'frame'` proves nothing — the wire test lives in common2 (`replay/rpc-auto.test.ts`). `hint` is opaque to the transport and goes through a ref: in `useReplaySubscribe` it is captured at subscribe time (used for the catch-up `frame()` call); in `useReplayFrame` it is read on EVERY pull, so a new identity is never missed and never resubscribes.
- `useReplayFrame` is the pull path: no live socket subscription at all; a timer calls `remote.frame(seq, hint)` and folds envelopes (seq-ascending, seen seq skipped — a keyframe recovery is just an envelope). Fresh start (no `since`) mirrors `replaySubscribe`'s catch-up for since<0: `keyframe()` is polled until the line has one (`frame(-1)` has no tail to return and THROWS on a still-empty line — a mount racing the producer's first event must not stick an error); a sacred line therefore NEEDS an explicit `since` (0 = full tail) — omitted, it waits forever. Overlapping pulls are never issued (a slow `frame()` skips ticks). Errors are LOUD and sticky: a reject (network, sacred line evicted past our seq, remote without `frame()`) stops the timer and sets `error` until `restart()` — deliberately no tail fallback here, that is `replaySubscribe`'s job. Freshness (`staleMs`) does not apply (the consumer owns the cadence).
- Freshness (`staleMs`): detection is 100% wenay-common2's watchdog (`ReplaySubscribeOpts.staleMs/onStale`, edge-triggered); the hook only mirrors the edges into `stale` state, so a fresh high-frequency line causes zero extra renders. `lastTs()` is a plain getter like `seq()` (producer ts of the last delivered event, 0 before the first delivery / while unsubscribed). Without `staleMs`: no watchdog, no state updates, `stale` stays `false`.
- Freshness on resubscribe/restart: the hook does NOT reset `stale` to `false` at effect start — it re-syncs from common2 after catch-up (mirrors the `onStale` edge fired during catch-up, plus `isStale()` once `ready` resolves), so a snapshot/tail carrying an old producer ts is stale from the first paint with no fresh-flicker. Caveat: common2's in-proc `keyframe()` stamps `ts` at request time, so a brand-new client on a stalled in-proc line reads as fresh at delivery and flips stale after `staleMs` via the arrival-gap watchdog; old-ts detection kicks in when the tail/keyframe actually carries producer timestamps (real relays, archives).
- `useReplayHistory` is archive playback — staleness intentionally does not apply there.
- `keepSeq`: within one mount, a resubscribe (StrictMode double effect, `enabled` toggle, `restart()`) reconnects with `{since: lastSeq}` -> journal tail. A NEW `remote` identity always resets seq (another line's seq is meaningless). A full unmount loses the refs: persist the position in the parent via `onSeq` and pass it back as `since` (QA card 23, client A).
- `seq()` and `useReplayHistory`'s interval-driven `seq/head` keep high-frequency lines from re-rendering per event. Frames/ticks should fold into a canvas/ref/store, not useState.
- `useReplayHistory.seek` kills the live subscription imperatively (guarded off, double-call safe), folds `history.at(where)` through `apply` (keyframe + tail; a keyframe fully redefines consumer state, so `reset` is rarely needed), and freezes. `play()` resubscribes `{since: pos}` -> archive tail -> live handover.
- `useStoreReplayEach` composes existing pieces instead of calling `ObserveAll2.syncStoreReplayEach` (which builds a FRESH store per call): the mirror lives in a ref (like `useStoreReplayMirror`), `store.each()` is subscribed in an effect declared BEFORE the sync effect (hook-call order guarantees the per-key subscriber exists when the keyframe applies — the expansion is never missed), then `useStoreReplaySync` drives the wire. Consequences: within one mount every resubscribe (StrictMode, `restart()`, `enabled` toggle, `staleMs`/`policy` change) reconnects by tail ON TOP of kept state and the consumer sees only the diff — no snapshot/`initial` dance (the library one-call needs `{since, initial: snapshot}` for that). After a FULL unmount pass `{since: prev.seq(), initial: prev.store.snapshot()}` like the library contract. `drain` is creation-time (it goes to `createStore`); changing it later does nothing. The fold target must live outside React state (ref/Map/grid api) — the hook renders nothing; `controller.store` is a normal store for `useStoreNode`/`useStoreKeys` extras.
- Server primitives (`conflateReplay` per connection, `archiveReplay`) intentionally have no hooks: they live where the RPC server is built.

QA cards 23/24/25 (`testUseReact/replayVideo.tsx`, all in-proc): synthetic 10fps jpeg-frame producer on `UseReplayListen({history, current})`; client A = direct `exposeReplay` remote; client B = simulated slow wire (1 envelope per rateMs) behind `conflateReplay({pending: () => buf.length, highWater: 4, lowWater: 1, keyOf: () => "frame"})`; client C = `archiveReplay` + `openHistory` scrubber; client D = freshness (`staleMs: 2000`, `React.memo` + no tick, mounted inside a local `<StrictMode>`; the flat renders counter under growing frames is the no-per-event-render proof; "stall producer" toggles the emit interval, "new client" remounts by key for the stalled-mount case; card 24 has the same via `staleMs: 2500` on the mirror); client E = pull path (`useReplayFrame` over the direct remote with a wrapped counting `frame()`, pace switch 250ms/1s/3s keeps seq). `window.__replayVideoDemo` is exposed for debugging (wire.setRateMs, stats). Node-verified: slow wire delivered 12/36 envelopes yet converged to the last frame with bounded buffer (coalesced tail recovery); `syncStoreReplay` off() freezes the mirror and `{since}` resubscribe catches up by tail. Card 25 = per-key feed (`useStoreReplayEach` over `exposeStoreReplay`): a dict-of-rows store, producer touches ONE random row per tick, the fold target is a plain Map with per-row cb counters — only the mutated row's counter grows, keyframe/`replace` are the only whole-table expansions, delete arrives as `(key, undefined)`. Browser QA of throttling-sensitive behavior needs a VISIBLE tab: hidden-tab timer/effect throttling stalls the producer and delays passive effects (known stand caveat).
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



