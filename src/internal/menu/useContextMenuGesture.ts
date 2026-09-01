import {useRef} from "react";
import type React from "react";

/** Movement in CSS px that turns a long press into a scroll. */
export const TOUCH_SLOP = 10;
/** Long-press and double-click windows, ms. */
export const LONG_PRESS_MS = 300;
export const DOUBLE_CLICK_MS = 300;

export type ContextMenuGestureOpen = (
    anchor: {clientX: number; clientY: number; target: EventTarget | null; preventDefault: () => void; stopPropagation: () => void},
    pointer: "mouse" | "touch",
) => void;

/** The one right-click / long-press / double-click gesture recogniser, shared by
 *  contextMenu.Layer (menuMouse.tsx) and MenuR (menuR.tsx). Both used to carry a
 *  copy-pasted block of these five handlers with a "keep the two in step" comment; now
 *  there is one. Returns spreadable DOM handlers; the host decides what opening means.
 *
 *  Touch coordinates are recorded unconditionally on start: the old `if (x == 0)` guard
 *  reset only after a SUCCESSFUL long press, so an aborted gesture left the previous
 *  touch's coordinates in place. The slop is in pixels, not a fraction of pageX, so the
 *  scroll threshold does not depend on where on the page the touch landed. */
export function useContextMenuGesture({enabled, onOpen}: {enabled: boolean; onOpen: ContextMenuGestureOpen}) {
    const timeEvent = useRef(0);
    const touchXY = useRef({x: 0, y: 0});
    const touchTime = useRef<null | number>(null);

    function onMouseUp(event: {button: number; clientX: number; clientY: number; target?: EventTarget | null; preventDefault?: () => void; stopPropagation?: () => void}) {
        if (!enabled) return;
        if (event.button == 2 || Date.now() - timeEvent.current < DOUBLE_CLICK_MS) {
            onOpen({
                clientX: event.clientX, clientY: event.clientY, target: event.target ?? null,
                preventDefault: () => event.preventDefault?.(), stopPropagation: () => event.stopPropagation?.(),
            }, "mouse");
        }
    }

    return {
        onMouseUp,
        onDoubleClick() { timeEvent.current = Date.now(); },
        onTouchStart(e: React.TouchEvent) {
            touchXY.current.x = e.touches[0].screenX;
            touchXY.current.y = e.touches[0].screenY;
            touchTime.current = Date.now();
        },
        onTouchMove(e: React.TouchEvent) {
            const x2 = e.touches[0].screenX;
            const y2 = e.touches[0].screenY;
            if (Math.abs(x2 - touchXY.current.x) > TOUCH_SLOP || Math.abs(y2 - touchXY.current.y) > TOUCH_SLOP) {
                touchTime.current = null;
            }
        },
        onTouchEnd(e: React.TouchEvent) {
            if (!enabled) return;
            if (touchTime.current && Date.now() - touchTime.current > LONG_PRESS_MS) {
                touchTime.current = null;
                touchXY.current.x = touchXY.current.y = 0;
                onOpen({
                    clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY, target: e.target,
                    preventDefault: () => e.preventDefault(), stopPropagation: () => e.stopPropagation(),
                }, "touch");
            }
        },
    };
}
