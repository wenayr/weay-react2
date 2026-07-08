import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";

//
export function DragArea({
                          children,
                          onY,
                          onX,
                          x = 0,
                          y = 0,
                          last,
                          onStart,
                          onStop,
                      }: {
    children: React.JSX.Element;
    onX?: (x: number) => void;
    onY?: (y: number) => void;
    x?: number;
    y?: number;
    last?: React.RefObject<{ x: number; y: number }>;
    onStart?: () => void;
    onStop?: () => void;
}) {
    const lastC = useRef<{ x: number; y: number } | null>(null);
    const lastT = useRef<{ x: number; y: number; id: number } | null>(null);
    const [a, setA] = useState(false);
    const [b, setB] = useState(false);
    // Default was {y: x, x: y} - coordinates were swapped; fixed (K3, see CHANGELOG/plan)
    const lastD = useRef<{ x: number; y: number }>(last?.current ?? { x, y });
    const wasDragging = useRef(false);
    // callbacks via ref: with them in the effect deps an inline callback from the consumer
    // resubscribed document listeners and re-fired onStart on every drag tick
    const callbacksRef = useRef({ onX, onY, onStart, onStop });
    callbacksRef.current = { onX, onY, onStart, onStop };

    // Update `lastD` values when `x` or `y` changes
    useLayoutEffect(() => {
        lastD.current.x = x;
        lastD.current.y = y;
    }, [x, y]);

    // Main movement event handling logic
    useEffect(() => {
        if (!(a || b)) {
            // onStop only after a real drag - previously it also fired on initial mount
            if (wasDragging.current) {
                wasDragging.current = false;
                callbacksRef.current.onStop?.();
            }
            return;
        }
        wasDragging.current = true;

        if (a) {
            const handleMouseMove = (e: MouseEvent) => {
                // mousedown always sets lastC before this subscription exists
                if (!lastC.current) return;
                const data = lastC.current;

                // Calculate and update coordinates
                lastD.current.x = e.clientX + data.x;
                lastD.current.y = e.clientY + data.y;
                callbacksRef.current.onX?.(lastD.current.x);
                callbacksRef.current.onY?.(lastD.current.y);

                e.stopPropagation();
            };

            const handleMouseUp = () => {
                document.body.removeEventListener("mousemove", handleMouseMove);
                document.body.removeEventListener("mouseup", handleMouseUp);
                lastC.current = null;
                setA(false);
            };

            document.body.addEventListener("mousemove", handleMouseMove);
            document.body.addEventListener("mouseup", handleMouseUp);

            callbacksRef.current.onStart?.();

            return () => {
                document.body.removeEventListener("mousemove", handleMouseMove);
                document.body.removeEventListener("mouseup", handleMouseUp);
            };
        }

        if (b) {
            const handleTouchMove = (e: TouchEvent) => {
                const data = lastT.current;
                if (!data) return;

                const touch = Array.from(e.changedTouches).find((t) => t.identifier === data.id);
                if (!touch) return;

                // Calculate and update coordinates
                lastD.current.x = touch.clientX + data.x;
                lastD.current.y = touch.clientY + data.y;
                callbacksRef.current.onX?.(lastD.current.x);
                callbacksRef.current.onY?.(lastD.current.y);

                e.stopPropagation();
            };

            const handleTouchEnd = (e: TouchEvent) => {
                const data = lastT.current;

                if (data) {
                    const touch = Array.from(e.changedTouches).find((t) => t.identifier === data.id);
                    if (touch) {
                        lastT.current = null;
                    }
                }

                if (!lastT.current) {
                    document.body.removeEventListener("touchmove", handleTouchMove);
                    document.body.removeEventListener("touchend", handleTouchEnd);
                    setB(false);
                }
            };

            document.body.addEventListener("touchmove", handleTouchMove);
            document.body.addEventListener("touchend", handleTouchEnd);

            callbacksRef.current.onStart?.();

            return () => {
                document.body.removeEventListener("touchmove", handleTouchMove);
                document.body.removeEventListener("touchend", handleTouchEnd);
            };
        }
    }, [a, b]);

    // Create an element for dragging
    return useMemo(
        () => (
            <div
                style={{
                    width: "auto",
                    height: "auto",
                }}
                onTouchStart={(e) => {
                    const touch = e.changedTouches[0];
                    if (touch) {
                        lastD.current.x = x;
                        lastD.current.y = y;
                        lastT.current = {
                            x: lastD.current.x - touch.clientX,
                            y: lastD.current.y - touch.clientY,
                            id: touch.identifier,
                        };
                    }
                    setB(true);
                }}
                onMouseDown={(e) => {
                    lastD.current.x = x;
                    lastD.current.y = y;
                    lastC.current = {
                        x: lastD.current.x - e.clientX,
                        y: lastD.current.y - e.clientY,
                    };
                    setA(true);
                }}
            >
                {children}
            </div>
        ),
        [children, x, y]
    );
}