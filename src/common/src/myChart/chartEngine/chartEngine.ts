
/** Точка данных (x,y) */
export interface DataPoint {
    x: number;
    y: number;
}

/** Тип графика: линия или бары */
export type ChartType = 'line' | 'bar';

/** Стили набора данных */
export interface DataSetStyle {
    strokeColor?: string;
    fillColor?: string;
    barColor?: string;
    lineWidth?: number;
    gradientFill?: boolean;
}

/** Структура для быстрого min/max */
export interface MinMaxChunk {
    xStart: number;
    xEnd: number;
    minY: number;
    maxY: number;
}

/** Набор данных (серия для графика) */
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

/** Параметры для создания DataSet */
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

    // Мягкие цвета по умолчанию
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
        if (!internalData.length) return { minY: 0, maxY: 1 };
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
 * ----------------------------------
 * 2. DataModel
 * ----------------------------------
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
 * ----------------------------------
 * 3. PanelManager
 * ----------------------------------
 */
export interface Panel {
    id: string;
    left: number;
    top: number;
    width: number;
    height: number;
    dataSets: DataSet[];
    verticalRange: { minY: number; maxY: number };
    autoFocusY: boolean;
    /** Можно разрешить ресайз */
    resizable?: boolean;
    /** Доля высоты для auto layout (при resizeObserver) */
    heightFraction?: number;
}

export interface PanelManager {
    panels: Panel[];
    addPanel(config: {
        id: string;
        left: number;
        top: number;
        width: number;
        height: number;
        dataSets: DataSet[];
        autoFocusY?: boolean;
        resizable?: boolean;
    }): void;

    layoutPanels(containerWidth: number, containerHeight: number): void;
    resizePanel(panelId: string, newHeight: number): void;
}

export function createPanelManager(): PanelManager {
    const panels: Panel[] = [];

    function addPanel(config: {
        id: string;
        left: number;
        top: number;
        width: number;
        height: number;
        dataSets: DataSet[];
        autoFocusY?: boolean;
        resizable?: boolean;
    }) {
        const p: Panel = {
            id: config.id,
            left: config.left,
            top: config.top,
            width: config.width,
            height: config.height,
            dataSets: config.dataSets,
            verticalRange: { minY: 0, maxY: 1 },
            autoFocusY: config.autoFocusY !== false,
            resizable: config.resizable ?? false,
            heightFraction: undefined
        };
        panels.push(p);
    }

    /**
     * layoutPanels — вызывается при изменении размеров контейнера
     * “Сохраняем” пропорции высот, пересчитываем top/height.
     */
    function layoutPanels(containerWidth: number, containerHeight: number) {
        // 1) выяснить суммарную высоту всех панелей (как было)
        let totalH = 0;
        for (const p of panels) {
            totalH += p.height;
        }
        if (totalH <= 0) totalH = 1;

        // 2) высчитать fraction = panel.height / totalH
        for (const p of panels) {
            p.heightFraction = p.height / totalH;
        }

        // 3) теперь распределим новую высоту, заданную containerHeight
        let currentTop = 0;
        for (const p of panels) {
            const newH = (p.heightFraction ?? 0) * containerHeight;
            p.top = currentTop;
            p.left = 0;
            p.width = containerWidth;
            p.height = newH;
            currentTop += newH;
        }
    }

    /**
     * resizePanel — меняет высоту конкретной панели,
     * и сдвигает панели ниже.
     */
    function resizePanel(panelId: string, newHeight: number) {
        const idx = panels.findIndex((p) => p.id === panelId);
        if (idx < 0) return;

        const panel = panels[idx];
        const delta = newHeight - panel.height;
        panel.height = newHeight;

        // Сдвигаем все панели ниже
        for (let i = idx + 1; i < panels.length; i++) {
            panels[i].top += delta;
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
 * ----------------------------------
 * 4. Renderer
 * ----------------------------------
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

/** Трансформация */
export interface Transform {
    offsetX: number;
    scaleX: number;
    offsetY?: number;
    scaleY?: number;
}

export function createRenderer(): Renderer {
    // Ширина оси Y справа
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
        // без учёта оси снизу, просто panel.left + ...
        return panel.left + (xVal - transform.offsetX) * transform.scaleX;
    }

    function yToPixY(yVal: number, panel: Panel, transform: Transform, isYRightAxis: boolean) {
        if (panel.autoFocusY) {
            const { minY, maxY } = panel.verticalRange;
            const range = maxY - minY || 1;
            // высота панели = panel.height
            const ratio = (yVal - minY) / range;
            return panel.top + panel.height - ratio * panel.height;
        } else {
            // ручной offsetY/scaleY
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
        xMax: number,
        isYRightAxis: boolean
    ) {
        ctx.save();
        ctx.strokeStyle = '#666';
        ctx.fillStyle = '#666';
        ctx.lineWidth = 1;

        // Ось Y справа
        const yAxisX = panel.left + panel.width - AXIS_THICKNESS / 2;
        // Рисуем вертикальную линию
        ctx.beginPath();
        ctx.moveTo(yAxisX, panel.top);
        ctx.lineTo(yAxisX, panel.top + panel.height);
        ctx.stroke();

        // Ось X (примерно снизу)
        ctx.beginPath();
        ctx.moveTo(panel.left, panel.top + panel.height - 0.5);
        ctx.lineTo(panel.left + panel.width, panel.top + panel.height - 0.5);
        ctx.stroke();

        // Тики по X
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

        // Тики по Y
        let minY: number, maxY: number;
        if (panel.autoFocusY) {
            minY = panel.verticalRange.minY;
            maxY = panel.verticalRange.maxY;
        } else {
            const offsetY = transform.offsetY ?? 0;
            const scaleY = transform.scaleY ?? 1;
            maxY = offsetY + panel.height / scaleY;
            minY = offsetY;
        }
        const yTicks = getNiceTicks(minY, maxY, 5);
        yTicks.forEach((val) => {
            const pixY = yToPixY(val, panel, transform, isYRightAxis);
            ctx.beginPath();
            ctx.moveTo(yAxisX - 5, pixY);
            ctx.lineTo(yAxisX, pixY);
            ctx.stroke();

            ctx.fillText(Math.round(val).toString(), yAxisX + 2, pixY + 4);
        });

        ctx.restore();
    }

    /**
     * LOD для line chart
     */
    function drawLineChartLOD(
        ctx: CanvasRenderingContext2D,
        data: DataPoint[],
        panel: Panel,
        transform: Transform,
        isYRightAxis: boolean,
        style: DataSetStyle
    ) {
        const strokeColor = style.strokeColor ?? '#2299dd';
        const fillColor = style.fillColor ?? 'rgba(34,153,221,0.2)';
        const gradientFill = style.gradientFill ?? true;
        const lineWidth = style.lineWidth ?? 2;

        // Видимый X
        const xMinVisible = transform.offsetX;
        const xMaxVisible = transform.offsetX + (panel.width - AXIS_THICKNESS) / transform.scaleX;
        // Фильтруем
        const visible = data.filter((pt) => pt.x >= xMinVisible && pt.x <= xMaxVisible);
        if (visible.length < 2) return;

        // Простейший LOD: если xToPixX(pt.x) совпадает (округляется) с предыдущим, пропускаем
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
            const py = yToPixY(r.y, panel, transform, isYRightAxis);
            if (first) {
                ctx.moveTo(px, py);
                first = false;
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.stroke();

        // Градиент
        if (gradientFill) {
            const last = result[result.length - 1];
            const pxLast = xToPixX(last.x, transform, panel);
            const pyBase = yToPixY(panel.verticalRange.minY, panel, transform, isYRightAxis);
            ctx.lineTo(pxLast, pyBase);

            const firstPt = result[0];
            const pxFirst = xToPixX(firstPt.x, transform, panel);
            ctx.lineTo(pxFirst, pyBase);
            ctx.closePath();

            const { minY, maxY } = panel.verticalRange;
            const yPixMin = yToPixY(minY, panel, transform, isYRightAxis);
            const yPixMax = yToPixY(maxY, panel, transform, isYRightAxis);
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
        isYRightAxis: boolean,
        style: DataSetStyle
    ) {
        const barColor = style.barColor ?? '#66cc66';
        const xMinVisible = transform.offsetX;
        const xMaxVisible = transform.offsetX + (panel.width - AXIS_THICKNESS) / transform.scaleX;
        const visible = data.filter((pt) => pt.x >= xMinVisible && pt.x <= xMaxVisible);
        if (visible.length === 0) return;

        ctx.save();
        ctx.fillStyle = barColor;
        const barWidth = 5;

        for (const pt of visible) {
            const px = xToPixX(pt.x, transform, panel);
            const py = yToPixY(pt.y, panel, transform, isYRightAxis);
            const pyBase = yToPixY(panel.verticalRange.minY, panel, transform, isYRightAxis);
            ctx.fillRect(px - barWidth / 2, py, barWidth, pyBase - py);
        }
        ctx.restore();
    }

    function drawCrosshair(
        ctx: CanvasRenderingContext2D,
        panel: Panel,
        crosshair: { x: number; y: number },
        transform: Transform,
        isYRightAxis: boolean
    ) {
        ctx.save();
        ctx.strokeStyle = '#888';
        ctx.setLineDash([4, 4]);

        // Вертикальная линия
        ctx.beginPath();
        ctx.moveTo(crosshair.x, panel.top);
        ctx.lineTo(crosshair.x, panel.top + panel.height);
        ctx.stroke();

        // Горизонтальная линия
        ctx.beginPath();
        ctx.moveTo(panel.left, crosshair.y);
        ctx.lineTo(panel.left + panel.width, crosshair.y);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#333';

        // Мировой X
        const worldX = (crosshair.x - panel.left) / transform.scaleX + transform.offsetX;
        // Мировой Y
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

        // Подпись X (снизу)
        const labelX = Math.round(worldX).toString();
        ctx.fillText(labelX, crosshair.x - 10, panel.top + panel.height - 8);

        // Подпись Y (у оси справа)
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

        // Оси / тики
        drawAxesAndTicks(ctx, panel, transform, globalTimeRange.xMin, globalTimeRange.xMax, isYRightAxis);

        // Рендер DataSet
        for (const ds of panel.dataSets) {
            if (ds.type === 'line') {
                drawLineChartLOD(ctx, ds.data, panel, transform, isYRightAxis, ds.style);
            } else if (ds.type === 'bar') {
                drawBarChart(ctx, ds.data, panel, transform, isYRightAxis, ds.style);
            }
        }

        if (crosshair) {
            if (
                crosshair.x >= panel.left &&
                crosshair.x <= panel.left + panel.width &&
                crosshair.y >= panel.top &&
                crosshair.y <= panel.top + panel.height
            ) {
                drawCrosshair(ctx, panel, crosshair, transform, isYRightAxis);
            }
        }

        ctx.restore();
    }

    return {
        drawPanel
    };
}

/**
 * ----------------------------------
 * 5. Interaction
 * ----------------------------------
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
    panelManager: PanelManager // чтобы вызывать resizePanel
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

    // Состояние для resizePanel
    let resizingPanelId: string | null = null;
    let startHeight = 0;
    let startMouseY = 0;

    function onMouseDown(e: MouseEvent) {
        isMouseDown = true;
        lastX = e.clientX;
        lastY = e.clientY;

        const rect = canvas.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        crosshairPos = { x: localX, y: localY };

        // Проверяем, не попали ли мы в “границу” для resize панелей
        const panels = getPanels();
        for (const p of panels) {
            if (!p.resizable) continue;
            const bottom = p.top + p.height;
            if (Math.abs(localY - bottom) < 5) {
                dragMode = DragMode.ResizePanel;
                resizingPanelId = p.id;
                startHeight = p.height;
                startMouseY = e.clientY;
                onTransformChanged();
                return;
            }
        }

        // Ищем, попали ли мы на ось Y (справа)?
        // (Чтобы масштабировать Y) - ось Y начинается ~ panel.width-40
        activePanel = findPanel(localX, localY);
        if (!activePanel) {
            dragMode = DragMode.None;
            return;
        }

        const axisRightX = activePanel.left + activePanel.width - 40;
        if (localX >= axisRightX) {
            // масштаб по Y (если autoFocusY = false)
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
            onTransformChanged(); // только кроссхейр
            return;
        }

        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;

        const t = getTransform();

        if (dragMode === DragMode.ResizePanel && resizingPanelId) {
            const delta = e.clientY - startMouseY;
            const newHeight = startHeight + delta;
            panelManager.resizePanel(resizingPanelId, newHeight);
            onTransformChanged();
            return;
        }

        if (!activePanel) return;

        if (dragMode === DragMode.Pan) {
            // сдвиг offsetX
            const newOffsetX = t.offsetX - dx / t.scaleX;
            setTransform({ ...t, offsetX: newOffsetX });
        } else if (dragMode === DragMode.ScaleY) {
            // масштаб по Y (только если autoFocusY=false)
            if (!activePanel.autoFocusY) {
                const oldScaleY = t.scaleY ?? 1;
                const factor = (dy < 0) ? 1.02 : 0.98;
                const newScaleY = oldScaleY * factor;
                const offsetY = t.offsetY ?? 0;
                // фиксируем точку под курсором
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

    // dblclick => если на правой оси => toggle autoFocusY
    function onDblClick(e: MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        const p = findPanel(localX, localY);
        if (!p) return;
        const axisRightX = p.left + p.width - 40;
        if (localX >= axisRightX) {
            onToggleAutoFocusY(p);
            onTransformChanged();
        }
    }

    function findPanel(x: number, y: number): Panel | null {
        const panels = getPanels();
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
 * ----------------------------------
 * 6. ChartEngine
 * ----------------------------------
 */
export interface ChartEngine {
    init(): void;
    destroy(): void;
    attachToContainer(container: HTMLElement): void;

    createDataSet(params: CreateDataSetParams): DataSet;
    addPanel(config: {
        id: string;
        left: number;
        top: number;
        width: number;
        height: number;
        dataSets: DataSet[];
        autoFocusY?: boolean;
        resizable?: boolean;
    }): void;

    canvas: HTMLCanvasElement;
    dataModel: DataModel;
    panelManager: PanelManager;
    renderer: Renderer;
}

/** createChartEngine */
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

    // Ось Y справа
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

    // Переключаем autoFocusY
    function toggleAutoFocusY(panel: Panel) {
        panel.autoFocusY = !panel.autoFocusY;
    }

    const interaction = createInteraction(
        canvas,
        getTransform,
        setTransform,
        getPanels,
        () => {
            // onTransformChanged => перерисовать
            updatePanels();
        },
        (p) => toggleAutoFocusY(p),
        panelManager
    );

    function updatePanels() {
        // AutoFocus Y
        const x1 = transform.offsetX;
        const x2 = transform.offsetX + (canvas.width - 40) / transform.scaleX;
        panelManager.panels.forEach((panel) => {
            if (panel.autoFocusY) {
                const { minY, maxY } = dataModel.getGlobalMinMaxY(
                    x1, x2, (ds) => panel.dataSets.includes(ds)
                );
                panel.verticalRange.minY = minY;
                panel.verticalRange.maxY = maxY;
            } else {
                // ручной offsetY/scaleY
                const offsetY = transform.offsetY ?? 0;
                const scaleY = transform.scaleY ?? 1;
                const y2 = offsetY + panel.height / scaleY;
                panel.verticalRange.minY = offsetY;
                panel.verticalRange.maxY = y2;
            }
        });
    }

    function renderLoop() {
        if (destroyed) return;
        if (!canvas.isConnected) {
            destroy();
            return;
        }
        updatePanels();

        const xMin = transform.offsetX;
        const xMax = transform.offsetX + (canvas.width - 40) / transform.scaleX;
        const crosshair = interaction.getCrosshairPos();

        // Рендер каждой панели
        for (const panel of panelManager.panels) {
            renderer.drawPanel(ctx, panel, transform, { xMin, xMax }, crosshair, isYRightAxis);
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
        resizeObserver = null;
        containerEl = null;
    }

    function attachToContainer(container: HTMLElement) {
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
        containerEl = container;

        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === containerEl) {
                    const { width, height } = entry.contentRect;
                    const newW = Math.floor(width);
                    const newH = Math.floor(height);
                    if (canvas.width !== newW || canvas.height !== newH) {
                        canvas.width = newW;
                        canvas.height = newH;
                        // пересчитать layoutPanels
                        panelManager.layoutPanels(newW, newH);
                    }
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
        left: number;
        top: number;
        width: number;
        height: number;
        dataSets: DataSet[];
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

