import { createDataModel, type CreateDataSetParams, type DataModel, type DataSet } from './dataSet.js';
import { createPanelManager, type Panel, type PanelConfig, type PanelManager } from './panels.js';
import { createRenderer, type Renderer, type Transform } from './renderer.js';
import { createInteraction } from './interaction.js';
import { visibleXRange } from './axis.js';
import { observeElementBox } from '../canvasSurface.js';

/**
 * ChartEngine
 */
export interface ChartEngine {
    init(): void;
    destroy(): void;
    attachToContainer(container: HTMLElement): void;

    createDataSet(params: CreateDataSetParams): DataSet;
    addPanel(config: PanelConfig): void;

    canvas: HTMLCanvasElement;
    dataModel: DataModel;
    panelManager: PanelManager;
    renderer: Renderer;
}

/**
 * Engine factory function
 */
export function createChartEngine(canvas: HTMLCanvasElement): ChartEngine {
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const dataModel = createDataModel();
    const panelManager = createPanelManager();
    const renderer = createRenderer();

    let transform: Transform = {
        offsetX: 0,
        scaleX: 1,
        offsetY: 0,
        scaleY: 1
    };
    let destroyed = false;
    let animationFrameId = 0;
    let containerEl: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let containerWidth = 0;
    let containerHeight = 0;

    // Dirty flag: render only when something changes. Invalidation hooks cover interaction
    // (including crosshair), addData/addPanel/resize; stamp in renderLoop catches direct
    // mutations through dataModel/panelManager (data lengths, panel geometry, canvas size).
    let needsRender = true;
    // a pointer move without a press changes nothing but the crosshair: answered by blitting
    // the cached data layer instead of rescanning every dataset
    let needsCrosshair = false;
    let layerCanvas: HTMLCanvasElement | null = null;
    let lastStamp = NaN;
    function invalidate() { needsRender = true; }
    function invalidateCrosshair() { needsCrosshair = true; }
    // A weighted SUM let compensating changes (+k on one dataset, -k on another) produce the
    // same stamp and silently skip a frame. Mixing positionally makes that collision class go
    // away at the same cost. Still polled every frame on purpose: the stamp is the documented
    // safety net for mutations made straight through dataModel/panelManager, which never call
    // invalidate().
    function frameStamp() {
        const panels = panelManager.panels;
        let s = 17;
        s = (s * 31 + panels.length) | 0;
        s = (s * 31 + canvas.width) | 0;
        s = (s * 31 + canvas.height) | 0;
        for (const p of panels) {
            s = (s * 31 + p.top) | 0;
            s = (s * 31 + p.height) | 0;
            s = (s * 31 + (p.autoFocusY ? 1 : 0)) | 0;
            for (const ds of p.dataSets) s = (s * 31 + ds.data.length) | 0;
        }
        return s;
    }

    // snapshot of the freshly painted data layer, reused by crosshair-only frames
    function captureLayer() {
        if (canvas.width == 0 || canvas.height == 0) { layerCanvas = null; return; }
        if (!layerCanvas) layerCanvas = document.createElement('canvas');
        if (layerCanvas.width != canvas.width) layerCanvas.width = canvas.width;
        if (layerCanvas.height != canvas.height) layerCanvas.height = canvas.height;
        const lctx = layerCanvas.getContext('2d');
        if (!lctx) { layerCanvas = null; return; }
        lctx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
        lctx.drawImage(canvas, 0, 0);
    }

    function setTransform(t: Transform) {
        transform = t;
    }
    function getTransform() {
        return transform;
    }
    function getPanels() {
        return panelManager.panels;
    }
    function toggleAutoFocusY(p: Panel) {
        p.autoFocusY = !p.autoFocusY;
    }

    function getContainerSize() {
        return { width: containerWidth, height: containerHeight };
    }

    const interaction = createInteraction(
        canvas,
        getTransform,
        setTransform,
        getPanels,
        // invalidate is enough: renderLoop runs updatePanels once per dirty frame,
        // calling it here doubled the min/max scan on every mouse event
        invalidate,
        (p) => toggleAutoFocusY(p),
        panelManager,
        getContainerSize,
        invalidateCrosshair
    );

    function updatePanels() {
        const [x1, x2] = visibleXRange(canvas.width, transform);
        for (const p of panelManager.panels) {
            if (p.autoFocusY) {
                let minY = Infinity;
                let maxY = -Infinity;
                for (const ds of p.dataSets) {
                    const r = ds.getMinMaxInRange(x1, x2);
                    if (r.minY < minY) minY = r.minY;
                    if (r.maxY > maxY) maxY = r.maxY;
                }
                if (minY === Infinity || maxY === -Infinity) { minY = 0; maxY = 1; }
                p.verticalRange.minY = minY;
                p.verticalRange.maxY = maxY;
            } else {
                const offsetY = transform.offsetY ?? 0;
                const scaleY = transform.scaleY ?? 1;
                const y2 = offsetY + p.height / scaleY;
                p.verticalRange.minY = offsetY;
                p.verticalRange.maxY = y2;
            }
        }
    }

    function renderLoop() {
        if (destroyed) return;

        const stamp = frameStamp();
        if (stamp !== lastStamp) {
            lastStamp = stamp;
            needsRender = true;
        }

        const fast = typeof renderer.drawPanelCrosshair == 'function';
        const layerReady = fast && layerCanvas != null
            && layerCanvas.width == canvas.width && layerCanvas.height == canvas.height;

        if (needsRender || (needsCrosshair && !layerReady)) {
            needsRender = false;
            needsCrosshair = false;
            updatePanels();

            const [xMin, xMax] = visibleXRange(canvas.width, transform);
            const crosshair = interaction.getCrosshairPos();

            for (const p of panelManager.panels) {
                renderer.drawPanel(ctx, p, transform, { xMin, xMax }, fast ? null : crosshair, true);
            }

            if (fast) {
                captureLayer();
                for (const p of panelManager.panels) renderer.drawPanelCrosshair!(ctx, p, transform, crosshair);
            }
        }
        else if (needsCrosshair) {
            needsCrosshair = false;
            const crosshair = interaction.getCrosshairPos();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(layerCanvas!, 0, 0);
            for (const p of panelManager.panels) renderer.drawPanelCrosshair!(ctx, p, transform, crosshair);
        }

        animationFrameId = requestAnimationFrame(renderLoop);
    }

    function init() {
        interaction.initEvents(canvas);
        renderLoop();
    }

    function destroy() {
        destroyed = true;
        cancelAnimationFrame(animationFrameId);
        layerCanvas = null;
        interaction.destroy();
        if (resizeObserver) {
            resizeObserver.disconnect();
        }
        containerEl = null;
        resizeObserver = null;
    }

    function attachToContainer(container: HTMLElement) {
        if (resizeObserver) resizeObserver.disconnect();
        containerEl = container;
        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === containerEl) {
                    const w = Math.floor(entry.contentRect.width);
                    const h = Math.floor(entry.contentRect.height);
                    if (canvas.width !== w || canvas.height !== h) {
                        canvas.width = w;
                        canvas.height = h;
                        invalidate(); // changing canvas size clears the bitmap, so redraw is required
                    }
                    containerWidth = w;
                    containerHeight = h;
                    // layoutPanels
                    panelManager.layoutPanels(w, h);
                }
            }
        });
        resizeObserver.observe(containerEl);
    }

    function createDataSetFn(params: CreateDataSetParams) {
        const ds = dataModel.addDataSet(params);
        const addDataOrig = ds.addData;
        ds.addData = (p) => { addDataOrig(p); invalidate(); };
        return ds;
    }

    function addPanelFn(config: PanelConfig) {
        panelManager.addPanel(config);
        invalidate();
    }

    return {
        init,
        destroy,
        attachToContainer,
        createDataSet: createDataSetFn,
        addPanel: addPanelFn,
        canvas,
        dataModel,
        panelManager,
        renderer
    };
}
