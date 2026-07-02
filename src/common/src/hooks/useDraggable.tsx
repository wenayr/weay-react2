import React, { useEffect, useMemo, useRef, useState } from "react";

export interface Position {
    x: number;
    y: number;
}

export type UseDraggableOptions = {
    initialPosition?: Position;
    holdMs?: number;
    onDragEnd?: DragEndCallback;
    onDragStart?: DragStartCallback;
};

export interface UseDraggableReturn {
    readonly position: Position;
    dragProps: {
        onMouseDown: React.MouseEventHandler<HTMLDivElement>;
        onTouchStart: React.TouchEventHandler<HTMLDivElement>;
    };
}

export interface UseDraggableApi extends UseDraggableReturn {
    props: UseDraggableReturn["dragProps"];
    bind: UseDraggableReturn["dragProps"];
    readonly positionRef: React.RefObject<Position>;
    readonly isDragging: boolean;
    getPosition(): Position;
    setPosition(position: Position): void;
    resetPosition(): void;
    cancelDrag(): void;
}

type DragEndCallback = (finalPosition: Position) => void;
type DragStartCallback = () => void;

export function useDraggableApi(options: UseDraggableOptions = {}): UseDraggableApi {
    const { initialPosition = { x: 0, y: 0 }, holdMs = 500, onDragEnd, onDragStart } = options;
    const [position, setPositionState] = useState<Position>(initialPosition);
    const positionRef = useRef(position);
    const holdMsRef = useRef(holdMs);
    const offsetMouse = useRef<Position>({ x: 0, y: 0 });
    const offsetTouch = useRef<{ x: number; y: number; id: number } | null>(null);
    const [draggingMouse, setDraggingMouse] = useState(false);
    const [draggingTouch, setDraggingTouch] = useState(false);
    const draggingRef = useRef(false);

    const onDragEndRef = useRef(onDragEnd);
    const onDragStartRef = useRef(onDragStart);
    const holdTimerMouse = useRef<number | null>(null);
    const holdTimerTouch = useRef<number | null>(null);

    const setPos = (p: Position) => {
        positionRef.current = p;
        setPositionState(p);
    };

    holdMsRef.current = holdMs;
    draggingRef.current = draggingMouse || draggingTouch;

    useEffect(() => {
        onDragEndRef.current = onDragEnd;
        onDragStartRef.current = onDragStart;
    });

    const cancelMouseHold = useMemo(() => function cancelMouseHold() {
        if (holdTimerMouse.current != null) {
            clearTimeout(holdTimerMouse.current);
            holdTimerMouse.current = null;
        }
        document.removeEventListener("mouseup", cancelMouseHold);
    }, []);

    const cancelTouchHold = useMemo(() => function cancelTouchHold() {
        if (holdTimerTouch.current != null) {
            clearTimeout(holdTimerTouch.current);
            holdTimerTouch.current = null;
        }
        document.removeEventListener("touchend", cancelTouchHold);
    }, []);

    const bind = useMemo<UseDraggableReturn["dragProps"]>(() => ({
        onMouseDown(e) {
            e.preventDefault();
            offsetMouse.current = { x: e.clientX, y: e.clientY };
            if (holdMsRef.current > 0) {
                holdTimerMouse.current = window.setTimeout(() => {
                    holdTimerMouse.current = null;
                    document.removeEventListener("mouseup", cancelMouseHold);
                    setDraggingMouse(true);
                }, holdMsRef.current);
                document.addEventListener("mouseup", cancelMouseHold);
            } else {
                setDraggingMouse(true);
            }
            onDragStartRef.current?.();
        },
        onTouchStart(e) {
            const touch = e.changedTouches[0];
            if (!touch) return;
            offsetTouch.current = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
            if (holdMsRef.current > 0) {
                holdTimerTouch.current = window.setTimeout(() => {
                    holdTimerTouch.current = null;
                    document.removeEventListener("touchend", cancelTouchHold);
                    setDraggingTouch(true);
                }, holdMsRef.current);
                document.addEventListener("touchend", cancelTouchHold);
            } else {
                setDraggingTouch(true);
            }
            onDragStartRef.current?.();
        },
    }), [cancelMouseHold, cancelTouchHold]);

    useEffect(() => {
        if (!draggingMouse) return;

        const handleMouseMove = (e: MouseEvent) => {
            setPos({ x: e.clientX - offsetMouse.current.x, y: e.clientY - offsetMouse.current.y });
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
            const theTouch = Array.from(e.changedTouches).find((t) => t.identifier === offsetTouch.current?.id);
            if (!theTouch) return;
            setPos({ x: theTouch.clientX - offsetTouch.current.x, y: theTouch.clientY - offsetTouch.current.y });
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (!offsetTouch.current) return;
            const ended = Array.from(e.changedTouches).find((t) => t.identifier === offsetTouch.current?.id);
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

    useEffect(() => () => {
        if (holdTimerMouse.current != null) clearTimeout(holdTimerMouse.current);
        if (holdTimerTouch.current != null) clearTimeout(holdTimerTouch.current);
        document.removeEventListener("mouseup", cancelMouseHold);
        document.removeEventListener("touchend", cancelTouchHold);
    }, [cancelMouseHold, cancelTouchHold]);

    return useMemo(() => ({
        get position() { return positionRef.current; },
        get positionRef() { return positionRef; },
        get isDragging() { return draggingRef.current; },
        props: bind,
        bind,
        dragProps: bind,
        getPosition() { return { ...positionRef.current }; },
        setPosition: setPos,
        resetPosition() { setPos({ x: 0, y: 0 }); },
        cancelDrag() {
            cancelMouseHold();
            cancelTouchHold();
            offsetTouch.current = null;
            setDraggingMouse(false);
            setDraggingTouch(false);
            setPos({ x: 0, y: 0 });
        },
    }), [bind, cancelMouseHold, cancelTouchHold]);
}

export function useDraggable(
    initialX: number = 0,
    initialY: number = 0,
    timeOut: number = 500,
    onDragEnd?: DragEndCallback,
    onDragStart?: DragStartCallback
): UseDraggableApi {
    return useDraggableApi({
        initialPosition: { x: initialX, y: initialY },
        holdMs: timeOut,
        onDragEnd,
        onDragStart,
    });
}