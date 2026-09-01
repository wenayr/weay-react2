/** Chrome of a floating window: title bar, the minimize/maximize/close controls, and the
 *  snap-layout picker. Split out of FloatingWindow.tsx because each piece needs nothing but the
 *  controller plus a couple of flags - a real seam, unlike the drag loop and the persistence
 *  effect, which would each need ten setters and refs from the controller body.
 *
 *  Internal: FloatingWindowBase is the only consumer, nothing here is re-exported publicly. */
import React, {ReactNode} from "react";
import type {FloatingWindowController} from "./floatingWindowProps.js";
import {snapLayouts, snapPreviewStyle, snapRegionLabels} from "./windowGeometry.js";

/** The drag handle. Rendered as the first child of .wenayWnd. */
export function WindowHeader({controller, header, title}: {
    controller: FloatingWindowController;
    header?: React.ReactElement | boolean;
    title?: ReactNode;
}) {
    return <div
        ref={controller.headerRef}
        className="wenayWndHeader"
        onTouchStart={controller.onHeaderTouchStart}
        onTouchEnd={controller.onHeaderTouchEnd}
        onMouseDown={controller.onHeaderMouseDown}
        onDoubleClick={controller.onHeaderDoubleClick}
    >
        {header ?? (title != null
            ? <div className="wenayWndTitle">{title}</div>
            : <div className="wenayWndHeaderDef"></div>)}
    </div>;
}

/** A fragment, not a wrapper element: the controls are CSS-positioned against .wenayWnd, so
 *  they must stay direct siblings of the content div. */
export function WindowControls({controller, minimize, maximize, close, onClose}: {
    controller: FloatingWindowController;
    minimize: boolean;
    maximize: boolean;
    close: boolean;
    onClose: () => void;
}) {
    // every control swallows the press so it never reaches the drag/raise handlers
    const stop = (event: React.SyntheticEvent) => event.stopPropagation();
    return <>
        {minimize && (
            <button
                type="button"
                className="wenayWndControl wenayWndMinimize"
                title="Minimize"
                aria-label="Minimize"
                onMouseDown={stop}
                onPointerDown={stop}
                onClick={controller.minimize}
            >
                <span aria-hidden="true" />
            </button>
        )}
        {maximize && (
            <button
                type="button"
                className="wenayWndControl wenayWndMaximize"
                title={controller.mode == "maximized" ? "Restore" : "Maximize"}
                aria-label={controller.mode == "maximized" ? "Restore" : "Maximize"}
                aria-pressed={controller.mode == "maximized"}
                onMouseDown={stop}
                onPointerDown={stop}
                onClick={() => {
                    controller.bringToFront();
                    controller.toggleMaximize();
                }}
            >
                <span aria-hidden="true" />
            </button>
        )}
        {close && (
            <button
                type="button"
                key="323"
                className="wenayCloseBtn wenayWndClose"
                title="Close"
                aria-label="Close"
                style={{zIndex: controller.overlayZIndex}}
                onMouseDown={stop}
                onPointerDown={stop}
                onClick={onClose}
            >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
            </button>
        )}
    </>;
}

/** Windows 11-like layout picker shown while dragging near the top centre. Lives in the
 *  viewport portal layer, above the window itself. */
export function SnapLayoutOverlay({controller}: {controller: FloatingWindowController}) {
    if (!controller.snapLayoutVisible) return null;
    return <>
        {controller.snapPreview && <div className="wenaySnapPreview" style={snapPreviewStyle(controller.snapPreview)} aria-hidden="true" />}
        <div className="wenaySnapLayout" role="toolbar" aria-label="Snap layouts">
            {snapLayouts.map(layout => (
                <div key={layout.id} className="wenaySnapLayoutPreset" role="group" aria-label={layout.label} data-layout={layout.id}>
                    {layout.zones.map(zone => (
                        <button
                            type="button"
                            key={zone.region}
                            className="wenaySnapLayoutZone"
                            style={{gridArea: zone.gridArea}}
                            data-wenay-snap-region={zone.region}
                            data-preview={controller.snapPreview == zone.region ? "true" : "false"}
                            aria-label={`${layout.label}: ${snapRegionLabels[zone.region]}`}
                            onPointerEnter={() => controller.previewSnap(zone.region)}
                            onMouseEnter={() => controller.previewSnap(zone.region)}
                            onFocus={() => controller.previewSnap(zone.region)}
                            onClick={() => controller.snapTo(zone.region)}
                        />
                    ))}
                </div>
            ))}
        </div>
    </>;
}
