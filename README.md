# wenay-react2

Common React UI primitives for wenay apps.

Use the new concise API guide first:

- [wenay-react2.md](doc/wenay-react2.md) - canonical everyday API.
- [wenay-react2-rare.md](doc/wenay-react2-rare.md) - old names, low-level exports, migration notes.
- [agGrid4 README](./src/common/src/grid/agGrid4/README.md) - table buffer/controller details.
- [agGrid4 wrapper boundary](./src/common/src/grid/agGrid4/WRAPPER.md) - where generic primitives end and app wrappers begin.

## Import

```ts
import { useModal, useAgGrid, createGridBuffer, createColumnBuffer, useStoreMirror } from "wenay-react2"
```

The root export is still flat. A grouped namespace is also exported for large files:

```ts
import { v2 } from "wenay-react2"

v2.grid.useAgGrid(...)
v2.modal.useModal()
```

## API Standard

New code should use the short controller-style surface:

```tsx
const modal = useModal()
modal.open(<Dialog />)
modal.close()

const grid = useAgGrid<Row>({getId: row => row.id})
grid.update({newData})
grid.clean()
grid.flush()

const mirror = useStoreMirror(remoteStore, initialState, {mask, current: true})
```

Old `Get*`, `*2/*3`, `FuncJSX`, and legacy grid helper names remain documented in `wenay-react2-rare.md` for existing code, but they are not the teaching path for new code.

## QA Stand

```sh
npm run testReact -- --host 127.0.0.1 --port 3002
```

The stand source is `src/common/testUseReact/qa.tsx`. Use it for visual checks after changing UI primitives.

## Build

```sh
npm run build
```
