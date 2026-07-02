Here is an expanded API guide with typings and usage examples. This format is suitable for documentation so other developers or AI assistants can quickly understand which props a component accepts and how to integrate it.

---

## API Reference (Components & Hooks)

### Modal and Floating Windows (MDI)

#### `DivRnd3`
Wrapper for creating freely movable, resizable windows with state persistence.

**Typing:**
```typescript
type tDivRndBase = {
    children: React.ReactElement | ((update: number) => React.ReactElement);
    position?: { x: number; y: number };
    size?: { height: number | string; width: number | string };
    keyForSave?: string;        // Key for caching the position/size in memory
    limit?: { x?: { max?: number; min?: number }, y?: { max?: number; min?: number } };
    onCLickClose?: () => void;  // Adds a close button to the window
    header?: React.ReactElement | boolean; // Drag handle header; otherwise the whole block is draggable
    zIndex?: number;
}
```

**Example:**
```textmate
<DivRnd3
    keyForSave="my_tool_window"
    size={{ width: 300, height: 200 }}
    onCLickClose={() => setOpen(false)}
    header={<div>My tool</div>}
>
    <div>Window content</div>
</DivRnd3>
```


#### `GetModalJSX()`
Factory for global modal windows. It lets business logic open windows without being tied to local component state.

**Example:**
```textmate
const myModal = GetModalJSX();

// 1. In the app root file (App.tsx):
<myModal.Render />

// 2. Anywhere in the logic:
myModal.set(<div onClick={() => myModal.set(null)}>Close me</div>);
// For multiple windows: myModal.addJSX(<Component/>)
```


---

### Drag-and-Drop and Interaction (Hooks & Wrappers)

#### `useOutside` / `DivOutsideClick`
Tracks clicks outside an element, useful for closing dropdowns and menus.

**Typing:**
```typescript
// Hook
function useOutside(params: { outsideClick: () => void, status?: boolean, ref?: RefObject }): RefObject;

// Component
type Props = { outsideClick: () => void, status?: boolean, zIndex?: number } & HTMLAttributes;
```

**Example:**
```textmate
<DivOutsideClick outsideClick={() => setDropdownOpen(false)} status={isOpen}>
    <div className="dropdown-menu">...</div>
</DivOutsideClick>
```


#### `Drag22`
Tracks mouse/finger movement and returns new coordinates without touching CSS directly.

**Typing:**
```typescript
type Drag2Props = {
    x?: number; y?: number;               // Start/current coordinates
    onX?: (val: number) => void;          // X change callback
    onY?: (val: number) => void;          // Y change callback
    onStart?: () => void; onStop?: () => void;
    children: ReactNode;
};
```


---

### Context Menus (`MenuR` / `mouseMenuApi`)

Smart context menus. They open on desktop via right click and on mobile via long tap / double tap. They support asynchronous item generation.

**Menu item typing (`tMenuReactStrictly`):**
```typescript
type tMenuReactStrictly = {
    name: string | ((status?: any) => string);
    onClick?: (e: any) => void | Promise<any> | Promise<any>[]; // Promise support with ok/error counters
    status?: boolean; // Whether the submenu is expanded
    next?: () => tMenuReact[] | Promise<tMenuReact[]>; // Nested menu
    func?: () => React.ReactElement | Promise<React.ReactElement>; // Custom hover render
};
```

**Examples:**
```textmate
// 1. Using the wrapper component
const menuItems = () => [
    { name: "Copy", onClick: () => copy() },
    { name: "Options", next: () => [{ name: "Option 1", onClick: () => {} }] }
];

<MenuR other={menuItems}>
    <div className="item">Right-click me</div>
</MenuR>

// 2. Global call through the API
mouseMenuApi.map.set("global_action", [{ name: "Global action", onClick: () => {} }]);
```


---

### Ag-Grid Table Updates (`applyTransactionAsyncUpdate2`)

Function for safe batched asynchronous table data updates synchronized with a local buffer/cache.

**Typing:**
```typescript
type Params<T> = {
    gridRef?: React.RefObject<GridReadyEvent<T, any>>;
    newData: Partial<T>[];                         // New data array
    getId: (row: Partial<T>) => string;            // ID getter
    bufTable: { [id: string]: Partial<T> };        // Local cache dictionary
    option?: { update?: boolean, add?: boolean, updateBuffer?: boolean, sync?: boolean };
};
```

**Example:**
```textmate
// Immediately updates the cache and sends a transaction to Ag-Grid
applyTransactionAsyncUpdate2({
    gridRef: apiGrid,
    newData: [{ id: "user_1", balance: 500 }],
    getId: (e) => e.id,
    bufTable: myLocalBuffer,
    option: { update: true, add: true }
});
```


---

### UI Settings Autogeneration (`ParametersReact`)

Engine that accepts an object with a data schema and renders a ready-to-use control form with inputs, sliders, and selects.

**Typing:**
The schema is built from `Params.IParamsExpandableReadonly` types.
Supported types: `number`, `string`, `boolean`, `Date`, arrays, and nested objects.

**Example:**
```textmate
const mySettings = {
    showGrid: true, // Generates a Checkbox
    opacity: {
        value: 0.5,
        range: { min: 0, max: 1, step: 0.1 },
        name: "Opacity"
    }, // Generates a Range Slider + Number Input
    theme: {
        value: "dark",
        range: ["dark", "light", "system"]
    } // Generates a Select
};

<ParametersReact
    params={mySettings}
    onChange={(newParams) => {
        console.log("New value:", newParams.opacity.value);
    }}
/>
```


---

### Logging System (`logsApi`)

Log registration, log viewer table, and toast notification system.

**API:**
```typescript
// 1. Adding a log
logsApi.addLogs({
    id: "system",
    var: 10,           // Severity, important for notification filtering
    time: new Date(),
    txt: "Connection lost"
});

// 2. Rendering components, usually somewhere near the root:
<logsApi.React.Message zIndex={9999} /> // Toast notifications in the top-right corner
<logsApi.React.PageLogs />              // Ag-Grid table with all logs
```

There are several other important architectural patterns and UI components actively used in the codebase. They should be documented so another developer or AI assistant can understand how interfaces are built in this project.

Here is the second part of the `README.md` additions:

---

### Sidebar Navigation

#### `ApiLeftMenu`
Ready-made API for controlling the left slide-out sidebar menu. It supports swipes, smooth snap scrolling, and imperative tab control.

**API and Typing:**
```typescript
type MenuItem = {
    el: () => React.JSX.Element;   // Tab component
    button?: React.JSX.Element;    // Custom button, optional
    color?: ColorString;           // Background color
    textB?: string;                // Default button text
};

// Register menu items:
ApiLeftMenu.setMenu(items: MenuItem[], key?: string);
```

**Usage example:**
```textmate
// 1. Register tabs, can be done anywhere in the logic:
ApiLeftMenu.setMenu([
    { textB: "Dashboard", el: () => <Dashboard />, color: "rgb(92,50,213)" },
    { textB: "Settings", el: () => <Settings /> }
], "main_menu");

// 2. Render the menu itself in the root Layout:
export function AppLayout() {
    return <ApiLeftMenu.Modal2 zIndex={20} />;
}
```


---

### Interactive Elements and Buttons

#### `Button` (from `useOutside.tsx`) / `MiniButton`
Advanced button components that encapsulate dropdown logic, popover panels, and outside-click tracking for automatic closing.

**`Button` typing:**
```typescript
type tButton = {
    button: ReactElement | ((status: boolean) => ReactElement); // The button itself; can change by status
    children: ReactNode | ((api: {onClose: () => void}) => ReactNode); // Dropdown content
    outClick?: boolean | (() => void); // Whether to close on outside click; true by default
    statusDef?: boolean; // Initial state, open/closed
};
```

**Example:**
```textmate
<Button
    outClick={true}
    button={(isOpen) => <div className={isOpen ? "active" : ""}>Options</div>}
>
    {({ onClose }) => (
        <div className="dropdown-panel">
            <div onClick={() => { doSomething(); onClose(); }}>Action 1</div>
        </div>
    )}
</Button>
```


#### `FResizableReact`
Wrapper over `re-resizable`. It creates resizable panels, for example columns or lower log panes, and stores their size in cache.

**Example:**
```textmate
<FResizableReact
    keyForSave="bottom_panel_size"
    size={{ height: 200, width: "100%" }}
    moveWith={false} // Allow resize only by height
>
    <LogsTable />
</FResizableReact>
```


---

### Global Reactivity (`renderBy` / `updateBy` Pattern)

*(Note: this is a key project concept used instead of classic `useState` / `Redux` for complex business logic.)*

Many places in the project use a mutable state approach: you mutate properties of a plain JS object and call `renderBy(obj)` to force an update of all components subscribed to that object through `updateBy(obj)`.

**Pattern example:**
```textmate
import { renderBy, updateBy } from "./updateBy";

// 1. Global or local state, a plain object
const myState = {
    count: 0,
    text: "hello"
};

// 2. Consumer component
function CounterViewer() {
    // The component subscribes to myState changes
    updateBy(myState);

    return <div>{myState.count}</div>;
}

// 3. State change, anywhere, even outside React
function increment() {
    myState.count += 1;
    renderBy(myState); // Triggers a CounterViewer rerender
}
```


---

### Useful Ag-Grid Utilities

#### `GridStyleDefault` and `StyleCSSHeadGrid`
Quickly apply the common corporate style to all application tables.

**Root integration example:**
```typescript
import { GridStyleDefault, StyleCSSHeadGrid } from "./styleGrid";

// Applies the dark theme, compresses spacing, and centers headers
GridStyleDefault();
StyleCSSHeadGrid();
```


#### `getComparatorGrid`
Factory for creating custom Ag-Grid column sort functions that correctly handle `undefined`, `NaN`, and inversion.
**Example:**
```textmate
const columnDefs = [
    {
        field: "price",
        comparator: getComparatorGrid() // Safe numeric sorting
    }
];
```


---

### Global Hooks

#### `useAddDownAnyKey`
Registers a global keyboard listener and stores the last pressed key in the exported reactive object `KeyDown`.

**Usage example:**
```textmate
import { KeyDown, useAddDownAnyKey } from "./useAddDownAnyKey";
import { updateBy } from "./updateBy";

function HotkeyListener() {
    useAddDownAnyKey(); // Hook initialization
    updateBy(KeyDown);  // Subscribe to key presses

    if (KeyDown.key === "Escape") {
        return <div>Escape pressed!</div>;
    }
    return null;
}
```
