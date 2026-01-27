import { ResizableProps } from "re-resizable";
type tSaveMap = {
    height?: number | string;
    width?: number | string;
};
export declare const mapResiReact: Map<string, tSaveMap>;
type t3 = Pick<ResizableProps, "style" | "enable" | "onResize" | "children" | "size" | "maxWidth" | "maxHeight" | "minWidth" | "minHeight">;
export declare function FResizableReact({ style, onResize, enable, children, keyForSave, onResizeStop, size, minWidth, minHeight, maxWidth, maxHeight, moveWith, moveHeight }: t3 & {
    keyForSave?: string;
    onResize?: (size?: tSaveMap) => void;
    onResizeStop?: (size: tSaveMap) => void;
    moveWith?: boolean;
    moveHeight?: boolean;
}): import("react/jsx-runtime").JSX.Element;
export {};
