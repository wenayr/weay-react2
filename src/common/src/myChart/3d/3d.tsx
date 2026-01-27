/*************************************************************
 * megaWebGLChart.tsx
 * Демонстрация:
 *   - WebGLCanvas (для графиков)
 *   - AxisCanvas (2D, для осей и сетки)
 *   - OverlayCanvas (2D, для кроссхейра, аннотаций, drag-resize)
 *   - Drag-resize панелей
 *   - Double-click по оси Y (справа)
 *   - "Запас" (padding) сверху/снизу при автофокусе
 *   - Живое добавление точек каждые 2 секунды
 *************************************************************/
import React, {useRef, useEffect, useState} from 'react';

/*************************************************************
 * 1) DataModel / DataSet
 *************************************************************/
interface DataPoint {
    x: number;
    y: number;
}

type ChartType = 'line' | 'bar';

interface DataSetStyle {
    strokeColor?: string;
    fillColor?: string;
    barColor?: string;
    lineWidth?: number;
    gradientFill?: boolean;
}

interface MinMaxChunk {
    xStart: number;
    xEnd: number;
    minY: number;
    maxY: number;
}

interface DataSet {
    id: string;
    type: ChartType;
    data: DataPoint[];
    style: DataSetStyle;
    chunkSize: number;
    minMaxChunks: MinMaxChunk[];

    getMinMaxInRange(x1: number, x2: number): { minY: number; maxY: number };

    addData(newPoints: DataPoint | DataPoint[]): void;
}

interface CreateDataSetParams {
    id: string;
    type?: ChartType;
    data?: DataPoint[];
    style?: DataSetStyle;
    chunkSize?: number;
}

function createDataSet(params: CreateDataSetParams): DataSet {
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
    const mergedStyle = {...defaultStyle, ...style};

    let internalData = data.slice();
    let minMaxChunks: MinMaxChunk[] = [];

    function buildChunks() {
        minMaxChunks = [];
        if (!internalData.length) return;
        for (let i = 0; i < internalData.length; i += chunkSize) {
            const chunk = internalData.slice(i, i + chunkSize);
            let minY = Infinity;
            let maxY = -Infinity;
            const xStart = chunk[0].x;
            const xEnd = chunk[chunk.length - 1].x;
            for (const p of chunk) {
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            }
            minMaxChunks.push({xStart, xEnd, minY, maxY});
        }
    }

    buildChunks();

    function getMinMaxInRange(x1: number, x2: number) {
        if (!internalData.length) return {minY: 0, maxY: 1};
        let mmin = Infinity;
        let mmax = -Infinity;
        for (const c of minMaxChunks) {
            if (c.xEnd < x1 || c.xStart > x2) continue;
            if (c.minY < mmin) mmin = c.minY;
            if (c.maxY > mmax) mmax = c.maxY;
        }
        if (mmin === Infinity || mmax === -Infinity) {
            mmin = 0;
            mmax = 1;
        }
        return {minY: mmin, maxY: mmax};
    }

    function addData(newPoints: DataPoint | DataPoint[]) {
        const arr = Array.isArray(newPoints) ? newPoints : [newPoints];
        internalData.push(...arr);
        const remainder = internalData.length % chunkSize;
        if (remainder <= arr.length) {
            buildChunks();
        } else {
            const idx = Math.floor((internalData.length - 1) / chunkSize);
            const start = idx * chunkSize;
            const c = internalData.slice(start, start + chunkSize);
            let mm = Infinity, MM = -Infinity;
            for (const p of c) {
                if (p.y < mm) mm = p.y;
                if (p.y > MM) MM = p.y;
            }
            const xStart = c[0].x;
            const xEnd = c[c.length - 1].x;
            minMaxChunks[idx] = {xStart, xEnd, minY: mm, maxY: MM};
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

interface DataModel {
    addDataSet(params: CreateDataSetParams): DataSet;

    getAllDataSets(): DataSet[];

    getGlobalMinMaxY(x1: number, x2: number, filterFn?: (ds: DataSet) => boolean): { minY: number; maxY: number };
}

function createDataModel(): DataModel {
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
        let mm = Infinity;
        let MM = -Infinity;
        for (const ds of dataSets) {
            if (filterFn && !filterFn(ds)) continue;
            const {minY, maxY} = ds.getMinMaxInRange(x1, x2);
            if (minY < mm) mm = minY;
            if (maxY > MM) MM = maxY;
        }
        if (mm === Infinity || MM === -Infinity) {
            mm = 0;
            MM = 1;
        }
        return {minY: mm, maxY: MM};
    }

    return {addDataSet, getAllDataSets, getGlobalMinMaxY};
}

/*************************************************************
 * 2) PanelManager
 *************************************************************/
interface Panel {
    id: string;
    dataSets: DataSet[];
    heightPct: number; // "drag-resize" будет менять
    topPx: number;
    heightPx: number;
    autoFocusY: boolean;
    minY: number; // вычисляется
    maxY: number; // вычисляется
}

interface PanelManager {
    panels: Panel[];

    addPanel(cfg: { id: string; dataSets: DataSet[]; heightPct?: number; autoFocusY?: boolean }): void;

    layoutPanels(totalH: number): void;

    resizePanel(panelId: string, deltaPx: number, containerHeight: number): void; // drag-resize
}

function createPanelManager(): PanelManager {
    const panels: Panel[] = [];

    function addPanel(cfg: { id: string; dataSets: DataSet[]; heightPct?: number; autoFocusY?: boolean }) {
        const p: Panel = {
            id: cfg.id,
            dataSets: cfg.dataSets,
            heightPct: cfg.heightPct ?? 50,
            topPx: 0,
            heightPx: 0,
            autoFocusY: cfg.autoFocusY !== false,
            minY: 0, maxY: 1
        };
        panels.push(p);
    }

    function layoutPanels(totalH: number) {
        if (!panels.length) return;
        let sum = 0;
        for (let i = 0; i < panels.length - 1; i++) {
            sum += panels[i].heightPct;
        }
        panels[panels.length - 1].heightPct = 100 - sum;
        let curTop = 0;
        for (const p of panels) {
            const h = (p.heightPct / 100) * totalH;
            p.topPx = curTop;
            p.heightPx = h;
            curTop += h;
        }
    }

    function resizePanel(panelId: string, deltaPx: number, containerHeight: number) {
        const idx = panels.findIndex(p => p.id === panelId);
        if (idx < 0) return;
        const p = panels[idx];
        // px->pct
        const dPct = (deltaPx / containerHeight) * 100;
        let newPct = p.heightPct + dPct;
        if (newPct < 5) newPct = 5;
        if (newPct > 95) newPct = 95;
        p.heightPct = newPct;
    }

    return {panels, addPanel, layoutPanels, resizePanel};
}

/*************************************************************
 * 3) WebGLRenderer (графики)
 *************************************************************/
interface Transform {
    offsetX: number;
    scaleX: number;
    offsetY: number;
    scaleY: number;
}

interface WebGLRenderer {
    init(gl: WebGLRenderingContext, w: number, h: number): void;

    drawAll(gl: WebGLRenderingContext, panels: Panel[], t: Transform, cw: number, ch: number): void;

    destroy(): void;

    uploadDataSet(gl: WebGLRenderingContext, ds: DataSet): void;
}

function createWebGLRenderer(): WebGLRenderer {
    let program: WebGLProgram | null = null;
    let aPositionLoc = -1;
    let uColorLoc: WebGLUniformLocation | null = null;
    let uMatrixLoc: WebGLUniformLocation | null = null;

    const dsBuffers = new Map<string, WebGLBuffer>();

    const vsSrc = `
    precision highp float;
    attribute vec2 aPosition;
    uniform mat3 uMatrix;
    void main() {
      vec3 pos = uMatrix * vec3(aPosition,1.0);
      gl_Position=vec4(pos.x,pos.y,0.0,1.0);
    }
  `;
    const fsSrc = `
    precision highp float;
    uniform vec4 uColor;
    void main(){
      gl_FragColor=uColor;
    }
  `;

    function compileShader(gl: WebGLRenderingContext, src: string, type: number): WebGLShader {
        const sh = gl.createShader(type)!;
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(sh);
            gl.deleteShader(sh);
            throw new Error('Shader error: ' + info);
        }
        return sh;
    }

    function createProgramGL(gl: WebGLRenderingContext, v: string, f: string): WebGLProgram {
        const vs = compileShader(gl, v, gl.VERTEX_SHADER);
        const fs = compileShader(gl, f, gl.FRAGMENT_SHADER);
        const prog = gl.createProgram()!;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(prog);
            gl.deleteProgram(prog);
            throw new Error('Link error: ' + info);
        }
        return prog;
    }

    function init(gl: WebGLRenderingContext, w: number, h: number) {
        program = createProgramGL(gl, vsSrc, fsSrc);
        gl.useProgram(program);
        aPositionLoc = gl.getAttribLocation(program, 'aPosition');
        uColorLoc = gl.getUniformLocation(program, 'uColor');
        uMatrixLoc = gl.getUniformLocation(program, 'uMatrix');
    }

    function uploadDataSet(gl: WebGLRenderingContext, ds: DataSet) {
        let buf = dsBuffers.get(ds.id);
        if (!buf) {
            buf = gl.createBuffer()!;
            dsBuffers.set(ds.id, buf);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        const arr = new Float32Array(ds.data.length * 2);
        for (let i = 0; i < ds.data.length; i++) {
            arr[i * 2 + 0] = ds.data[i].x;
            arr[i * 2 + 1] = ds.data[i].y;
        }
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    }

    function parseColor(hex: string): [number, number, number] {
        let c = hex.replace('#', '');
        if (c.length < 6) c = c.padEnd(6, '0');
        const r = parseInt(c.substr(0, 2), 16) / 255;
        const g = parseInt(c.substr(2, 2), 16) / 255;
        const b = parseInt(c.substr(4, 2), 16) / 255;
        return [r, g, b];
    }

    function mat3Ortho(l: number, r: number, b: number, t: number): number[] {
        const tx = -(r + l) / (r - l);
        const ty = -(t + b) / (t - b);
        return [
            2 / (r - l), 0, 0,
            0, 2 / (t - b), 0,
            tx, ty, 1
        ];
    }

    /** С учётом panel.topPx, etc. + "padding" сверху/снизу */
    const PADDING_FACTOR = 0.1; // например, 10%
    function computeMatrix(panel: Panel, transform: Transform, cw: number, ch: number) {
        const left = transform.offsetX;
        const right = transform.offsetX + cw / transform.scaleX;
        let yMin, yMax;
        if (panel.autoFocusY) {
            // добавим запас сверху/снизу
            let range = panel.maxY - panel.minY;
            if (range < 1) range = 1;
            const pad = range * PADDING_FACTOR;
            yMin = panel.minY - pad;
            yMax = panel.maxY + pad;
        } else {
            // ручной + тоже чуть можно добавить pad, если хотите
            const range = panel.heightPx / transform.scaleY;
            const pad = range * PADDING_FACTOR;
            yMin = transform.offsetY - pad + panel.topPx;
            yMax = transform.offsetY + range + pad + panel.topPx;
        }
        // матрица ortho
        const mat = mat3Ortho(left, right, yMin, yMax);
        return new Float32Array(mat);
    }

    function drawDataSet(gl: WebGLRenderingContext, ds: DataSet, panel: Panel, t: Transform, cw: number, ch: number) {
        if (!program) return;
        if (!ds.data.length) return;
        if (!dsBuffers.has(ds.id)) {
            uploadDataSet(gl, ds);
        }
        gl.useProgram(program);
        const buf = dsBuffers.get(ds.id)!;
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(aPositionLoc);
        gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);

        const color = ds.type === 'line' ? (ds.style.strokeColor ?? '#ff0000') : (ds.style.barColor ?? '#66cc66');
        const [r, g, b] = parseColor(color);
        gl.uniform4f(uColorLoc, r, g, b, 1.0);

        const mat = computeMatrix(panel, t, cw, ch);
        gl.uniformMatrix3fv(uMatrixLoc, false, mat);

        if (ds.type === 'line') {
            gl.drawArrays(gl.LINE_STRIP, 0, ds.data.length);
        } else {
            // bar => POINTS (упрощённо)
            gl.drawArrays(gl.POINTS, 0, ds.data.length);
        }
    }

    function drawAll(gl: WebGLRenderingContext, panels: Panel[], t: Transform, cw: number, ch: number) {
        gl.viewport(0, 0, cw, ch);
        gl.clearColor(1, 1, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        for (const p of panels) {
            for (const ds of p.dataSets) {
                drawDataSet(gl, ds, p, t, cw, ch);
            }
        }
    }

    function destroy() {
        dsBuffers.clear();
        // ...
    }

    return {init, drawAll, destroy, uploadDataSet};
}

/*************************************************************
 * 4) AxisCanvas (рисуем сетку, оси)
 *************************************************************/
function drawAxes2D(
    ctx: CanvasRenderingContext2D,
    panels: Panel[],
    transform: Transform,
    cw: number, ch: number
) {
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.strokeStyle = '#777';

    // Просто рисуем границы панелей, ось Y справа
    for (const p of panels) {
        // bottom line
        ctx.beginPath();
        ctx.moveTo(0, p.topPx + p.heightPx);
        ctx.lineTo(cw, p.topPx + p.heightPx);
        ctx.stroke();
        // y-axis at right
        ctx.beginPath();
        ctx.moveTo(cw - 40, p.topPx);
        ctx.lineTo(cw - 40, p.topPx + p.heightPx);
        ctx.stroke();

        // Можно добавить "setku" — вертикальные линии
        // Можно "nice ticks"...
    }

    ctx.restore();
}

/*************************************************************
 * 5) OverlayCanvas (кроссхейр, drag-resize, dblclick)
 *************************************************************/
interface OverlayInteractionState {
    isDraggingPanelEdge: boolean;
    resizingPanelId: string | null;
    startY: number;
    startHeight: number;
    isDraggingChart: boolean;
    lastX: number;
    lastY: number;
}

function drawOverlayCanvas(
    ctx: CanvasRenderingContext2D,
    cw: number, ch: number,
    crosshair: { x: number; y: number } | null,
    panels: Panel[]
) {
    ctx.clearRect(0, 0, cw, ch);

    // кроссхейр
    if (crosshair) {
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(crosshair.x, 0);
        ctx.lineTo(crosshair.x, ch);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, crosshair.y);
        ctx.lineTo(cw, crosshair.y);
        ctx.stroke();
        ctx.restore();
    }

    // границы панелей (между панелями)
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    for (let i = 0; i < panels.length; i++) {
        const p = panels[i];
        const bottom = p.topPx + p.heightPx;
        if (i < panels.length - 1) {
            // рисуем тонкую "ручку"
            ctx.beginPath();
            ctx.moveTo(0, bottom);
            ctx.lineTo(cw, bottom);
            ctx.stroke();
        }
    }
    ctx.restore();
}

/*************************************************************
 * 6) Небольшая утилита: генерация данных
 *************************************************************/
function generateIncrementalData(count: number, startX = 0, startY = 0, maxDelta = 10): DataPoint[] {
    const arr: DataPoint[] = [];
    let x = startX;
    let y = startY;
    for (let i = 0; i < count; i++) {
        x++;
        y += (Math.random() - 0.5) * 2 * maxDelta;
        arr.push({x, y});
    }
    return arr;
}

/*************************************************************
 * 7) MegaWebGLChart (React-компонент)
 *************************************************************/
export const MegaWebGLChart: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    // WebGL canvas
    const webglCanvasRef = useRef<HTMLCanvasElement>(null);
    // Axis canvas
    const axisCanvasRef = useRef<HTMLCanvasElement>(null);
    // Overlay canvas
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

    const [cw, setCW] = useState(800);
    const [ch, setCH] = useState(500);

    const glRef = useRef<WebGLRenderingContext | null>(null);

    // DataModel, PanelManager, Renderer
    const dataModelRef = useRef(createDataModel());
    const panelManagerRef = useRef(createPanelManager());
    const rendererRef = useRef(createWebGLRenderer());

    // Transform
    const transformRef = useRef<Transform>({
        offsetX: 0,
        scaleX: 1,
        offsetY: 0,
        scaleY: 1
    });

    // crosshair
    const crosshairRef = useRef<{ x: number; y: number } | null>(null);

    // Interaction overlay
    const overlayStateRef = useRef<OverlayInteractionState>({
        isDraggingPanelEdge: false,
        resizingPanelId: null,
        startY: 0,
        startHeight: 0,
        isDraggingChart: false,
        lastX: 0, lastY: 0
    });

    // ResizeObserver
    useEffect(() => {
        const cont = containerRef.current;
        if (!cont) return;
        const ro = new ResizeObserver(entries => {
            for (const e of entries) {
                if (e.target === cont) {
                    const w = Math.floor(e.contentRect.width);
                    const h = Math.floor(e.contentRect.height);
                    setCW(w);
                    setCH(h);
                    // пересчитаем размер canvas
                    if (webglCanvasRef.current) {
                        webglCanvasRef.current.width = w;
                        webglCanvasRef.current.height = h;
                    }
                    if (axisCanvasRef.current) {
                        axisCanvasRef.current.width = w;
                        axisCanvasRef.current.height = h;
                    }
                    if (overlayCanvasRef.current) {
                        overlayCanvasRef.current.width = w;
                        overlayCanvasRef.current.height = h;
                    }
                    panelManagerRef.current.layoutPanels(h);
                    requestAnimationFrame(drawAll);
                }
            }
        });
        ro.observe(cont);
        return () => ro.disconnect();
    }, []);

    // Init WebGL
    useEffect(() => {
        const glCanvas = webglCanvasRef.current;
        if (!glCanvas) return;
        const gl = glCanvas.getContext('webgl');
        if (!gl) {
            console.error('No webgl');
            return;
        }
        glRef.current = gl;
        rendererRef.current.init(gl, cw, ch);

        // Interaction (pan, zoom) на axisCanvasRef (или overlayCanvasRef)
        // Но можно и на webglCanvas — ваш выбор.
        // Для простоты сделаем на "overlayCanvas".
        const overlay = overlayCanvasRef.current!;
        if (!overlay) return;

        function onMouseDown(e: MouseEvent) {
            const rect = overlay.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            crosshairRef.current = {x, y};
            // проверяем, не попали ли мы в границу между панелями
            const pm = panelManagerRef.current;
            for (let i = 0; i < pm.panels.length; i++) {
                const p = pm.panels[i];
                const bot = p.topPx + p.heightPx;
                if (Math.abs(bot - y) < 5 && i < pm.panels.length - 1) {
                    overlayStateRef.current.isDraggingPanelEdge = true;
                    overlayStateRef.current.resizingPanelId = p.id;
                    overlayStateRef.current.startY = e.clientY;
                    overlayStateRef.current.startHeight = p.heightPx;
                    return;
                }
            }
            // проверяем, не попали ли мы в ось Y (справа ~cw-40)
            if (x >= cw - 40) {
                // double-click обрабатывается в onDblClick
                // а так — возможно масштаб по Y? Опустим для краткости.
            }

            // иначе pan
            overlayStateRef.current.isDraggingChart = true;
            overlayStateRef.current.lastX = e.clientX;
            overlayStateRef.current.lastY = e.clientY;
        }

        function onMouseMove(e: MouseEvent) {
            const rect = overlay.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            crosshairRef.current = {x, y};

            const st = overlayStateRef.current;
            if (st.isDraggingPanelEdge && st.resizingPanelId) {
                // resizing
                const dy = e.clientY - st.startY;
                panelManagerRef.current.resizePanel(st.resizingPanelId, dy, ch);
                panelManagerRef.current.layoutPanels(ch);
                requestAnimationFrame(drawAll);
                return;
            }
            if (st.isDraggingChart) {
                const dx = e.clientX - st.lastX;
                const dy = e.clientY - st.lastY;
                st.lastX = e.clientX;
                st.lastY = e.clientY;
                const t = transformRef.current;
                t.offsetX -= dx / t.scaleX;
                t.offsetY += dy / t.scaleY;
                requestAnimationFrame(drawAll);
                return;
            }
            requestAnimationFrame(drawAll);
        }

        function onMouseUp(e: MouseEvent) {
            overlayStateRef.current.isDraggingPanelEdge = false;
            overlayStateRef.current.resizingPanelId = null;
            overlayStateRef.current.isDraggingChart = false;
        }

        function onWheel(e: WheelEvent) {
            e.preventDefault();
            const t = transformRef.current;
            const delta = (e.deltaY < 0) ? 1.1 : 0.9;
            const rect = overlay.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const worldX = t.offsetX + mx / t.scaleX;
            const worldY = t.offsetY + (ch - my) / t.scaleY;
            t.scaleX *= delta;
            t.scaleX = Math.max(0.0001, t.scaleX);
            t.scaleY *= delta;
            t.scaleY = Math.max(0.0001, t.scaleY);
            const newMx = (worldX - t.offsetX) * t.scaleX;
            const newMy = (worldY - t.offsetY) * t.scaleY;
            const dx = mx - newMx;
            const dy = my - (ch - newMy);
            t.offsetX -= dx / t.scaleX;
            t.offsetY += dy / t.scaleY;
            requestAnimationFrame(drawAll);
        }

        function onDblClick(e: MouseEvent) {
            // double-click => если x>=cw-40 => toggle autoFocus
            const rect = overlay.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (x >= cw - 40) {
                // найдём, какой panel
                const pm = panelManagerRef.current;
                for (const p of pm.panels) {
                    if (y >= p.topPx && y <= p.topPx + p.heightPx) {
                        p.autoFocusY = !p.autoFocusY;
                        requestAnimationFrame(drawAll);
                        return;
                    }
                }
            }
        }

        overlay.addEventListener('mousedown', onMouseDown);
        overlay.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        overlay.addEventListener('wheel', onWheel, {passive: false});
        overlay.addEventListener('dblclick', onDblClick);

        return () => {
            overlay.removeEventListener('mousedown', onMouseDown);
            overlay.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            overlay.removeEventListener('wheel', onWheel);
            overlay.removeEventListener('dblclick', onDblClick);
        };
    }, [cw, ch]);

    // Data init
    useEffect(() => {
        const dm = dataModelRef.current;
        const pm = panelManagerRef.current;
        // line DS
        const dsLine = dm.addDataSet({
            id: 'line1',
            type: 'line',
            data: generateIncrementalData(1000, 0, 100, 5),
            style: {strokeColor: '#FF0000'}
        });
        // bar DS
        const dsBar = dm.addDataSet({
            id: 'bar1',
            type: 'bar',
            data: generateIncrementalData(500, 0, 50, 2),
            style: {barColor: '#66aa66'}
        });

        pm.addPanel({id: 'mainPanel', dataSets: [dsLine], heightPct: 70, autoFocusY: true});
        pm.addPanel({id: 'bottomPanel', dataSets: [dsBar], heightPct: 30, autoFocusY: true});
    }, []);

    // Живое добавление
    useEffect(() => {
        const gl = glRef.current;
        if (!gl) return;
        const dsLine = dataModelRef.current.getAllDataSets().find(d => d.id === 'line1');
        const dsBar = dataModelRef.current.getAllDataSets().find(d => d.id === 'bar1');
        if (!dsLine || !dsBar) return;

        let lineX = dsLine.data[dsLine.data.length - 1]?.x || 0;
        let lineY = dsLine.data[dsLine.data.length - 1]?.y || 100;
        let barX = dsBar.data[dsBar.data.length - 1]?.x || 0;
        let barY = dsBar.data[dsBar.data.length - 1]?.y || 50;

        const intId = setInterval(() => {
            lineX++;
            lineY += (Math.random() - 0.5) * 2 * 5;
            dsLine.addData({x: lineX, y: lineY});

            barX++;
            barY += (Math.random() - 0.5) * 2 * 2;
            dsBar.addData({x: barX, y: barY});

            // обновим буфер
            rendererRef.current.uploadDataSet(gl, dsLine);
            rendererRef.current.uploadDataSet(gl, dsBar);
            requestAnimationFrame(drawAll);
        }, 2000);

        return () => clearInterval(intId);
    }, []);

    // При изменении cw,ch -> layout -> draw
    useEffect(() => {
        panelManagerRef.current.layoutPanels(ch);
        requestAnimationFrame(drawAll);
    }, [cw, ch]);

    function drawAll() {
        const gl = glRef.current;
        if (!gl) return;

        // автофокус
        const pm = panelManagerRef.current;
        const dm = dataModelRef.current;
        const t = transformRef.current;
        for (const p of pm.panels) {
            if (p.autoFocusY) {
                const x1 = t.offsetX;
                const x2 = t.offsetX + cw / t.scaleX;
                const {minY, maxY} = dm.getGlobalMinMaxY(x1, x2, ds => p.dataSets.includes(ds));
                // padding добавляем в renderer, но minY/maxY всё равно храним
                p.minY = minY;
                p.maxY = maxY;
            } else {
                p.minY = t.offsetY;
                p.maxY = t.offsetY + p.heightPx / t.scaleY;
            }
        }

        // webgl draw
        rendererRef.current.drawAll(gl, pm.panels, t, cw, ch);

        // axisCanvas
        const axisCtx = axisCanvasRef.current?.getContext('2d');
        if (axisCtx) {
            drawAxes2D(axisCtx, pm.panels, t, cw, ch);
        }

        // overlay
        const ovCtx = overlayCanvasRef.current?.getContext('2d');
        if (ovCtx) {
            drawOverlayCanvas(ovCtx, cw, ch, crosshairRef.current, pm.panels);
        }
    }

    return (
        <div ref={containerRef}
             style={{width: '100%', height: '600px', border: '1px solid #ccc', position: 'relative'}}>
            <canvas ref={webglCanvasRef} style={{position: 'absolute', left: 0, top: 0}}/>
            <canvas ref={axisCanvasRef} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}/>
            <canvas ref={overlayCanvasRef} style={{position: 'absolute', left: 0, top: 0}}/>
        </div>
    );
};
