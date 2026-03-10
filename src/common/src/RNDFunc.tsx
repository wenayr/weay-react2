import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";

//
export function Drag2({
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
    const lastD = useRef<{ x: number; y: number }>(last?.current ?? { y: x, x: y });

    // Обновляем значения `lastD` при изменении `x` или `y`
    useLayoutEffect(() => {
        lastD.current.x = x;
        lastD.current.y = y;
    }, [x, y]);

    // Основная логика обработки событий перемещения
    useEffect(() => {
        if (!(a || b)) {
            onStop?.();
            return;
        }

        if (a) {
            const handleMouseMove = (e: MouseEvent) => {
                if (!lastC.current) {
                    lastC.current = { x: e.clientX, y: e.clientY };
                }

                const data = lastC.current;

                // Вычисляем и обновляем координаты
                lastD.current.x = e.clientX + data.x;
                lastD.current.y = e.clientY + data.y;
                onX?.(lastD.current.x);
                onY?.(lastD.current.y);

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

            onStart?.();

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

                // Вычисляем и обновляем координаты
                lastD.current.x = touch.clientX + data.x;
                lastD.current.y = touch.clientY + data.y;
                onX?.(lastD.current.x);
                onY?.(lastD.current.y);

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

            onStart?.();

            return () => {
                document.body.removeEventListener("touchmove", handleTouchMove);
                document.body.removeEventListener("touchend", handleTouchEnd);
            };
        }
    }, [a, b, onX, onY, onStart, onStop]);

    // Создаем элемент для перемещения
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