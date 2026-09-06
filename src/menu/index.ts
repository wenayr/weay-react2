/** `wenay-react2/menu` (3.0.0) - the menu block: the context-menu engine (Menu, MenuItemElement,
 *  MenuProgress and the contextMenu layer/controller created by createContextMenu) and the
 *  persisted right-hand DropdownMenu with its controller and the mapRightMenu map it saves to.
 *  Depends on ./react and, through DropdownMenu's modal render store, on ./modal (so react-rnd
 *  is reachable from this entry); pulls no ag-grid and no grid/logs/chart/communication code. */

export {Menu, MenuProgress, MenuElement as MenuItemElement} from "../internal/menu/menu.js";
export type {
    MenuActionEvent,
    MenuActionEventType,
    MenuActionHandler,
    MenuItem,
    MenuItemStrict,
} from "../internal/menu/menu.js";
export {contextMenu, createContextMenu} from "../internal/menu/menuMouse.js";
export type {
    ContextMenuActionCounters,
    ContextMenuAnchor,
    ContextMenuGesture,
    ContextMenuLayerProps,
    ContextMenuPoint,
    ContextMenuProvided,
    ContextMenuState,
    ContextMenuStats,
    ContextMenuStatsSnapshot,
} from "../internal/menu/menuMouse.js";
export {
    DropdownMenu,
    createRightMenuController,
    useRightMenuController,
} from "../internal/components/Menu/RightMenu.js";
export type {
    DropdownMenuProps,
    MenuElement,
    MenuRightClassNames,
    MenuRightRenderProps,
    MenuRightStyles,
    MenuRightTrigger,
    MenuRightTriggerState,
    RightMenuController,
    UseRightMenuControllerOptions,
} from "../internal/components/Menu/RightMenu.js";
export {mapRightMenu} from "../internal/components/Menu/RightMenuStore.js";
export type {
    MenuRightPosition,
    MenuRightSavedState,
    MenuRightVerticalPosition,
} from "../internal/components/Menu/RightMenuStore.js";
