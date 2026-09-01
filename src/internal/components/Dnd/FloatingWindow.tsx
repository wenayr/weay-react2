/** Public entry point of the floating-window layer. The implementation lives in sibling
 *  modules - useFloatingWindowController (state and handlers), FloatingWindowBase (the
 *  renderer), floatingWindowProps (the contracts), plus floatingWindowPersistence,
 *  floatingWindowDrag and floatingWindowSnap - and this file re-exports exactly the surface it
 *  has always had, so `src/windows/index.ts` and `Dnd/index.ts` are unaffected. */
import { floatingWindowMap } from "../../utils/persistedMaps.js";

export { FloatingWindowTaskbar, useFloatingWindowManager } from "./FloatingDesktop.js";
export type { FloatingDesktopWindow, FloatingWindowManager, FloatingWindowTaskbarProps } from "./FloatingDesktop.js";
export type {
    FloatingWindowCloseReason,
    FloatingWindowMode,
    FloatingWindowPosition,
    FloatingWindowSavedGeometry,
    FloatingWindowSize,
    FloatingWindowSnapRegion,
} from "../../utils/floatingWindowTypes.js";
export type {
    FloatingWindowController,
    FloatingWindowControllerOptions,
    FloatingWindowProps,
    FloatingWindowUpdate,
} from "./floatingWindowProps.js";

// Map of all popup window sizes; declared in utils/persistedMaps (memoryCache registry must not
// import the component layer) and re-exported here so the public surface is unchanged
export { floatingWindowMap };

export { WindowPortal, useWindowPortalContainer } from "./WindowPortal.js";

export { FloatingWindow, FloatingWindowBase } from "./FloatingWindowBase.js";
export { useFloatingWindowController } from "./useFloatingWindowController.js";

export { DragBox } from "./DragBox.js";
export type { DragBoxProps } from "./DragBox.js";
