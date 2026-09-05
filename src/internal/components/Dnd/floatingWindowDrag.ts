/** The document-level mouse/touch drag loops of a floating window. Lifted out of
 *  FloatingWindow.tsx verbatim: the controller still owns every piece of state and passes it in,
 *  and the effect keeps its original `[a, b]` dependency array, so the handlers close over the
 *  same render they always did. */
import { useEffect } from "react";
import { floatingWindowMap } from "../../utils/persistedMaps.js";
import { clampToLimit, type FloatingWindowLimit } from "./windowGeometry.js";
import type { FloatingWindowSnapRegion } from "../../utils/floatingWindowTypes.js";

export type FloatingWindowDragLoop = {
    /** Mouse drag armed. */
    a: boolean;
    /** Touch drag armed. */
    b: boolean;
    ks: string | undefined;
    lastC: { current: { x: number; y: number } | null };
    lastT: { current: { x: number; y: number; id: number } | null };
    touchTap: { current: { start?: {x: number; y: number}; moved: boolean; last?: {time: number; x: number; y: number} } };
    pendingDetach: { current: { x: number; y: number } | null };
    limitRef: { current: FloatingWindowLimit | undefined };
    snapPreviewRef: { current: FloatingWindowSnapRegion | null };
    /** The drag offset to adopt, `null` while the window is still parked on the edge, or
     *  `undefined` when there is nothing to detach. */
    resolveDetach: (clientX: number, clientY: number) => { x: number; y: number } | null | undefined;
    updateSnapPicker: (clientX: number, clientY: number) => void;
    commitPosition: (next: { x: number; y: number }) => void;
    setA: (value: boolean) => void;
    setB: (value: boolean) => void;
    snapTo: (region: FloatingWindowSnapRegion) => void;
    hideSnapLayout: () => void;
};

/** A pointer emits moves far faster than the page paints, and every commit re-renders the
 *  window (and, through the snap picker, its overlay). Only the newest sample can be on screen
 *  anyway, so the handlers just record it and one frame applies it. Without rAF (SSR, a stub
 *  environment) the sample is applied inline and the loop behaves exactly as it used to. */
const scheduleFrame = typeof requestAnimationFrame == "function" ? requestAnimationFrame : null;

export function useFloatingWindowDragLoop(o: FloatingWindowDragLoop) {
    const {a, b} = o;
    useEffect(() => {
        let frame = 0;
        let pendingMouse: {clientX: number; clientY: number} | null = null;
        let pendingTouch: {clientX: number; clientY: number} | null = null;

        const applyMouse = (clientX: number, clientY: number) => {
            if (o.lastC.current == null) return;
            const detached = o.resolveDetach(clientX, clientY);
            if (detached === null) return;              // still parked on the edge
            if (detached) o.lastC.current = detached;
            const data = o.lastC.current;
            o.updateSnapPicker(clientX, clientY);
            o.commitPosition(clampToLimit(clientX + data.x, clientY + data.y, o.limitRef.current));
        };
        const applyTouch = (clientX: number, clientY: number) => {
            const data = o.lastT.current;
            if (!data) return;
            const detached = o.resolveDetach(clientX, clientY);
            if (detached === null) return;              // still parked on the edge
            if (detached) o.lastT.current = {...data, ...detached};
            const offset = o.lastT.current ?? data;
            o.updateSnapPicker(clientX, clientY);
            o.commitPosition(clampToLimit(clientX + offset.x, clientY + offset.y, o.limitRef.current));
        };
        const runFrame = () => {
            const mouse = pendingMouse;
            const touch = pendingTouch;
            pendingMouse = null;
            pendingTouch = null;
            if (mouse) applyMouse(mouse.clientX, mouse.clientY);
            if (touch) applyTouch(touch.clientX, touch.clientY);
        };
        const schedule = () => {
            if (frame) return;
            if (!scheduleFrame) return runFrame();
            frame = scheduleFrame(() => {
                frame = 0;
                runFrame();
            });
        };
        /** The release must land on the pointer's last sample, not on the one before it. */
        const flushFrame = () => {
            if (frame) {
                cancelAnimationFrame(frame);
                frame = 0;
            }
            runFrame();
        };

        const mouseMoveHandler = (e: MouseEvent) => {
            e.stopPropagation();
            if (o.lastC.current == null) return;
            if (e.buttons !== 1) return mouseUpHandler();
            pendingMouse = {clientX: e.clientX, clientY: e.clientY};
            schedule();
        };
        const mouseUpHandler = () => {
            flushFrame();
            const target = o.snapPreviewRef.current;
            document.removeEventListener("mouseup", mouseUpHandler);
            document.removeEventListener("mousemove", mouseMoveHandler);
            o.lastC.current = null;
            o.pendingDetach.current = null;
            o.setA(false);
            if (target) o.snapTo(target);
            else o.hideSnapLayout();
            if (o.ks) floatingWindowMap.touch(o.ks);
        };

        const touchMoveHandler = (e: TouchEvent) => {
            const data = o.lastT.current;
            if (!data) return touchEndHandler(e);

            let t: Touch | null = null;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const zz = e.changedTouches[i];
                if (zz.identifier === data.id) t = zz;
            }
            if (!t) return;

            // The tap/drag verdict stays synchronous: touchend reads it, and a frame may not
            // have run by then.
            const tapStart = o.touchTap.current.start;
            if (tapStart && (Math.abs(t.clientX - tapStart.x) > 8 || Math.abs(t.clientY - tapStart.y) > 8)) {
                o.touchTap.current.moved = true;
            }

            pendingTouch = {clientX: t.clientX, clientY: t.clientY};
            schedule();
        };
        const touchEndHandler = (e: TouchEvent) => {
            flushFrame();
            const data = o.lastT.current;
            if (data) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const zz = e.changedTouches[i];
                    if (zz.identifier === data.id) {
                        o.lastT.current = null;
                    }
                }
            }
            if (o.lastT.current == null) {
                const target = o.snapPreviewRef.current;
                document.removeEventListener("touchend", touchEndHandler);
                document.removeEventListener("touchmove", touchMoveHandler);
                o.pendingDetach.current = null;
                o.setB(false);
                if (target) o.snapTo(target);
                else o.hideSnapLayout();
                if (o.ks) floatingWindowMap.touch(o.ks);
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
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
            pendingMouse = null;
            pendingTouch = null;
            document.removeEventListener("mousemove", mouseMoveHandler);
            document.removeEventListener("mouseup", mouseUpHandler);
            document.removeEventListener("touchmove", touchMoveHandler);
            document.removeEventListener("touchend", touchEndHandler);
        };
    }, [a, b]);
}
