/** The renderer half of the floating window: react-rnd wiring, the portal layer, close
 *  arbitration and the chrome. All state lives in useFloatingWindowController; this file only
 *  reads it. Split out of FloatingWindow.tsx, which re-exports everything below unchanged. */
import React, { useCallback, useEffect, useState } from "react";
import { Rnd } from "react-rnd";
import { createPortal } from "react-dom";
import { WindowPortalContext } from "./WindowPortal.js";
import { SnapLayoutOverlay, WindowControls, WindowHeader } from "./WindowChrome.js";
import { useFloatingWindowController } from "./useFloatingWindowController.js";
import type { FloatingWindowProps } from "./floatingWindowProps.js";
import type { FloatingWindowCloseReason } from "../../persist/floatingWindowTypes.js";

// Freezes the subtree until update changes (intentionally ignores render closure changes) -
// the previous useMemo-in-callback semantics, but without calling a hook from an arbitrary place
const MemoChild = React.memo(
    ({ update, render }: { update: number; render: (u: number) => React.ReactElement }) => render(update),
    (prev, next) => prev.update === next.update
);

export const FloatingWindow: typeof FloatingWindowBase = (a) => {
    // Only the render-prop form is frozen between `update` bumps. A plain element child is
    // re-created by the caller on every parent render, so wrapping it in MemoChild (whose
    // `update` would be pinned to 0) froze the subtree at its first render for good.
    const render = a.children;
    if (typeof render !== "function") return <FloatingWindowBase {...a} />;
    const ff = (update: number) => <MemoChild update={update} render={render} />;

    return <FloatingWindowBase {...a} children={ff} />;
};

/**
 * Wrapper component around react-rnd.
 * Provides dragging and resizing, an optional header, and a close button.
 */
export function FloatingWindowBase({
                                children,
                                windowId,
                                stackGroup = "window",
                                layoutGroup,
                                keyForSave: ks,
                                position,
                                size,
                                title,
                                taskbarLabel,
                                ariaLabel,
                                maximizable,
                                maximizeButton,
                                minimizable,
                                minimizeButton,
                                snappable,
                                defaultMaximized = false,
                                defaultMinimized = false,
                                onModeChange,
                                onMinimizedChange,
                                onSnapChange,
                                onActiveChange,
                                onPositionChange,
                                onSizeChange,
                                overflow = true,
                                zIndex = 9,
                                onUpdate,
                                disableDragging,
                                className,
                                header,
                                moveOnlyHeader,
                                limit,
                                onClickClose,
                                onClose,
                                beforeClose,
                                closable,
                                closeOnEscape = false,
                                sizeByWindow = true,
                                cascade,
                                portal = true,
                                portalContainer,
                            }: FloatingWindowProps) {
    const clickClose = onClickClose;
    const showClose = closable ?? !!(onClose || clickClose);
    const portalEnabled = portal && typeof document != "undefined";
    const canMaximize = maximizable ?? portalEnabled;
    const canMinimize = minimizable ?? false;
    const canSnap = snappable ?? portalEnabled;
    const showMaximizeButton = canMaximize && (maximizeButton ?? false);
    const showMinimizeButton = canMinimize && (minimizeButton ?? true);
    // `limit` remains coordinate-system-relative. The default portal uses viewport
    // coordinates; an embedded portal={false} window uses its positioned parent.
    // The sizeByWindow clamp independently keeps the whole window in the viewport.

    const controller = useFloatingWindowController({
        windowId,
        stackGroup,
        layoutGroup,
        keyForSave: ks,
        position,
        size,
        taskbarLabel: taskbarLabel ?? title ?? windowId,
        zIndex,
        onUpdate,
        disableDragging,
        limit,
        sizeByWindow,
        maximizable: canMaximize,
        minimizable: canMinimize,
        snappable: canSnap,
        cascade: cascade ?? portalEnabled,
        defaultMaximized,
        defaultMinimized,
        onModeChange,
        onMinimizedChange,
        onSnapChange,
        onActiveChange,
        onPositionChange,
        onSizeChange,
    });

    const requestClose = (reason: FloatingWindowCloseReason) => {
        const finish = () => {
            if (onClose) onClose(reason);
            else clickClose?.();
        };
        const verdict = beforeClose?.(reason);
        if (verdict && typeof (verdict as Promise<boolean>).then == "function") {
            void Promise.resolve(verdict).then(allowed => { if (allowed !== false) finish(); });
        } else if (verdict !== false) {
            finish();
        }
    };

    useEffect(() => {
        if (!closeOnEscape || !controller.active || !showClose) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key != "Escape") return;
            event.preventDefault();
            requestClose("escape");
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [closeOnEscape, controller.active, showClose, beforeClose, onClose, clickClose]);

    const showHeader = !!(moveOnlyHeader || header || title != null);

    const headerD = <WindowHeader controller={controller} header={header} title={title}/>;

    const [portalRoot, setPortalRoot] = useState<HTMLDivElement | null>(null);
    const [windowRoot, setWindowRoot] = useState<HTMLDivElement | null>(null);
    const setWindowRef = useCallback((node: HTMLDivElement | null) => {
        controller.windowRef.current = node;
        setWindowRoot(node);
    }, [controller.windowRef]);
    const rootClassName = [
        className,
        "wenayWindowRoot",
        controller.active && "wenayWindowRoot_active",
        controller.mode == "maximized" && "wenayWindowRoot_maximized",
        controller.snapRegion && "wenayWindowRoot_snapped",
        controller.minimized && "wenayWindowRoot_minimized",
    ].filter(Boolean).join(" ");

    const windowNode = (
        <Rnd
            disableDragging={true}
            enableResizing={controller.mode == "normal"}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: controller.zIndex,
                isolation: "isolate",
                pointerEvents: "auto",
                display: controller.minimized ? "none" : undefined,
            }}
            data-wenay-window=""
            data-window-id={windowId}
            data-wenay-window-layer={portalEnabled ? "viewport" : "parent"}
            data-active={controller.active ? "true" : "false"}
            data-mode={controller.mode}
            data-minimized={controller.minimized ? "true" : "false"}
            data-snap-region={controller.snapRegion ?? undefined}
            data-position-x={controller.position.x}
            data-position-y={controller.position.y}
            role="dialog"
            aria-label={ariaLabel ?? (typeof title == "string" ? title : undefined)}
            tabIndex={0}
            className={rootClassName}
            onKeyDown={controller.onWindowKeyDown}
            onResizeStart={controller.onResizeStart}
            onResizeStop={controller.onResizeStop}
            onResize={controller.onResize}
            position={controller.position}
            size={controller.size}
        >
            <div
                ref={setWindowRef}
                className="wenayWnd"
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                    flex: "auto"
                }}
                onMouseDown={controller.onWindowMouseDown}
                onPointerDown={controller.onWindowPointerDown}
            >
                {showHeader ? headerD : null}
                <div className="maxSize" style={{ overflow: overflow ? "auto" : undefined }}>
                    {controller.dragging && (
                        <div
                            className="maxSize"
                            style={{
                                position: "absolute",
                                zIndex: controller.overlayZIndex
                            }}
                        ></div>
                    )}
                    {typeof children === "function" ? children(controller.update) : children}
                </div>
                <WindowControls
                    controller={controller}
                    minimize={showHeader && showMinimizeButton}
                    maximize={showHeader && showMaximizeButton}
                    close={showClose}
                    onClose={() => requestClose("close-button")}
                />
            </div>
        </Rnd>
    );

    const snapLayout = canSnap ? <SnapLayoutOverlay controller={controller}/> : null;

    if (!portalEnabled) return <WindowPortalContext.Provider value={windowRoot}>{windowNode}</WindowPortalContext.Provider>;
    return createPortal(
        <div
            ref={setPortalRoot}
            data-wenay-window-portal-root=""
            style={{
                position: "fixed",
                inset: 0,
                zIndex: controller.zIndex,
                isolation: "isolate",
                pointerEvents: "none",
            }}
        >
            {snapLayout}
            <WindowPortalContext.Provider value={portalRoot}>{windowNode}</WindowPortalContext.Provider>
        </div>,
        portalContainer ?? document.body,
    );
}
