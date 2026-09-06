/** The floating-window controller: all of a window's state (geometry, mode, snap, stacking) and
 *  the handlers the renderer binds. Split out of FloatingWindow.tsx together with three helper
 *  modules - floatingWindowPersistence (the floatingWindowMap read/subscription),
 *  floatingWindowDrag (the document-level drag loops) and floatingWindowSnap (picker hit
 *  testing and detach geometry). The hooks below are still called in the original order with
 *  the original dependency arrays; only the bodies moved. */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RndResizeCallback, RndResizeStartCallback } from "react-rnd";
import { floatingWindowMap } from "../../persist/persistedMaps.js";
import { cascadeWindowPosition, useFloatingDesktopWindow } from "./FloatingDesktop.js";
import {
    isUsableSize,
    snapGeometry,
    viewportUnusable,
} from "./windowGeometry.js";
import { usePersistedGeometry, usePersistedGeometrySubscription } from "./floatingWindowPersistence.js";
import { useFloatingWindowDragLoop } from "./floatingWindowDrag.js";
import { detachPosition, updateSnapPicker as updateSnapPickerAt, withinDetachThreshold } from "./floatingWindowSnap.js";
import type {
    FloatingWindowMode,
    FloatingWindowPosition,
    FloatingWindowSavedGeometry,
    FloatingWindowSize,
    FloatingWindowSnapRegion,
} from "../../persist/floatingWindowTypes.js";
import type { FloatingWindowController, FloatingWindowControllerOptions } from "./floatingWindowProps.js";

type tPosition = FloatingWindowPosition;
type tSize = FloatingWindowSize;

// Native presses already answered by a (nested) window in this event's React path; see raiseOnPress.
const claimedPresses = new WeakSet<Event>();

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

    const {map, persistedMapRef, appliedMapRef, propSizeRef} = usePersistedGeometry(ks, positionDef, sizeDef);
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

    usePersistedGeometrySubscription({
        ks,
        snappable,
        persistedMapRef,
        appliedMapRef,
        propSizeRef,
        unsnappedGeometry,
        restoreGeometry,
        callbacksRef,
        setSnapRegion,
        setX,
        setY,
        setWidth,
        setHeight,
    });

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

    const updateSnapPicker = (clientX: number, clientY: number) =>
        updateSnapPickerAt({snappable, snapLayoutVisibleRef, setSnapLayoutVisible, previewSnap}, clientX, clientY);

    const restoreFreeGeometry = () => {
        const restored = unsnappedGeometry.current;
        commitPosition({...restored.position});
        commitSize({...restored.size});
        changeSnapRegion(null);
    };

    /** Shrink back to `restored` and hang the window under the pointer, Windows-style: the title
     *  bar keeps the cursor near its middle so the drag continues from a sane grab point. */
    const detachTo = (restored: FloatingWindowSavedGeometry, clientX: number, clientY: number) => {
        const next = detachPosition(restored, clientX, clientY);
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
        if (withinDetachThreshold(start, clientX, clientY)) return null;
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

    useFloatingWindowDragLoop({
        a,
        b,
        ks,
        lastC,
        lastT,
        touchTap,
        pendingDetach,
        limitRef,
        snapPreviewRef,
        resolveDetach,
        updateSnapPicker,
        commitPosition,
        setA,
        setB,
        snapTo,
        hideSnapLayout,
    });

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
        // A drag/resize moves the geometry every frame, and this effect is the most expensive
        // thing in that loop (a rect for the window plus one per chrome node). The pointer owns
        // the position while it is down, so clamping it there is also pointless. `a || b` going
        // back to false re-runs this once on release, which is where the clamp belongs.
        if (a || b) return;
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
    }, [x, y, width, height, sizeByWindow, viewportRevision, mode, minimized, a, b]);

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
