import React from "react";
import { Sparkline } from "../../api.js";
import { MyChartEngine } from "../../src/myChart/chartEngine/chartEngineReact.js";
import { Check } from "../standKit.js";


const sparklineQaRows = [
    {label: "one series", series: {key: "one", data: [4, 7, 5, 11, 8, 13, 10], color: "#0969da"}},
    {label: "gradient", series: {key: "fill", data: [3, 5, 4, 9, 7, 12, 14], color: "#1a7f37", fillColor: "rgba(46, 160, 67, .35)"}},
    {label: "two series", series: [
        {key: "bid", data: [8, 10, 7, 11, 9, 13], color: "#8250df"},
        {key: "ask", data: [12, 9, 13, 10, 14, 11], color: "#cf222e"},
    ]},
    {label: "zero / constant", series: [
        {key: "zero", data: [0, 0, 0, 0], color: "#57606a"},
        {key: "constant", data: [5, 5, 5, 5], color: "#bf8700"},
    ]},
    {label: "one point", series: {key: "point", data: [7], color: "#0969da"}},
];

function SparklineQaDemo() {
    return <div style={{width: "min(460px, 100%)", border: "1px solid #d0d7de", borderRadius: 6, overflow: "hidden"}}>
        {sparklineQaRows.map((row, index) => <div key={row.label} style={{
            display: "grid",
            gridTemplateColumns: "116px minmax(0, 1fr)",
            alignItems: "center",
            height: 26,
            boxSizing: "border-box",
            borderTop: index ? "1px solid #eaeef2" : undefined,
            background: index % 2 ? "#f6f8fa" : "#fff",
        }}>
            <span style={{padding: "0 8px", fontSize: 11, color: "#57606a", whiteSpace: "nowrap"}}>{row.label}</span>
            <Sparkline aria-label={row.label} series={row.series} />
        </div>)}
    </div>;
}


/* ---------- card wrappers ---------- */

export function Card49() {
    return (
    <Check id="sparkline" n={49} title="Sparkline — compact canvas chart"
                       do="Resize the browser and inspect every 26 px row, including the zero/constant and one-point cases."
                       expect="Every line stays crisp and clipped to its row, fills resize with the card, and no canvas changes row height. The zero/constant rows stay finite and visible."
                       note="This card uses the public Sparkline API. Rendering is ResizeObserver-driven with DPR scaling and no axes, interaction listeners, or RAF loop.">
                    <SparklineQaDemo />
                </Check>
    );
}

export function Card6() {
    return (
    <Check n={6} title="Chart (MyChartEngine) - LOD min+max"
                       do="Let the chart collect data, then zoom out with the mouse wheel. Watch the line amplitude."
                       expect="When zooming out, the line keeps its amplitude and peaks do not collapse into a straight line. ✅ Fix: LOD takes min+max per pixel. Both panels, line and bars, stay fully inside the card; nothing slides down."
                       note="Fixed: drawLineChartLOD now takes min+max points per pixel instead of the first point, so peaks/dips are not clipped. Height fix: MyChartEngine had a hardcoded height 600px, so the lower panel left the card; an optional style prop was added, with the 600px default unchanged. Perf, dirty flag/filter each frame, was not touched."
                       tall>
                    <div style={{ height: 300 }}><MyChartEngine style={{ height: "100%" }} /></div>
                </Check>
    );
}
