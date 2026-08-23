import "../style/menuRight.css"
import "../style/style.css"
import * as hooksKit from "./src/hooks/index.js";
import * as dndKit from "./src/components/Dnd/index.js";
import * as utilsKit from "./src/utils/index.js";
import * as gridKit from "./src/grid/agGrid4/index.js";
import * as modalKit from "./src/components/Modal/index.js";
import * as menuKit from "./src/menu/menu.js";
import * as contextMenuKit from "./src/menu/menuMouse.js";
import * as rightClickMenuKit from "./src/menu/menuR.js";
import * as logsKit from "./src/logs/logs.js";
import * as updateByKit from "./updateBy.js";
import * as communicationKit from "./src/components/Communication/index.js";

// 0. STYLES - independent
export * from "./src/styles/styleGrid.js";
export * from "./src/styles/tokens.js";

// 1. BASE LAYER - no internal project dependencies
export * from "./updateBy.js";

// 2. HOOKS - depend on updateBy and wenay-common2
export * from "./src/hooks/index.js";

// 4. DND components - depend on updateBy and utils (persistedMaps)
export * from "./src/components/Dnd/index.js";

// 5. UTILS - self-contained (persisted maps live in utils/persistedMaps; components import
// their map from there, so utils no longer reaches into the component layer)
export * from "./src/utils/index.js";

// 5b. GRID (agGrid4): core buffer + headless hook + AgGridTable.
export * from "./src/grid/agGrid4/index.js";

// 5c. GRID column state (createColumnState): persisted order/visibility/width/sort/filter,
// standalone config store + optional two-way ag-grid adapter (attach via onGridReady).
// The columnState barrel is deliberately ag-grid-free; createColumnGrid (ag-grid runtime +
// Toolbar) ships from its own module so grid-less consumers can import the barrel directly.
export * from "./src/grid/columnState/index.js";
export * from "./src/grid/columnState/columnGrid.js";
export * from "./src/grid/gridChrome.js";

// 6. BASE COMPONENTS - depend on hooks
export * from "./src/components/Buttons/index.js";
export * from "./src/components/MyResizeObserver.js";
export * from "./src/components/Other.js";

// 7. Parameters - depends on utils
export * from "./src/components/Parameters.js";

// 8. ParamsEditor - depends on Parameters and utils
export * from "./src/components/ParamsEditor.js";

// 9. Input - depends on hooks and Dnd
export * from "./src/components/Input.js";

// 10. Modal - depends on Input and updateBy
export * from "./src/components/Modal/index.js";

// 11. Menu - depends on hooks, Dnd, and Modal
export * from "./src/components/Menu/index.js";

// 11b. Settings dialog + section registry; UI slot with configurable placement
export * from "./src/components/Settings/index.js";
export * from "./src/components/UiSlot/index.js";

// 11c. Customizable toolbar (createToolbar): config persisted like createUiSlot,
// pure Settings editor works both in the bar's gear popover and in a settings section
export * from "./src/components/Toolbar/index.js";

// 11d. Communication UI. Protocol/media ownership is injected by the app;
// VideoCall + useVideoCallController own only the product surface and UI state.
export * from "./src/components/Communication/index.js";

// 12. MENU - depends on components
export { Menu, MenuProgress, MenuElement as MenuItemElement } from "./src/menu/menu.js";
export type { MenuItem, MenuItemStrict } from "./src/menu/menu.js";
export * from "./src/menu/menuMouse.js";
export * from "./src/menu/menuR.js";

// 13. LOGS - depend on utils/memoryStore, menu, and components/ParamsEditor
export * from "./src/logs/logs.js";
export * from "./src/logs/logsContext.js";
export * from "./src/logs/miniLogs.js";

// 14. CHARTS - highest level
export * from "./src/myChart/Sparkline.js";
export * from "./src/myChart/1/myChart.js";
export * from "./src/myChart/1/myChartTest.js";
export * from "./src/myChart/chartEngine/chartEngineReact.js";

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
    communication: communicationKit,
    updateBy: updateByKit,
} as const;
