import { useRef, useState, useEffect } from "react";
export function useDraggable(initialX = 0, initialY = 0, timeOut = 500, onDragEnd, onDragStart) {
    const [position, setPosition] = useState({ x: initialX, y: initialY });
    const offsetMouse = useRef({ x: 0, y: 0 });
    const offsetTouch = useRef(null);
    const [draggingMouse, setDraggingMouse] = useState(false);
    const [draggingTouch, setDraggingTouch] = useState(false);
    // Таймеры для определения длинного нажатия
    const holdTimerMouse = useRef(null);
    const holdTimerTouch = useRef(null);
    const cancelMouseHold = () => {
        if (holdTimerMouse.current) {
            clearTimeout(holdTimerMouse.current);
            holdTimerMouse.current = null;
        }
        document.removeEventListener("mouseup", handleMouseUpForHold);
    };
    const handleMouseUpForHold = () => {
        cancelMouseHold();
    };
    const handleMouseDown = (e) => {
        e.preventDefault();
        offsetMouse.current = {
            x: e.clientX,
            y: e.clientY,
        };
        if (timeOut) {
            holdTimerMouse.current = window.setTimeout(() => {
                setDraggingMouse(true);
                holdTimerMouse.current = null;
                document.removeEventListener("mouseup", handleMouseUpForHold);
            }, timeOut);
            document.addEventListener("mouseup", handleMouseUpForHold);
        }
        onDragStart?.();
    };
    const cancelTouchHold = () => {
        if (holdTimerTouch.current) {
            clearTimeout(holdTimerTouch.current);
            holdTimerTouch.current = null;
        }
        document.removeEventListener("touchend", handleTouchEndForHold);
    };
    const handleTouchEndForHold = () => {
        cancelTouchHold();
    };
    const handleTouchStart = (e) => {
        const touch = e.changedTouches[0];
        if (!touch)
            return;
        offsetTouch.current = {
            x: touch.clientX,
            y: touch.clientY,
            id: touch.identifier,
        };
        if (timeOut) {
            holdTimerTouch.current = window.setTimeout(() => {
                setDraggingTouch(true);
                holdTimerTouch.current = null;
                document.removeEventListener("touchend", handleTouchEndForHold);
            }, timeOut);
            document.addEventListener("touchend", handleTouchEndForHold);
        }
    };
    useEffect(() => {
        if (draggingMouse) {
            const handleMouseMove = (e) => {
                const newX = e.clientX - offsetMouse.current.x;
                const newY = e.clientY - offsetMouse.current.y;
                setPosition({ x: newX, y: newY });
            };
            const handleMouseUp = (e) => {
                setPosition({ x: 0, y: 0 });
                // Остальные действия по завершению перетаскивания мышью
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
                setDraggingMouse(false);
                if (onDragEnd) {
                    onDragEnd({ ...position });
                }
                // Сбрасываем смещение
                offsetMouse.current = { x: 0, y: 0 };
            };
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
            return () => {
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
            };
        }
    }, [draggingMouse, onDragEnd, position]);
    useEffect(() => {
        if (draggingTouch) {
            const handleTouchMove = (e) => {
                if (!offsetTouch.current)
                    return;
                const theTouch = Array.from(e.changedTouches).find((t) => t.identifier === offsetTouch.current?.id);
                if (!theTouch)
                    return;
                const newX = theTouch.clientX - offsetTouch.current.x;
                const newY = theTouch.clientY - offsetTouch.current.y;
                setPosition({ x: newX, y: newY });
            };
            const handleTouchEnd = (e) => {
                if (!offsetTouch.current)
                    return;
                const ended = Array.from(e.changedTouches).find((t) => t.identifier === offsetTouch.current?.id);
                if (ended) {
                    setPosition({ x: 0, y: 0 });
                    document.removeEventListener("touchmove", handleTouchMove);
                    document.removeEventListener("touchend", handleTouchEnd);
                    setDraggingTouch(false);
                    if (onDragEnd) {
                        onDragEnd({ ...position });
                    }
                    offsetTouch.current = null;
                }
            };
            document.addEventListener("touchmove", handleTouchMove);
            document.addEventListener("touchend", handleTouchEnd);
            return () => {
                document.removeEventListener("touchmove", handleTouchMove);
                document.removeEventListener("touchend", handleTouchEnd);
            };
        }
    }, [draggingTouch, onDragEnd, position]);
    return {
        position,
        dragProps: {
            onMouseDown: handleMouseDown,
            onTouchStart: handleTouchStart,
        },
    };
}
