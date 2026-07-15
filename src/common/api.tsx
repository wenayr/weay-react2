import "../style/menuRight.css"
import "../style/style.css"
import * as hooksKit from "./src/hooks";
import * as dndKit from "./src/components/Dnd";
import * as utilsKit from "./src/utils";
import * as gridKit from "./src/grid/agGrid4";
import * as modalKit from "./src/components/Modal";
import * as menuKit from "./src/menu/menu";
import * as contextMenuKit from "./src/menu/menuMouse";
import * as rightClickMenuKit from "./src/menu/menuR";
import * as logsKit from "./src/logs/logs";
import * as updateByKit from "./updateBy";

// 0. STYLES - independent
export * from "./src/styles/styleGrid";
export * from "./src/styles/tokens";

// 1. BASE LAYER - no internal project dependencies
export * from "./updateBy";

// 2. HOOKS - depend on updateBy and wenay-common2
export * from "./src/hooks";

// 4. DND components - depend on updateBy and utils (persistedMaps)
export * from "./src/components/Dnd";

// 5. UTILS - self-contained (persisted maps live in utils/persistedMaps; components import
// their map from there, so utils no longer reaches into the component layer)
export * from "./src/utils";

// 5b. GRID (agGrid4): core buffer + headless hook + AgGridTable.
export * from "./src/grid/agGrid4";

// 5c. GRID column state (createColumnState): persisted order/visibility/width/sort/filter,
// standalone config store + optional two-way ag-grid adapter (attach via onGridReady).
// The columnState barrel is deliberately ag-grid-free; createColumnGrid (ag-grid runtime +
// Toolbar) ships from its own module so grid-less consumers can import the barrel directly.
export * from "./src/grid/columnState";
export * from "./src/grid/columnState/columnGrid";
export * from "./src/grid/gridChrome";

// 6. BASE COMPONENTS - depend on hooks
export * from "./src/components/Buttons";
export * from "./src/components/MyResizeObserver";
export * from "./src/components/Other";

// 7. Parameters - depends on utils
export * from "./src/components/Parameters";

// 8. ParamsEditor - depends on Parameters and utils
export * from "./src/components/ParamsEditor";

// 9. Input - depends on hooks and Dnd
export * from "./src/components/Input";

// 10. Modal - depends on Input and updateBy
export * from "./src/components/Modal";

// 11. Menu - depends on hooks, Dnd, and Modal
export * from "./src/components/Menu";

// 11b. Settings dialog + section registry; UI slot with configurable placement
export * from "./src/components/Settings";
export * from "./src/components/UiSlot";

// 11c. Customizable toolbar (createToolbar): config persisted like createUiSlot,
// pure Settings editor works both in the bar's gear popover and in a settings section
export * from "./src/components/Toolbar";

// 12. MENU - depends on components
export { Menu, MenuProgress, MenuElement as MenuItemElement } from "./src/menu/menu";
export type { MenuItem, MenuItemStrict } from "./src/menu/menu";
export * from "./src/menu/menuMouse";
export * from "./src/menu/menuR";

// 13. LOGS - depend on utils/memoryStore, menu, and components/ParamsEditor
export * from "./src/logs/logs";
export * from "./src/logs/logsContext";
export * from "./src/logs/miniLogs";

// 14. CHARTS - highest level
export * from "./src/myChart/1/myChart";
export * from "./src/myChart/1/myChartTest";
export * from "./src/myChart/chartEngine/chartEngineReact";

export const kit = {
    hooks: hooksKit,
    dnd: dndKit,
    utils: utilsKit,
    grid: gridKit,
    modal: modalKit,
    menu: {
        ...menuKit,
        context: contextMenuKit,
        rightClick: rightClickMenuKit,
    },
    logs: logsKit,
    updateBy: updateByKit,
} as const;
