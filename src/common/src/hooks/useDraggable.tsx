import { useRef, useState, useEffect } from "react";

export interface Position {
    x: number;
    y: number;
}

export interface UseDraggableReturn {
    position: Position;
    dragProps: {
        onMouseDown: React.MouseEventHandler<HTMLDivElement>;
        onTouchStart: React.TouchEventHandler<HTMLDivElement>;
    };
}

type DragEndCallback = (finalPosition: Position) => void;
type DragStartCallback = () => void;

export function useDraggable(
    initialX: number = 0,
    initialY: number = 0,
    timeOut: number = 500,
    onDragEnd?: DragEndCallback,
    onDragStart?: DragStartCallback
): UseDraggableReturn {
    const [position, setPosition] = useState<Position>({ x: initialX, y: initialY });
    const positionRef = useRef(position);
    const setPos = (p: Position) => {
        positionRef.current = p;
        setPosition(p);
    };

    const offsetMouse = useRef<Position>({ x: 0, y: 0 });
    const offsetTouch = useRef<{ x: number; y: number; id: number } | null>(null);
    const [draggingMouse, setDraggingMouse] = useState(false);
    const [draggingTouch, setDraggingTouch] = useState(false);

    // Колбэки через ref: эффекты подписки не зависят от их идентичности
    const onDragEndRef = useRef(onDragEnd);
    const onDragStartRef = useRef(onDragStart);
    useEffect(() => {
        onDragEndRef.current = onDragEnd;
        onDragStartRef.current = onDragStart;
    });

    // Таймеры для определения длинного нажатия
    const holdTimerMouse = useRef<number | null>(null);
    const holdTimerTouch = useRef<number | null>(null);

    // Стабильные (одна ссылка на всё время жизни) хендлеры отмены hold —
    // раньше add/remove получали разные функции между рендерами и листенеры копились
    const cancelMouseHold = useRef(function cancelMouseHold() {
        if (holdTimerMouse.current != null) {
            clearTimeout(holdTimerMouse.current);
            holdTimerMouse.current = null;
        }
        document.removeEventListener("mouseup", cancelMouseHold);
    }).current;

    const cancelTouchHold = useRef(function cancelTouchHold() {
        if (holdTimerTouch.current != null) {
            clearTimeout(holdTimerTouch.current);
            holdTimerTouch.current = null;
        }
        document.removeEventListener("touchend", cancelTouchHold);
    }).current;

    const handleMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
        e.preventDefault();
        offsetMouse.current = {
            x: e.clientX,
            y: e.clientY,
        };
        if (timeOut) {
            holdTimerMouse.current = window.setTimeout(() => {
                holdTimerMouse.current = null;
                document.removeEventListener("mouseup", cancelMouseHold);
                setDraggingMouse(true);
            }, timeOut);
            document.addEventListener("mouseup", cancelMouseHold);
        }
        onDragStartRef.current?.();
    };

    const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
        const touch = e.changedTouches[0];
        if (!touch) return;
        offsetTouch.current = {
            x: touch.clientX,
            y: touch.clientY,
            id: touch.identifier,
        };
        if (timeOut) {
            holdTimerTouch.current = window.setTimeout(() => {
                holdTimerTouch.current = null;
                document.removeEventListener("touchend", cancelTouchHold);
                setDraggingTouch(true);
            }, timeOut);
            document.addEventListener("touchend", cancelTouchHold);
        }
    };

    useEffect(() => {
        if (!draggingMouse) return;

        const handleMouseMove = (e: MouseEvent) => {
            setPos({
                x: e.clientX - offsetMouse.current.x,
                y: e.clientY - offsetMouse.current.y,
            });
        };

        const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            const final = { ...positionRef.current };
            setPos({ x: 0, y: 0 });
            setDraggingMouse(false);
            onDragEndRef.current?.(final);
            offsetMouse.current = { x: 0, y: 0 };
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [draggingMouse]);

    useEffect(() => {
        if (!draggingTouch) return;

        const handleTouchMove = (e: TouchEvent) => {
            if (!offsetTouch.current) return;
            const theTouch = Array.from(e.changedTouches).find(
                (t) => t.identifier === offsetTouch.current?.id
            );
            if (!theTouch) return;
            setPos({
                x: theTouch.clientX - offsetTouch.current.x,
                y: theTouch.clientY - offsetTouch.current.y,
            });
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (!offsetTouch.current) return;
            const ended = Array.from(e.changedTouches).find(
                (t) => t.identifier === offsetTouch.current?.id
            );
            if (ended) {
                document.removeEventListener("touchmove", handleTouchMove);
                document.removeEventListener("touchend", handleTouchEnd);
                const final = { ...positionRef.current };
                setPos({ x: 0, y: 0 });
                setDraggingTouch(false);
                onDragEndRef.current?.(final);
                offsetTouch.current = null;
            }
        };

        document.addEventListener("touchmove", handleTouchMove);
        document.addEventListener("touchend", handleTouchEnd);

        return () => {
            document.removeEventListener("touchmove", handleTouchMove);
            document.removeEventListener("touchend", handleTouchEnd);
        };
    }, [draggingTouch]);

    // Размонтирование во время hold: чистим таймеры и hold-листенеры
    useEffect(() => () => {
        if (holdTimerMouse.current != null) clearTimeout(holdTimerMouse.current);
        if (holdTimerTouch.current != null) clearTimeout(holdTimerTouch.current);
        document.removeEventListener("mouseup", cancelMouseHold);
        document.removeEventListener("touchend", cancelTouchHold);
    }, []);

    return {
        position,
        dragProps: {
            onMouseDown: handleMouseDown,
            onTouchStart: handleTouchStart,
        },
    };
}
