import React, { useEffect, useRef } from "react";
import { createChartCanvas, IChartCanvas, IChartPoint} from "./myChart";

export function ChartDemo() {
    const chartRef = useRef<IChartCanvas | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Создаём график
        const chart = createChartCanvas({
            container: containerRef.current,
            width: 600,
            height: 300,
            autoScaleY: true,
            showTimeAxis: true,
            showPriceAxis: true,
        });
        chartRef.current = chart;

        // Добавим тестовые данные
        const now = Date.now();
        const demoData: IChartPoint[] = [];
        for (let i = 0; i < 50; i++) {
            demoData.push({
                time: now + i * 1000,
                price: 100 + Math.sin(i / 5) * 10,
            });
        }
        chart.appendData(demoData);
        chart.jumpToEnd();

        // Пример «потокового» добавления новых точек
        const timer = setInterval(() => {
            const last = demoData[demoData.length - 1];
            const newPoint: IChartPoint = {
                time: last.time + 1000,
                price: last.price + (Math.random() - 0.5) * 2,
            };
            demoData.push(newPoint);
            chart.appendData(newPoint);
            // optional: chart.jumpToEnd();
        }, 2000);

        return () => clearInterval(timer);
    }, []);

    return (
        <div style={{ padding: 20 }}>
            <h2>Chart with Wheel Zoom</h2>
            <div
                ref={containerRef}
                style={{ border: "1px solid black", width: 620, height: 320 }}
            />
            <div style={{ marginTop: 10 }}>
                <button onClick={() => chartRef.current?.zoomX(1.1)}>Zoom In</button>
                <button onClick={() => chartRef.current?.zoomX(0.9)}>Zoom Out</button>
                <button onClick={() => chartRef.current?.scrollX(50)}>
                    Scroll Left
                </button>
                <button onClick={() => chartRef.current?.scrollX(-50)}>
                    Scroll Right
                </button>
                <button onClick={() => chartRef.current?.jumpToStart()}>Start</button>
                <button onClick={() => chartRef.current?.jumpToEnd()}>End</button>
            </div>
        </div>
    );
}
