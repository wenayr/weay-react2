/** `wenay-react2/ui` (3.0.0) - the generic UI block: the persisted toggle-button family
 *  (Button, HoverButton, OutsideButton, AbsoluteButton, MiniButton, PopupButton), the outside-
 *  click area and Overlay, the persisted re-resizable wrapper (FResizableReact + mapResiReact)
 *  and the resize-handle helpers, the UiSlot mount-point registry, the customizable Toolbar with
 *  its density registry, and the SettingsDialog with its section registry. Depends on ./react,
 *  ./windows (SettingsDialog hosts itself in FloatingWindowBase, so react-rnd is part of this
 *  entry) and re-resizable; pulls no ag-grid and no grid/logs/chart/communication code. */

export {AbsoluteButton, Button, HoverButton, OutsideButton} from "../internal/components/Buttons/Button.js";
export {MiniButton, PopupButton} from "../internal/components/Buttons/MiniButton.js";
export {OutsideClickArea} from "../internal/components/OutsideClickArea.js";
export {Overlay} from "../internal/components/Overlay.js";
export type {OverlayProps} from "../internal/components/Overlay.js";
export {removeResizeableElement, setResizeableElement} from "../internal/components/MyResizeObserver.js";
export {FResizableReact, mapResiReact} from "../internal/components/Dnd/Resizable.js";
export {createUiSlot} from "../internal/components/UiSlot/UiSlot.js";
export {
    createToolbar,
    getToolbarDensities,
    registerToolbarDensity,
    toolbarItemIcon,
} from "../internal/components/Toolbar/Toolbar.js";
export type {
    ToolbarConfig,
    ToolbarDensity,
    ToolbarItem,
    ToolbarSourceMode,
    UiListConfig,
    UiListSource,
} from "../internal/components/Toolbar/Toolbar.js";
export {
    SettingsDialog,
    getSettingsSections,
    registerSettingsSection,
    useSettingsDialogController,
} from "../internal/components/Settings/SettingsDialog.js";
export type {
    SettingsDialogController,
    SettingsDialogProps,
    SettingsDialogTreeToolState,
    SettingsSearchSource,
    SettingsSearchTerm,
    SettingsSection,
    SettingsTree,
    SettingsTreeFilter,
    SettingsTreeNode,
} from "../internal/components/Settings/SettingsDialog.js";
