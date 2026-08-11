import "../style/style.css";

export {
    FloatingWindow,
    FloatingWindowBase,
    WindowPortal,
    useFloatingWindowController,
    useWindowPortalContainer,
    DragBox,
} from "../common/src/components/Dnd/FloatingWindow";
export type {
    DragBoxProps,
    FloatingWindowCloseReason,
    FloatingWindowController,
    FloatingWindowControllerOptions,
    FloatingWindowMode,
    FloatingWindowPosition,
    FloatingWindowProps,
    FloatingWindowSavedGeometry,
    FloatingWindowSize,
    FloatingWindowSnapRegion,
    FloatingWindowUpdate,
} from "../common/src/components/Dnd/FloatingWindow";
export {
    FloatingWindowTaskbar,
    cascadeWindowPosition,
    useFloatingDesktopWindow,
    useFloatingWindowManager,
} from "../common/src/components/Dnd/FloatingDesktop";
export type {
    FloatingDesktopWindow,
    FloatingWindowManager,
    FloatingWindowTaskbarProps,
} from "../common/src/components/Dnd/FloatingDesktop";
