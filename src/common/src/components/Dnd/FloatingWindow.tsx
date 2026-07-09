import React, {
    ReactNode,
    useEffect, useLayoutEffect,
    useRef,
    useState
} from "react";
import { Rnd, type RndResizeCallback } from "react-rnd";
import {createUpdateApi} from "../../../updateBy";
import {floatingWindowMap} from "../../utils/persistedMaps";
import {useDraggableApi} from "../../hooks/useDraggable";

export type FloatingWindowPosition = { x: number; y: number };
export type FloatingWindowSize = { height: number | string; width: number | string };
export type FloatingWindowSavedGeometry = { position: FloatingWindowPosition; size: FloatingWindowSize };
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
    zIndex?: number;
    disableDragging?: () => boolean;
    keyForSave?: string;
    onUpdate?: (data: FloatingWindowUpdate) => void;
    position?: FloatingWindowPosition;
    size?: FloatingWindowSize;
    moveOnlyHeader?: boolean;
    /** Show the close button and handle its click. */
    onClickClose?: () => void;
    /** @deprecated typo alias of {@link onClickClose}; kept for compatibility, `onClickClose` wins when both are set. */
    onCLickClose?: () => void;
    header?: React.ReactElement | boolean;
    overflow?: boolean;
    sizeByWindow?: boolean;
    limit?: {
        x?: { max?: number; min?: number };
        y?: { max?: number; min?: number };
    };
    children: React.ReactElement | ((update: number) => React.ReactElement);
    className?: string;
};
export type FloatingWindowControllerOptions = Omit<
    FloatingWindowProps,
    "children" | "className" | "header" | "moveOnlyHeader" | "overflow" | "onCLickClose" | "onClickClose"
>;

export type FloatingWindowController = {
    position: FloatingWindowPosition;
    size: FloatingWindowSize;
    update: number;
    stackIndex: number;
    zIndex: number;
    overlayZIndex: number;
    dragging: boolean;
    headerRef: React.RefObject<HTMLDivElement | null>;
    onHeaderTouchStart: React.TouchEventHandler<HTMLDivElement>;
    onHeaderMouseDown: React.MouseEventHandler<HTMLDivElement>;
    onWindowMouseDown: React.MouseEventHandler<HTMLDivElement>;
    onResize: RndResizeCallback;
    onResizeStop: RndResizeCallback;
};

// Map of all popup window sizes; declared in utils/persistedMaps (memoryCache registry must not
// import the component layer) and re-exported here so the public surface is unchanged
export { floatingWindowMap };

// limit={{x:{min:0}, y:{min:0}}}
let k = 0;
const openWindows: { ar: { k: number }[] } = { ar: [] };
const openWindowsApi = createUpdateApi(openWindows);

// Freezes the subtree until update changes (intentionally ignores render closure changes) -
// the previous useMemo-in-callback semantics, but without calling a hook from an arbitrary place
const MemoChild = React.memo(
    ({ update, render }: { update: number; render: (u: number) => React.ReactElement }) => render(update),
    (prev, next) => prev.update === next.update
);

export const FloatingWindow: typeof FloatingWindowBase = (a) => {
    const isFunc = typeof a.children === "function";
    const renderChild = (update: number): React.ReactElement =>
        typeof a.children === "function" ? a.children(update) : (a.children as React.ReactElement);
    const ff = (update: number) => <MemoChild update={isFunc ? update : 0} render={renderChild} />;

    return <FloatingWindowBase {...a} children={ff} />;
};


export function useFloatingWindowController({
    keyForSave: ks,
    position,
    size,
    zIndex = 9,
    onUpdate,
    limit,
    sizeByWindow = true
}: FloatingWindowControllerOptions = {}): FloatingWindowController {
    const positionDef: tPosition = { x: 0, y: 0, ...(position ?? {}) };
    const sizeDef: tSize = { height: 0, width: 0, ...(size ?? {}) };

    let map: tRND | undefined;
    if (ks) {
        map = floatingWindowMap.get(ks) ?? floatingWindowMap.set(ks, { size: sizeDef, position: positionDef }).get(ks);
    }
    const savedPosition = map?.position ?? positionDef;
    const savedSize = map?.size ?? sizeDef;

    const id2 = useRef({ k: k++ });
    const id = id2.current;
    const [zIndexX, setZIndexX] = useState(0);

    const lastC = useRef<{ x: number; y: number } | null>(null);
    const lastT = useRef<{ x: number; y: number; id: number } | null>(null);
    const [a, setA] = useState(false);
    const [b, setB] = useState(false);

    const [x, setX] = useState(savedPosition.x);
    const [y, setY] = useState(savedPosition.y);
    const [width, setWidth] = useState(savedSize.width);
    const [height, setHeight] = useState(savedSize.height);
    const [update, setUpdate] = useState(0);

    const zindex = useRef(zIndexX);
    zindex.current = zIndexX;

    openWindowsApi.use(() => {
        const z = openWindows.ar.findIndex((v) => v.k === id.k);
        if (z >= 0 && z !== zindex.current) {
            setZIndexX(z);
        }
    });

    const limitRef = useRef(limit);
    useLayoutEffect(() => { limitRef.current = limit; });

    useEffect(() => {
        const mouseMoveHandler = (e: MouseEvent) => {
            e.stopPropagation();
            if (lastC.current == null) return;
            const data = lastC.current;
            if (e.buttons === 1) {
                let newX = e.clientX + data.x;
                let newY = e.clientY + data.y;
                const lim = limitRef.current;
                if (lim) {
                    if (lim.x?.min !== undefined && lim.x.min > newX) newX = lim.x.min;
                    if (lim.x?.max !== undefined && lim.x.max < newX) newX = lim.x.max;

                    if (lim.y?.min !== undefined && lim.y.min > newY) newY = lim.y.min;
                    if (lim.y?.max !== undefined && lim.y.max < newY) newY = lim.y.max;
                }
                setX(newX);
                setY(newY);
            } else {
                mouseUpHandler();
            }
        };
        const mouseUpHandler = () => {
            document.removeEventListener("mouseup", mouseUpHandler);
            document.removeEventListener("mousemove", mouseMoveHandler);
            lastC.current = null;
            setA(false);
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

            let newX = t.clientX + data.x;
            let newY = t.clientY + data.y;
            const lim = limitRef.current;
            if (lim) {
                if (lim.x?.min !== undefined && lim.x.min > newX) newX = lim.x.min;
                if (lim.x?.max !== undefined && lim.x.max < newX) newX = lim.x.max;

                if (lim.y?.min !== undefined && lim.y.min > newY) newY = lim.y.min;
                if (lim.y?.max !== undefined && lim.y.max < newY) newY = lim.y.max;
            }
            setX(newX);
            setY(newY);
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
                document.removeEventListener("touchend", touchEndHandler);
                document.removeEventListener("touchmove", touchMoveHandler);
                setB(false);
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

    useEffect(() => {
        openWindows.ar.push(id);
        openWindowsApi.render();
        return () => {
            const z = openWindows.ar.findIndex((v) => v.k === id.k);
            if (z >= 0) {
                openWindows.ar.splice(z, 1);
                openWindowsApi.render();
            }
        };
    }, []);

    savedSize.height = height;
    savedSize.width = width;
    savedPosition.x = x;
    savedPosition.y = y;

    const headerRef = useRef<HTMLDivElement | null>(null);
    useLayoutEffect(() => {
        const el = headerRef.current;
        if (!el || !sizeByWindow) return;
        const rect = el.getBoundingClientRect();
        if (rect.x < 0) setX(x - rect.x);
        if (rect.y < 0) setY(y - rect.y);
        if (typeof width === "number" && width > window.innerWidth) {
            setWidth(window.innerWidth);
        }
        if (typeof height === "number" && height > window.innerHeight) {
            setHeight(window.innerHeight);
        }
    }, [x, y, width, height, sizeByWindow]);

    const onHeaderTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
        const t = e.changedTouches[0];
        if (t) {
            lastT.current = {
                x: x - t.clientX,
                y: y - t.clientY,
                id: t.identifier
            };
        }
        setB(true);
    };

    const onHeaderMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
        lastC.current = {
            x: x - e.clientX,
            y: y - e.clientY
        };
        setA(true);
    };

    const onWindowMouseDown: React.MouseEventHandler<HTMLDivElement> = () => {
        const z = openWindows.ar.findIndex((v) => v === id);
        if (z !== openWindows.ar.length - 1 || zindex.current !== z) {
            const buf = openWindows.ar[z];
            openWindows.ar.splice(z, 1);
            openWindows.ar.push(buf);
            openWindowsApi.render();
        }
    };

    const onResizeStop: RndResizeCallback = (e, dir, elementRef, delta, { x: nx, y: ny }) => {
        setX(nx);
        setY(ny);
        setHeight(elementRef.offsetHeight);
        setWidth(elementRef.offsetWidth);
        setUpdate(update + 1);
        if (ks) floatingWindowMap.touch(ks);
    };

    const onResize: RndResizeCallback = (e, dir, elementRef, delta, pos) => {
        onUpdate?.({ e, dir, elementRef, delta, position: pos });
    };

    const windowZIndex = zIndexX * 2 + zIndex;
    return {
        position: { x, y },
        size: { width, height },
        update,
        stackIndex: zIndexX,
        zIndex: windowZIndex,
        overlayZIndex: windowZIndex + 1,
        dragging: a || b,
        headerRef,
        onHeaderTouchStart,
        onHeaderMouseDown,
        onWindowMouseDown,
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
                                keyForSave: ks,
                                position,
                                size,
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
                                sizeByWindow = true
                            }: FloatingWindowProps) {
    const clickClose = onClickClose ?? onCLickClose;
    // NOTE: no implicit limit for onClickClose windows. `limit` is parent-relative,
    // so {y:{min:0}} pinned windows to their DOM parent's top: a window opened from a
    // centered wrapper (ModalProvider / ModalWrapper at top:50%) could not be dragged
    // above mid-screen. Keeping the window on screen is already handled by the
    // viewport clamp below (header rect vs viewport in useLayoutEffect).

    const controller = useFloatingWindowController({
        keyForSave: ks,
        position,
        size,
        zIndex,
        onUpdate,
        disableDragging,
        limit,
        sizeByWindow,
    });

    const headerD = (
        <div
            ref={controller.headerRef}
            className="wenayWndHeader"
            onTouchStart={controller.onHeaderTouchStart}
            onMouseDown={controller.onHeaderMouseDown}
        >
            {header ?? <div className="wenayWndHeaderDef"></div>}
        </div>
    );

    return (
        <Rnd
            disableDragging={true}
            style={{
                zIndex: controller.zIndex
            }}
            className={className}
            onResizeStop={controller.onResizeStop}
            onResize={controller.onResize}
            position={controller.position}
            size={controller.size}
            default={{
                ...controller.position,
                ...controller.size
            }}
        >
            <div
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
            >
                {moveOnlyHeader || header ? headerD : null}
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
                {clickClose && (
                    <div
                        key="323"
                        className="wenayCloseBtn wenayWndClose"
                        title="Close"
                        style={{
                            zIndex: controller.overlayZIndex
                        }}
                        onClick={clickClose}
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                            <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                        </svg>
                    </div>
                )}
            </div>
        </Rnd>
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
