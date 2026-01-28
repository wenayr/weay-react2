/**
 * Точка на графике: время (time) и цена (price).
 */
export interface IChartPoint {
    time: number;
    price: number;
}

/**
 * Настройки канваса.
 */
export interface IChartConfig {
    container: HTMLElement;   // контейнер, в который вставим canvas
    width?: number;
    height?: number;
    autoScaleY?: boolean;     // автоматически подгонять масштаб по оси Y
    showTimeAxis?: boolean;
    showPriceAxis?: boolean;
}

/**
 * Интерфейс объекта, который возвращает createChartCanvas:
 * методы управления зумом, прокруткой и т.д.
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
 * Создаём функциональный канвас с возможностью зума колёсиком.
 */
export function createChartCanvas(config: IChartConfig): IChartCanvas {
    // Создаём <canvas> и вставляем в container
    const canvas = document.createElement("canvas");
    config.container.appendChild(canvas);

    // Состояние (state) в замыкании
    let state = {
        width: (config.width ?? config.container.offsetWidth) || 800,
        height: (config.height ?? config.container.offsetHeight) || 400,
        data: [] as IChartPoint[],
        offsetX: 0,
        scaleX: 5,       // пикселей на «шаг» (индекс точки)
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

    // ~~~ Отрисовка ~~~
    function draw() {
        if (!state.needsRender) return;
        state.needsRender = false;

        ctx.clearRect(0, 0, state.width, state.height);

        if (state.data.length === 0) {
            drawAxes();
            return;
        }

        // Рассчитываем, какие индексы данных видны на экране
        const minIndex = Math.floor(-state.offsetX / state.scaleX);
        const maxIndex = Math.ceil((state.width - state.offsetX) / state.scaleX);
        const startIndex = Math.max(0, minIndex);
        const endIndex = Math.min(state.data.length - 1, maxIndex);

        if (startIndex > endIndex) {
            drawAxes();
            return;
        }

        // Ищем minY и maxY для видимых точек (если autoScaleY=true)
        let minY = Infinity;
        let maxY = -Infinity;
        for (let i = startIndex; i <= endIndex; i++) {
            const p = state.data[i];
            if (p.price < minY) minY = p.price;
            if (p.price > maxY) maxY = p.price;
        }
        if (minY === Infinity) {
            // Нет видимых точек
            drawAxes();
            return;
        }
        if (!state.autoScaleY) {
            // Допустим, зафиксируем 0..100, если не хотим авто
            minY = 0;
            maxY = 100;
        }
        const rangeY = maxY - minY || 1;
        const marginTop = 20;
        const marginBottom = state.showTimeAxis ? 20 : 0;
        const chartHeight = state.height - marginTop - marginBottom;

        function toScreenX(i: number) {
            return i * state.scaleX + state.offsetX;
        }
        function toScreenY(price: number) {
            return marginTop + chartHeight - ((price - minY) / rangeY) * chartHeight;
        }

        // Рисуем линию
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
        ctx.strokeStyle = "rgb(0,180,0)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Рисуем оси и подписи
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

        // Ось X (внизу)
        if (state.showTimeAxis) {
            ctx.beginPath();
            ctx.moveTo(0, state.height - 0.5);
            ctx.lineTo(state.width, state.height - 0.5);
            ctx.stroke();

            // Подписи времени
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

        // Ось Y (слева)
        if (state.showPriceAxis) {
            ctx.beginPath();
            ctx.moveTo(0.5, 0);
            ctx.lineTo(0.5, state.height);
            ctx.stroke();

            if (minY !== undefined && maxY !== undefined && toY) {
                const yMin = toY(minY);
                const yMax = toY(maxY);
                ctx.fillText(String(minY.toFixed(2)), 5, yMin - 2);
                ctx.beginPath();
                ctx.moveTo(0, yMin);
                ctx.lineTo(5, yMin);
                ctx.stroke();

                ctx.fillText(String(maxY.toFixed(2)), 5, yMax - 2);
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
    function animate() {
        if (destroyed) return;
        if (!canvas.isConnected) {
            destroy();
            return;
        }
        if (state.needsRender) {
            draw();
        }
        animationFrameId = requestAnimationFrame(animate);
    }
    animate();

    // ~~~ Методы API ~~~

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
        // Определяем, какой индекс сейчас под centerPx
        const i = (centerPx - state.offsetX) / state.scaleX;
        state.scaleX *= factor;
        // Ограничиваем масштаб
        if (state.scaleX < 0.1) state.scaleX = 0.1;
        if (state.scaleX > 2000) state.scaleX = 2000;
        // Сдвигаем offsetX так, чтобы та же точка осталась под курсором
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
        // Принудительный вызов отрисовки
        state.needsRender = true;
        draw();
    }

    // ~~~ События мыши ~~~
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
            scrollX(dx); // тянем график
        }
    };
    const onMouseUp = () => {
        state.isDragging = false;
        removeDocListeners();
    };

    // ===> Привязка зума к скроллу мышки <===
    const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        // e.deltaY > 0 => крутим вниз => factor < 1 => отдаляем
        // e.deltaY < 0 => крутим вверх => factor > 1 => приближаем
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

    // Собираем и возвращаем API
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
