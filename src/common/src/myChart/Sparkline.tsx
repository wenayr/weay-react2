import React, {useLayoutEffect, useRef, useState} from "react";

export interface SparklineSeries {
    key: React.Key;
    data: readonly number[];
    color?: string;
    show?: boolean;
    /** When present, draws a top-to-bottom gradient under this series. */
    fillColor?: string;
}

export interface SparklineTheme {
    /** Fallback for a series without its own color. Defaults to the inherited text color. */
    lineColor?: string;
    /** Optional canvas background. The default is transparent. */
    backgroundColor?: string;
}

export interface SparklineProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
    series: SparklineSeries | readonly SparklineSeries[];
    theme?: SparklineTheme;
    /** Line width in CSS pixels. */
    lineWidth?: number;
    /** Inner plot padding in CSS pixels. */
    padding?: number;
}

interface SparklineSize {
    width: number;
    height: number;
    dpr: number;
}

const EMPTY_SIZE: SparklineSize = {width: 0, height: 0, dpr: 1};

function finiteNonNegative(value: number) {
    return Number.isFinite(value) && value > 0 ? value : 0;
}

function currentDpr() {
    return typeof window == "undefined" ? 1 : Math.max(1, window.devicePixelRatio || 1);
}

function sizeFromRect(rect: Pick<DOMRectReadOnly, "width" | "height">): SparklineSize {
    return {
        width: finiteNonNegative(rect.width),
        height: finiteNonNegative(rect.height),
        dpr: currentDpr(),
    };
}

function sameSize(a: SparklineSize, b: SparklineSize) {
    return a.width === b.width && a.height === b.height && a.dpr === b.dpr;
}

function asSeriesArray(series: SparklineProps["series"]): readonly SparklineSeries[] {
    return Array.isArray(series) ? series : [series as SparklineSeries];
}

function drawingRevision(series: readonly SparklineSeries[]) {
    return JSON.stringify(series.map(item => [
        item.show !== false,
        item.color ?? null,
        item.fillColor ?? null,
        item.data,
    ]));
}

function drawSparkline(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dpr: number,
    series: readonly SparklineSeries[],
    lineWidth: number,
    padding: number,
    fallbackColor: string,
    backgroundColor?: string,
) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
    }

    const visible = series.filter(item => item.show !== false && item.data.length > 0);
    let min = Infinity;
    let max = -Infinity;
    for (const item of visible) {
        for (const value of item.data) {
            if (!Number.isFinite(value)) continue;
            if (value < min) min = value;
            if (value > max) max = value;
        }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return;

    const insetX = Math.min(Math.max(padding, lineWidth / 2), width / 2);
    const insetY = Math.min(Math.max(padding, lineWidth / 2), height / 2);
    const plotWidth = Math.max(0, width - insetX * 2);
    const plotHeight = Math.max(0, height - insetY * 2);
    const range = max - min;
    const toY = range === 0
        ? () => height / 2
        : (value: number) => insetY + (max - value) / range * plotHeight;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = lineWidth;

    for (const item of visible) {
        const points: Array<{x: number; y: number}> = [];
        const denominator = item.data.length - 1;
        item.data.forEach((value, index) => {
            if (!Number.isFinite(value)) return;
            points.push({
                x: denominator <= 0 ? width / 2 : insetX + index / denominator * plotWidth,
                y: toY(value),
            });
        });
        if (points.length === 0) continue;

        const color = item.color || fallbackColor;
        if (item.fillColor && points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
            ctx.lineTo(points[points.length - 1].x, height - insetY);
            ctx.lineTo(points[0].x, height - insetY);
            ctx.closePath();
            const gradient = ctx.createLinearGradient(0, insetY, 0, height - insetY);
            gradient.addColorStop(0, item.fillColor);
            gradient.addColorStop(1, "transparent");
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        ctx.strokeStyle = color;
        if (points.length === 1) {
            ctx.beginPath();
            ctx.arc(points[0].x, points[0].y, Math.max(1, lineWidth), 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            continue;
        }

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
    }
}

/**
 * A non-interactive, resize-aware canvas chart for compact table-like rows.
 * Rendering is synchronous and event-driven; the component never starts a RAF loop.
 */
export function Sparkline({
    series,
    theme,
    lineWidth = 1.5,
    padding = 1,
    className,
    style,
    ...containerProps
}: SparklineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [size, setSize] = useState<SparklineSize>(EMPTY_SIZE);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container || typeof ResizeObserver == "undefined") return;

        const updateSize = (rect: Pick<DOMRectReadOnly, "width" | "height">) => {
            const next = sizeFromRect(rect);
            setSize(previous => sameSize(previous, next) ? previous : next);
        };
        updateSize(container.getBoundingClientRect());

        const observer = new ResizeObserver(entries => {
            const entry = entries.find(item => item.target === container);
            if (entry) updateSize(entry.contentRect);
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const safeLineWidth = Number.isFinite(lineWidth) && lineWidth > 0 ? lineWidth : 1.5;
    const safePadding = Number.isFinite(padding) && padding >= 0 ? padding : 1;
    const pixelWidth = Math.max(0, Math.round(size.width * size.dpr));
    const pixelHeight = Math.max(0, Math.round(size.height * size.dpr));
    const normalizedSeries = asSeriesArray(series);
    // Calculate on every React render so an application that mutates an existing data
    // array still gets one redraw, while referential churn with equal values gets none.
    const seriesRevision = drawingRevision(normalizedSeries);

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || size.width <= 0 || size.height <= 0) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const inheritedColor = getComputedStyle(container).color;
        drawSparkline(
            ctx,
            size.width,
            size.height,
            size.dpr,
            normalizedSeries,
            safeLineWidth,
            safePadding,
            theme?.lineColor || inheritedColor || "#2f81f7",
            theme?.backgroundColor,
        );
    }, [seriesRevision, size, safeLineWidth, safePadding, theme?.lineColor, theme?.backgroundColor]);

    const position = style?.position && style.position !== "static" ? style.position : "relative";
    const hasAccessibleName = containerProps["aria-label"] != null || containerProps["aria-labelledby"] != null;
    return (
        <div
            {...containerProps}
            role={containerProps.role ?? (hasAccessibleName ? "img" : undefined)}
            ref={containerRef}
            className={className}
            style={{
                ...style,
                display: style?.display ?? "block",
                position,
                width: style?.width ?? "100%",
                height: style?.height ?? "100%",
                minWidth: 0,
                minHeight: 0,
                overflow: "hidden",
                boxSizing: "border-box",
            }}
        >
            <canvas
                ref={canvasRef}
                width={pixelWidth}
                height={pixelHeight}
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: 0,
                    display: "block",
                    width: `${size.width}px`,
                    height: `${size.height}px`,
                    maxWidth: "100%",
                    maxHeight: "100%",
                    pointerEvents: "none",
                }}
            />
        </div>
    );
}
