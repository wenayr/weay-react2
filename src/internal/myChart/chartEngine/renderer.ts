import type { DataPoint, DataSetStyle } from './dataSet.js';
import type { Panel } from './panels.js';
import { AXIS_THICKNESS, visibleXRange } from './axis.js';

/**
 * Renderer (right Y axis, LOD for lines)
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
    /** Draws ONLY the crosshair layer of a panel, over an already painted data layer.
     *  Lets the engine answer a pointer move with a blit of the cached data layer instead of
     *  a full LOD redraw of every dataset. Optional: a custom Renderer without it keeps the
     *  old single-pass behaviour (drawPanel with the crosshair argument). */
    drawPanelCrosshair?(
        ctx: CanvasRenderingContext2D,
        panel: Panel,
        transform: Transform,
        crosshair: { x: number; y: number } | null
    ): void;
}

export interface Transform {
    offsetX: number;
    scaleX: number;
    offsetY?: number;
    scaleY?: number;
}

// Data is sorted by x: find visible-range boundaries with binary search,
// without filter allocations on each frame. Returns [start, end) by indexes.
function visibleRange(data: DataPoint[], xMin: number, xMax: number): [number, number] {
    let lo = 0, hi = data.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (data[mid].x < xMin) lo = mid + 1; else hi = mid;
    }
    const start = lo;
    hi = data.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (data[mid].x <= xMax) lo = mid + 1; else hi = mid;
    }
    return [start, lo];
}

/** One gradient object per (top, bottom, colour) instead of a fresh one per dataset per frame.
 *  During a pan every filled line rebuilt its gradient on every single frame, and the geometry
 *  only changes when the panel's vertical range does. Bounded so a long session cannot grow it. */
// keyed BY CONTEXT: a gradient belongs to the context that created it, and a page can hold
// several charts, so one flat cache would hand canvas B a gradient made on canvas A
const gradientCache = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasGradient>>();
const GRADIENT_CACHE_MAX = 64;

function fillGradient(ctx: CanvasRenderingContext2D, yTop: number, yBottom: number, color: string): CanvasGradient {
    let perContext = gradientCache.get(ctx);
    if (!perContext) { perContext = new Map(); gradientCache.set(ctx, perContext) }
    const key = `${Math.round(yTop)}|${Math.round(yBottom)}|${color}`;
    let grad = perContext.get(key);
    if (!grad) {
        if (perContext.size >= GRADIENT_CACHE_MAX) perContext.clear();
        grad = ctx.createLinearGradient(0, yTop, 0, yBottom);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        perContext.set(key, grad);
    }
    return grad;
}

export function createRenderer(): Renderer {
    function getNiceTicks(minVal: number, maxVal: number, count: number): number[] {
        const range = maxVal - minVal || 1;
        const roughStep = range / count;
        const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
        const norm = roughStep / mag;
        const step = (norm < 2 ? 1 : norm < 5 ? 2 : 5) * mag;

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
        // otherwise offsetY/scaleY
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

        const [xMinVisible, xMaxVisible] = visibleXRange(panel.width, transform);
        const [start, end] = visibleRange(data, xMinVisible, xMaxVisible);
        if (end - start < 2) return;

        const result: DataPoint[] = [];
        let lastPixX = -1;
        let minPt: DataPoint | null = null;
        let maxPt: DataPoint | null = null;
        const flush = () => {
            if (!minPt || !maxPt) return;
            const a = minPt.x <= maxPt.x ? minPt : maxPt;
            const b = a === minPt ? maxPt : minPt;
            result.push(a);
            if (b !== a) result.push(b);
        };
        for (let i = start; i < end; i++) {
            const pt = data[i];
            const px = Math.round(xToPixX(pt.x, transform, panel));
            if (px !== lastPixX) {
                flush();
                minPt = pt;
                maxPt = pt;
                lastPixX = px;
            } else {
                if (pt.y < minPt!.y) minPt = pt;
                if (pt.y > maxPt!.y) maxPt = pt;
            }
        }
        flush();
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
            ctx.fillStyle = fillGradient(ctx, yPixMin, yPixMax, fillColor);
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
        const [xMinVisible, xMaxVisible] = visibleXRange(panel.width, transform);
        const [start, end] = visibleRange(data, xMinVisible, xMaxVisible);
        if (end === start) return;

        ctx.save();
        ctx.fillStyle = barColor;
        const barWidth = 5;
        const pyBase = yToPixY(panel.verticalRange.minY, panel, transform);
        for (let i = start; i < end; i++) {
            const pt = data[i];
            const px = xToPixX(pt.x, transform, panel);
            const py = yToPixY(pt.y, panel, transform);
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

    // same clip and bounds test as drawPanel's crosshair block, without repainting the data
    function drawPanelCrosshair(
        ctx: CanvasRenderingContext2D,
        panel: Panel,
        transform: Transform,
        crosshair: { x: number; y: number } | null
    ) {
        if (!crosshair) return;
        if (
            crosshair.x < panel.left ||
            crosshair.x > panel.left + panel.width ||
            crosshair.y < panel.top ||
            crosshair.y > panel.top + panel.height
        ) return;

        ctx.save();
        ctx.beginPath();
        ctx.rect(panel.left, panel.top, panel.width, panel.height);
        ctx.clip();
        drawCrosshair(ctx, panel, crosshair, transform);
        ctx.restore();
    }

    return {
        drawPanel,
        drawPanelCrosshair
    };
}
