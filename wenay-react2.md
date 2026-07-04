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
MemoryMap                                       // rnd / resize / other maps
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

Listen helpers:
```
useListenEffect(listen, (...args) => {})
const value = useListenValue(listen, {initial})
const args = useListenArgs(listen)
```

The hook does not choose transport. `remoteStore` needs `{ get(mask?), changed }` and may also provide `changedPaths`; apps may implement it with RPC, WebSocket, SSE, or test HTTP. `changedPaths` is used as a transport optimization: mirror pulls `mask ∩ paths` instead of the whole mask. `initial` is only the local mirror seed; changing it does not reset an existing mirror. `mask` is treated as a small declarative StoreMask, so structurally equal inline masks do not resubscribe. For add/delete keys, subscribe to the parent object node with `useStoreKeys(node)`; this also covers deep objects. If a state key conflicts with StoreNode methods such as `count`, use `store.node.at("count")`.
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
npm run testReact -- --host 127.0.0.1 --port 3002
```

The stand lives in `src/common/testUseReact/qa.tsx`. Use it for visual checks; agGrid4 overlay/dynamic-column demos are dedicated QA cards.






