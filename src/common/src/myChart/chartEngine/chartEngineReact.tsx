/*************************************************************
 * chartEngine.tsx
 * Обновлённый пример, где:
 *  - Ширина панелей = 100% от Canvas
 *  - Высота панелей задаётся в процентах (heightPct)
 *  - Последняя панель всегда "дотягивает" до 100%
 *************************************************************/
import React, { useRef, useEffect } from 'react';

/**
 * Базовые типы данных
 */
export interface DataPoint {
    x: number;
    y: number;
}

export type ChartType = 'line' | 'bar';

export interface DataSetStyle {
    strokeColor?: string;
    fillColor?: string;
    barColor?: string;
    lineWidth?: number;
    gradientFill?: boolean;
}

export interface MinMaxChunk {
    xStart: number;
    xEnd: number;
    minY: number;
    maxY: number;
}

export interface DataSet {
    id: string;
    type: ChartType;
    data: DataPoint[];
    style: DataSetStyle;
    chunkSize: number;
    minMaxChunks: MinMaxChunk[];

    getMinMaxInRange(rangeX1: number, rangeX2: number): { minY: number; maxY: number };
    addData(newPoints: DataPoint | DataPoint[]): void;
}

export interface CreateDataSetParams {
    id: string;
    type?: ChartType;
    data?: DataPoint[];
    style?: DataSetStyle;
    chunkSize?: number;
}

/**
 * Фабрика DataSet
 */
export function createDataSet(params: CreateDataSetParams): DataSet {
    const {
        id,
        type = 'line',
        data = [],
        style = {},
        chunkSize = 100
    } = params;

    const defaultStyle: DataSetStyle = {
        strokeColor: '#2299dd',
        fillColor: 'rgba(34,153,221,0.2)',
        barColor: '#66cc66',
        lineWidth: 2,
        gradientFill: true
    };
    const mergedStyle: DataSetStyle = { ...defaultStyle, ...style };

    let internalData = data.slice();
    let minMaxChunks: MinMaxChunk[] = [];

    function buildMinMaxChunks() {
        minMaxChunks = [];
        if (internalData.length === 0) return;
        for (let i = 0; i < internalData.length; i += chunkSize) {
            const chunkData = internalData.slice(i, i + chunkSize);
            let minY = Infinity;
            let maxY = -Infinity;
            const xStart = chunkData[0].x;
            const xEnd = chunkData[chunkData.length - 1].x;
            for (const dp of chunkData) {
                if (dp.y < minY) minY = dp.y;
                if (dp.y > maxY) maxY = dp.y;
            }
            minMaxChunks.push({ xStart, xEnd, minY, maxY });
        }
    }
    buildMinMaxChunks();

    function getMinMaxInRange(rangeX1: number, rangeX2: number) {
        if (internalData.length === 0) {
            return { minY: 0, maxY: 1 };
        }
        let overallMin = Infinity;
        let overallMax = -Infinity;
        for (const chunk of minMaxChunks) {
            if (chunk.xEnd < rangeX1 || chunk.xStart > rangeX2) continue;
            if (chunk.minY < overallMin) overallMin = chunk.minY;
            if (chunk.maxY > overallMax) overallMax = chunk.maxY;
        }
        if (overallMin === Infinity || overallMax === -Infinity) {
            overallMin = 0;
            overallMax = 1;
        }
        return { minY: overallMin, maxY: overallMax };
    }

    function addData(newPoints: DataPoint | DataPoint[]) {
        const arr = Array.isArray(newPoints) ? newPoints : [newPoints];
        internalData.push(...arr);
        const remainder = internalData.length % chunkSize;
        if (remainder <= arr.length) {
            buildMinMaxChunks();
        } else {
            const lastChunkIndex = Math.floor((internalData.length - 1) / chunkSize);
            const startIndex = lastChunkIndex * chunkSize;
            const chunkData = internalData.slice(startIndex, startIndex + chunkSize);
            let minY = Infinity;
            let maxY = -Infinity;
            for (const d of chunkData) {
                if (d.y < minY) minY = d.y;
                if (d.y > maxY) maxY = d.y;
            }
            const xStart = chunkData[0].x;
            const xEnd = chunkData[chunkData.length - 1].x;
            minMaxChunks[lastChunkIndex] = { xStart, xEnd, minY, maxY };
        }
    }

    return {
        id,
        type,
        data: internalData,
        style: mergedStyle,
        chunkSize,
        minMaxChunks,
        getMinMaxInRange,
        addData
    };
}

/**
 * DataModel
 */
export interface DataModel {
    addDataSet(params: CreateDataSetParams): DataSet;
    getAllDataSets(): DataSet[];
    getGlobalMinMaxY(x1: number, x2: number, filterFn?: (ds: DataSet) => boolean): { minY: number; maxY: number };
}

export function createDataModel(): DataModel {
    const dataSets: DataSet[] = [];

    function addDataSet(params: CreateDataSetParams) {
        const ds = createDataSet(params);
        dataSets.push(ds);
        return ds;
    }

    function getAllDataSets() {
        return dataSets;
    }

    function getGlobalMinMaxY(x1: number, x2: number, filterFn?: (ds: DataSet) => boolean) {
        let globalMin = Infinity;
        let globalMax = -Infinity;
        for (const ds of dataSets) {
            if (filterFn && !filterFn(ds)) continue;
            const { minY, maxY } = ds.getMinMaxInRange(x1, x2);
            if (minY < globalMin) globalMin = minY;
            if (maxY > globalMax) globalMax = maxY;
        }
        if (globalMin === Infinity || globalMax === -Infinity) {
            globalMin = 0;
            globalMax = 1;
        }
        return { minY: globalMin, maxY: globalMax };
    }

    return {
        addDataSet,
        getAllDataSets,
        getGlobalMinMaxY
    };
}

/**
 * PanelManager
 * Вместо pixel-высоты, используем heightPct (процент).
 */
export interface Panel {
    id: string;
    left: number;       // px
    top: number;        // px (будет рассчитываться)
    width: number;      // px (здесь = canvas.width)
    height: number;     // px (будет рассчитываться)
    heightPct: number;  // доля от 100 (кроме последней, которая может "добирать")
    dataSets: DataSet[];
    verticalRange: { minY: number; maxY: number };
    autoFocusY: boolean;
    resizable?: boolean;
}

export interface PanelManager {
    panels: Panel[];

    addPanel(config: {
        id: string;
        /** Процент высоты: 0..100, последняя панель добирает остаток */
        heightPct?: number;
        dataSets: DataSet[];
        autoFocusY?: boolean;
        resizable?: boolean;
    }): void;

    layoutPanels(containerWidth: number, containerHeight: number): void;
    resizePanel(panelId: string, deltaPx: number, containerHeight: number): void;
}

export function createPanelManager(): PanelManager {
    const panels: Panel[] = [];

    function addPanel(config: {
        id: string;
        heightPct?: number;
        dataSets: DataSet[];
        autoFocusY?: boolean;
        resizable?: boolean;
    }) {
        const p: Panel = {
            id: config.id,
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            heightPct: config.heightPct ?? 20, // по умолчанию 20% (или любой другой)
            dataSets: config.dataSets,
            verticalRange: { minY: 0, maxY: 1 },
            autoFocusY: config.autoFocusY !== false,
            resizable: config.resizable ?? false
        };
        panels.push(p);
    }

    /**
     * layoutPanels:
     *  - Суммируем heightPct всех панелей (кроме последней).
     *  - Последняя панель = 100% - сумма предыдущих (если вдруг сумма < 100).
     *  - Переводим проценты в px, рассчитываем top/height.
     */
    function layoutPanels(containerWidth: number, containerHeight: number) {
        // Сумма процентов у всех панелей, кроме последней
        if (panels.length === 0) return;

        // Рассчитываем сумму “заданных” процентов (кроме последней)
        let totalAssignedPct = 0;
        for (let i = 0; i < panels.length - 1; i++) {
            totalAssignedPct += panels[i].heightPct;
        }
        if (totalAssignedPct > 100) totalAssignedPct = 100; // ограничим

        // Последней панели даём остаток
        const lastPanel = panels[panels.length - 1];
        lastPanel.heightPct = 100 - totalAssignedPct;

        // Теперь вычисляем top/height
        let currentTopPx = 0;
        for (const p of panels) {
            // Преобразуем процент в px
            const hPx = (p.heightPct / 100) * containerHeight;
            p.left = 0;
            p.top = currentTopPx;
            p.width = containerWidth;
            p.height = hPx;

            currentTopPx += hPx;
        }
    }

    /**
     * resizePanel: меняем процент высоты одной панели при “перетаскивании”.
     * deltaPx — изменение высоты в px, превращаем в проценты.
     */
    function resizePanel(panelId: string, deltaPx: number, containerHeight: number) {
        const idx = panels.findIndex((p) => p.id === panelId);
        if (idx < 0 || idx >= panels.length) return;
        const p = panels[idx];

        // Текущий процент
        const oldPct = p.heightPct;
        // px -> pct
        const deltaPct = (deltaPx / containerHeight) * 100;
        const newPct = p.heightPct + deltaPct;

        // Ограничим чтобы не уходило в отрицательные значения
        if (newPct < 5) { // Минимум 5% (условно)
            p.heightPct = 5;
        } else if (newPct > 95) {
            p.heightPct = 95;
        } else {
            p.heightPct = newPct;
        }
    }

    return {
        panels,
        addPanel,
        layoutPanels,
        resizePanel
    };
}

/**
 * Renderer (ось Y справа, LOD для линий)
 */
export interface Renderer {
    drawPanel(
        ctx: CanvasRenderingContext2D,
        panel: Panel,
        transform: Transform,
        globalTimeRange: { xMin: number; xMax: number },
        crosshair: { x: number; y: number } | null,
        isYRightAxis: boolean
    ): void;
}

export interface Transform {
    offsetX: number;
    scaleX: number;
    offsetY?: number;
    scaleY?: number;
}

export function createRenderer(): Renderer {
    const AXIS_THICKNESS = 40;

    function getNiceTicks(minVal: number, maxVal: number, count: number): number[] {
        const range = maxVal - minVal || 1;
        const roughStep = range / count;
        const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
        let norm = roughStep / mag;
        let step = 1;
        if (norm < 2) step = 1;
        else if (norm < 5) step = 2;
        else step = 5;
        step *= mag;

        const niceMin = Math.floor(minVal / step) * step;
        const niceMax = Math.ceil(maxVal / step) * step;
        const ticks: number[] = [];
        for (let val = niceMin; val <= niceMax; val += step) {
            ticks.push(val);
        }
        return ticks;
    }

    function xToPixX(xVal: number, transform: Transform, panel: Panel) {
        return panel.left + (xVal - transform.offsetX) * transform.scaleX;
    }

    function yToPixY(yVal: number, panel: Panel, transform: Transform) {
        // autoFocusY => [minY, maxY]
        // иначе offsetY/scaleY
        if (panel.autoFocusY) {
            const { minY, maxY } = panel.verticalRange;
            const range = maxY - minY || 1;
            const ratio = (yVal - minY) / range;
            return panel.top + panel.height - ratio * panel.height;
        } else {
            const offsetY = transform.offsetY ?? 0;
            const scaleY = transform.scaleY ?? 1;
            return panel.top + panel.height - (yVal - offsetY) * scaleY;
        }
    }

    function drawAxesAndTicks(
        ctx: CanvasRenderingContext2D,
        panel: Panel,
        transform: Transform,
        xMin: number,
        xMax: number
    ) {
        ctx.save();
        ctx.strokeStyle = '#666';
        ctx.fillStyle = '#666';
        ctx.lineWidth = 1;

        const yAxisX = panel.left + panel.width - AXIS_THICKNESS / 2;
        ctx.beginPath();
        ctx.moveTo(yAxisX, panel.top);
        ctx.lineTo(yAxisX, panel.top + panel.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(panel.left, panel.top + panel.height - 0.5);
        ctx.lineTo(panel.left + panel.width, panel.top + panel.height - 0.5);
        ctx.stroke();

        // X tics
        const xTicks = getNiceTicks(xMin, xMax, 6);
        xTicks.forEach((val) => {
            const xPix = xToPixX(val, transform, panel);
            const baseY = panel.top + panel.height;
            ctx.beginPath();
            ctx.moveTo(xPix, baseY - 5);
            ctx.lineTo(xPix, baseY);
            ctx.stroke();
            ctx.fillText(Math.round(val).toString(), xPix - 5, baseY + 12);
        });

        // Y tics
        let minY: number, maxY: number;
        if (panel.autoFocusY) {
            minY = panel.verticalRange.minY;
            maxY = panel.verticalRange.maxY;
        } else {
            const offsetY = transform.offsetY ?? 0;
            const scaleY = transform.scaleY ?? 1;
            minY = offsetY;
            maxY = offsetY + panel.height / scaleY;
        }
        const yTicks = getNiceTicks(minY, maxY, 5);
        yTicks.forEach((val) => {
            const pixY = yToPixY(val, panel, transform);
            ctx.beginPath();
            ctx.moveTo(yAxisX - 5, pixY);
            ctx.lineTo(yAxisX, pixY);
            ctx.stroke();

            ctx.fillText(Math.round(val).toString(), yAxisX + 2, pixY + 4);
        });

        ctx.restore();
    }

    function drawLineChartLOD(
        ctx: CanvasRenderingContext2D,
        data: DataPoint[],
        panel: Panel,
        transform: Transform,
        style: DataSetStyle
    ) {
        const strokeColor = style.strokeColor ?? '#2299dd';
        const fillColor = style.fillColor ?? 'rgba(34,153,221,0.2)';
        const gradientFill = style.gradientFill ?? true;
        const lineWidth = style.lineWidth ?? 2;

        const AXIS_THICKNESS = 40;
        const xMinVisible = transform.offsetX;
        const xMaxVisible = transform.offsetX + (panel.width - AXIS_THICKNESS) / transform.scaleX;

        const visible = data.filter((pt) => pt.x >= xMinVisible && pt.x <= xMaxVisible);
        if (visible.length < 2) return;

        const result: DataPoint[] = [];
        let lastPixX = -1;
        for (const pt of visible) {
            const px = Math.round(xToPixX(pt.x, transform, panel));
            if (px !== lastPixX) {
                result.push(pt);
                lastPixX = px;
            }
        }
        if (result.length < 2) return;

        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        let first = true;
        for (const r of result) {
            const px = xToPixX(r.x, transform, panel);
            const py = yToPixY(r.y, panel, transform);
            if (first) {
                ctx.moveTo(px, py);
                first = false;
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.stroke();

        if (gradientFill) {
            const lastPt = result[result.length - 1];
            const pxLast = xToPixX(lastPt.x, transform, panel);
            const pyBase = yToPixY(panel.verticalRange.minY, panel, transform);
            ctx.lineTo(pxLast, pyBase);

            const firstPt = result[0];
            const pxFirst = xToPixX(firstPt.x, transform, panel);
            ctx.lineTo(pxFirst, pyBase);
            ctx.closePath();

            const { minY, maxY } = panel.verticalRange;
            const yPixMin = yToPixY(minY, panel, transform);
            const yPixMax = yToPixY(maxY, panel, transform);
            const grad = ctx.createLinearGradient(0, yPixMin, 0, yPixMax);
            grad.addColorStop(0, fillColor);
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.fill();
        }
        ctx.restore();
    }

    function drawBarChart(
        ctx: CanvasRenderingContext2D,
        data: DataPoint[],
        panel: Panel,
        transform: Transform,
        style: DataSetStyle
    ) {
        const barColor = style.barColor ?? '#66cc66';
        const AXIS_THICKNESS = 40;
        const xMinVisible = transform.offsetX;
        const xMaxVisible = transform.offsetX + (panel.width - AXIS_THICKNESS) / transform.scaleX;
        const visible = data.filter((pt) => pt.x >= xMinVisible && pt.x <= xMaxVisible);
        if (!visible.length) return;

        ctx.save();
        ctx.fillStyle = barColor;
        const barWidth = 5;
        for (const pt of visible) {
            const px = xToPixX(pt.x, transform, panel);
            const py = yToPixY(pt.y, panel, transform);
            const pyBase = yToPixY(panel.verticalRange.minY, panel, transform);
            ctx.fillRect(px - barWidth / 2, py, barWidth, pyBase - py);
        }
        ctx.restore();
    }

    function drawCrosshair(
        ctx: CanvasRenderingContext2D,
        panel: Panel,
        crosshair: { x: number; y: number },
        transform: Transform
    ) {
        ctx.save();
        ctx.strokeStyle = '#888';
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        ctx.moveTo(crosshair.x, panel.top);
        ctx.lineTo(crosshair.x, panel.top + panel.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(panel.left, crosshair.y);
        ctx.lineTo(panel.left + panel.width, crosshair.y);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#333';

        const worldX = (crosshair.x - panel.left) / transform.scaleX + transform.offsetX;
        let worldY = 0;
        if (panel.autoFocusY) {
            const { minY, maxY } = panel.verticalRange;
            const range = maxY - minY || 1;
            const ratio = (panel.top + panel.height - crosshair.y) / panel.height;
            worldY = minY + ratio * range;
        } else {
            const offsetY = transform.offsetY ?? 0;
            const scaleY = transform.scaleY ?? 1;
            worldY = offsetY + (panel.top + panel.height - crosshair.y) / scaleY;
        }

        const labelX = Math.round(worldX).toString();
        ctx.fillText(labelX, crosshair.x - 10, panel.top + panel.height - 8);

        const labelY = Math.round(worldY).toString();
        const rightX = panel.left + panel.width - 38;
        ctx.fillRect(rightX, crosshair.y - 8, 38, 16);
        ctx.fillStyle = '#fff';
        ctx.fillText(labelY, rightX + 3, crosshair.y + 4);

        ctx.restore();
    }

    function drawPanel(
        ctx: CanvasRenderingContext2D,
        panel: Panel,
        transform: Transform,
        globalTimeRange: { xMin: number; xMax: number },
        crosshair: { x: number; y: number } | null,
        isYRightAxis: boolean
    ) {
        ctx.clearRect(panel.left, panel.top, panel.width, panel.height);

        ctx.save();
        ctx.beginPath();
        ctx.rect(panel.left, panel.top, panel.width, panel.height);
        ctx.clip();

        drawAxesAndTicks(ctx, panel, transform, globalTimeRange.xMin, globalTimeRange.xMax);

        for (const ds of panel.dataSets) {
            if (ds.type === 'line') {
                drawLineChartLOD(ctx, ds.data, panel, transform, ds.style);
            } else if (ds.type === 'bar') {
                drawBarChart(ctx, ds.data, panel, transform, ds.style);
            }
        }

        if (crosshair) {
            if (
                crosshair.x >= panel.left &&
                crosshair.x <= panel.left + panel.width &&
                crosshair.y >= panel.top &&
                crosshair.y <= panel.top + panel.height
            ) {
                drawCrosshair(ctx, panel, crosshair, transform);
            }
        }

        ctx.restore();
    }

    return {
        drawPanel
    };
}

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
    getContainerSize: () => { width: number; height: number }
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

        // Проверка границы между панелями (для ресайза)
        const panels = getPanels();
        for (const p of panels) {
            if (!p.resizable) continue;
            const bottom = p.top + p.height;
            if (Math.abs(localY - bottom) < 5) {
                dragMode = DragMode.ResizePanel;
                resizingPanelId = p.id;
                onTransformChanged();
                return;
            }
        }

        // Ищем панель
        activePanel = findPanel(localX, localY, panels);
        if (!activePanel) {
            dragMode = DragMode.None;
            return;
        }

        const axisRightX = activePanel.left + activePanel.width - 40;
        if (localX >= axisRightX) {
            // масштаб по Y, если autoFocusY=false
            dragMode = DragMode.ScaleY;
        } else {
            // pan
            dragMode = DragMode.Pan;
        }

        onTransformChanged();
    }

    function onMouseMove(e: MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        crosshairPos = { x: localX, y: localY };

        if (!isMouseDown) {
            onTransformChanged();
            return;
        }

        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;

        const t = getTransform();

        // Режим ресайза панели
        if (dragMode === DragMode.ResizePanel && resizingPanelId) {
            // deltaPx = dy
            const { height: cH } = getContainerSize();
            panelManager.resizePanel(resizingPanelId, dy, cH);
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

    function onMouseUp(e: MouseEvent) {
        isMouseDown = false;
        dragMode = DragMode.None;
        activePanel = null;
        resizingPanelId = null;
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
        const axisRightX = p.left + p.width - 40;
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

    function initEvents(canvasEl: HTMLCanvasElement) {
        if (attached) return;
        attached = true;
        canvasEl.addEventListener('mousedown', onMouseDown);
        canvasEl.addEventListener('mousemove', onMouseMove);
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
        canvas.removeEventListener('wheel', onWheel as any);
        canvas.removeEventListener('dblclick', onDblClick);
        document.removeEventListener('mouseup', onGlobalMouseUp);
    }

    return {
        initEvents,
        getCrosshairPos,
        destroy
    };
}

/**
 * ChartEngine
 */
export interface ChartEngine {
    init(): void;
    destroy(): void;
    attachToContainer(container: HTMLElement): void;

    createDataSet(params: CreateDataSetParams): DataSet;
    addPanel(config: {
        id: string;
        dataSets: DataSet[];
        heightPct?: number;
        autoFocusY?: boolean;
        resizable?: boolean;
    }): void;

    canvas: HTMLCanvasElement;
    dataModel: DataModel;
    panelManager: PanelManager;
    renderer: Renderer;
}

/**
 * Фабричная функция движка
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

    const isYRightAxis = true;

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
        () => updatePanels(),
        (p) => toggleAutoFocusY(p),
        panelManager,
        getContainerSize
    );

    function updatePanels() {
        const x1 = transform.offsetX;
        const x2 = transform.offsetX + (canvas.width - 40) / transform.scaleX;
        for (const p of panelManager.panels) {
            if (p.autoFocusY) {
                const { minY, maxY } = dataModel.getGlobalMinMaxY(
                    x1, x2, (ds) => p.dataSets.includes(ds)
                );
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
        updatePanels();

        const xMin = transform.offsetX;
        const xMax = transform.offsetX + (canvas.width - 40) / transform.scaleX;
        const crosshair = interaction.getCrosshairPos();

        for (const p of panelManager.panels) {
            renderer.drawPanel(ctx, p, transform, { xMin, xMax }, crosshair, isYRightAxis);
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
        interaction.destroy();
        if (resizeObserver && containerEl) {
            resizeObserver.unobserve(containerEl);
            resizeObserver.disconnect();
        }
        containerEl = null;
        resizeObserver = null;
    }

    function attachToContainer(container: HTMLElement) {
        containerEl = container;
        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === containerEl) {
                    const w = Math.floor(entry.contentRect.width);
                    const h = Math.floor(entry.contentRect.height);
                    if (canvas.width !== w || canvas.height !== h) {
                        canvas.width = w;
                        canvas.height = h;
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
        return dataModel.addDataSet(params);
    }

    function addPanelFn(config: {
        id: string;
        dataSets: DataSet[];
        heightPct?: number;
        autoFocusY?: boolean;
        resizable?: boolean;
    }) {
        panelManager.addPanel(config);
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

/**
 * Пример генерации данных
 */
export function generateIncrementalData(
    startX: number,
    count: number,
    startY: number,
    maxDelta: number
): DataPoint[] {
    const arr: DataPoint[] = [];
    let currentY = startY;
    let currentX = startX;
    for (let i = 0; i < count; i++) {
        const delta = (Math.random() - 0.5) * 2 * maxDelta;
        currentY += delta;
        if (currentY < 0) currentY = 0;
        arr.push({ x: currentX, y: currentY });
        currentX++;
    }
    return arr;
}

/**
 * Пример React-компонента MyChart
 */
export const MyChartEngine: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ChartEngine | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const engine = createChartEngine(canvas);
        engineRef.current = engine;
        engine.attachToContainer(container);
        engine.init();

        // Создаём DataSets
        const lineData = generateIncrementalData(0, 50, 100, 10);
        const lineDS = engine.createDataSet({
            id: 'line1',
            type: 'line',
            data: lineData,
            style: { strokeColor: '#FF0000' }
        });

        const barData = generateIncrementalData(0, 50, 50, 5);
        const barDS = engine.createDataSet({
            id: 'bar1',
            type: 'bar',
            data: barData,
            style: { barColor: '#66aa66' }
        });

        // Добавляем панели — указываем heightPct
        // Последняя панель автоматически заберёт остаток до 100%.
        engine.addPanel({
            id: 'mainPanel',
            dataSets: [lineDS],
            heightPct: 60,    // 60%
            autoFocusY: true,
            resizable: true
        });

        engine.addPanel({
            id: 'bottomPanel',
            dataSets: [barDS],
            heightPct: 30,    // 30%
            autoFocusY: true,
            resizable: true
        });

        // Имитация добавления
        let lineX = lineData[lineData.length - 1].x;
        let lineY = lineData[lineData.length - 1].y;
        let barX = barData[barData.length - 1].x;
        let barY = barData[barData.length - 1].y;

        const intervalId = setInterval(() => {
            const dLine = (Math.random() - 0.5) * 10;
            lineY += dLine; if (lineY < 0) lineY = 0;
            lineX++;
            lineDS.addData({ x: lineX, y: lineY });

            const dBar = (Math.random() - 0.5) * 5;
            barY += dBar; if (barY < 0) barY = 0;
            barX++;
            barDS.addData({ x: barX, y: barY });
        }, 1);

        return () => {
            clearInterval(intervalId);
            engine.destroy();
        };
    }, []);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '600px',
                border: '1px solid #ccc',
                position: 'relative'
            }}
        >
            <canvas ref={canvasRef} />
        </div>
    );
};
