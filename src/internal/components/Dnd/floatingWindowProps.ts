/** Public prop/controller contracts of the floating-window layer. Data-only, so the renderer,
 *  the controller hook and the chrome can each name them without importing one another.
 *  FloatingWindow.tsx re-exports all of this unchanged - this file is internal. */
import type React from "react";
import type { ReactNode } from "react";
import type { RndResizeCallback, RndResizeStartCallback } from "react-rnd";
import type {
    FloatingWindowCloseReason,
    FloatingWindowMode,
    FloatingWindowPosition,
    FloatingWindowSize,
    FloatingWindowSnapRegion,
} from "../../persist/floatingWindowTypes.js";

export type FloatingWindowUpdate = {
    e: MouseEvent | TouchEvent;
    dir: string;
    elementRef: HTMLElement;
    delta: { width: number; height: number };
    position: FloatingWindowPosition;
};
export type FloatingWindowProps = {
    /** Stable public identity used by the window manager. */
    windowId?: string;
    /** Windows only reorder against peers in the same group. */
    stackGroup?: string;
    /** Persist a multi-window layout as `${layoutGroup}:${windowId}` without repeating keyForSave. */
    layoutGroup?: string;
    zIndex?: number;
    disableDragging?: () => boolean;
    keyForSave?: string;
    onUpdate?: (data: FloatingWindowUpdate) => void;
    position?: FloatingWindowPosition;
    size?: FloatingWindowSize;
    title?: ReactNode;
    taskbarLabel?: ReactNode;
    ariaLabel?: string;
    /** Enable maximize/restore behavior (double-click, two taps, keyboard and controller). */
    maximizable?: boolean;
    /** Render the maximize control. The behavior remains available when this is hidden. @default false */
    maximizeButton?: boolean;
    /** Enable minimize behavior through the button, keyboard, taskbar and controller. */
    minimizable?: boolean;
    /** Render the minimize control when minimizable. @default true */
    minimizeButton?: boolean;
    /** Enable the Windows 11-like layout picker while dragging near the top centre. */
    snappable?: boolean;
    defaultMaximized?: boolean;
    defaultMinimized?: boolean;
    onModeChange?: (mode: FloatingWindowMode) => void;
    onMinimizedChange?: (minimized: boolean) => void;
    onSnapChange?: (region: FloatingWindowSnapRegion | null) => void;
    onActiveChange?: (active: boolean) => void;
    onPositionChange?: (position: FloatingWindowPosition) => void;
    onSizeChange?: (size: FloatingWindowSize) => void;
    /** Modern close API with a reason. The legacy onClickClose remains supported. */
    onClose?: (reason: FloatingWindowCloseReason) => void;
    beforeClose?: (reason: FloatingWindowCloseReason) => boolean | Promise<boolean>;
    closable?: boolean;
    closeOnEscape?: boolean;
    moveOnlyHeader?: boolean;
    /** Show the close button and handle its click. */
    onClickClose?: () => void;
    header?: React.ReactElement | boolean;
    overflow?: boolean;
    sizeByWindow?: boolean;
    /** Cascade windows that have neither a saved nor explicit position. */
    cascade?: boolean;
    /**
     * Render in the shared viewport layer (document.body) so ancestor stacking
     * contexts and overflow cannot trap the window. Disable only for a window
     * that intentionally belongs to a positioned parent.
     * @default true
     */
    portal?: boolean;
    /** Custom target for the viewport layer. Defaults to document.body. */
    portalContainer?: Element;
    limit?: {
        x?: { max?: number; min?: number };
        y?: { max?: number; min?: number };
    };
    children: React.ReactElement | ((update: number) => React.ReactElement);
    className?: string;
};
export type FloatingWindowControllerOptions = Omit<
    FloatingWindowProps,
    "children" | "className" | "header" | "moveOnlyHeader" | "overflow" | "onClickClose" | "onClose" | "beforeClose" | "closable" | "closeOnEscape" | "portal" | "portalContainer" | "title" | "ariaLabel" | "maximizeButton" | "minimizeButton"
>;

export type FloatingWindowController = {
    position: FloatingWindowPosition;
    size: FloatingWindowSize;
    update: number;
    stackIndex: number;
    zIndex: number;
    overlayZIndex: number;
    dragging: boolean;
    active: boolean;
    mode: FloatingWindowMode;
    minimized: boolean;
    snapRegion: FloatingWindowSnapRegion | null;
    snapLayoutVisible: boolean;
    snapPreview: FloatingWindowSnapRegion | null;
    windowRef: React.RefObject<HTMLDivElement | null>;
    headerRef: React.RefObject<HTMLDivElement | null>;
    bringToFront(): void;
    maximize(): void;
    restore(): void;
    toggleMaximize(): void;
    minimize(): void;
    unminimize(): void;
    snapTo(region: FloatingWindowSnapRegion): void;
    showSnapLayout(): void;
    hideSnapLayout(): void;
    previewSnap(region: FloatingWindowSnapRegion | null): void;
    onWindowPointerDown: React.PointerEventHandler<HTMLDivElement>;
    onHeaderTouchStart: React.TouchEventHandler<HTMLDivElement>;
    onHeaderTouchEnd: React.TouchEventHandler<HTMLDivElement>;
    onHeaderMouseDown: React.MouseEventHandler<HTMLDivElement>;
    onHeaderDoubleClick: React.MouseEventHandler<HTMLDivElement>;
    onWindowMouseDown: React.MouseEventHandler<HTMLDivElement>;
    onWindowKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
    onResize: RndResizeCallback;
    onResizeStart: RndResizeStartCallback;
    onResizeStop: RndResizeCallback;
};
