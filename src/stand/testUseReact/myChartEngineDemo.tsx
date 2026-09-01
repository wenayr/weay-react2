import React, { useRef, useEffect } from 'react';
import type { DataPoint } from '../../internal/myChart/chartEngine/dataSet.js';
import { type ChartEngine, createChartEngine } from '../../internal/myChart/chartEngine/engine.js';

/**
 * Data generation example
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
 * MyChart React component example
 */
export const MyChartEngine: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
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

        // Create DataSets
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

        // Add panels and specify heightPct
        // The last panel automatically takes the remaining space up to 100%.
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

        // Simulate adding data
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
        }, 50); // demo stream; 1ms flooded the dataset at max timer rate

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
                position: 'relative',
                ...style
            }}
        >
            <canvas ref={canvasRef} />
        </div>
    );
};
