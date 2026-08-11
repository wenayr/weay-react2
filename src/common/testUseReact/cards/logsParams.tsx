import React, { useState, useMemo, useEffect } from "react";
import { renderBy, updateBy, logsApi, MiniLogsTable, ParamsEdit, ParamsArrayEdit, ParamsEditor, useKeyboard, keyboard, useResizeObserver, useElementSize } from "../../api";
import { Params } from "wenay-common2/client";
import { OutsideClickArea } from "../../src/hooks";
import { TestParams } from "../testParams";
import { Check } from "../standKit";


/* ---------- 1. Reactivity: updateBy / renderBy ---------- */
const shared = { count: 0 };
const Subscriber = () => { updateBy(shared); return <span style={{ fontSize: 22, fontWeight: 700 }}>count = {shared.count}</span>; };

const KeyDownDemo = () => {
    const api = useKeyboard();
    const [last, setLast] = useState(keyboard.get());
    useEffect(() => keyboard.on((key) => setLast(key)), []);
    return <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span>Last key: <b style={{ fontSize: 22 }}>{last || "-"}</b></span>
        <button onClick={() => api.reset()}>reset via API</button>
    </div>;
};
const ReactivityDemo = () => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Subscriber />
        <button onClick={() => { shared.count++; renderBy(shared); }}>+1 and renderBy</button>
        <button onClick={() => { shared.count++; }}>+1 WITHOUT renderBy</button>
        <button onClick={() => renderBy(shared)}>renderBy only</button>
    </div>
);


// Outside click via OutsideClickArea directly: display:inline-block keeps the close zone wrapped around
// the content, with no full-width strip like Button+outClick.
// The popup uses position:absolute; otherwise it expands the wrapper rectangle, and a click to the right of the button
// (within the popup width) lands inside the wrapper itself, so contains() treats it as inside.
const OutsideDemo = () => {
    const [open, setOpen] = useState(false);
    return (
        <OutsideClickArea status={open} outsideClick={() => setOpen(false)} style={{ display: "inline-block", position: "relative" }}>
            <div onClick={() => setOpen(v => !v)} style={{ display: "inline-block", padding: "6px 12px", border: "1px solid #6e7781", borderRadius: 6, cursor: "pointer", background: open ? "#6e7781" : "#fff", color: open ? "#fff" : "#000" }}>open</div>
            {open && <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 8, padding: 16, width: 220, border: "1px solid #6e7781", borderRadius: 8, background: "#fafbfc", zIndex: 5 }}>Closes on clicks anywhere except this panel and the button</div>}
        </OutsideClickArea>
    );
};

// Logs: add a record with time:Date and check the time column, which used to be always empty.
const LogsDemo = () => {
    const PageLogs = logsApi.React.PageLogs;
    const MessageLogs = logsApi.React.Message;
    const [miniClick, setMiniClick] = useState("none");
    const miniRows = useMemo(() => [
        { time: new Date("2026-01-01T10:00:00"), id: "mini", var: 1, txt: "mini one", address: "qa" },
        { time: new Date("2026-01-01T10:00:01"), id: "mini", var: 2, txt: "mini two", address: "qa" },
    ], []);
    return (
        <div style={{ position: "relative" }}>
            <MessageLogs zIndex={80} />
            <button style={{ marginBottom: 8 }} onClick={() => logsApi.addLogs({ id: "demo", var: 1, time: new Date(), txt: "log " + new Date().toLocaleTimeString() })}>add log</button>
            <div style={{ height: 260 }}><PageLogs /></div>
            <div style={{ marginTop: 12, fontSize: 12 }}>MiniLogs click: {miniClick}</div>
            <div style={{ height: 170, marginTop: 6 }}>
                <MiniLogsTable data={miniRows} onClick={e => setMiniClick(String(e.data?.txt ?? "empty"))} />
            </div>
        </div>
    );
};

// ParamsArrayEdit, which used to save pre-edit values, vs ParamsEdit, which is correct.
// Lazy: building the CParams instance and its simple params is deferred to first use,
// so importing this module does not construct the params runtime.
let paramsSaveCache: { def: Params.CParams; simple: ReturnType<typeof Params.GetSimpleParams> } | null = null;
const paramsSave = () => paramsSaveCache ??= (() => {
    const def = new class extends Params.CParams {
        test = { value: 1, range: { min: 1, max: 10, step: 1 } };
        test2 = { value: 1, range: { min: 1, max: 10, step: 1 } };
    };
    return { def, simple: Params.GetSimpleParams(def) };
})();
const makeInfos = () => { const { def, simple } = paramsSave(); return Params.mergeParamValuesToInfos(def, simple); };
const fmt = (d: any) => { try { return JSON.stringify(d, null, 2); } catch { return String(d); } };

const ParamsSaveDemo = () => {
    const [saved3, setSaved3] = useState("(not saved yet)");
    const [saved2, setSaved2] = useState("(not saved yet)");
    return (
        <div style={{ display: "flex", gap: 24 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#cf222e" }}>ParamsArrayEdit - expected BUG</div>
                <ParamsArrayEdit params={async () => [makeInfos()]} onSave={(d: any) => { console.log("ParamsArrayEdit → onSave:", d); setSaved3(fmt(d)); }} />
                <div style={{ fontSize: 12, marginTop: 6 }}>what was sent to onSave:</div>
                <pre style={{ background: "#f6f8fa", padding: 8, borderRadius: 6, maxHeight: 150, overflow: "auto", fontSize: 11 }}>{saved3}</pre>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#1a7f37" }}>ParamsEdit - correct</div>
                <ParamsEdit params={async () => makeInfos()} onSave={(d: any) => { console.log("ParamsEdit → onSave:", d); setSaved2(fmt(d)); }} />
                <div style={{ fontSize: 12, marginTop: 6 }}>what was sent to onSave:</div>
                <pre style={{ background: "#f6f8fa", padding: 8, borderRadius: 6, maxHeight: 150, overflow: "auto", fontSize: 11 }}>{saved2}</pre>
            </div>
        </div>
    );
};

const DebounceDemo = () => {
    const [count, setCount] = useState(0);
    const infos = useMemo(() => makeInfos(), []);
    return (
        <div>
            <div style={{ marginBottom: 8 }}>onChange called: <b style={{ fontSize: 18 }}>{count}</b> times <button onClick={() => setCount(0)}>reset</button></div>
            <ParamsEditor params={infos} onChange={() => setCount((c) => c + 1)} />
        </div>
    );
};

const resizeAssetRange = ["USDT", "BTC", "ETH", "BNB", "AMB"] as const;
function makeResizeParams(asset: string) {
    return {
        asset: {
            name: "asset",
            value: asset,
            range: resizeAssetRange,
        },
    };
}

const ResizeBugRepro = () => {
    const [n, setN] = useState(0);
    const [asset, setAsset] = useState("USDT");
    const [fixedWidth, setFixedWidth] = useState(150);
    const [autoWidth, setAutoWidth] = useState(0);
    const [fixedSelectWidth, setFixedSelectWidth] = useState(0);

    const onChange = (params: ReturnType<typeof makeResizeParams>) => {
        setAsset(params.asset.value);
        setN(v => v + 1);
    };

    // Resize detection now rides the library singleton: useResizeObserver on the auto box,
    // useElementSize on the user-resizable fixed box (its width/height come from the hook).
    const readWidths = () => {
        const autoSelect = autoBox.element()?.querySelector("select");
        const fixedSelect = fixedBox.element()?.querySelector("select");
        setAutoWidth(Math.round(autoSelect?.getBoundingClientRect().width ?? 0));
        setFixedSelectWidth(Math.round(fixedSelect?.getBoundingClientRect().width ?? 0));
    };
    const autoBox = useResizeObserver<HTMLDivElement>(readWidths);
    const fixedBox = useElementSize<HTMLDivElement>();

    React.useLayoutEffect(() => {
        readWidths();
        // setResizeableElement's probing settles after paint - re-read one frame later
        const id = requestAnimationFrame(readWidths);
        return () => cancelAnimationFrame(id);
    }, [n, asset, fixedWidth, fixedBox.width]);

    const selectInfo: React.CSSProperties = { fontSize: 12, color: "#57606a", marginTop: 6 };

    return <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
                <div ref={autoBox.ref} style={{ display: "inline-flex", flexDirection: "column", alignItems: "stretch", border: "1px solid #cf222e", padding: 6 }}>
                    <ParamsEditor params={makeResizeParams(asset)} onChange={onChange}/>
                    <button onClick={() => setN(v => v + 1)}>rerender {n}</button>
                </div>
                <div style={selectInfo}>auto-width select: <b>{autoWidth}px</b></div>
            </div>
            <div>
                <div ref={fixedBox.ref} style={{ width: fixedWidth, minWidth: 90, maxWidth: 300, resize: "horizontal", overflow: "auto", border: "1px solid #0969da", padding: 6 }}>
                    <ParamsEditor params={makeResizeParams(asset)} onChange={onChange}/>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    <button onClick={() => setFixedWidth(w => w == 150 ? 240 : 150)}>parent {fixedWidth}px</button>
                    <button onClick={() => setN(v => v + 1)}>rerender</button>
                </div>
                <div style={selectInfo}>fixed-parent select: <b>{fixedSelectWidth}px</b> · container (useElementSize): <b>{fixedBox.width}×{fixedBox.height}px</b></div>
            </div>
        </div>
        <div style={{ fontSize: 13 }}>selected asset: <b>{asset}</b></div>
    </div>;
};


/* ---------- card wrappers ---------- */

export function Card8() {
    return (
    <Check n={8} title="Outside-click closing (OutsideClickArea)"
                       do="Click open. Then click ANY place outside the panel, including on the same horizontal line and slightly to the right of the open button, within the panel width where there used to be a dead zone."
                       expect="A click anywhere outside the panel/button closes it, including the area to the right of the button above the panel. Clicking the panel or button does NOT close it."
                       note="Library BUG, this card used to fail on it: Button+outClick wraps in OutsideClickArea, which is a full-width block div, so the entire horizontal strip counts as inside. Here OutsideClickArea uses display:inline-block, and the popup uses position:absolute; otherwise it expands the wrapper rectangle and creates a dead zone to the right of the button. Real library fix: wrap content by default, or let Button narrow the wrapper.">
                    <OutsideDemo />
                </Check>
    );
}

export function Card1() {
    return (
    <Check n={1} title="Reactivity updateBy / renderBy"
                       do="Click +1 and renderBy, then +1 WITHOUT renderBy, then renderBy only."
                       expect="+1 and renderBy increases the number. +1 WITHOUT renderBy does NOT change the number on screen. renderBy only shows the accumulated value."
                       note="This is the split between change and notification. After migration to the store, app.set(...) performs both steps at once.">
                    <ReactivityDemo />
                </Check>
    );
}

export function Card14() {
    return (
    <Check n={14} title="Keyboard API - useKeyboard / keyboard"
                       do="Press any key, then click reset via API."
                       expect="Last key updates through keyboard.on; reset clears the value and also notifies subscribers."
                       note="The new pub/sub is built with `listen`: listen.on(cb) -> off(). The old keyboardState remains compatible.">
                    <KeyDownDemo />
                </Check>
    );
}

export function Card7() {
    return (
    <Check n={7} title="Parameters - sliders and stable commentary hover"
                       do="Move the sliders and edit their values. Hover the test2/test3 parameter name, then slowly move the pointer across the commentary tooltip."
                       expect="The original parameter UI remains unchanged: slider and number stay in sync, and the commentary remains visible without flickering under the pointer."
                       note="Regression check for ParamRow commentary. The only component change is pointer-events: none on the existing tooltip."
                       tall>
                    <div style={{ minHeight: 260 }}><TestParams /></div>
                </Check>
    );
}

export function Card19() {
    return (
    <Check n={19} title="Parameters - resize observer shrink repro"
                       do="Click rerender many times and change the asset select. Then click parent 150/240px, or narrow the blue wrapper in DevTools."
                       expect="The red auto-width select does not ratchet down. The blue fixed-parent select gets narrower when the parent is 150px and grows back when the parent is 240px."
                       note="This is the setResizeableElement repro: repeated ref/ResizeObserver runs must keep the natural width and avoid feedback in shrink-to-content containers."
                       tall>
                    <ResizeBugRepro />
                </Check>
    );
}

export function Card9() {
    return (
    <Check n={9} title="Logs - time format + MiniLogs layers"
                       do="Click add log several times, watch the corner notification layer, then click a row in the compact MiniLogs table."
                       expect="PageLogs and MiniLogs show time in hh:mm:ss format; a temporary notification appears in the card corner; MiniLogs row click updates the small click label."
                       note="This card mounts logsApi.React.Message; that compatibility wrapper now uses useMessageEventLogsController -> MessageEventLogsView. The newer context LogsNotifications remains a separate LogsProvider-based surface. MiniLogs is hook/controller-first: useMiniLogsTable -> MiniLogsView/MiniLogsTable -> compatibility MiniLogs."
                       tall>
                    <LogsDemo />
                </Check>
    );
}

export function Card10() {
    return (
    <Check n={10} title="ParamsArrayEdit vs ParamsEdit - what is sent to onSave"
                       do="Change the value in EACH column (test/test2), then click save. Compare what was sent to onSave and the console (F12)."
                       expect="BOTH save the CHANGED value (ParamsArrayEdit matches ParamsEdit). ✅ Fixed (regression check)."
                       note="Fix in Other.tsx: params[i]=z -> params[i]=e. z was a placeholder and discarded the edited clone e."
                       tall>
                    <ParamsSaveDemo />
                </Check>
    );
}

export function Card11() {
    return (
    <Check n={11} title="Parameters - debounce onChange"
                       do="Quickly move the slider/number several times in a row, then stop."
                       expect="The counter does NOT grow on every tiny movement, but roughly once after ~200ms of stopping. ✅ Fixed."
                       note="Fix: timeoutId -> useRef + cleanup on unmount."
                       tall>
                    <DebounceDemo />
                </Check>
    );
}
