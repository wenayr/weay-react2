# React Native entrypoint

Import the renderer-neutral API from `wenay-react2/native`. It has no React DOM,
CSS, browser-global or ag-grid dependency.

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import {createNativeColumnDots, createNativeColumnState} from 'wenay-react2/native'

const columns = createNativeColumnState({
    key: 'super-admin.columns',
    columns: [
        {key: 'server', title: 'Server', fixed: true},
        {key: 'status', title: 'Status'},
        {key: 'panic', title: 'Panic'},
    ],
    storage: AsyncStorage,
})
await columns.ready

const dots = createNativeColumnDots({state: columns, max: 8})
dots.begin('status', 40, 0)
dots.move(120, 0, {start: 0, length: 240})
dots.end()
```

The persisted `v/order/visible/width/sort/filter/groups` shape matches the web
`ColumnsConfig`. Writes are serialized and local edits made while hydration is
pending win over stale storage.

`createNativeColumnDots` is a view-independent interaction model. Connect its
`begin/move/end` coordinates to PanResponder or Gesture Handler. Set `removeDirection` to `up`, `down` or `either` (the renderer-neutral default). It supports
live field replacement along the slider, explicit reorder and toggle, sticky
`asc -> desc -> off` sorting, and upward tear-off.

Call `dots.dispose()` and `columns.dispose()` with the owning screen. Use
`columns.api.flush()` when the latest AsyncStorage write must be awaited.
