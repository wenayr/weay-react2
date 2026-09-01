/** Root barrel. Since 2.0.0 it is a plain re-export list: no CSS side effects (consumers
 *  import "wenay-react2/styles" once - see doc/WENAY_REACT2_RENAMES.md), no `kit` namespace
 *  object (it held a live reference to every member and defeated tree-shaking for the whole
 *  package), no demo/stand code. Sections are ordered by dependency direction. */

// 0. STYLES - tokens + ag-grid theme helpers
export * from "./internal/styles/styleGrid.js";
export * from "./internal/styles/tokens.js";

// 1. BASE LAYER - external-object reactivity
export * from "./internal/updateBy.js";

// 2. HOOKS - depend on updateBy, utils and wenay-common2
export * from "./internal/hooks/index.js";

// 3. UTILS - persistence primitives and pure helpers (explicit list, no export *)
export * from "./internal/utils/index.js";

// 4. DND - floating windows, resizable, drag box
export * from "./internal/components/Dnd/index.js";

// 5. GRID (agGrid4): core buffer + headless hook + AgGridTable
export * from "./internal/grid/agGrid4/index.js";

// 5b. GRID column state: state primitive (ag-grid-free), DOM renderers, ag-grid runtime
// (createColumnGrid) and grid chrome each from their own module.
export * from "./internal/grid/columnState/index.js";
export * from "./internal/grid/columnState/ui.js";
export * from "./internal/grid/columnState/columnGrid.js";
export * from "./internal/grid/gridChrome.js";

// 6. BASE COMPONENTS - depend on hooks
export * from "./internal/components/Buttons/index.js";
export * from "./internal/components/OutsideClickArea.js";
export * from "./internal/components/Overlay.js";
export * from "./internal/components/MyResizeObserver.js";

// 7. ParamsEditor (+ row renderers and async wrappers)
export * from "./internal/components/ParamsEditor/index.js";

// 8. Input - depends on hooks and Dnd
export * from "./internal/components/Input.js";

// 9. Modal - depends on Input and updateBy
export * from "./internal/components/Modal/index.js";

// 10. Menu components (RightMenu) - depend on hooks, Dnd and Modal
export * from "./internal/components/Menu/index.js";

// 11. Settings dialog + section registry; UI slot; customizable toolbar
export * from "./internal/components/Settings/index.js";
export * from "./internal/components/UiSlot/index.js";
export * from "./internal/components/Toolbar/index.js";

// 12. Communication UI. Protocol/media ownership is injected by the app.
export * from "./internal/components/Communication/index.js";

// 13. Context menu engine
export { Menu, MenuProgress, MenuElement as MenuItemElement } from "./internal/menu/menu.js";
export type { MenuItem, MenuItemStrict } from "./internal/menu/menu.js";
export * from "./internal/menu/menuMouse.js";

// 14. LOGS - controller + three views (page table, mini feed, message events)
export * from "./internal/logs/logs.js";
export * from "./internal/logs/miniLogs.js";

// 15. CHARTS
export * from "./internal/myChart/Sparkline.js";
export * from "./internal/myChart/chartEngine/chartEngineReact.js";
