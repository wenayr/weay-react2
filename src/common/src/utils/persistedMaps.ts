import { ObservableMap } from "./observableMap";
import type { FloatingWindowSavedGeometry } from "../components/Dnd/FloatingWindow";
import type { MenuRightSavedState } from "../components/Menu/RightMenuStore";

/** Persisted-state maps live in a utils LEAF so the runtime dependency graph points one way:
 *  owning components import their map from here, and memoryStore assembles the memoryCache
 *  registry without reaching up into the component layer (it used to import FloatingWindow/
 *  Resizable/RightMenuStore, dragging react-rnd and the Menu tree into every utils consumer).
 *  The `import type` lines above are erased at build - shapes stay documented at their owners. */

/** Saved size of an FResizableReact column/box; the shape the resize layer persists. */
export type ResizableSavedSize = { height?: number | string, width?: number | string }

// observable - memoryCache marks itself dirty on their mutations
export const floatingWindowMap = new ObservableMap<string, FloatingWindowSavedGeometry>();
export const mapResiReact = new ObservableMap<string, ResizableSavedSize>();
export const mapRightMenu = new ObservableMap<string, MenuRightSavedState>();
