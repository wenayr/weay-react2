// Chart margins and line color (same values, extracted from the render body)
const CHART_MARGIN_TOP = 20;
const CHART_MARGIN_BOTTOM = 20;
const CHART_LINE_COLOR = "rgb(0,180,0)";

/**
 * Chart point: time and price.
 */
export interface IChartPoint {
    time: number;
    price: number;
}

/**
 * Canvas settings.
 */
export interface IChartConfig {
    container: HTMLElement;   // container where canvas will be inserted
    width?: number;
    height?: number;
    autoScaleY?: boolean;     // automatically fit the Y scale
    showTimeAxis?: boolean;
    showPriceAxis?: boolean;
}

/**
 * Interface returned by createChartCanvas:
 * methods for zoom, scrolling, etc.
 */
export interface IChartCanvas {
    appendData(points: IChartPoint | IChartPoint[]): void;
    clearData(): void;
    scrollX(deltaPx: number): void;
    zoomX(factor: number, centerPx?: number): void;
    jumpToStart(): void;
    jumpToEnd(): void;
    jumpToIndex(i: number): void;
    setAutoScaleY(enabled: boolean): void;
    setShowTimeAxis(enabled: boolean): void;
    setShowPriceAxis(enabled: boolean): void;
    draw(): void;
    destroy(): void;
}

/**
 * Creates a functional canvas with wheel zoom support.
 */
export function createChartCanvas(config: IChartConfig): IChartCanvas {
    // Create <canvas> and insert it into container
    const canvas = document.createElement("canvas");
    config.container.appendChild(canvas);

    // State captured in the closure
    let state = {
        width: (config.width ?? config.container.offsetWidth) || 800,
        height: (config.height ?? config.container.offsetHeight) || 400,
        data: [] as IChartPoint[],
        offsetX: 0,
        scaleX: 5,       // pixels per step (point index)
        autoScaleY: config.autoScaleY ?? true,
        showTimeAxis: config.showTimeAxis ?? true,
        showPriceAxis: config.showPriceAxis ?? true,
        needsRender: true,
        isDragging: false,
        lastDragX: 0,
    };

    const ctx = canvas.getContext("2d")!;
    function resizeCanvas() {
        state.width = (config.width ?? config.container.offsetWidth) || 800;
        state.height = (config.height ?? config.container.offsetHeight) || 400;
        canvas.width = state.width;
        canvas.height = state.height;
        state.needsRender = true;
    }
    resizeCanvas();

    // ~~~ Rendering ~~~
    function draw() {
        if (!state.needsRender) return;
        state.needsRender = false;

        ctx.clearRect(0, 0, state.width, state.height);

        if (state.data.length === 0) {
            drawAxes();
            return;
        }

        // Calculate which data indexes are visible on screen
        const minIndex = Math.floor(-state.offsetX / state.scaleX);
        const maxIndex = Math.ceil((state.width - state.offsetX) / state.scaleX);
        const startIndex = Math.max(0, minIndex);
        const endIndex = Math.min(state.data.length - 1, maxIndex);

        if (startIndex > endIndex) {
            drawAxes();
            return;
        }

        // Fixed 0..100 range unless auto scaling; the scan runs only when its result is used
        let minY = 0;
        let maxY = 100;
        if (state.autoScaleY) {
            minY = Infinity;
            maxY = -Infinity;
            for (let i = startIndex; i <= endIndex; i++) {
                const p = state.data[i];
                if (p.price < minY) minY = p.price;
                if (p.price > maxY) maxY = p.price;
            }
        }
        const rangeY = maxY - minY || 1;
        const marginTop = CHART_MARGIN_TOP;
        const marginBottom = state.showTimeAxis ? CHART_MARGIN_BOTTOM : 0;
        const chartHeight = state.height - marginTop - marginBottom;

        function toScreenX(i: number) {
            return i * state.scaleX + state.offsetX;
        }
        function toScreenY(price: number) {
            return marginTop + chartHeight - ((price - minY) / rangeY) * chartHeight;
        }

        // Draw the line
        ctx.beginPath();
        let first = true;
        for (let i = startIndex; i <= endIndex; i++) {
            const p = state.data[i];
            const x = toScreenX(i);
            const y = toScreenY(p.price);
            if (first) {
                ctx.moveTo(x, y);
                first = false;
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.strokeStyle = CHART_LINE_COLOR;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw axes and labels
        drawAxes(minY, maxY, startIndex, endIndex, toScreenX, toScreenY);
    }

    function drawAxes(
        minY?: number,
        maxY?: number,
        startIndex?: number,
        endIndex?: number,
        toX?: (i: number) => number,
        toY?: (price: number) => number
    ) {
        ctx.save();
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.font = "12px sans-serif";

        // X axis (bottom)
        if (state.showTimeAxis) {
            ctx.beginPath();
            ctx.moveTo(0, state.height - 0.5);
            ctx.lineTo(state.width, state.height - 0.5);
            ctx.stroke();

            // Time labels
            if (startIndex != null && endIndex != null && toX) {
                const step = Math.max(1, Math.floor((endIndex - startIndex) / 5));
                for (let i = startIndex; i <= endIndex; i += step) {
                    const p = state.data[i];
                    const x = toX(i);
                    if (x < 0 || x > state.width) continue;
                    const dateStr = new Date(p.time).toLocaleTimeString();
                    ctx.fillText(dateStr, x, state.height - 5);
                    ctx.beginPath();
                    ctx.moveTo(x, state.height - 15);
                    ctx.lineTo(x, state.height);
                    ctx.stroke();
                }
            }
        }

        // Y axis (left)
        if (state.showPriceAxis) {
            ctx.beginPath();
            ctx.moveTo(0.5, 0);
            ctx.lineTo(0.5, state.height);
            ctx.stroke();

            if (minY !== undefined && maxY !== undefined && toY) {
                const yMin = toY(minY);
                const yMax = toY(maxY);
                ctx.fillText(minY.toFixed(2), 5, yMin - 2);
                ctx.beginPath();
                ctx.moveTo(0, yMin);
                ctx.lineTo(5, yMin);
                ctx.stroke();

                ctx.fillText(maxY.toFixed(2), 5, yMax - 2);
                ctx.beginPath();
                ctx.moveTo(0, yMax);
                ctx.lineTo(5, yMax);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    let animationFrameId: number | null = null;
    let destroyed = false;
    let docListenersActive = false;
    // temp-detach (portal, node move) is not a reason to self-destroy: wait for reconnect
    // with a grace period; a real unmount without destroy() is handled by timeout auto-cleanup
    const DETACH_DESTROY_MS = 10_000;
    let disconnectedSince: number | null = null;
    function animate() {
        if (destroyed) return;
        if (!canvas.isConnected) {
            disconnectedSince ??= performance.now();
            if (performance.now() - disconnectedSince > DETACH_DESTROY_MS) {
                destroy();
                return;
            }
            animationFrameId = requestAnimationFrame(animate);
            return;
        }
        if (disconnectedSince != null) {
            disconnectedSince = null;
            state.needsRender = true; // force redraw after reconnect
        }
        if (state.needsRender) {
            draw();
        }
        animationFrameId = requestAnimationFrame(animate);
    }
    animate();

    // ~~~ API methods ~~~

    function appendData(points: IChartPoint | IChartPoint[]) {
        if (!Array.isArray(points)) points = [points];
        state.data.push(...points);
        state.needsRender = true;
    }

    function clearData() {
        state.data = [];
        state.offsetX = 0;
        state.needsRender = true;
    }

    function scrollX(deltaPx: number) {
        state.offsetX += deltaPx;
        state.needsRender = true;
    }

    function zoomX(factor: number, centerPx = state.width / 2) {
        // Determine which index is currently under centerPx
        const i = (centerPx - state.offsetX) / state.scaleX;
        state.scaleX *= factor;
        // Clamp scale
        if (state.scaleX < 0.1) state.scaleX = 0.1;
        if (state.scaleX > 2000) state.scaleX = 2000;
        // Shift offsetX so the same point stays under the cursor
        state.offsetX = centerPx - i * state.scaleX;
        state.needsRender = true;
    }

    function jumpToStart() {
        state.offsetX = 0;
        state.needsRender = true;
    }

    function jumpToEnd() {
        const i = state.data.length - 1;
        if (i < 0) return;
        const desiredX = state.width * 0.9;
        state.offsetX = desiredX - i * state.scaleX;
        state.needsRender = true;
    }

    function jumpToIndex(i: number) {
        if (i < 0 || i >= state.data.length) return;
        const centerPx = state.width / 2;
        state.offsetX = centerPx - i * state.scaleX;
        state.needsRender = true;
    }

    function setAutoScaleY(enabled: boolean) {
        state.autoScaleY = enabled;
        state.needsRender = true;
    }

    function setShowTimeAxis(enabled: boolean) {
        state.showTimeAxis = enabled;
        state.needsRender = true;
    }

    function setShowPriceAxis(enabled: boolean) {
        state.showPriceAxis = enabled;
        state.needsRender = true;
    }

    function drawManually() {
        // Force render call
        state.needsRender = true;
        draw();
    }

    // ~~~ Mouse events ~~~
    const addDocListeners = () => {
        if (docListenersActive) return;
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        docListenersActive = true;
    };
    const removeDocListeners = () => {
        if (!docListenersActive) return;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        docListenersActive = false;
    };

    const onMouseDown = (e: MouseEvent) => {
        state.isDragging = true;
        state.lastDragX = e.clientX;
        addDocListeners();
    };
    const onMouseMove = (e: MouseEvent) => {
        if (state.isDragging) {
            const dx = e.clientX - state.lastDragX;
            state.lastDragX = e.clientX;
            scrollX(dx); // drag the chart
        }
    };
    const onMouseUp = () => {
        state.isDragging = false;
        removeDocListeners();
    };

    // ===> Bind zoom to mouse wheel <===
    const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        // e.deltaY > 0 => wheel down => factor < 1 => zoom out
        // e.deltaY < 0 => wheel up => factor > 1 => zoom in
        const factor = e.deltaY < 0 ? 1.1 : 0.9;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;

        zoomX(factor, mouseX);
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    function destroy() {
        if (destroyed) return;
        destroyed = true;
        canvas.removeEventListener("mousedown", onMouseDown);
        removeDocListeners();
        canvas.removeEventListener("wheel", onWheel);
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (canvas.parentElement) {
            canvas.parentElement.removeChild(canvas);
        }
    }

    // Build and return API
    return {
        appendData,
        clearData,
        scrollX,
        zoomX,
        jumpToStart,
        jumpToEnd,
        jumpToIndex,
        setAutoScaleY,
        setShowTimeAxis,
        setShowPriceAxis,
        draw: drawManually,
        destroy,
    };
}
