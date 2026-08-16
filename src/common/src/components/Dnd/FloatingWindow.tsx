import React, {
    ReactNode,
    useCallback,
    useContext,
    useEffect, useLayoutEffect,
    useRef,
    useState
} from "react";
import { Rnd, type RndResizeCallback } from "react-rnd";
import {createPortal} from "react-dom";
import {floatingWindowMap} from "../../utils/persistedMaps";
import {useDraggableApi} from "../../hooks/useDraggable";
import {cascadeWindowPosition, useFloatingDesktopWindow} from "./FloatingDesktop";
import type {
    FloatingWindowCloseReason,
    FloatingWindowMode,
    FloatingWindowPosition,
    FloatingWindowSavedGeometry,
    FloatingWindowSize,
    FloatingWindowSnapRegion,
} from "./FloatingWindowTypes";
export {FloatingWindowTaskbar, useFloatingWindowManager} from "./FloatingDesktop";
export type {FloatingDesktopWindow, FloatingWindowManager, FloatingWindowTaskbarProps} from "./FloatingDesktop";
export type {
    FloatingWindowCloseReason,
    FloatingWindowMode,
    FloatingWindowPosition,
    FloatingWindowSavedGeometry,
    FloatingWindowSize,
    FloatingWindowSnapRegion,
} from "./FloatingWindowTypes";
type tPosition = FloatingWindowPosition;
type tSize = FloatingWindowSize;
type tRND = FloatingWindowSavedGeometry;
export type FloatingWindowUpdate = {
    e: MouseEvent | TouchEvent;
    dir: string;
    elementRef: HTMLElement;
    delta: { width: number; height: number };
    position: FloatingWindowPosition;
};
export type FloatingWindowProps = {
    /** Stable public identity used by the window manager. */
    windowId?: string;
    /** Windows only reorder against peers in the same group. */
    stackGroup?: string;
    /** Persist a multi-window layout as `${layoutGroup}:${windowId}` without repeating keyForSave. */
    layoutGroup?: string;
    zIndex?: number;
    disableDragging?: () => boolean;
    keyForSave?: string;
    onUpdate?: (data: FloatingWindowUpdate) => void;
    position?: FloatingWindowPosition;
    size?: FloatingWindowSize;
    title?: ReactNode;
    taskbarLabel?: ReactNode;
    ariaLabel?: string;
    /** Enable maximize/restore behavior (double-click, two taps, keyboard and controller). */
    maximizable?: boolean;
    /** Render the maximize control. The behavior remains available when this is hidden. @default false */
    maximizeButton?: boolean;
    /** Enable minimize behavior through the button, keyboard, taskbar and controller. */
    minimizable?: boolean;
    /** Render the minimize control when minimizable. @default true */
    minimizeButton?: boolean;
    /** Enable the Windows 11-like layout picker while dragging near the top centre. */
    snappable?: boolean;
    defaultMaximized?: boolean;
    defaultMinimized?: boolean;
    onModeChange?: (mode: FloatingWindowMode) => void;
    onMinimizedChange?: (minimized: boolean) => void;
    onSnapChange?: (region: FloatingWindowSnapRegion | null) => void;
    onActiveChange?: (active: boolean) => void;
    onPositionChange?: (position: FloatingWindowPosition) => void;
    onSizeChange?: (size: FloatingWindowSize) => void;
    /** Modern close API with a reason. The legacy onClickClose remains supported. */
    onClose?: (reason: FloatingWindowCloseReason) => void;
    beforeClose?: (reason: FloatingWindowCloseReason) => boolean | Promise<boolean>;
    closable?: boolean;
    closeOnEscape?: boolean;
    moveOnlyHeader?: boolean;
    /** Show the close button and handle its click. */
    onClickClose?: () => void;
    /** @deprecated typo alias of {@link onClickClose}; kept for compatibility, `onClickClose` wins when both are set. */
    onCLickClose?: () => void;
    header?: React.ReactElement | boolean;
    overflow?: boolean;
    sizeByWindow?: boolean;
    /** Cascade windows that have neither a saved nor explicit position. */
    cascade?: boolean;
    /**
     * Render in the shared viewport layer (document.body) so ancestor stacking
     * contexts and overflow cannot trap the window. Disable only for a window
     * that intentionally belongs to a positioned parent.
     * @default true
     */
    portal?: boolean;
    /** Custom target for the viewport layer. Defaults to document.body. */
    portalContainer?: Element;
    limit?: {
        x?: { max?: number; min?: number };
        y?: { max?: number; min?: number };
    };
    children: React.ReactElement | ((update: number) => React.ReactElement);
    className?: string;
};
export type FloatingWindowControllerOptions = Omit<
    FloatingWindowProps,
    "children" | "className" | "header" | "moveOnlyHeader" | "overflow" | "onCLickClose" | "onClickClose" | "onClose" | "beforeClose" | "closable" | "closeOnEscape" | "portal" | "portalContainer" | "title" | "ariaLabel" | "maximizeButton" | "minimizeButton"
>;

export type FloatingWindowController = {
    position: FloatingWindowPosition;
    size: FloatingWindowSize;
    update: number;
    stackIndex: number;
    zIndex: number;
    overlayZIndex: number;
    dragging: boolean;
    active: boolean;
    mode: FloatingWindowMode;
    minimized: boolean;
    snapRegion: FloatingWindowSnapRegion | null;
    snapLayoutVisible: boolean;
    snapPreview: FloatingWindowSnapRegion | null;
    windowRef: React.RefObject<HTMLDivElement | null>;
    headerRef: React.RefObject<HTMLDivElement | null>;
    bringToFront(): void;
    maximize(): void;
    restore(): void;
    toggleMaximize(): void;
    minimize(): void;
    unminimize(): void;
    snapTo(region: FloatingWindowSnapRegion): void;
    showSnapLayout(): void;
    hideSnapLayout(): void;
    previewSnap(region: FloatingWindowSnapRegion | null): void;
    onWindowPointerDown: React.PointerEventHandler<HTMLDivElement>;
    onHeaderTouchStart: React.TouchEventHandler<HTMLDivElement>;
    onHeaderTouchEnd: React.TouchEventHandler<HTMLDivElement>;
    onHeaderMouseDown: React.MouseEventHandler<HTMLDivElement>;
    onHeaderDoubleClick: React.MouseEventHandler<HTMLDivElement>;
    onWindowMouseDown: React.MouseEventHandler<HTMLDivElement>;
    onWindowKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
    onResize: RndResizeCallback;
    onResizeStop: RndResizeCallback;
};

// Map of all popup window sizes; declared in utils/persistedMaps (memoryCache registry must not
// import the component layer) and re-exported here so the public surface is unchanged
export { floatingWindowMap };

const WindowPortalContext = React.createContext<Element | null>(null);

export function useWindowPortalContainer() {
    return useContext(WindowPortalContext);
}

/** Portal a popup/menu/tooltip into the stacking context of its owning window. */
export function WindowPortal({children, className, style}: {
    children: ReactNode;
    className?: string;
    style?: React.CSSProperties;
}) {
    const container = useWindowPortalContainer();
    if (!container) return <>{children}</>;
    return createPortal(
        <div className={className} style={{position: "absolute", zIndex: 2147483646, pointerEvents: "auto", ...style}}>
            {children}
        </div>,
        container,
    );
}

const snapRegionLabels: Record<FloatingWindowSnapRegion, string> = {
    left: "left",
    right: "right",
    "top-left": "top left",
    "top-right": "top right",
    "bottom-left": "bottom left",
    "bottom-right": "bottom right",
};

type FloatingWindowSnapLayout = {
    id: string;
    label: string;
    zones: Array<{region: FloatingWindowSnapRegion; gridArea: string}>;
};

const snapLayouts: FloatingWindowSnapLayout[] = [
    {
        id: "halves",
        label: "Two columns",
        zones: [
            {region: "left", gridArea: "1 / 1 / 3 / 2"},
            {region: "right", gridArea: "1 / 2 / 3 / 3"},
        ],
    },
    {
        id: "left-stack",
        label: "Left and stacked right",
        zones: [
            {region: "left", gridArea: "1 / 1 / 3 / 2"},
            {region: "top-right", gridArea: "1 / 2 / 2 / 3"},
            {region: "bottom-right", gridArea: "2 / 2 / 3 / 3"},
        ],
    },
    {
        id: "right-stack",
        label: "Stacked left and right",
        zones: [
            {region: "top-left", gridArea: "1 / 1 / 2 / 2"},
            {region: "bottom-left", gridArea: "2 / 1 / 3 / 2"},
            {region: "right", gridArea: "1 / 2 / 3 / 3"},
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

function snapPreviewStyle(region: FloatingWindowSnapRegion): React.CSSProperties {
    const left = region == "left" || region.endsWith("-left");
    const right = region == "right" || region.endsWith("-right");
    const top = region.startsWith("top-");
    const bottom = region.startsWith("bottom-");
    return {
        left: left ? 6 : right ? "50%" : 6,
        top: top ? 6 : bottom ? "50%" : 6,
        width: region == "left" || region == "right" ? "calc(50% - 9px)" : "calc(50% - 9px)",
        height: region == "left" || region == "right" ? "calc(100% - 12px)" : "calc(50% - 9px)",
    };
}

// Freezes the subtree until update changes (intentionally ignores render closure changes) -
// the previous useMemo-in-callback semantics, but without calling a hook from an arbitrary place
const MemoChild = React.memo(
    ({ update, render }: { update: number; render: (u: number) => React.ReactElement }) => render(update),
    (prev, next) => prev.update === next.update
);

export const FloatingWindow: typeof FloatingWindowBase = (a) => {
    // Only the render-prop form is frozen between `update` bumps. A plain element child is
    // re-created by the caller on every parent render, so wrapping it in MemoChild (whose
    // `update` would be pinned to 0) froze the subtree at its first render for good.
    const render = a.children;
    if (typeof render !== "function") return <FloatingWindowBase {...a} />;
    const ff = (update: number) => <MemoChild update={update} render={render} />;

    return <FloatingWindowBase {...a} children={ff} />;
};


export function useFloatingWindowController({
    windowId,
    stackGroup = "window",
    layoutGroup,
    keyForSave,
    position,
    size,
    taskbarLabel,
    zIndex = 9,
    onUpdate,
    limit,
    sizeByWindow = true,
    disableDragging,
    maximizable = true,
    minimizable = false,
    snappable = true,
    cascade = true,
    defaultMaximized = false,
    defaultMinimized = false,
    onModeChange,
    onMinimizedChange,
    onSnapChange,
    onActiveChange,
    onPositionChange,
    onSizeChange,
}: FloatingWindowControllerOptions = {}): FloatingWindowController {
    const desktop = useFloatingDesktopWindow({windowId, group: stackGroup, baseZIndex: zIndex, label: taskbarLabel});
    const ks = keyForSave ?? (layoutGroup && windowId ? `${layoutGroup}:${windowId}` : undefined);
    const positionDef: tPosition = { ...(cascade ? cascadeWindowPosition(desktop.entry.key) : {x: 0, y: 0}), ...(position ?? {}) };
    const sizeDef: tSize = { height: 0, width: 0, ...(size ?? {}) };

    let map: tRND | undefined;
    if (ks) {
        map = floatingWindowMap.get(ks) ?? floatingWindowMap.set(ks, { size: sizeDef, position: positionDef }).get(ks);
    }
    const persistedMapRef = useRef<tRND | undefined>(map);
    persistedMapRef.current = map;
    const appliedMapRef = useRef<tRND | undefined>(map);
    const savedPosition = map?.position ?? positionDef;
    const savedSize = map?.size ?? sizeDef;

    const stack = desktop.stack;

    const lastC = useRef<{ x: number; y: number } | null>(null);
    const lastT = useRef<{ x: number; y: number; id: number } | null>(null);
    const touchTap = useRef<{
        start?: {x: number; y: number};
        moved: boolean;
        last?: {time: number; x: number; y: number};
    }>({moved: false});
    const [a, setA] = useState(false);
    const [b, setB] = useState(false);

    const [x, setX] = useState(savedPosition.x);
    const [y, setY] = useState(savedPosition.y);
    const [width, setWidth] = useState(savedSize.width);
    const [height, setHeight] = useState(savedSize.height);
    const [update, setUpdate] = useState(0);
    const [mode, setMode] = useState<FloatingWindowMode>(defaultMaximized ? "maximized" : "normal");
    const [minimized, setMinimized] = useState(defaultMinimized);
    const [snapRegion, setSnapRegion] = useState<FloatingWindowSnapRegion | null>(map?.snapRegion ?? null);
    const [snapLayoutVisible, setSnapLayoutVisible] = useState(false);
    const [snapPreview, setSnapPreview] = useState<FloatingWindowSnapRegion | null>(null);
    const snapPreviewRef = useRef<FloatingWindowSnapRegion | null>(null);
    const restoreGeometry = useRef<FloatingWindowSavedGeometry>({
        position: {...savedPosition},
        size: {...savedSize},
    });
    const unsnappedGeometry = useRef<FloatingWindowSavedGeometry>({
        position: {...(map?.freeGeometry?.position ?? savedPosition)},
        size: {...(map?.freeGeometry?.size ?? savedSize)},
    });
    const callbacksRef = useRef({onModeChange, onMinimizedChange, onSnapChange, onActiveChange, onPositionChange, onSizeChange});
    callbacksRef.current = {onModeChange, onMinimizedChange, onSnapChange, onActiveChange, onPositionChange, onSizeChange};
    const snapLayoutVisibleRef = useRef(snapLayoutVisible);
    snapLayoutVisibleRef.current = snapLayoutVisible;

    const commitPosition = (next: FloatingWindowPosition) => {
        setX(next.x);
        setY(next.y);
        callbacksRef.current.onPositionChange?.(next);
    };
    const commitSize = (next: FloatingWindowSize) => {
        setWidth(next.width);
        setHeight(next.height);
        callbacksRef.current.onSizeChange?.(next);
    };
    const changeMode = (next: FloatingWindowMode) => {
        setMode(next);
        callbacksRef.current.onModeChange?.(next);
    };
    const changeMinimized = (next: boolean) => {
        setMinimized(next);
        callbacksRef.current.onMinimizedChange?.(next);
    };
    const changeSnapRegion = (next: FloatingWindowSnapRegion | null) => {
        setSnapRegion(next);
        if (persistedMapRef.current) {
            persistedMapRef.current.snapRegion = next;
            if (ks) floatingWindowMap.touch(ks);
        }
        callbacksRef.current.onSnapChange?.(next);
    };
    const previewSnap = (next: FloatingWindowSnapRegion | null) => {
        snapPreviewRef.current = next;
        setSnapPreview(next);
    };
    const hideSnapLayout = () => {
        setSnapLayoutVisible(false);
        previewSnap(null);
    };
    const snapGeometry = (region: FloatingWindowSnapRegion): FloatingWindowSavedGeometry => {
        const viewportWidth = typeof window == "undefined" ? 0 : window.innerWidth;
        const viewportHeight = typeof window == "undefined" ? 0 : window.innerHeight;
        const halfWidth = Math.floor(viewportWidth / 2);
        const halfHeight = Math.floor(viewportHeight / 2);
        switch (region) {
            case "left": return {position: {x: 0, y: 0}, size: {width: halfWidth, height: viewportHeight}};
            case "right": return {position: {x: halfWidth, y: 0}, size: {width: viewportWidth - halfWidth, height: viewportHeight}};
            case "top-left": return {position: {x: 0, y: 0}, size: {width: halfWidth, height: halfHeight}};
            case "top-right": return {position: {x: halfWidth, y: 0}, size: {width: viewportWidth - halfWidth, height: halfHeight}};
            case "bottom-left": return {position: {x: 0, y: halfHeight}, size: {width: halfWidth, height: viewportHeight - halfHeight}};
            case "bottom-right": return {position: {x: halfWidth, y: halfHeight}, size: {width: viewportWidth - halfWidth, height: viewportHeight - halfHeight}};
        }
    };
    const snapTo = (region: FloatingWindowSnapRegion) => {
        if (!snappable || typeof window == "undefined") return;
        if (!snapRegion && mode == "normal") {
            unsnappedGeometry.current = {position: {x, y}, size: {width, height}};
            if (persistedMapRef.current) persistedMapRef.current.freeGeometry = {
                position: {...unsnappedGeometry.current.position},
                size: {...unsnappedGeometry.current.size},
            };
        }
        const geometry = snapGeometry(region);
        commitPosition(geometry.position);
        commitSize(geometry.size);
        changeSnapRegion(region);
        hideSnapLayout();
    };

    // The application loads storage after mount, so a window can render once with
    // defaults before memoryCache replaces its entry. Object identity separates that
    // hydration from this controller's own in-place geometry edits.
    useEffect(() => {
        if (!ks) return;
        const applyPersistedEntry = (changedKey?: string) => {
            if (changedKey !== undefined && changedKey !== ks) return;
            const next = floatingWindowMap.get(ks);
            if (!next || next === appliedMapRef.current) return;
            appliedMapRef.current = next;
            persistedMapRef.current = next;
            const free = next.freeGeometry ?? next;
            unsnappedGeometry.current = {
                position: {...free.position},
                size: {...free.size},
            };
            restoreGeometry.current = {
                position: {...next.position},
                size: {...next.size},
            };
            const nextSnap = next.snapRegion ?? null;
            setSnapRegion(nextSnap);
            callbacksRef.current.onSnapChange?.(nextSnap);
            if (nextSnap && snappable && typeof window !== "undefined") {
                const geometry = snapGeometry(nextSnap);
                setX(geometry.position.x);
                setY(geometry.position.y);
                setWidth(geometry.size.width);
                setHeight(geometry.size.height);
            } else {
                setX(next.position.x);
                setY(next.position.y);
                setWidth(next.size.width);
                setHeight(next.size.height);
            }
        };
        applyPersistedEntry();
        return floatingWindowMap.onChange(applyPersistedEntry);
    }, [ks, snappable]);

    const maximize = () => {
        if (!maximizable || mode == "maximized" || typeof window == "undefined") return;
        restoreGeometry.current = {position: {x, y}, size: {width, height}};
        commitPosition({x: 0, y: 0});
        commitSize({width: window.innerWidth, height: window.innerHeight});
        changeMode("maximized");
        hideSnapLayout();
    };
    const restore = () => {
        if (mode == "normal") return;
        commitPosition({...restoreGeometry.current.position});
        commitSize({...restoreGeometry.current.size});
        changeMode("normal");
    };
    const toggleMaximize = () => mode == "maximized" ? restore() : maximize();
    const minimize = () => {
        if (!minimizable || minimized) return;
        changeMinimized(true);
    };
    const unminimize = () => {
        if (!minimized) {
            desktop.bringToFront();
            return;
        }
        changeMinimized(false);
        desktop.bringToFront();
    };

    useLayoutEffect(() => {
        desktop.sync({minimized, mode, snapRegion, actions: {minimize, restore: unminimize}});
    }, [minimized, mode, snapRegion]);

    const updateSnapPicker = (clientX: number, clientY: number) => {
        if (!snappable || typeof window == "undefined" || typeof document == "undefined") return;
        const nearTopCentre = clientY <= 34 && Math.abs(clientX - window.innerWidth / 2) <= 170;
        if (nearTopCentre && !snapLayoutVisibleRef.current) {
            snapLayoutVisibleRef.current = true;
            setSnapLayoutVisible(true);
        }
        if (!snapLayoutVisibleRef.current) return;
        const hit = document.elementFromPoint?.(clientX, clientY) as HTMLElement | null | undefined;
        const region = hit?.closest<HTMLElement>("[data-wenay-snap-region]")?.dataset.wenaySnapRegion as FloatingWindowSnapRegion | undefined;
        previewSnap(region ?? null);
    };

    const restoreFreeGeometry = () => {
        const restored = unsnappedGeometry.current;
        commitPosition({...restored.position});
        commitSize({...restored.size});
        changeSnapRegion(null);
    };

    const detachSnappedForDrag = (clientX: number, clientY: number) => {
        if (!snapRegion) return {x, y};
        const restored = unsnappedGeometry.current;
        const restoredWidth = typeof restored.size.width == "number" ? restored.size.width : 320;
        const next = {
            x: Math.max(0, Math.min(clientX - restoredWidth / 2, Math.max(0, window.innerWidth - restoredWidth))),
            y: Math.max(0, clientY - 12),
        };
        commitSize({...restored.size});
        commitPosition(next);
        changeSnapRegion(null);
        return next;
    };

    const announcedActive = useRef<boolean | null>(null);
    useEffect(() => {
        if (announcedActive.current == stack.active) return;
        announcedActive.current = stack.active;
        callbacksRef.current.onActiveChange?.(stack.active);
    }, [stack.active]);

    const limitRef = useRef(limit);
    useLayoutEffect(() => { limitRef.current = limit; });
    const disableDraggingRef = useRef(disableDragging);
    useLayoutEffect(() => { disableDraggingRef.current = disableDragging; });

    useEffect(() => {
        const mouseMoveHandler = (e: MouseEvent) => {
            e.stopPropagation();
            if (lastC.current == null) return;
            const data = lastC.current;
            if (e.buttons === 1) {
                let newX = e.clientX + data.x;
                let newY = e.clientY + data.y;
                updateSnapPicker(e.clientX, e.clientY);
                const lim = limitRef.current;
                if (lim) {
                    if (lim.x?.min !== undefined && lim.x.min > newX) newX = lim.x.min;
                    if (lim.x?.max !== undefined && lim.x.max < newX) newX = lim.x.max;

                    if (lim.y?.min !== undefined && lim.y.min > newY) newY = lim.y.min;
                    if (lim.y?.max !== undefined && lim.y.max < newY) newY = lim.y.max;
                }
                commitPosition({x: newX, y: newY});
            } else {
                mouseUpHandler();
            }
        };
        const mouseUpHandler = () => {
            const target = snapPreviewRef.current;
            document.removeEventListener("mouseup", mouseUpHandler);
            document.removeEventListener("mousemove", mouseMoveHandler);
            lastC.current = null;
            setA(false);
            if (target) snapTo(target);
            else hideSnapLayout();
            if (ks) floatingWindowMap.touch(ks);
        };

        const touchMoveHandler = (e: TouchEvent) => {
            const data = lastT.current;
            if (!data) return touchEndHandler(e);

            let t: Touch | null = null;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const zz = e.changedTouches[i];
                if (zz.identifier === data.id) t = zz;
            }
            if (!t) return;
            updateSnapPicker(t.clientX, t.clientY);

            const tapStart = touchTap.current.start;
            if (tapStart && (Math.abs(t.clientX - tapStart.x) > 8 || Math.abs(t.clientY - tapStart.y) > 8)) {
                touchTap.current.moved = true;
            }

            let newX = t.clientX + data.x;
            let newY = t.clientY + data.y;
            const lim = limitRef.current;
            if (lim) {
                if (lim.x?.min !== undefined && lim.x.min > newX) newX = lim.x.min;
                if (lim.x?.max !== undefined && lim.x.max < newX) newX = lim.x.max;

                if (lim.y?.min !== undefined && lim.y.min > newY) newY = lim.y.min;
                if (lim.y?.max !== undefined && lim.y.max < newY) newY = lim.y.max;
            }
            commitPosition({x: newX, y: newY});
        };
        const touchEndHandler = (e: TouchEvent) => {
            const data = lastT.current;
            if (data) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const zz = e.changedTouches[i];
                    if (zz.identifier === data.id) {
                        lastT.current = null;
                    }
                }
            }
            if (lastT.current == null) {
                const target = snapPreviewRef.current;
                document.removeEventListener("touchend", touchEndHandler);
                document.removeEventListener("touchmove", touchMoveHandler);
                setB(false);
                if (target) snapTo(target);
                else hideSnapLayout();
                if (ks) floatingWindowMap.touch(ks);
            }
        };

        if (a) {
            document.addEventListener("mousemove", mouseMoveHandler);
            document.addEventListener("mouseup", mouseUpHandler);
        }
        if (b) {
            document.addEventListener("touchmove", touchMoveHandler);
            document.addEventListener("touchend", touchEndHandler);
        }

        return () => {
            document.removeEventListener("mousemove", mouseMoveHandler);
            document.removeEventListener("mouseup", mouseUpHandler);
            document.removeEventListener("touchmove", touchMoveHandler);
            document.removeEventListener("touchend", touchEndHandler);
        };
    }, [a, b]);

    if (mode == "normal") {
        savedSize.height = height;
        savedSize.width = width;
        savedPosition.x = x;
        savedPosition.y = y;
    }

    const windowRef = useRef<HTMLDivElement | null>(null);
    const headerRef = useRef<HTMLDivElement | null>(null);
    const [viewportRevision, setViewportRevision] = useState(0);
    useEffect(() => {
        if (!sizeByWindow || typeof window == "undefined") return;
        const onViewportResize = () => setViewportRevision(value => value + 1);
        window.addEventListener("resize", onViewportResize);
        return () => window.removeEventListener("resize", onViewportResize);
    }, [sizeByWindow]);

    useLayoutEffect(() => {
        if (typeof window == "undefined") return;
        if (mode == "maximized") {
            commitPosition({x: 0, y: 0});
            commitSize({width: window.innerWidth, height: window.innerHeight});
        } else if (snapRegion) {
            const geometry = snapGeometry(snapRegion);
            commitPosition(geometry.position);
            commitSize(geometry.size);
        }
    }, [mode, viewportRevision, snapRegion]);

    useLayoutEffect(() => {
        const el = windowRef.current;
        if (!el || !sizeByWindow || typeof window == "undefined") return;
        const rect = el.getBoundingClientRect();
        const outer = Array.from(el.querySelectorAll<HTMLElement>(".wenayWndClose, .wenayWndControl"))
            .map(node => node.getBoundingClientRect())
            .reduce<{left: number; right: number; top: number; bottom: number}>((bounds, chrome) => ({
                left: Math.min(bounds.left, chrome.left),
                right: Math.max(bounds.right, chrome.right),
                top: Math.min(bounds.top, chrome.top),
                bottom: Math.max(bounds.bottom, chrome.bottom),
            }), rect);
        const outerWidth = outer.right - outer.left;
        const outerHeight = outer.bottom - outer.top;
        let nextX = x;
        let nextY = y;
        if (outerWidth > window.innerWidth) nextX -= outer.left;
        else if (outer.left < 0) nextX -= outer.left;
        else if (outer.right > window.innerWidth) nextX -= outer.right - window.innerWidth;
        if (outerHeight > window.innerHeight) nextY -= outer.top;
        else if (outer.top < 0) nextY -= outer.top;
        else if (outer.bottom > window.innerHeight) nextY -= outer.bottom - window.innerHeight;
        if (mode != "normal") return;
        if (nextX !== x || nextY !== y) commitPosition({x: nextX, y: nextY});
        const chromeWidth = Math.max(0, rect.left - outer.left) + Math.max(0, outer.right - rect.right);
        const chromeHeight = Math.max(0, rect.top - outer.top) + Math.max(0, outer.bottom - rect.bottom);
        const maxWindowWidth = Math.max(0, window.innerWidth - chromeWidth);
        const maxWindowHeight = Math.max(0, window.innerHeight - chromeHeight);
        if (typeof width === "number" && width > maxWindowWidth) {
            commitSize({width: maxWindowWidth, height});
        }
        if (typeof height === "number" && height > maxWindowHeight) {
            commitSize({width: typeof width == "number" && width > maxWindowWidth ? maxWindowWidth : width, height: maxWindowHeight});
        }
    }, [x, y, width, height, sizeByWindow, viewportRevision, mode]);

    const onHeaderTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
        const t = e.changedTouches[0];
        if (t) touchTap.current = {...touchTap.current, start: {x: t.clientX, y: t.clientY}, moved: false};
        if (mode == "maximized" || disableDraggingRef.current?.()) return;
        if (t) {
            const startPosition = detachSnappedForDrag(t.clientX, t.clientY);
            lastT.current = {
                x: startPosition.x - t.clientX,
                y: startPosition.y - t.clientY,
                id: t.identifier
            };
        }
        setB(true);
    };

    const onHeaderTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
        const touch = e.changedTouches[0];
        const start = touchTap.current.start;
        if (!touch || !start || touchTap.current.moved || !maximizable) return;
        const now = Date.now();
        const previous = touchTap.current.last;
        if (
            previous &&
            now - previous.time <= 350 &&
            Math.abs(touch.clientX - previous.x) <= 24 &&
            Math.abs(touch.clientY - previous.y) <= 24
        ) {
            touchTap.current.last = undefined;
            toggleMaximize();
        } else {
            touchTap.current.last = {time: now, x: touch.clientX, y: touch.clientY};
        }
    };

    const onHeaderMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
        if (mode == "maximized" || disableDraggingRef.current?.()) return;
        const startPosition = detachSnappedForDrag(e.clientX, e.clientY);
        lastC.current = {
            x: startPosition.x - e.clientX,
            y: startPosition.y - e.clientY
        };
        setA(true);
    };
    const onHeaderDoubleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
        if (!maximizable) return;
        e.preventDefault();
        toggleMaximize();
    };

    const bringToFront = desktop.bringToFront;
    const onWindowMouseDown: React.MouseEventHandler<HTMLDivElement> = bringToFront;
    const onWindowPointerDown: React.PointerEventHandler<HTMLDivElement> = bringToFront;

    const onWindowKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
        const target = e.target as HTMLElement;
        if (target.matches("input, textarea, select, button, [contenteditable='true']")) return;
        if (e.metaKey && !e.altKey && e.key.startsWith("Arrow")) {
            e.preventDefault();
            if (e.key == "ArrowLeft") snapTo("left");
            else if (e.key == "ArrowRight") snapTo("right");
            else if (e.key == "ArrowUp") maximize();
            else if (mode == "maximized") restore();
            else if (snapRegion) restoreFreeGeometry();
            else minimize();
            return;
        }
        if (e.altKey && e.key == "Enter") {
            e.preventDefault();
            toggleMaximize();
            return;
        }
        if (!e.altKey || mode != "normal" || !e.key.startsWith("Arrow")) return;
        e.preventDefault();
        const delta = e.shiftKey ? 20 : 10;
        if (e.ctrlKey || e.metaKey) {
            if (typeof width != "number" || typeof height != "number") return;
            commitSize({
                width: Math.max(80, width + (e.key == "ArrowRight" ? delta : e.key == "ArrowLeft" ? -delta : 0)),
                height: Math.max(40, height + (e.key == "ArrowDown" ? delta : e.key == "ArrowUp" ? -delta : 0)),
            });
        } else {
            commitPosition({
                x: x + (e.key == "ArrowRight" ? delta : e.key == "ArrowLeft" ? -delta : 0),
                y: y + (e.key == "ArrowDown" ? delta : e.key == "ArrowUp" ? -delta : 0),
            });
        }
        if (ks) floatingWindowMap.touch(ks);
    };

    const onResizeStop: RndResizeCallback = (e, dir, elementRef, delta, { x: nx, y: ny }) => {
        commitPosition({x: nx, y: ny});
        commitSize({height: elementRef.offsetHeight, width: elementRef.offsetWidth});
        setUpdate(value => value + 1);
        if (ks) floatingWindowMap.touch(ks);
    };

    const onResize: RndResizeCallback = (e, dir, elementRef, delta, pos) => {
        onUpdate?.({ e, dir, elementRef, delta, position: pos });
    };

    const windowZIndex = stack.zIndex;
    return {
        position: { x, y },
        size: { width, height },
        update,
        stackIndex: stack.index,
        zIndex: windowZIndex,
        overlayZIndex: windowZIndex + 1,
        dragging: a || b,
        active: stack.active,
        mode,
        minimized,
        snapRegion,
        snapLayoutVisible,
        snapPreview,
        windowRef,
        headerRef,
        bringToFront,
        maximize,
        restore,
        toggleMaximize,
        minimize,
        unminimize,
        snapTo,
        showSnapLayout: () => setSnapLayoutVisible(true),
        hideSnapLayout,
        previewSnap,
        onWindowPointerDown,
        onHeaderTouchStart,
        onHeaderTouchEnd,
        onHeaderMouseDown,
        onHeaderDoubleClick,
        onWindowMouseDown,
        onWindowKeyDown,
        onResize,
        onResizeStop,
    };
}

/**
 * Wrapper component around react-rnd.
 * Provides dragging and resizing, an optional header, and a close button.
 */
export function FloatingWindowBase({
                                children,
                                windowId,
                                stackGroup = "window",
                                layoutGroup,
                                keyForSave: ks,
                                position,
                                size,
                                title,
                                taskbarLabel,
                                ariaLabel,
                                maximizable,
                                maximizeButton,
                                minimizable,
                                minimizeButton,
                                snappable,
                                defaultMaximized = false,
                                defaultMinimized = false,
                                onModeChange,
                                onMinimizedChange,
                                onSnapChange,
                                onActiveChange,
                                onPositionChange,
                                onSizeChange,
                                overflow = true,
                                zIndex = 9,
                                onUpdate,
                                disableDragging,
                                className,
                                header,
                                moveOnlyHeader,
                                limit,
                                onCLickClose,
                                onClickClose,
                                onClose,
                                beforeClose,
                                closable,
                                closeOnEscape = false,
                                sizeByWindow = true,
                                cascade,
                                portal = true,
                                portalContainer,
                            }: FloatingWindowProps) {
    const clickClose = onClickClose ?? onCLickClose;
    const showClose = closable ?? !!(onClose || clickClose);
    const portalEnabled = portal && typeof document != "undefined";
    const canMaximize = maximizable ?? portalEnabled;
    const canMinimize = minimizable ?? false;
    const canSnap = snappable ?? portalEnabled;
    const showMaximizeButton = canMaximize && (maximizeButton ?? false);
    const showMinimizeButton = canMinimize && (minimizeButton ?? true);
    // `limit` remains coordinate-system-relative. The default portal uses viewport
    // coordinates; an embedded portal={false} window uses its positioned parent.
    // The sizeByWindow clamp independently keeps the whole window in the viewport.

    const controller = useFloatingWindowController({
        windowId,
        stackGroup,
        layoutGroup,
        keyForSave: ks,
        position,
        size,
        taskbarLabel: taskbarLabel ?? title ?? windowId,
        zIndex,
        onUpdate,
        disableDragging,
        limit,
        sizeByWindow,
        maximizable: canMaximize,
        minimizable: canMinimize,
        snappable: canSnap,
        cascade: cascade ?? portalEnabled,
        defaultMaximized,
        defaultMinimized,
        onModeChange,
        onMinimizedChange,
        onSnapChange,
        onActiveChange,
        onPositionChange,
        onSizeChange,
    });

    const requestClose = (reason: FloatingWindowCloseReason) => {
        const finish = () => {
            if (onClose) onClose(reason);
            else clickClose?.();
        };
        const verdict = beforeClose?.(reason);
        if (verdict && typeof (verdict as Promise<boolean>).then == "function") {
            void Promise.resolve(verdict).then(allowed => { if (allowed !== false) finish(); });
        } else if (verdict !== false) {
            finish();
        }
    };

    useEffect(() => {
        if (!closeOnEscape || !controller.active || !showClose) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key != "Escape") return;
            event.preventDefault();
            requestClose("escape");
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [closeOnEscape, controller.active, showClose, beforeClose, onClose, clickClose]);

    const showHeader = !!(moveOnlyHeader || header || title != null);

    const headerD = (
        <div
            ref={controller.headerRef}
            className="wenayWndHeader"
            onTouchStart={controller.onHeaderTouchStart}
            onTouchEnd={controller.onHeaderTouchEnd}
            onMouseDown={controller.onHeaderMouseDown}
            onDoubleClick={controller.onHeaderDoubleClick}
        >
            {header ?? (title != null
                ? <div className="wenayWndTitle">{title}</div>
                : <div className="wenayWndHeaderDef"></div>)}
        </div>
    );

    const [portalRoot, setPortalRoot] = useState<HTMLDivElement | null>(null);
    const [windowRoot, setWindowRoot] = useState<HTMLDivElement | null>(null);
    const setWindowRef = useCallback((node: HTMLDivElement | null) => {
        controller.windowRef.current = node;
        setWindowRoot(node);
    }, [controller.windowRef]);
    const rootClassName = [
        className,
        "wenayWindowRoot",
        controller.active && "wenayWindowRoot_active",
        controller.mode == "maximized" && "wenayWindowRoot_maximized",
        controller.snapRegion && "wenayWindowRoot_snapped",
        controller.minimized && "wenayWindowRoot_minimized",
    ].filter(Boolean).join(" ");

    const windowNode = (
        <Rnd
            disableDragging={true}
            enableResizing={controller.mode == "normal"}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: controller.zIndex,
                isolation: "isolate",
                pointerEvents: "auto",
                display: controller.minimized ? "none" : undefined,
            }}
            data-wenay-window=""
            data-window-id={windowId}
            data-wenay-window-layer={portalEnabled ? "viewport" : "parent"}
            data-active={controller.active ? "true" : "false"}
            data-mode={controller.mode}
            data-minimized={controller.minimized ? "true" : "false"}
            data-snap-region={controller.snapRegion ?? undefined}
            data-position-x={controller.position.x}
            data-position-y={controller.position.y}
            role="dialog"
            aria-label={ariaLabel ?? (typeof title == "string" ? title : undefined)}
            tabIndex={0}
            className={rootClassName}
            onKeyDown={controller.onWindowKeyDown}
            onResizeStop={controller.onResizeStop}
            onResize={controller.onResize}
            position={controller.position}
            size={controller.size}
        >
            <div
                ref={setWindowRef}
                className="wenayWnd"
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                    flex: "auto"
                }}
                onMouseDown={controller.onWindowMouseDown}
                onPointerDown={controller.onWindowPointerDown}
            >
                {showHeader ? headerD : null}
                <div className="maxSize" style={{ overflow: overflow ? "auto" : undefined }}>
                    {controller.dragging && (
                        <div
                            className="maxSize"
                            style={{
                                position: "absolute",
                                zIndex: controller.overlayZIndex
                            }}
                        ></div>
                    )}
                    {typeof children === "function" ? children(controller.update) : children}
                </div>
                {showHeader && showMinimizeButton && (
                    <button
                        type="button"
                        className="wenayWndControl wenayWndMinimize"
                        title="Minimize"
                        aria-label="Minimize"
                        onMouseDown={event => event.stopPropagation()}
                        onPointerDown={event => event.stopPropagation()}
                        onClick={controller.minimize}
                    >
                        <span aria-hidden="true" />
                    </button>
                )}
                {showHeader && showMaximizeButton && (
                    <button
                        type="button"
                        className="wenayWndControl wenayWndMaximize"
                        title={controller.mode == "maximized" ? "Restore" : "Maximize"}
                        aria-label={controller.mode == "maximized" ? "Restore" : "Maximize"}
                        aria-pressed={controller.mode == "maximized"}
                        onMouseDown={event => event.stopPropagation()}
                        onPointerDown={event => event.stopPropagation()}
                        onClick={() => {
                            controller.bringToFront();
                            controller.toggleMaximize();
                        }}
                    >
                        <span aria-hidden="true" />
                    </button>
                )}
                {showClose && (
                    <button
                        type="button"
                        key="323"
                        className="wenayCloseBtn wenayWndClose"
                        title="Close"
                        aria-label="Close"
                        style={{
                            zIndex: controller.overlayZIndex
                        }}
                        onMouseDown={event => event.stopPropagation()}
                        onPointerDown={event => event.stopPropagation()}
                        onClick={() => requestClose("close-button")}
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                            <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                        </svg>
                    </button>
                )}
            </div>
        </Rnd>
    );

    const snapLayout = canSnap && controller.snapLayoutVisible ? (
        <>
            {controller.snapPreview && <div className="wenaySnapPreview" style={snapPreviewStyle(controller.snapPreview)} aria-hidden="true" />}
            <div className="wenaySnapLayout" role="toolbar" aria-label="Snap layouts">
                {snapLayouts.map(layout => (
                    <div key={layout.id} className="wenaySnapLayoutPreset" role="group" aria-label={layout.label} data-layout={layout.id}>
                        {layout.zones.map(zone => (
                            <button
                                type="button"
                                key={zone.region}
                                className="wenaySnapLayoutZone"
                                style={{gridArea: zone.gridArea}}
                                data-wenay-snap-region={zone.region}
                                data-preview={controller.snapPreview == zone.region ? "true" : "false"}
                                aria-label={`${layout.label}: ${snapRegionLabels[zone.region]}`}
                                onPointerEnter={() => controller.previewSnap(zone.region)}
                                onMouseEnter={() => controller.previewSnap(zone.region)}
                                onFocus={() => controller.previewSnap(zone.region)}
                                onClick={() => controller.snapTo(zone.region)}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </>
    ) : null;

    if (!portalEnabled) return <WindowPortalContext.Provider value={windowRoot}>{windowNode}</WindowPortalContext.Provider>;
    return createPortal(
        <div
            ref={setPortalRoot}
            data-wenay-window-portal-root=""
            style={{
                position: "fixed",
                inset: 0,
                zIndex: controller.zIndex,
                isolation: "isolate",
                pointerEvents: "none",
            }}
        >
            {snapLayout}
            <WindowPortalContext.Provider value={portalRoot}>{windowNode}</WindowPortalContext.Provider>
        </div>,
        portalContainer ?? document.body,
    );
}

// Removed unused demo components Drag3 and DragBig3
// Use DragBox for functional draggable behavior

export type DragBoxProps = {
    /** Child element that should be draggable */
    children: ReactNode;

    /** Callback when the X coordinate changes */
    onX?: (val: number) => void;

    /** Callback when the Y coordinate changes */
    onY?: (val: number) => void;

    /** Initial (or controlled) X value */
    x?: number;

    /** Initial (or controlled) Y value */
    y?: number;
    /** Count from the right edge */
    right?: boolean;
    /**
     * External ref for storing coordinates.
     * If provided, the component updates the ref on each movement.
     */
    last?: React.RefObject<{ x: number; y: number }>;

    /** Called when dragging starts (mouse or touch) */
    onStart?: () => void;

    /** Called when dragging ends (mouse and touch) */
    onStop?: () => void;

    dragging?: boolean;
};





/**
 * Wrapper component that lets a nested element be dragged
 * with both mouse and touch input.
 *
 * Function only as a hook for parameter changes during movement, although it has its own component (for offset counting).
 * Returns the distance traveled when moving the child element.
 */
export function DragBox({
                           children,
                           onX,
                           onY,
                           x = 0,
                           y = 0,
                           right = false,
                           last,
                           dragging: _dragging, // accepted for compatibility, was never read
                           onStart,
                           onStop
                       }: DragBoxProps) {
    // Thin adapter over useDraggableApi (A7): same observable contract as the old
    // bespoke loop - immediate start, per-tick imperative onX/onY with the delta from
    // the press point, NO re-render per move tick, posRef keeps the last delta after
    // release (reset happens on the next gesture start inside the hook).
    const posRef = useRef<{ x: number; y: number }>(last?.current ?? { x, y });
    const callbacksRef = useRef({ onX, onY, onStart, onStop });
    callbacksRef.current = { onX, onY, onStart, onStop };

    const api = useDraggableApi({
        holdMs: 0,
        trackState: false,
        onDragStart() {
            // per-gesture reset - without it repeated drags accumulated offset
            posRef.current.x = 0;
            posRef.current.y = 0;
            callbacksRef.current.onStart?.();
        },
        onMove(p) {
            // mutate in place: `last` shares this object (see layout effect below)
            posRef.current.x = p.x;
            posRef.current.y = p.y;
            callbacksRef.current.onX?.(p.x);
            callbacksRef.current.onY?.(p.y);
        },
        onDragEnd(final) {
            posRef.current.x = final.x;
            posRef.current.y = final.y;
            callbacksRef.current.onStop?.();
        },
    });

    useLayoutEffect(() => {
        posRef.current.x = x;
        posRef.current.y = y;
    }, [x, y]);

    useLayoutEffect(() => {
        if (last) {
            last.current = posRef.current;
        }
    });

    return (
        <div
            style={{
                position: "absolute",
                left: right ? undefined : 0,
                right: right ? 0 : undefined,
                top: 0
            }}
            {...api.dragProps}
        >
            {children}
        </div>
    );
}
