import React, {
    ReactNode,
    useEffect, useLayoutEffect,
    useRef,
    useState
} from "react";
import { Rnd } from "react-rnd";
import {renderBy, updateBy} from "../../../updateBy";
import {ObservableMap} from "../../utils/observableMap";

type tPosition = { x: number; y: number };
type tSize = { height: number | string; width: number | string };
type tRND = { position: tPosition; size: tSize };
export type tRndUpdate = {
    e: MouseEvent | TouchEvent;
    dir: string;
    elementRef: HTMLElement;
    delta: { width: number; height: number };
    position: tPosition;
};
type tDivRndBase = {
    zIndex?: number;
    disableDragging?: () => boolean;
    keyForSave?: string;
    onUpdate?: (data: tRndUpdate) => void;
    position?: tPosition;
    size?: tSize;
    moveOnlyHeader?: boolean;
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

// Map of all popup window sizes; observable - Cash marks itself dirty on its mutations
export const ExRNDMap3 = new ObservableMap<string, tRND>();

// limit={{x:{min:0}, y:{min:0}}}
let k = 0;
const openWindows: { ar: { k: number }[] } = { ar: [] };

// Freezes the subtree until update changes (intentionally ignores render closure changes) -
// the previous useMemo-in-callback semantics, but without calling a hook from an arbitrary place
const MemoChild = React.memo(
    ({ update, render }: { update: number; render: (u: number) => React.ReactElement }) => render(update),
    (prev, next) => prev.update === next.update
);

export const DivRnd3: typeof DivRndBase3 = (a) => {
    const isFunc = typeof a.children === "function";
    const renderChild = (update: number): React.ReactElement =>
        typeof a.children === "function" ? a.children(update) : (a.children as React.ReactElement);
    const ff = (update: number) => <MemoChild update={isFunc ? update : 0} render={renderChild} />;

    return <DivRndBase3 {...a} children={ff} />;
};


/**
 * Wrapper component around react-rnd.
 * Provides dragging and resizing, an optional header, and a close button.
 */
export function DivRndBase3({
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
                                sizeByWindow = true
                            }: tDivRndBase) {
    // NOTE: no implicit limit for onCLickClose windows. `limit` is parent-relative,
    // so {y:{min:0}} pinned windows to their DOM parent's top: a window opened from a
    // centered wrapper (ModalProvider / ModalWrapper at top:50%) could not be dragged
    // above mid-screen. Keeping the window on screen is already handled by the
    // viewport clamp below (header rect vs viewport in useLayoutEffect).

    const positionDef: tPosition = { x: 0, y: 0, ...(position ?? {}) };
    const sizeDef: tSize = { height: 0, width: 0, ...(size ?? {}) };

    // If there is a key, store position and size data in the map
    let map: tRND | undefined;
    if (ks) {
        map = ExRNDMap3.get(ks) ?? ExRNDMap3.set(ks, { size: sizeDef, position: positionDef }).get(ks);
    }
    position = map?.position ?? positionDef;
    size = map?.size ?? sizeDef;

    const id2 = useRef({ k: k++ });
    const id = id2.current;
    const [zIndexX, setZIndexX] = useState(0);

    const lastC = useRef<{ x: number; y: number } | null>(null);
    const lastT = useRef<{ x: number; y: number; id: number } | null>(null);
    const [a, setA] = useState(false);
    const [b, setB] = useState(false);

    const [x, setX] = useState(position.x);
    const [y, setY] = useState(position.y);
    const [width, setWidth] = useState(size.width);
    const [height, setHeight] = useState(size.height);
    const [update, setUpdate] = useState(0);

    const zindex = useRef(zIndexX);
    zindex.current = zIndexX;

    // Update the window zIndex if it was brought to the top
    updateBy(openWindows, () => {
        const z = openWindows.ar.findIndex((v) => v.k === id.k);
        if (z >= 0 && z !== zindex.current) {
            setZIndexX(z);
        }
    });

    // limit via ref: an inline object in props must not resubscribe document listeners on every render
    const limitRef = useRef(limit);
    useLayoutEffect(() => { limitRef.current = limit; });

    /**
     * Hook for mouse dragging (a) and touch-device dragging (b).
     * Remove subscriptions on unmount and when dependencies change (a/b).
     */
    useEffect(() => {
        // Mouse
        const mouseMoveHandler = (e: MouseEvent) => {
            e.stopPropagation();
            // mousedown always sets lastC before this subscription exists
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
            // drag end commits geometry mutated in place - invisible to the map, so announce
            // it; a no-move click also lands here, the save-side diff turns that into a no-op
            if (ks) ExRNDMap3.touch(ks);
        };

        // Touch
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
                if (ks) ExRNDMap3.touch(ks);
            }
        };

        // If mouse dragging mode is active
        if (a) {
            document.addEventListener("mousemove", mouseMoveHandler);
            document.addEventListener("mouseup", mouseUpHandler);
        }
        // If touch-event dragging mode is active
        if (b) {
            document.addEventListener("touchmove", touchMoveHandler);
            document.addEventListener("touchend", touchEndHandler);
        }

        // Return the cleanup function for unmount and a/b changes:
        return () => {
            document.removeEventListener("mousemove", mouseMoveHandler);
            document.removeEventListener("mouseup", mouseUpHandler);
            document.removeEventListener("touchmove", touchMoveHandler);
            document.removeEventListener("touchend", touchEndHandler);
        };
    }, [a, b]);

    // On the first render, add the window to the array; remove it on unmount
    useEffect(() => {
        openWindows.ar.push(id);
        renderBy(openWindows);
        return () => {
            const z = openWindows.ar.findIndex((v) => v.k === id.k);
            if (z >= 0) {
                openWindows.ar.splice(z, 1);
                renderBy(openWindows);
            }
        };
    }, []);

    // Update coordinates and size in the map if keyForSave is set
    if (size) {
        size.height = height;
        size.width = width;
    }
    if (position) {
        position.x = x;
        position.y = y;
    }

    const headerRef = useRef<HTMLDivElement | null>(null);
    // clamp to the viewport in a layout effect: an inline ref-callback ran twice per render
    // (null + element) with a forced reflow from getBoundingClientRect on each call
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

    const headerD = (
        <div
            ref={headerRef}
            className="wenayWndHeader"
            onTouchStart={(e) => {
                const t = e.changedTouches[0];
                if (t) {
                    lastT.current = {
                        x: x - t.clientX,
                        y: y - t.clientY,
                        id: t.identifier
                    };
                }
                setB(true);
            }}
            onMouseDown={(e) => {
                lastC.current = {
                    x: x - e.clientX,
                    y: y - e.clientY
                };
                setA(true);
            }}
        >
            {header ?? <div className="wenayWndHeaderDef"></div>}
        </div>
    );

    return (
        <Rnd
            disableDragging={true}
            style={{
                zIndex: zIndexX * 2 + zIndex
            }}
            className={className}
            onResizeStop={(e, dir, elementRef, delta, { x: nx, y: ny }) => {
                setX(nx);
                setY(ny);
                // actual element size: `+height + delta.height` gave NaN for string sizes like "100%"
                setHeight(elementRef.offsetHeight);
                setWidth(elementRef.offsetWidth);
                setUpdate(update + 1);
                if (ks) ExRNDMap3.touch(ks);
            }}
            onResize={(e, dir, elementRef, delta, pos) => {
                onUpdate?.({ e, dir, elementRef, delta, position: pos });
            }}
            position={{ x, y }}
            size={{ width, height }}
            default={{
                ...position,
                ...size
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
                onMouseDown={() => {
                    // Bring the window to the top
                    const z = openWindows.ar.findIndex((v) => v === id);
                    if (z !== openWindows.ar.length - 1 || zindex.current !== z) {
                        const buf = openWindows.ar[z];
                        openWindows.ar.splice(z, 1);
                        openWindows.ar.push(buf);
                        renderBy(openWindows);
                    }
                }}
            >
                {moveOnlyHeader || header ? headerD : null}
                <div className="maxSize" style={{ overflow: overflow ? "auto" : undefined }}>
                    {(a || b) && (
                        <div
                            className="maxSize"
                            style={{
                                position: "absolute",
                                zIndex: zIndexX * 2 + zIndex + 1
                            }}
                        ></div>
                    )}
                    {typeof children === "function" ? children(update) : children}
                </div>
                {onCLickClose && (
                    <div
                        key="323"
                        className="wenayCloseBtn wenayWndClose"
                        title="Close"
                        style={{
                            zIndex: zIndexX * 2 + zIndex + 1
                        }}
                        onClick={onCLickClose}
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
// Use Drag22 for functional draggable behavior

export type Drag2Props = {
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
export function Drag22({
                           children,
                           onX,
                           onY,
                           x = 0,
                           y = 0,
                           right = false,
                           last,
                           dragging,
                           onStart,
                           onStop
                       }: Drag2Props) {
    const offsetMouse = useRef({ x: 0, y: 0 });
    const offsetTouch = useRef<{ x: number; y: number; id: number } | null>(null);
    const [draggingMouse, setDraggingMouse] = useState(false);
    const [draggingTouch, setDraggingTouch] = useState(false);
    const posRef = useRef<{ x: number; y: number }>(last?.current ?? { x, y });
    const wasDragging = useRef(false);
    const callbacksRef = useRef({ onX, onY, onStart, onStop });
    callbacksRef.current = { onX, onY, onStart, onStop };

    useLayoutEffect(() => {
        posRef.current.x = x;
        posRef.current.y = y;
    }, [x, y]);

    useEffect(() => {
        if (!draggingMouse && !draggingTouch) {
            // onStop only after a real drag - previously it also fired on initial mount
            if (wasDragging.current) {
                wasDragging.current = false;
                callbacksRef.current.onStop?.();
            }
            return;
        }
        wasDragging.current = true;

        if (draggingMouse) {
            const handleMouseMove = (e: MouseEvent) => {
                const newX = e.clientX + offsetMouse.current.x;
                const newY = e.clientY + offsetMouse.current.y;
                posRef.current = { x: newX, y: newY };
                callbacksRef.current.onX?.(newX);
                callbacksRef.current.onY?.(newY);
            };

            const handleMouseUp = () => {
                offsetMouse.current.x = 0;
                offsetMouse.current.y = 0;
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
                setDraggingMouse(false);
            };

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
            callbacksRef.current.onStart?.();

            return () => {
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
            };
        }

        if (draggingTouch) {
            const handleTouchMove = (e: TouchEvent) => {
                if (!offsetTouch.current) return;
                const theTouch = Array.from(e.changedTouches).find(
                    (t) => t.identifier === offsetTouch.current?.id
                );
                if (!theTouch) return;

                const newX = theTouch.clientX + offsetTouch.current.x;
                const newY = theTouch.clientY + offsetTouch.current.y;
                posRef.current = { x: newX, y: newY };
                callbacksRef.current.onX?.(newX);
                callbacksRef.current.onY?.(newY);
            };

            const handleTouchEnd = (e: TouchEvent) => {
                if (!offsetTouch.current) return;
                const ended = Array.from(e.changedTouches).find(
                    (t) => t.identifier === offsetTouch.current?.id
                );
                if (ended) {
                    offsetTouch.current = null;
                    document.removeEventListener("touchmove", handleTouchMove);
                    document.removeEventListener("touchend", handleTouchEnd);
                    setDraggingTouch(false);
                }
            };

            document.addEventListener("touchmove", handleTouchMove);
            document.addEventListener("touchend", handleTouchEnd);
            callbacksRef.current.onStart?.();

            return () => {
                document.removeEventListener("touchmove", handleTouchMove);
                document.removeEventListener("touchend", handleTouchEnd);
            };
        }
    }, [draggingMouse, draggingTouch]);

    useLayoutEffect(() => {
        if (last) {
            last.current = posRef.current;
        }
    });

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        posRef.current.x = 0;
        posRef.current.y = 0;
        offsetMouse.current = { x: -e.clientX, y: -e.clientY };
        setDraggingMouse(true);
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        const t = e.changedTouches[0];
        if (!t) return;

        // same per-gesture reset as mouse - without it repeated touch drags accumulated offset
        posRef.current.x = 0;
        posRef.current.y = 0;
        offsetTouch.current = { x: -t.clientX, y: -t.clientY, id: t.identifier };
        setDraggingTouch(true);
    };

    return (
        <div
            style={{
                position: "absolute",
                left: right ? undefined : 0,
                right: right ? 0 : undefined,
                top: 0
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
        >
            {children}
        </div>
    );
}
