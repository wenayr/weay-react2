/** Pure geometry of the floating-window layer: drag clamping, snap regions and the snap-layout
 *  catalogue. No React state, no DOM writes - split out of FloatingWindow.tsx so it can be unit
 *  tested on its own and reused by the drag loop, the controller and the chrome without any of
 *  them importing the others. FloatingWindow.tsx re-exports whatever of this is public. */
import type {
    FloatingWindowPosition,
    FloatingWindowSavedGeometry,
    FloatingWindowSnapRegion,
} from "./FloatingWindowTypes.js";

/** Structural shape of FloatingWindowProps["limit"] - declared here so the clamp does not have
 *  to import the component's prop type (which would point this leaf back at the component). */
export type FloatingWindowLimit = {
    x?: { max?: number; min?: number };
    y?: { max?: number; min?: number };
};

export type FloatingWindowSnapLayout = {
    id: string;
    label: string;
    zones: Array<{region: FloatingWindowSnapRegion; gridArea: string}>;
};

export const snapRegionLabels: Record<FloatingWindowSnapRegion, string> = {
    left: "left",
    right: "right",
    top: "top",
    bottom: "bottom",
    "top-left": "top left",
    "top-right": "top right",
    "bottom-left": "bottom left",
    "bottom-right": "bottom right",
};

export const snapLayouts: FloatingWindowSnapLayout[] = [
    {
        id: "halves",
        label: "Two columns",
        zones: [
            {region: "left", gridArea: "1 / 1 / 3 / 2"},
            {region: "right", gridArea: "1 / 2 / 3 / 3"},
        ],
    },
    {
        id: "rows",
        label: "Two rows",
        zones: [
            {region: "top", gridArea: "1 / 1 / 2 / 3"},
            {region: "bottom", gridArea: "2 / 1 / 3 / 3"},
        ],
    },
    {
        id: "quarters",
        label: "Four quarters",
        zones: [
            {region: "top-left", gridArea: "1 / 1 / 2 / 2"},
            {region: "top-right", gridArea: "1 / 2 / 2 / 3"},
            {region: "bottom-left", gridArea: "2 / 1 / 3 / 2"},
            {region: "bottom-right", gridArea: "2 / 2 / 3 / 3"},
        ],
    },
];

/** Shared by the mouse and touch drag loops, which clamp identically. */
export function clampToLimit(x: number, y: number, lim: FloatingWindowLimit | undefined): FloatingWindowPosition {
    if (!lim) return {x, y};
    if (lim.x?.min !== undefined && lim.x.min > x) x = lim.x.min;
    if (lim.x?.max !== undefined && lim.x.max < x) x = lim.x.max;
    if (lim.y?.min !== undefined && lim.y.min > y) y = lim.y.min;
    if (lim.y?.max !== undefined && lim.y.max < y) y = lim.y.max;
    return {x, y};
}

export function snapPreviewStyle(region: FloatingWindowSnapRegion): React.CSSProperties {
    // A region occupies half the viewport on the axes it names and all of the other one:
    // the column halves are full height, the row halves full width, quarters neither.
    const right = region == "right" || region.endsWith("-right");
    const bottom = region == "bottom" || region.startsWith("bottom-");
    const fullHeight = region == "left" || region == "right";
    const fullWidth = region == "top" || region == "bottom";
    return {
        left: right ? "50%" : 6,
        top: bottom ? "50%" : 6,
        width: fullWidth ? "calc(100% - 12px)" : "calc(50% - 9px)",
        height: fullHeight ? "calc(100% - 12px)" : "calc(50% - 9px)",
    };
}

/** Target geometry for a snap region. Reads the viewport at call time (the caller already
 *  guards against SSR), so it stays a plain function rather than closing over the controller. */
export function snapGeometry(region: FloatingWindowSnapRegion): FloatingWindowSavedGeometry {
    const viewportWidth = typeof window == "undefined" ? 0 : window.innerWidth;
    const viewportHeight = typeof window == "undefined" ? 0 : window.innerHeight;
    const halfWidth = Math.floor(viewportWidth / 2);
    const halfHeight = Math.floor(viewportHeight / 2);
    switch (region) {
        case "left": return {position: {x: 0, y: 0}, size: {width: halfWidth, height: viewportHeight}};
        case "right": return {position: {x: halfWidth, y: 0}, size: {width: viewportWidth - halfWidth, height: viewportHeight}};
        case "top": return {position: {x: 0, y: 0}, size: {width: viewportWidth, height: halfHeight}};
        case "bottom": return {position: {x: 0, y: halfHeight}, size: {width: viewportWidth, height: viewportHeight - halfHeight}};
        case "top-left": return {position: {x: 0, y: 0}, size: {width: halfWidth, height: halfHeight}};
        case "top-right": return {position: {x: halfWidth, y: 0}, size: {width: viewportWidth - halfWidth, height: halfHeight}};
        case "bottom-left": return {position: {x: 0, y: halfHeight}, size: {width: halfWidth, height: viewportHeight - halfHeight}};
        case "bottom-right": return {position: {x: halfWidth, y: halfHeight}, size: {width: viewportWidth - halfWidth, height: viewportHeight - halfHeight}};
    }
}
