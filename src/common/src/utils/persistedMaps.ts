import { ObservableMap } from "./observableMap.js";
import type { FloatingWindowSavedGeometry } from "./floatingWindowTypes.js";

/** Persisted-state maps live in a utils LEAF so the runtime dependency graph points one way:
 *  owning components import their map from here, and memoryStore assembles the memoryCache
 *  registry without reaching up into the component layer (it used to import FloatingWindow/
 *  Resizable/RightMenuStore, dragging react-rnd and the Menu tree into every utils consumer).
 *  Shared persisted shapes stay data-only so the registry never points back to
 *  a component/controller module, even at declaration-build time - which is why the window
 *  geometry contract sits next to this file in utils rather than under components/Dnd. */

/** Saved size of an FResizableReact column/box; the shape the resize layer persists. */
export type ResizableSavedSize = { height?: number | string, width?: number | string }

export type MenuRightPosition = 'left' | 'right';
export type MenuRightVerticalPosition = 'top' | 'bottom';
export type MenuRightSavedState = {
    position: MenuRightPosition;
    verticalPosition: MenuRightVerticalPosition;
    offset: {x: number; y: number};
};

/** Open/closed state of a keyForSave-tagged Button. */
export type ButtonSavedState = { open: boolean }

// observable - memoryCache marks itself dirty on their mutations
export const floatingWindowMap = new ObservableMap<string, FloatingWindowSavedGeometry>();
export const buttonStatusMap = new ObservableMap<string, ButtonSavedState>();
export const mapResiReact = new ObservableMap<string, ResizableSavedSize>();
export const mapRightMenu = new ObservableMap<string, MenuRightSavedState>();
