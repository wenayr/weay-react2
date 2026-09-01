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

export function useFloatingWindowDragLoop(o: FloatingWindowDragLoop) {
    const {a, b} = o;
    useEffect(() => {
        const mouseMoveHandler = (e: MouseEvent) => {
            e.stopPropagation();
            if (o.lastC.current == null) return;
            if (e.buttons !== 1) return mouseUpHandler();
            const detached = o.resolveDetach(e.clientX, e.clientY);
            if (detached === null) return;              // still parked on the edge
            if (detached) o.lastC.current = detached;
            const data = o.lastC.current;
            o.updateSnapPicker(e.clientX, e.clientY);
            o.commitPosition(clampToLimit(e.clientX + data.x, e.clientY + data.y, o.limitRef.current));
        };
        const mouseUpHandler = () => {
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

            const tapStart = o.touchTap.current.start;
            if (tapStart && (Math.abs(t.clientX - tapStart.x) > 8 || Math.abs(t.clientY - tapStart.y) > 8)) {
                o.touchTap.current.moved = true;
            }

            const detached = o.resolveDetach(t.clientX, t.clientY);
            if (detached === null) return;              // still parked on the edge
            if (detached) o.lastT.current = {...data, ...detached};
            const offset = o.lastT.current ?? data;
            o.updateSnapPicker(t.clientX, t.clientY);
            o.commitPosition(clampToLimit(t.clientX + offset.x, t.clientY + offset.y, o.limitRef.current));
        };
        const touchEndHandler = (e: TouchEvent) => {
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
            document.removeEventListener("mousemove", mouseMoveHandler);
            document.removeEventListener("mouseup", mouseUpHandler);
            document.removeEventListener("touchmove", touchMoveHandler);
            document.removeEventListener("touchend", touchEndHandler);
        };
    }, [a, b]);
}
