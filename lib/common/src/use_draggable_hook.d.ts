/// <reference types="react" />
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
export declare function useDraggable(initialX?: number, initialY?: number, timeOut?: number, onDragEnd?: DragEndCallback, onDragStart?: DragStartCallback): UseDraggableReturn;
export {};
