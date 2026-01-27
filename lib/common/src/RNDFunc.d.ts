/// <reference types="react" />
export declare function Drag2({ children, onY, onX, x, y, last, onStart, onStop, }: {
    children: React.JSX.Element;
    onX?: (x: number) => void;
    onY?: (y: number) => void;
    x?: number;
    y?: number;
    last?: React.RefObject<{
        x: number;
        y: number;
    }>;
    onStart?: () => void;
    onStop?: () => void;
}): import("react/jsx-runtime").JSX.Element;
