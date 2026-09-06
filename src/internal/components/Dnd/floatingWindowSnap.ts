/** Snap-picker hit testing and the "tear off the edge" geometry, split out of
 *  FloatingWindow.tsx. Nothing here holds React state: the controller still owns the state and
 *  passes what these need, so the behavior and call order are unchanged. */
import type {
    FloatingWindowPosition,
    FloatingWindowSavedGeometry,
    FloatingWindowSnapRegion,
} from "../../persist/floatingWindowTypes.js";

/** Distance a press on an attached (maximized/snapped) window must travel before it detaches. */
export const DETACH_THRESHOLD = 8;

/** Which snap-layout tile, if any, sits under the pointer. */
export function snapRegionAtPoint(clientX: number, clientY: number): FloatingWindowSnapRegion | null {
    const hit = document.elementFromPoint?.(clientX, clientY) as HTMLElement | null | undefined;
    const region = hit?.closest<HTMLElement>("[data-wenay-snap-region]")?.dataset.wenaySnapRegion as FloatingWindowSnapRegion | undefined;
    return region ?? null;
}

/** Open the Windows 11-like layout picker near the top centre, then preview the hovered tile. */
export function updateSnapPicker(o: {
    snappable: boolean;
    snapLayoutVisibleRef: { current: boolean };
    setSnapLayoutVisible: (visible: boolean) => void;
    previewSnap: (region: FloatingWindowSnapRegion | null) => void;
}, clientX: number, clientY: number) {
    if (!o.snappable || typeof window == "undefined" || typeof document == "undefined") return;
    const nearTopCentre = clientY <= 34 && Math.abs(clientX - window.innerWidth / 2) <= 170;
    if (nearTopCentre && !o.snapLayoutVisibleRef.current) {
        o.snapLayoutVisibleRef.current = true;
        o.setSnapLayoutVisible(true);
    }
    if (!o.snapLayoutVisibleRef.current) return;
    o.previewSnap(snapRegionAtPoint(clientX, clientY));
}

/** Where a window shrinking back to `restored` should hang under the pointer, Windows-style:
 *  the title bar keeps the cursor near its middle so the drag continues from a sane grab point. */
export function detachPosition(restored: FloatingWindowSavedGeometry, clientX: number, clientY: number): FloatingWindowPosition {
    const restoredWidth = typeof restored.size.width == "number" ? restored.size.width : 320;
    return {
        x: Math.max(0, Math.min(clientX - restoredWidth / 2, Math.max(0, window.innerWidth - restoredWidth))),
        y: Math.max(0, clientY - 12),
    };
}

/** True while a press has not travelled far enough for the window to leave the edge. */
export function withinDetachThreshold(start: {x: number; y: number}, clientX: number, clientY: number) {
    return Math.abs(clientX - start.x) <= DETACH_THRESHOLD && Math.abs(clientY - start.y) <= DETACH_THRESHOLD;
}
