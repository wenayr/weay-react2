import type { Panel, PanelManager } from './panels.js';
import type { Transform } from './renderer.js';
import { AXIS_THICKNESS } from './axis.js';

/**
 * Interaction
 */
export interface Interaction {
    initEvents(canvas: HTMLCanvasElement): void;
    getCrosshairPos(): { x: number; y: number } | null;
    destroy(): void;
}

export function createInteraction(
    canvas: HTMLCanvasElement,
    getTransform: () => Transform,
    setTransform: (t: Transform) => void,
    getPanels: () => Panel[],
    onTransformChanged: () => void,
    onToggleAutoFocusY: (panel: Panel) => void,
    panelManager: PanelManager,
    getContainerSize: () => { width: number; height: number },
    /** Called instead of onTransformChanged when ONLY the crosshair moved (hover without a
     *  press). Defaults to onTransformChanged, so existing callers behave exactly as before. */
    onCrosshairMoved: () => void = onTransformChanged
): Interaction {
    let crosshairPos: { x: number; y: number } | null = null;

    enum DragMode {
        None,
        Pan,
        ScaleY,
        ResizePanel
    }
    let dragMode = DragMode.None;
    let isMouseDown = false;
    let lastX = 0;
    let lastY = 0;
    let activePanel: Panel | null = null;
    let attached = false;

    let resizingPanelId: string | null = null;

    function onMouseDown(e: MouseEvent) {
        isMouseDown = true;
        lastX = e.clientX;
        lastY = e.clientY;
        const rect = canvas.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        crosshairPos = { x: localX, y: localY };

        // Check the boundary between panels (for resize)
        const panels = getPanels();
        for (const p of panels) {
            if (!p.resizable) continue;
            // last panel takes the leftover height in layoutPanels - its bottom border is not draggable
            if (p === panels[panels.length - 1]) continue;
            const bottom = p.top + p.height;
            if (Math.abs(localY - bottom) < 5) {
                dragMode = DragMode.ResizePanel;
                resizingPanelId = p.id;
                onTransformChanged();
                return;
            }
        }

        // Find panel
        activePanel = findPanel(localX, localY, panels);
        if (!activePanel) {
            dragMode = DragMode.None;
            return;
        }

        const axisRightX = activePanel.left + activePanel.width - AXIS_THICKNESS;
        if (localX >= axisRightX) {
            // Scale by Y if autoFocusY=false
            dragMode = DragMode.ScaleY;
        } else {
            // pan
            dragMode = DragMode.Pan;
        }

        onTransformChanged();
    }

    function onMouseMove(e: MouseEvent) {
        // Do NOT swap this for e.offsetX/offsetY: the canvas carries a 1px border, so offsetX
        // is measured from the padding box while rect.left is the border box - measured on the
        // stand, that shifts the crosshair by exactly one pixel on both axes.
        const rect = canvas.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        crosshairPos = { x: localX, y: localY };

        if (!isMouseDown) {
            onCrosshairMoved();
            return;
        }

        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;

        const t = getTransform();

        // Panel resize mode
        if (dragMode === DragMode.ResizePanel && resizingPanelId) {
            // deltaPx = dy
            const { width: cW, height: cH } = getContainerSize();
            panelManager.resizePanel(resizingPanelId, dy, cH);
            // recalc px top/height right away - previously it only happened on container resize
            panelManager.layoutPanels(cW, cH);
            onTransformChanged();
            return;
        }

        if (!activePanel) return;

        if (dragMode === DragMode.Pan) {
            const newOffsetX = t.offsetX - dx / t.scaleX;
            setTransform({ ...t, offsetX: newOffsetX });
        } else if (dragMode === DragMode.ScaleY) {
            if (!activePanel.autoFocusY) {
                const oldScaleY = t.scaleY ?? 1;
                const factor = (dy < 0) ? 1.02 : 0.98;
                const newScaleY = oldScaleY * factor;
                const offsetY = t.offsetY ?? 0;
                const worldY = offsetY + (activePanel.top + activePanel.height - localY) / oldScaleY;
                const newOffsetY = worldY - (activePanel.top + activePanel.height - localY) / newScaleY;
                setTransform({ ...t, scaleY: newScaleY, offsetY: newOffsetY });
            }
        }
        onTransformChanged();
    }

    function onGlobalMouseUp(e: MouseEvent) {
        if (isMouseDown) {
            isMouseDown = false;
            dragMode = DragMode.None;
            activePanel = null;
            resizingPanelId = null;
        }
    }

    function onWheel(e: WheelEvent) {
        e.preventDefault();
        const t = getTransform();
        const rect = canvas.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const worldX = t.offsetX + (localX - (activePanel?.left ?? 0)) / t.scaleX;
        const delta = e.deltaY < 0 ? 1.1 : 0.9;
        let newScaleX = t.scaleX * delta;
        newScaleX = Math.max(newScaleX, 0.0001);
        const newOffsetX = worldX - (localX - (activePanel?.left ?? 0)) / newScaleX;
        setTransform({ ...t, offsetX: newOffsetX, scaleX: newScaleX });
        onTransformChanged();
    }

    function onDblClick(e: MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        const p = findPanel(localX, localY, getPanels());
        if (!p) return;
        const axisRightX = p.left + p.width - AXIS_THICKNESS;
        if (localX >= axisRightX) {
            onToggleAutoFocusY(p);
            onTransformChanged();
        }
    }

    function findPanel(x: number, y: number, panels: Panel[]): Panel | null {
        for (const p of panels) {
            if (x >= p.left && x <= p.left + p.width && y >= p.top && y <= p.top + p.height) {
                return p;
            }
        }
        return null;
    }

    // the pointer left the canvas - drop the crosshair instead of freezing it at the last position
    function onMouseLeave() {
        if (!crosshairPos) return;
        crosshairPos = null;
        onCrosshairMoved();
    }

    function initEvents(canvasEl: HTMLCanvasElement) {
        if (attached) return;
        attached = true;
        canvasEl.addEventListener('mousedown', onMouseDown);
        canvasEl.addEventListener('mousemove', onMouseMove);
        canvasEl.addEventListener('mouseleave', onMouseLeave);
        canvasEl.addEventListener('wheel', onWheel, { passive: false });
        canvasEl.addEventListener('dblclick', onDblClick);
        document.addEventListener('mouseup', onGlobalMouseUp);
    }

    function getCrosshairPos() {
        return crosshairPos;
    }

    function destroy() {
        if (!attached) return;
        attached = false;
        canvas.removeEventListener('mousedown', onMouseDown);
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('mouseleave', onMouseLeave);
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('dblclick', onDblClick);
        document.removeEventListener('mouseup', onGlobalMouseUp);
    }

    return {
        initEvents,
        getCrosshairPos,
        destroy
    };
}
