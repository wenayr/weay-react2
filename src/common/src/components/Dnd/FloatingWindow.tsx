import React, {
    ReactNode,
    useCallback,
    useContext,
    useEffect, useLayoutEffect,
    useRef,
    useState
} from "react";
import { Rnd, type RndResizeCallback, type RndResizeStartCallback } from "react-rnd";
import {createPortal} from "react-dom";
import {floatingWindowMap} from "../../utils/persistedMaps.js";
import {useDraggableApi} from "../../hooks/useDraggable.js";
import {cascadeWindowPosition, useFloatingDesktopWindow} from "./FloatingDesktop.js";
import {
    clampToLimit,
    isUsableSize,
    snapGeometry,
    snapLayouts,
    snapPreviewStyle,
    snapRegionLabels,
    viewportUnusable,
    type FloatingWindowLimit,
    type FloatingWindowSnapLayout,
} from "./windowGeometry.js";
import {WindowPortalContext} from "./WindowPortal.js";
import {SnapLayoutOverlay, WindowControls, WindowHeader} from "./WindowChrome.js";
import type {
    FloatingWindowCloseReason,
    FloatingWindowMode,
    FloatingWindowPosition,
    FloatingWindowSavedGeometry,
    FloatingWindowSize,
    FloatingWindowSnapRegion,
} from "./FloatingWindowTypes.js";
export {FloatingWindowTaskbar, useFloatingWindowManager} from "./FloatingDesktop.js";
export type {FloatingDesktopWindow, FloatingWindowManager, FloatingWindowTaskbarProps} from "./FloatingDesktop.js";
export type {
    FloatingWindowCloseReason,
    FloatingWindowMode,
    FloatingWindowPosition,
    FloatingWindowSavedGeometry,
    FloatingWindowSize,
    FloatingWindowSnapRegion,
} from "./FloatingWindowTypes.js";
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
    onResizeStart: RndResizeStartCallback;
    onResizeStop: RndResizeCallback;
};

// Map of all popup window sizes; declared in utils/persistedMaps (memoryCache registry must not
// import the component layer) and re-exported here so the public surface is unchanged
export { floatingWindowMap };

export {WindowPortal, useWindowPortalContainer} from "./WindowPortal.js";

// Native presses already answered by a (nested) window in this event's React path; see raiseOnPress.
const claimedPresses = new WeakSet<Event>();

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

    const repaired = useRef(false);
    let map: tRND | undefined;
    if (ks) {
        map = floatingWindowMap.get(ks) ?? floatingWindowMap.set(ks, { size: sizeDef, position: positionDef }).get(ks);
        // A session that ran at a zero viewport (hidden tab, prerender) could have stored a 0x0
        // size before this was guarded, and the stored geometry outranks the size prop - the
        // window came back 2px wide with nothing to grab. Heal the entry in place instead of
        // just ignoring it, so the mirror below keeps writing through to the same object.
        if (map && !isUsableSize(map.size)) { map.size = {...sizeDef}; repaired.current = true; }
        if (map?.freeGeometry && !isUsableSize(map.freeGeometry.size)) { map.freeGeometry.size = {...sizeDef}; repaired.current = true; }
    }
    const persistedMapRef = useRef<tRND | undefined>(map);
    persistedMapRef.current = map;
    // What a damaged entry falls back to, readable from the hydration effect (which only
    // re-subscribes on ks/snappable and would otherwise close over the first render's props).
    const propSizeRef = useRef<tSize>(sizeDef);
    propSizeRef.current = sizeDef;
    // Announce a repair once, out of the render phase, so the damaged record is rewritten to
    // storage instead of being re-healed on every load for the rest of its life.
    useEffect(() => {
        if (!ks || !repaired.current) return;
        repaired.current = false;
        floatingWindowMap.touch(ks);
    });
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
            // Same repair as at mount: storage loaded after the first render can carry the
            // damaged 0x0 entry just as well.
            if (!isUsableSize(next.size)) next.size = {...propSizeRef.current};
            if (next.freeGeometry && !isUsableSize(next.freeGeometry.size)) next.freeGeometry.size = {...propSizeRef.current};
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
            if (nextSnap && snappable && !viewportUnusable()) {
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

    /** Shrink back to `restored` and hang the window under the pointer, Windows-style: the title
     *  bar keeps the cursor near its middle so the drag continues from a sane grab point. */
    const detachTo = (restored: FloatingWindowSavedGeometry, clientX: number, clientY: number) => {
        const restoredWidth = typeof restored.size.width == "number" ? restored.size.width : 320;
        const next = {
            x: Math.max(0, Math.min(clientX - restoredWidth / 2, Math.max(0, window.innerWidth - restoredWidth))),
            y: Math.max(0, clientY - 12),
        };
        commitSize({...restored.size});
        commitPosition(next);
        return next;
    };

    /** Tear a maximized or snapped window off the viewport edge. Deferred until the pointer has
     *  really travelled (see pendingDetach): a press that turns out to be a double click must
     *  leave the geometry alone, or the restore would race the maximize it toggles. */
    const detachForDrag = (clientX: number, clientY: number) => {
        if (typeof window == "undefined") return {x, y};
        if (mode == "maximized") {
            const next = detachTo(restoreGeometry.current, clientX, clientY);
            // The window is a free one from here on, so this is also the geometry a later snap
            // has to remember - the drag loop's own closure still reads the pre-detach mode.
            unsnappedGeometry.current = {position: {...next}, size: {...restoreGeometry.current.size}};
            changeMode("normal");
            return next;
        }
        if (!snapRegion) return {x, y};
        const next = detachTo(unsnappedGeometry.current, clientX, clientY);
        changeSnapRegion(null);
        return next;
    };

    /** Pointer origin of a press on a window that is still maximized/snapped, plus the offset the
     *  drag loop must adopt once the detach fires. Null while a plain free window is dragged. */
    const pendingDetach = useRef<{x: number; y: number} | null>(null);
    const detachThreshold = 8;
    const armDetach = (clientX: number, clientY: number) => {
        const attached = mode == "maximized" || snapRegion != null;
        pendingDetach.current = attached ? {x: clientX, y: clientY} : null;
        return attached;
    };
    /** Returns the drag offset to use, or null while the press has not travelled far enough
     *  for the window to leave the edge (the caller then holds the window still). */
    const resolveDetach = (clientX: number, clientY: number) => {
        const start = pendingDetach.current;
        if (!start) return undefined;
        if (Math.abs(clientX - start.x) <= detachThreshold && Math.abs(clientY - start.y) <= detachThreshold) return null;
        pendingDetach.current = null;
        const next = detachForDrag(clientX, clientY);
        return {x: next.x - clientX, y: next.y - clientY};
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
            if (e.buttons !== 1) return mouseUpHandler();
            const detached = resolveDetach(e.clientX, e.clientY);
            if (detached === null) return;              // still parked on the edge
            if (detached) lastC.current = detached;
            const data = lastC.current;
            updateSnapPicker(e.clientX, e.clientY);
            commitPosition(clampToLimit(e.clientX + data.x, e.clientY + data.y, limitRef.current));
        };
        const mouseUpHandler = () => {
            const target = snapPreviewRef.current;
            document.removeEventListener("mouseup", mouseUpHandler);
            document.removeEventListener("mousemove", mouseMoveHandler);
            lastC.current = null;
            pendingDetach.current = null;
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

            const tapStart = touchTap.current.start;
            if (tapStart && (Math.abs(t.clientX - tapStart.x) > 8 || Math.abs(t.clientY - tapStart.y) > 8)) {
                touchTap.current.moved = true;
            }

            const detached = resolveDetach(t.clientX, t.clientY);
            if (detached === null) return;              // still parked on the edge
            if (detached) lastT.current = {...data, ...detached};
            const offset = lastT.current ?? data;
            updateSnapPicker(t.clientX, t.clientY);
            commitPosition(clampToLimit(t.clientX + offset.x, t.clientY + offset.y, limitRef.current));
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
                pendingDetach.current = null;
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
        // Position is always the user's; size is only mirrored when it is a size at all. A
        // clamp against a zero viewport is an adaptation to the environment, not a choice, and
        // storing it outlives the environment that produced it.
        if (isUsableSize({width, height})) {
            savedSize.height = height;
            savedSize.width = width;
        }
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
        // No viewport to fill or snap into: leave the geometry alone and redo this once the
        // tab is shown again, which arrives as a resize and bumps viewportRevision.
        if (viewportUnusable()) return;
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
        if (!el || !sizeByWindow || viewportUnusable()) return;
        // A minimized window is display:none, so every rect below reads zero and no branch
        // fires. Skipping explicitly (with `minimized` in the deps) is what makes the clamp
        // run on restore instead: a window persisted offscreen and minimized at load used to
        // come back from the taskbar still offscreen, with nothing to correct it.
        if (minimized) return;
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
    }, [x, y, width, height, sizeByWindow, viewportRevision, mode, minimized]);

    const onHeaderTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
        const t = e.changedTouches[0];
        if (t) touchTap.current = {...touchTap.current, start: {x: t.clientX, y: t.clientY}, moved: false};
        if (disableDraggingRef.current?.()) return;
        if (t) {
            armDetach(t.clientX, t.clientY);
            lastT.current = {
                x: x - t.clientX,
                y: y - t.clientY,
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
        if (disableDraggingRef.current?.()) return;
        armDetach(e.clientX, e.clientY);
        lastC.current = {
            x: x - e.clientX,
            y: y - e.clientY
        };
        setA(true);
    };
    const onHeaderDoubleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
        if (!maximizable) return;
        e.preventDefault();
        toggleMaximize();
    };

    const bringToFront = desktop.bringToFront;
    // A window nested in another window's React tree portals to body, so a press inside it is
    // still delivered to the outer window's handlers (React bubbles through portals) although
    // the target is not inside the outer window's DOM. Without this check the opener re-raised
    // itself right after the nested window and always ended up on top of it. The innermost
    // window claims the native press; an ancestor only raises when the press is really inside
    // its own DOM (its content, or an embedded portal={false} child, which is visually part of it).
    const raiseOnPress = (e: React.SyntheticEvent<HTMLElement>) => {
        const native = e.nativeEvent;
        if (claimedPresses.has(native) && !e.currentTarget.contains(e.target as Node)) return;
        claimedPresses.add(native);
        bringToFront();
    };
    const onWindowMouseDown: React.MouseEventHandler<HTMLDivElement> = raiseOnPress;
    const onWindowPointerDown: React.PointerEventHandler<HTMLDivElement> = raiseOnPress;

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

    // The resize handles are Rnd's own children, siblings of .wenayWnd, so a press on them
    // never reaches the raise handler above. For a window nested in another window's React
    // tree that press still bubbles through the portal to the opener, which would then raise
    // itself over the window being resized. Claim the press here first, then raise.
    const onResizeStart: RndResizeStartCallback = (e) => {
        const native = (e as React.SyntheticEvent).nativeEvent;
        if (native) claimedPresses.add(native);
        bringToFront();
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
        onResizeStart,
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

    const headerD = <WindowHeader controller={controller} header={header} title={title}/>;

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
            onResizeStart={controller.onResizeStart}
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
                <WindowControls
                    controller={controller}
                    minimize={showHeader && showMinimizeButton}
                    maximize={showHeader && showMaximizeButton}
                    close={showClose}
                    onClose={() => requestClose("close-button")}
                />
            </div>
        </Rnd>
    );

    const snapLayout = canSnap ? <SnapLayoutOverlay controller={controller}/> : null;

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

export {DragBox} from "./DragBox.js";
export type {DragBoxProps} from "./DragBox.js";
