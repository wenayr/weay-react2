import "../style/menuRight.css"
import "../style/style.css"
import * as hooksV2 from "./src/hooks";
import * as dndV2 from "./src/components/Dnd";
import * as utilsV2 from "./src/utils";
import * as gridV2 from "./src/grid/agGrid4";
import * as modalV2 from "./src/components/Modal";
import * as menuV2 from "./src/menu/menu";
import * as menuMouseV2 from "./src/menu/menuMouse";
import * as menuRV2 from "./src/menu/menuR";
import * as logsV2 from "./src/logs/logs";
import * as updateByV2 from "./updateBy";


// 0. STYLES - independent
export * from "./src/styles/styleGrid";
export * from "./src/styles/tokens";

// 1. BASE LAYER - no internal project dependencies
export * from "./updateBy";

// 2. HOOKS - depend only on updateBy
export * from "./src/hooks";

// 4. DND components - depend on updateBy
export * from "./src/components/Dnd";

// 5. UTILS - now depend on Dnd (mapMemory imports ExRNDMap3, mapResiReact)
export * from "./src/utils";

// 5b. GRID (agGrid4): core buffer + headless hook + AgGridMy. New path instead of applyTransactionAsyncUpdate
export * from "./src/grid/agGrid4";

// 5c. GRID column state (createColumnState): persisted order/visibility/width/sort/filter,
// standalone config store + optional two-way ag-grid adapter (attach via onGridReady)
export * from "./src/grid/columnState";

// 6. BASE COMPONENTS - depend on hooks
export * from "./src/components/Buttons";
export * from "./src/components/MyResizeObserver";
export * from "./src/components/Other";

// 7. Parameters - depends on utils
export * from "./src/components/Parameters";

// 8. ParametersEngine - depends on Parameters and utils
export * from "./src/components/ParametersEngine";

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
export { MenuBase, TimeNum, MenuElement as LegacyMenuElement } from "./src/menu/menu";
export type { tMenuReact, tMenuReactStrictly } from "./src/menu/menu";
export * from "./src/menu/menuMouse";
export * from "./src/menu/menuR";

// 13. LOGS - depend on utils/mapMemory, menu, and components/ParametersEngine
export * from "./src/logs/logs";
export * from "./src/logs/logs3";
export * from "./src/logs/miniLogs";


// 14. CHARTS - highest level
export * from "./src/myChart/1/myChart";
export * from "./src/myChart/1/myChartTest";
export * from "./src/myChart/chartEngine/chartEngineReact";

export function test() {
    return 5;
}
export const v2 = {
    hooks: hooksV2,
    dnd: dndV2,
    utils: utilsV2,
    grid: gridV2,
    modal: modalV2,
    menu: {
        ...menuV2,
        mouse: menuMouseV2,
        rightClick: menuRV2,
    },
    logs: logsV2,
    updateBy: updateByV2,
} as const;
