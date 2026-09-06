/** Data-only contracts shared by the window controller, desktop manager, and
 * persisted-state registry. Keeping them in a leaf module prevents those
 * layers from importing one another merely to name persisted geometry. */
export type FloatingWindowPosition = { x: number; y: number };

export type FloatingWindowSize = {
    height: number | string;
    width: number | string;
};

export type FloatingWindowMode = "normal" | "maximized";

export type FloatingWindowSnapRegion =
    | "left"
    | "right"
    | "top"
    | "bottom"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";

export type FloatingWindowCloseReason = "close-button" | "escape" | "programmatic";

export type FloatingWindowSavedGeometry = {
    position: FloatingWindowPosition;
    size: FloatingWindowSize;
    snapRegion?: FloatingWindowSnapRegion | null;
    freeGeometry?: {
        position: FloatingWindowPosition;
        size: FloatingWindowSize;
    };
};
