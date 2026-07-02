/* qa.tsx - ONE board for manual library checks.
 *
 * Run:  npm run testReact   (vite → http://localhost:3000)
 * Each card: a live element + what to do + what is expected.
 * Use the ✓/✗ buttons to mark results as you go. These are also the acceptance criteria for changes from REFACTOR_PLAN.md.
 */

import React, { useState, useMemo, useEffect } from "react";
import { MenuBase, mouseMenuApi, renderBy, updateBy, logsApi, EditParams2, EditParams3, ParametersReact, ModalProvider, useModal, useKeyDown, keyDownApi, useAgGrid, AgGridMy, type BufferTable } from "../api";
import type { ColDef } from "ag-grid-community";
import { Params } from "wenay-common2";
import { Button, ButtonHover, DivOutsideClick } from "../src/hooks";
import { DivRnd3 } from "../src/components";
import { MyChartEngine } from "../src/myChart/chartEngine/chartEngineReact";
import { GridExample, tt } from "./useGrid";
import { TestParams } from "./testParams";

/* ---------- card wrapper ---------- */
const card: React.CSSProperties = { border: "1px solid #d0d7de", borderRadius: 10, margin: "14px 0", background: "#fff", overflow: "hidden", fontFamily: "system-ui, sans-serif" };
const head: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f6f8fa", borderBottom: "1px solid #d0d7de" };
const badge: React.CSSProperties = { width: 24, height: 24, borderRadius: 12, background: "#0969da", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 };
const stageS: React.CSSProperties = { padding: 14, position: "relative" };
const row: React.CSSProperties = { padding: "6px 14px", fontSize: 13, lineHeight: 1.5, borderTop: "1px dashed #e1e4e8" };
const btn = (on: boolean, color: string): React.CSSProperties => ({ border: `1px solid ${color}`, background: on ? color : "#fff", color: on ? "#fff" : color, borderRadius: 6, padding: "3px 8px", fontSize: 12, cursor: "pointer" });

function Check(p: { n: number; title: string; do: string; expect: string; note?: string; tall?: boolean; children: React.ReactNode }) {
    const [ok, setOk] = useState<null | boolean>(null);
    return (
        <section style={{ ...card, outline: ok === true ? "2px solid #1a7f37" : ok === false ? "2px solid #cf222e" : "none" }}>
            <div style={head}>
                <span style={badge}>{p.n}</span>
                <b style={{ flex: 1 }}>{p.title}</b>
                <button style={btn(ok === true, "#1a7f37")} onClick={() => setOk(true)}>✓ works</button>
                <button style={btn(ok === false, "#cf222e")} onClick={() => setOk(false)}>✗ bug</button>
            </div>
            <div style={{ ...stageS, minHeight: p.tall ? 340 : 80 }}>{p.children}</div>
            <div style={row}><b>Do:</b> {p.do}</div>
            <div style={{ ...row, color: "#1a7f37" }}><b>Expected:</b> {p.expect}</div>
            {p.note && <div style={{ ...row, color: "#9a6700" }}><b>Note:</b> {p.note}</div>}
        </section>
    );
}

/* ---------- 1. Reactivity: updateBy / renderBy ---------- */
const shared = { count: 0 };
const Subscriber = () => { updateBy(shared); return <span style={{ fontSize: 22, fontWeight: 700 }}>count = {shared.count}</span>; };

const KeyDownDemo = () => {
    const api = useKeyDown();
    const [last, setLast] = useState(keyDownApi.get());
    useEffect(() => keyDownApi.on((key) => setLast(key)), []);
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

// Outside click via DivOutsideClick directly: display:inline-block keeps the close zone wrapped around
// the content, with no full-width strip like Button+outClick.
// The popup uses position:absolute; otherwise it expands the wrapper rectangle, and a click to the right of the button
// (within the popup width) lands inside the wrapper itself, so contains() treats it as inside.
const OutsideDemo = () => {
    const [open, setOpen] = useState(false);
    return (
        <DivOutsideClick status={open} outsideClick={() => setOpen(false)} style={{ display: "inline-block", position: "relative" }}>
            <div onClick={() => setOpen(v => !v)} style={{ display: "inline-block", padding: "6px 12px", border: "1px solid #6e7781", borderRadius: 6, cursor: "pointer", background: open ? "#6e7781" : "#fff", color: open ? "#fff" : "#000" }}>open</div>
            {open && <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 8, padding: 16, width: 220, border: "1px solid #6e7781", borderRadius: 8, background: "#fafbfc", zIndex: 5 }}>Closes on clicks anywhere except this panel and the button</div>}
        </DivOutsideClick>
    );
};

// Logs: add a record with time:Date and check the time column, which used to be always empty.
const LogsDemo = () => {
    const PageLogs = logsApi.React.PageLogs;
    return (
        <div>
            <button style={{ marginBottom: 8 }} onClick={() => logsApi.addLogs({ id: "demo", var: 1, time: new Date(), txt: "log " + new Date().toLocaleTimeString() })}>add log</button>
            <div style={{ height: 260 }}><PageLogs /></div>
        </div>
    );
};

// EditParams3, which used to save pre-edit values, vs EditParams2, which is correct.
const paramsDefSave = new class extends Params.CParams {
    test = { value: 1, range: { min: 1, max: 10, step: 1 } };
    test2 = { value: 1, range: { min: 1, max: 10, step: 1 } };
};
const simpleSave = Params.GetSimpleParams(paramsDefSave);
const makeInfos = () => Params.mergeParamValuesToInfos(paramsDefSave, simpleSave);
const fmt = (d: any) => { try { return JSON.stringify(d, null, 2); } catch { return String(d); } };

const ParamsSaveDemo = () => {
    const [saved3, setSaved3] = useState("(not saved yet)");
    const [saved2, setSaved2] = useState("(not saved yet)");
    return (
        <div style={{ display: "flex", gap: 24 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#cf222e" }}>EditParams3 - expected BUG</div>
                <EditParams3 params={async () => [makeInfos()]} onSave={(d: any) => { console.log("EditParams3 → onSave:", d); setSaved3(fmt(d)); }} />
                <div style={{ fontSize: 12, marginTop: 6 }}>what was sent to onSave:</div>
                <pre style={{ background: "#f6f8fa", padding: 8, borderRadius: 6, maxHeight: 150, overflow: "auto", fontSize: 11 }}>{saved3}</pre>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#1a7f37" }}>EditParams2 - correct</div>
                <EditParams2 params={async () => makeInfos()} onSave={(d: any) => { console.log("EditParams2 → onSave:", d); setSaved2(fmt(d)); }} />
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
            <ParametersReact params={infos} onChange={() => setCount((c) => c + 1)} />
        </div>
    );
};

/* ---------- 12. agGrid4: controller + external buffer ---------- */
type tQARow = { id: string; name: string; price: number };
const agQABuffer: BufferTable<tQARow> = {}; // module-level buffer that survives grid remounts
const agQACols = [
    { field: "name", headerName: "Name" },
    { field: "price", headerName: "Price" },
] satisfies ColDef<tQARow>[];
const rndPrice = () => +(Math.random() * 1000).toFixed(2);

const AgGrid4Inner = () => {
    const grid = useAgGrid<tQARow>({ externalBuffer: agQABuffer });
    return (
        <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <button onClick={() => grid.update({ newData: [{ id: "tsla", name: "Tesla", price: rndPrice() }] })}>add/update Tesla</button>
                <button onClick={() => grid.update({ newData: [{ id: "aapl", name: "Apple", price: rndPrice() }] })}>add/update Apple</button>
                <button onClick={() => grid.update({ removeData: [{ id: "tsla" }] })}>remove Tesla</button>
                <button onClick={() => grid.fit()}>fit via API</button>
            </div>
            <div style={{ height: 220 }}><AgGridMy<tQARow> controller={grid} columnDefs={agQACols} /></div>
        </div>
    );
};

const AgGrid4Demo = () => {
    const [on, setOn] = useState(true);
    return (
        <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <button onClick={() => setOn(v => !v)}>{on ? "unmount grid" : "mount grid"}</button>
                <button onClick={() => { agQABuffer["msft"] = { id: "msft", name: "Microsoft (outside the grid)", price: rndPrice() }; }}>write MSFT directly to the buffer</button>
            </div>
            {on ? <AgGrid4Inner /> : <div style={{ padding: 20, color: "#57606a" }}>grid is unmounted - buffer lives in the module</div>}
        </div>
    );
};

/* ---------- 13. ModalProvider / useModal ---------- */
const ModalOpener = () => {
    const modal = useModal();
    return (
        <button onClick={() => modal.open(
            <div style={{ background: "#fff", padding: 24, borderRadius: 8, minWidth: 260 }}>
                <b>Modal via useModal</b>
                <div style={{ margin: "10px 0", fontSize: 13 }}>Close with Escape, an outside click, or the button.</div>
                <button onClick={() => modal.close()}>close</button>
            </div>
        )}>open modal</button>
    );
};
const ModalDemo = () => <ModalProvider><ModalOpener /></ModalProvider>;

/* ---------- borad ---------- */
function ActiveChecks() {
    return (
        <>
            <Check n={1} title="Reactivity updateBy / renderBy"
                   do="Click +1 and renderBy, then +1 WITHOUT renderBy, then renderBy only."
                   expect="+1 and renderBy increases the number. +1 WITHOUT renderBy does NOT change the number on screen. renderBy only shows the accumulated value."
                   note="This is the split between change and notification. After migration to the store, app.set(...) performs both steps at once.">
                <ReactivityDemo />
            </Check>


            <Check n={14} title="Keyboard API - useKeyDown / keyDownApi"
                   do="Press any key, then click clear."
                   expect="Last key updates through keyDownApi.on; reset clears the value and also notifies subscribers."
                   note="The new pub/sub is built with UseListen: listen.on(cb) -> off(). The old KeyDown remains compatible.">
                <KeyDownDemo />
            </Check>
            <Check n={2} title="Drag + Resize (DivRnd3 / RNDFunc3)"
                   do="Click window, drag the window by its header, resize it from the edges, and close it with the x button. Open the console (F12)."
                   expect="The window moves and resizes smoothly; the x button closes it; position and size are restored on reopen (keyForSave)."
                   note="Plan bug: the console must NOT contain xxx spam (RNDFunc3:532); listener resubscription on every tick is a candidate for usePointerDrag."
                   tall>
                <Button button={(e: any) => <div style={{ display: "inline-block", padding: "6px 12px", border: "1px solid #0969da", borderRadius: 6, cursor: "pointer", background: e ? "#0969da" : "#fff", color: e ? "#fff" : "#0969da" }}>window</div>}>
                    {(api: any) => (
                        <DivRnd3 keyForSave={"qa-rnd"} key={"qa-rnd"} size={{ height: 220, width: 280 }}
                                 className={"fon border fonLight"} moveOnlyHeader={true} onCLickClose={api.onClose} limit={{ y: { min: 0 } }} onUpdate={() => {}}>
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#eef2f6" }}>drag header / resize / close</div>
                        </DivRnd3>
                    )}
                </Button>
            </Check>

            <Check n={3} title="Nested menu (MenuBase) + hover"
                   do="Hover menu, then move the cursor to the item with ▶ and into its submenu."
                   expect="The menu opens ONLY when hovering the menu trigger itself, not the full row width."
                   note="Library BUG confirmed: ButtonHover wraps in a <div> with no width, so it becomes a full-row block, unlike ButtonBase (width:min-content). This board wraps it with width:min-content as a workaround; add width:min-content to ButtonHover in the library.">
                <div style={{ width: "min-content" }}>
                    <ButtonHover button={() => <div style={{ display: "inline-block", padding: "6px 12px", border: "1px solid #888", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}>menu</div>}>
                        <MenuBase zIndex={50} coordinate={{ x: 0, y: 0 }} data={[
                            { name: "item 1", onClick: () => alert("item 1") },
                            { name: "submenu ▶", next: () => [{ name: "leaf A", onClick: () => alert("A") }, { name: "leaf B", onClick: () => alert("B") }] },
                        ]} />
                    </ButtonHover>
                </div>
            </Check>

            <Check n={5} title="Grid + transactions (applyTransactionAsyncUpdate)"
                   do="update Tesla uses a random price and updates by ID. Then remove Tesla should make the row disappear."
                   expect="Update by ID without duplicates. remove Tesla removes the row. ✅ Remove-only updates used to be lost, leaving the row in place."
                   note="Fix: applyTransactionAsyncUpdate applies remove once, INDEPENDENTLY of add/update. Previously remove was lost when add/update were empty, and duplicated when both were present."
                   tall>
                <div>
                    <button style={{ marginBottom: 8 }} onClick={() => renderBy(tt)}>update Tesla (random price)</button>
                    <div style={{ height: 280 }}><GridExample /></div>
                </div>
            </Check>

            <Check n={6} title="Chart (MyChartEngine) - LOD min+max"
                   do="Let the chart collect data, then zoom out with the mouse wheel. Watch the line amplitude."
                   expect="When zooming out, the line keeps its amplitude and peaks do not collapse into a straight line. ✅ Fix: LOD takes min+max per pixel. Both panels, line and bars, stay fully inside the card; nothing slides down."
                   note="Fixed: drawLineChartLOD now takes min+max points per pixel instead of the first point, so peaks/dips are not clipped. Height fix: MyChartEngine had a hardcoded height 600px, so the lower panel left the card; an optional style prop was added, with the 600px default unchanged. Perf, dirty flag/filter each frame, was not touched."
                   tall>
                <div style={{ height: 300 }}><MyChartEngine style={{ height: "100%" }} /></div>
            </Check>

            <Check n={7} title="Parameters (ParametersReact / ParametersEngine)"
                   do="Move sliders and fields. The test3 field has a name and a hover comment."
                   expect="The value changes in the UI while editing; range/number stay in sync; commentary appears on hover."
                   note="Plan bugs: EditParams3 loses edits (Other.tsx); broken debounce and missing ResizeObserver cleanup in ParametersEngine."
                   tall>
                <div style={{ minHeight: 260 }}><TestParams /></div>
            </Check>

            <Check n={12} title="agGrid4 - controller, removal, external buffer"
                   do="add/update Tesla and Apple should make rows appear/update. remove Tesla should remove it. Then: unmount grid -> write MSFT directly to the buffer -> mount grid."
                   expect="Updates by ID have no duplicates; removal works. After remount, the grid catches up with the buffer itself: Tesla/Apple are still present, MSFT appears (attach->sync). Theme is dark, like production grids (GridStyleDefault)."
                   note="New path instead of applyTransactionAsyncUpdate (v1 is marked @deprecated). The createGridBuffer core also works outside React."
                   tall>
                <AgGrid4Demo />
            </Check>

            <Check n={13} title="ModalProvider / useModal - Escape and outside click"
                   do="Click open modal. Close it with Escape. Open it again and close with an outside click. Open it again and close with the close button."
                   expect="All three methods close it. The dimmed backdrop is above everything (z-index from token --wenay-z-modal)."
                   note="M1: Escape and closeOnEscape/closeOnOutsideClick options were added; useModal and previous behavior are unchanged. GetModalJSX is marked @deprecated.">
                <ModalDemo />
            </Check>

            <Check n={8} title="Outside-click closing (DivOutsideClick)"
                   do="Click open. Then click ANY place outside the panel, including on the same horizontal line and slightly to the right of the open button, within the panel width where there used to be a dead zone."
                   expect="A click anywhere outside the panel/button closes it, including the area to the right of the button above the panel. Clicking the panel or button does NOT close it."
                   note="Library BUG, this card used to fail on it: Button+outClick wraps in DivOutsideClick, which is a full-width block div, so the entire horizontal strip counts as inside. Here DivOutsideClick uses display:inline-block, and the popup uses position:absolute; otherwise it expands the wrapper rectangle and creates a dead zone to the right of the button. Real library fix: wrap content by default, or let Button narrow the wrapper.">
                <OutsideDemo />
            </Check>
        </>
    );
}

function ArchiveChecks() {
    return (
        <>
            <Check n={4} title="Right-click context menu (mouseMenuApi)"
                   do="Right-click the gray area to open the menu. Then right-click somewhere ELSE."
                   expect="Right-clicking elsewhere closes the previous menu and opens a new one with items. ✅ Fixed."
                   note="Fix: menuR stores an item snapshot on open + menuMouse onConsume. The bb / no stale items invariants are preserved."
                   tall>
                <mouseMenuApi.ReactMouse zIndex={40}>
                    <div style={{ width: "100%", height: 300, background: "#e7ebef", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#57606a" }}
                         onMouseDown={(e) => {
                             if (e.button === 2) mouseMenuApi.map.set("sym", [
                                 { name: "action 1", onClick: () => alert("action 1") },
                                 { name: "submenu ▶", next: () => [{ name: "nested", onClick: () => alert("nested") }] },
                             ]);
                         }}>right-click here</div>
                </mouseMenuApi.ReactMouse>
            </Check>

            <Check n={9} title="Logs - time format (valueFormatter)"
                   do="Click add log several times."
                   expect="The time column shows time in hh:mm:ss format. ✅ Fixed."
                   note="Fix: it was e.value.time, but Date has no .time so it was always undefined; now it is e.value, the Date itself. Affects logs.tsx and miniLogs.tsx."
                   tall>
                <LogsDemo />
            </Check>

            <Check n={10} title="EditParams3 vs EditParams2 - what is sent to onSave"
                   do="Change the value in EACH column (test/test2), then click save. Compare what was sent to onSave and the console (F12)."
                   expect="BOTH save the CHANGED value (EditParams3 matches EditParams2). ✅ Fixed (regression check)."
                   note="Fix in Other.tsx: params[i]=z -> params[i]=e. z was a placeholder and discarded the edited clone e."
                   tall>
                <ParamsSaveDemo />
            </Check>

            <Check n={11} title="Parameters - debounce onChange"
                   do="Quickly move the slider/number several times in a row, then stop."
                   expect="The counter does NOT grow on every tiny movement, but roughly once after ~200ms of stopping. ✅ Fixed."
                   note="Fix: timeoutId -> useRef + cleanup on unmount."
                   tall>
                <DebounceDemo />
            </Check>
        </>
    );
}

export function QABoard() {
    const [hash, setHash] = useState(typeof location !== "undefined" ? location.hash : "");
    useEffect(() => {
        const f = () => setHash(location.hash);
        window.addEventListener("hashchange", f);
        return () => window.removeEventListener("hashchange", f);
    }, []);
    const archive = hash === "#archive";
    const link = (on: boolean): React.CSSProperties => ({ padding: "4px 10px", borderRadius: 6, textDecoration: "none", color: on ? "#fff" : "#0969da", background: on ? "#0969da" : "#fff", border: "1px solid #0969da", fontSize: 13 });
    return (
        <div style={{ maxWidth: 920, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>
            <h2 style={{ margin: "0 0 4px" }}>QA board wenay-react2</h2>
            <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
                <a href="#" style={link(!archive)}>Active checks</a>
                <a href="#archive" style={link(archive)}>Verified archive</a>
            </div>
            <div style={{ color: "#57606a", fontSize: 13, marginBottom: 8 }}>
                {archive ? "Verified and fixed nodes are kept for repeated checks." : "Click elements, compare with Expected, and mark ✓/✗. Token regression (S1): the appearance of ALL cards/menus/grids should not have changed; variables were moved to tokens.css without changing values."}
            </div>
            {archive ? <ArchiveChecks /> : <ActiveChecks />}
        </div>
    );
}
