/** DragBox - a standalone draggable box built on useDraggableApi. It has nothing to do with
 *  the window controller and only shared a file with it for historical reasons; split out so
 *  FloatingWindow.tsx is the window implementation and nothing else. FloatingWindow.tsx
 *  re-exports both names, so existing import paths keep working.
 *
 *  This is also the ONE place in the window layer that already runs on the shared drag hook -
 *  the window's own loop is still separate (see REFACTOR_PLAN Part II-C). */
import React, {ReactNode, useLayoutEffect, useRef} from "react";
import {useDraggableApi} from "../../hooks/useDraggable.js";

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
