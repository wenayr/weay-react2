/* qa.tsx - ONE board for manual library checks.
 *
 * Run:  npm run testReact -- --host 127.0.0.1 --port 3002
 * Each card: a live element + what to do + what is expected.
 * Use the ✓/✗ buttons to mark results as you go. These are also the acceptance criteria for changes from REFACTOR_PLAN.md.
 */

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { Menu, contextMenu, renderBy, updateBy, logsApi, MiniLogsTable, ParamsEdit, ParamsArrayEdit, ParamsEditor, ModalProvider, useModal, useKeyboard, keyboard, useAgGrid, AgGridTable, createGridBuffer, createColumnBuffer, createColumnState, createColumnGrid, ColumnsMenu, ColumnDots, CardList, useStoreMirror, useStoreNode, useStoreKeys, useStoreSelect, useStoreChangedPaths, useListenEffect, useListenArgs, useListenValue, SettingsDialog, registerSettingsSection, createUiSlot, createCallbackHub, createToolbar, registerToolbarDensity, useReorder, useReorderBoard, memoryCache, useCacheMapPersistence, useResizeObserver, useElementSize, useMediaSource, usePeer, type BufferTable, type ToolbarItem, type ToolbarConfig, type BoardColumn } from "../api";
import type { ColDef, ColGroupDef } from "ag-grid-community";
import { listen as createListen, Observe, Params, Media, Peer } from "wenay-common2";
import { Button, HoverButton, OutsideClickArea } from "../src/hooks";
import { FloatingWindow } from "../src/components";
import { DragBox } from "../src/components/Dnd/FloatingWindow";
import { MyChartEngine } from "../src/myChart/chartEngine/chartEngineReact";
import { GridExample, tt } from "./useGrid";
import { TestParams } from "./testParams";
import { ReplayVideoDemo, ReplayRouteDemo, ReplayStoreDemo, ReplayStoreEachDemo } from "./replayVideo";

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
            <div style={{ height: 220 }}><AgGridTable<tQARow> controller={grid} columnDefs={agQACols} /></div>
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

/* ---------- 15. agGrid4: overlay over declarative rowData ---------- */
type tOverlayRow = { id: string; name: string; price?: number; note?: string };
const overlayColumns = [
    { field: "id", width: 90 },
    { field: "name" },
    { field: "price", headerName: "Stream price" },
    { field: "note" },
] satisfies ColDef<tOverlayRow>[];

const AgGrid4OverlayDemo = () => {
    const [showC, setShowC] = useState(false);
    const [core] = useState(() => createGridBuffer<tOverlayRow>({
        getId: row => String(row.id),
        mode: "overlay",
        pushDefaults: { add: false },
    }));
    const grid = useAgGrid({ core });
    const rows = useMemo<tOverlayRow[]>(() => [
        { id: "a", name: "Alpha", note: "owned by rowData" },
        { id: "b", name: "Beta", note: "owned by rowData" },
        ...(showC ? [{ id: "c", name: "Gamma", note: "appears only after rowData adds it" }] : []),
    ], [showC]);

    useEffect(() => {
        core.api.sync();
    }, [core, rows]);

    return (
        <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <button onClick={() => core.api.updateData({ newData: [{ id: "a", price: rndPrice() }] })}>stream update A</button>
                <button onClick={() => core.api.updateData({ newData: [{ id: "c", price: 777 }] })}>stream C before rowData</button>
                <button onClick={() => setShowC(v => !v)}>{showC ? "remove C from rowData" : "add C to rowData"}</button>
                <button onClick={() => grid.sync()}>sync overlay</button>
            </div>
            <div style={{ height: 230 }}>
                <AgGridTable<tOverlayRow>
                    controller={grid}
                    rowData={rows}
                    columnDefs={overlayColumns}
                    getRowId={p => p.data.id}
                />
            </div>
        </div>
    );
};

/* ---------- 16. agGrid4: dynamic column buffer ---------- */
type tDynamicRow = { id: string; symbol: string; [key: string]: string | number };
const dynamicRows: tDynamicRow[] = [
    { id: "btc", symbol: "BTCUSDT", alpha: 11, beta: 21, gamma: 31 },
    { id: "eth", symbol: "ETHUSDT", alpha: 12, beta: 22, gamma: 32 },
];
const dynamicBaseCols = [
    { field: "symbol", width: 130 },
    { headerName: "Dynamic", groupId: "qa-dynamic", children: [] },
] satisfies (ColDef<tDynamicRow> | ColGroupDef<tDynamicRow>)[];

const buildDynamicCol = (name: string): ColDef<tDynamicRow> => ({
    colId: `dynamic:${name}`,
    field: name,
    headerName: name,
    width: 100,
});

function buildDynamicColumnDefs(names: readonly string[]) {
    return dynamicBaseCols.map(col =>
        "children" in col && col.groupId == "qa-dynamic"
            ? { ...col, children: names.map(buildDynamicCol) }
            : col,
    );
}

const AgGrid4ColumnBufferDemo = () => {
    const [columns] = useState(() => createColumnBuffer<tDynamicRow>());

    return (
        <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <button onClick={() => columns.api.setNames(["alpha"])}>alpha</button>
                <button onClick={() => columns.api.setNames(["alpha", "beta"])}>alpha + beta</button>
                <button onClick={() => columns.api.setNames(["gamma", "alpha", "gamma"])}>gamma + alpha</button>
                <button onClick={() => columns.api.setNames([])}>clear dynamic</button>
            </div>
            <div style={{ height: 230 }}>
                <AgGridTable<tDynamicRow>
                    rowData={dynamicRows}
                    getRowId={p => p.data.id}
                    columnDefs={dynamicBaseCols}
                    onGridReady={event => columns.control.attach(event.api, {
                        apply: ({ api, names }) => api.setGridOption("columnDefs", buildDynamicColumnDefs(names)),
                    })}
                    onGridPreDestroyed={() => columns.control.detach()}
                />
            </div>
        </div>
    );
};


/* ---------- 28. columnState: persisted column layout, external layer over a live grid ---------- */
type tColStateRow = { id: string; name: string; price: number; qty: number };
const colStateRows: tColStateRow[] = [
    { id: "a", name: "Alpha", price: 10.5, qty: 3 },
    { id: "b", name: "Beta", price: 22.1, qty: 7 },
    { id: "c", name: "Gamma", price: 5.8, qty: 1 },
];
const colStateCols = [
    { colId: "name", field: "name" },
    { colId: "price", field: "price" },
    { colId: "qty", field: "qty", headerName: "Qty" },
] satisfies ColDef<tColStateRow>[];
// module-level like a real app wrapper: the config survives grid remounts and reloads
const qaColumnState = createColumnState({
    key: "qa28.columnState",
    columns: [
        { key: "name", title: "Name", fixed: true },
        { key: "price", title: "Price" },
        { key: "qty", title: "Qty" },
    ],
});

const ColumnStateDemo = () => {
    const [on, setOn] = useState(true);
    const cfg = qaColumnState.api.useConfig();
    return (
        <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <button onClick={() => setOn(v => !v)}>{on ? "unmount grid" : "mount grid"}</button>
                <button onClick={() => qaColumnState.api.show("price", cfg.visible.price == false)}>{cfg.visible.price == false ? "show price" : "hide price"}</button>
                <button onClick={() => qaColumnState.api.toggleSort("price")}>sort price: {cfg.sort?.key == "price" ? cfg.sort.dir : "off"}</button>
                <button onClick={() => qaColumnState.api.reset()}>reset</button>
            </div>
            {on ? (
                <div style={{ height: 190 }}>
                    <AgGridTable<tColStateRow>
                        rowData={colStateRows}
                        getRowId={p => p.data.id}
                        columnDefs={colStateCols}
                        autoSizeColumns={false} // auto-fit would rewrite tracked widths on every mount
                        onGridReady={e => qaColumnState.grid.attach(e.api)}
                        onGridPreDestroyed={() => qaColumnState.grid.detach()}
                    />
                </div>
            ) : (
                <div style={{ padding: 20, color: "#57606a" }}>grid is unmounted - config lives in the module</div>
            )}
            <pre style={{ fontSize: 11, background: "#f6f8fa", padding: 6, borderRadius: 6, margin: "8px 0 0", overflow: "auto" }}>
                {JSON.stringify({ order: cfg.order, visible: cfg.visible, width: cfg.width, sort: cfg.sort }, null, 1)}
            </pre>
        </div>
    );
};


/* ---------- 29. columnState mobile: ColumnDots + CardList ---------- */
type tMobRow = { id: string; name: string; price: number; qty: number; ver: string; note: string; base: string; change: string; risk: string };
const mobRows: tMobRow[] = [
    { id: "btc", name: "BTCUSDT", price: 64230.5, qty: 3, ver: "v2", note: "spot", base: "USDT", change: "+1.8%", risk: "low" },
    { id: "eth", name: "ETHUSDT", price: 3120.2, qty: 12, ver: "v3", note: "spot", base: "USDT", change: "+0.7%", risk: "mid" },
    { id: "sol", name: "SOLUSDT", price: 148.9, qty: 40, ver: "v1", note: "futures", base: "USDT", change: "-2.1%", risk: "high" },
    { id: "ada", name: "ADAUSDT", price: 0.44, qty: 900, ver: "v2", note: "spot", base: "USDT", change: "+0.2%", risk: "low" },
    { id: "dot", name: "DOTUSDT", price: 6.8, qty: 150, ver: "v4", note: "futures", base: "USDT", change: "-0.9%", risk: "mid" },
    { id: "xrp", name: "XRPUSDT", price: 0.52, qty: 700, ver: "v1", note: "spot", base: "USDT", change: "+3.0%", risk: "mid" },
];
const qaMobColumns = createColumnState({
    key: "qa29.mobileColumns",
    columns: [
        { key: "name", title: "Symbol", short: "sym", fixed: true, cardRole: "title" },
        { key: "price", title: "Price", short: "price" },
        { key: "qty", title: "Quantity", short: "qty", defaultVisible: false },
        { key: "ver", title: "Version", short: "ver", cardRole: "accent", defaultVisible: false },
        { key: "note", title: "Note", short: "note", defaultVisible: false },
        { key: "base", title: "Base", short: "base", defaultVisible: false },
        { key: "change", title: "Change", short: "chg", defaultVisible: false },
        { key: "risk", title: "Risk", short: "risk", defaultVisible: false },
    ],
});

const qa29MobileCss = `
.qa29MobileShell {
  position: relative;
  max-width: 420px;
}
.qa29MobileCards .wenayCardListItem:last-child {
  padding-bottom: 92px;
}
.qa29MobileDots {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  z-index: 3;
  padding: 6px 8px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}
.qa29MobileDots .wenayColDotsHead {
  justify-content: flex-end;
  gap: 0;
  margin-bottom: 2px;
  font-size: 11px;
}
.qa29MobileDots .wenayColDotsTrack {
  height: 48px;
  margin: 0 16px;
}
.qa29MobileDots .wenayColDotsMeta,
.qa29MobileDots .wenayColDotsSpacer {
  display: none;
}
.qa29MobileDots .wenayColDotsSort {
  width: 32px;
  height: 28px;
  padding: 0;
  font-size: 0;
  opacity: 0.82;
  background: transparent;
}
.qa29MobileDots .wenayColDotsSort::before {
  content: "⇅";
  font-size: 16px;
  line-height: 1;
}
`;

const MobileColumnsDemo = () => (
    <div className="qa29MobileShell">
        <style>{qa29MobileCss}</style>
        <CardList<tMobRow> state={qaMobColumns} data={mobRows} getId={r => r.id} className="qa29MobileCards" />
        <ColumnDots state={qaMobColumns} max={8} className="qa29MobileDots" />
    </div>
);


/* ---------- 30. columnState icon menu: ColumnsMenu (1:1 grid mirror, button states, standards) ---------- */
type tMenuRow = { id: string; name: string; price: number; qty: number; fee: number; note: string; blockText: string; blockZero: number; blockEmpty: string };
const menuRows: tMenuRow[] = [
    { id: "a", name: "Alpha", price: 10.5, qty: 3, fee: 0, note: "", blockText: "red", blockZero: 0, blockEmpty: "" },
    { id: "b", name: "Beta", price: 22.1, qty: 0, fee: 0, note: "", blockText: "green", blockZero: 0, blockEmpty: "" },
    { id: "c", name: "Gamma", price: 5.8, qty: 1, fee: 0, note: "", blockText: "blue", blockZero: 0, blockEmpty: "" },
];
const menuBaseColDefs = [
    { colId: "name", field: "name" },
    { colId: "price", field: "price" },
    { colId: "qty", field: "qty", headerName: "Qty" },
    { colId: "fee", field: "fee" },
    { colId: "note", field: "note" },
] satisfies ColDef<tMenuRow>[];
const qa30BlockGroup = "modeBlock";
const qa30BlockColumns = [
    { colId: "blockText", field: "blockText", headerName: "Values" },
    { colId: "blockZero", field: "blockZero", headerName: "Zeros" },
    { colId: "blockEmpty", field: "blockEmpty", headerName: "Empty" },
] satisfies ColDef<tMenuRow>[];
const qaMenuState = createColumnState({
    key: "qa30.columnsMenu",
    columns: [
        { key: "name", title: "Name", fixed: true },
        { key: "price", title: "Price (has sub-fields)", short: "price" },
        { key: "qty", title: "Quantity", short: "qty" },
        { key: "fee", title: "Fee", short: "fee" },
        { key: "note", title: "Note", short: "note" },
        { key: "blockText", title: "Block / Values", short: "val", group: qa30BlockGroup },
        { key: "blockZero", title: "Block / Zeros", short: "zero", group: qa30BlockGroup },
        { key: "blockEmpty", title: "Block / Empty", short: "empty", group: qa30BlockGroup },
    ],
});
// The grouped block's mode is an app-level layer above columnState: columnDefs
// stay stable, and a runtime presentGate hides/disables unavailable leaf columns.
const qa30BlockModeState = { i: 0 };
const menuValues = (key: string) => menuRows.map(r => r[key as keyof tMenuRow]);
const menuColumnEmpty = (key: string, zeroIsEmpty: boolean) =>
    menuValues(key).every(v => v == null || v === "" || (zeroIsEmpty && v === 0));
const qa30BlockModes = [
    { hint: "mode 1/4: show all 3 sub-columns", show: (_: string) => true },
    { hint: "mode 2/4: hide empty sub-columns, 0 counts as empty", show: (key: string) => !menuColumnEmpty(key, true) },
    { hint: "mode 3/4: hide empty sub-columns, 0 is a value", show: (key: string) => !menuColumnEmpty(key, false) },
    { hint: "mode 4/4: skip the whole group block", show: (_: string) => false },
];
function qa30BlockMode() {
    return qa30BlockModes[qa30BlockModeState.i];
}
function qa30BlockVisible(mode = qa30BlockMode()) {
    return qa30BlockColumns.some(d => mode.show(String(d.colId)));
}

const qa30MenuColumnDefs = [
    ...menuBaseColDefs,
    { headerName: "Mode block", groupId: qa30BlockGroup, children: qa30BlockColumns } satisfies ColGroupDef<tMenuRow>,
];
const qa30BaseColumnKeys = menuBaseColDefs.map(d => String(d.colId));
function qa30PresentKeys(mode = qa30BlockMode()) {
    return [
        ...qa30BaseColumnKeys,
        ...qa30BlockColumns.filter(d => mode.show(String(d.colId))).map(d => String(d.colId)),
    ];
}
function applyQa30BlockMode(mode = qa30BlockMode()) {
    qaMenuState.api.setPresentGate(qa30PresentKeys(mode));
}

function nextQa30BlockMode() {
    qa30BlockModeState.i = (qa30BlockModeState.i + 1) % qa30BlockModes.length;
    applyQa30BlockMode();
    renderBy(qa30BlockModeState);
}

const qa30BlockModeItem = { title: "Block display mode" };
const qa30SquareButtonBase: React.CSSProperties = {
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    padding: "7px 11px",
    borderRadius: 0,
    margin: 0,
    fontSize: 13,
    lineHeight: "16px",
    fontWeight: 400,
    userSelect: "none",
    whiteSpace: "nowrap",
    transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
};
const qa30SquareGlyphStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    fontWeight: 400,
    letterSpacing: 0,
};
function qa30SquareGlyph(item: {icon?: React.ReactNode, short?: string, title: string}, density: string) {
    if (density == "icon") {
        if (item.icon != null) return <span style={qa30SquareGlyphStyle}>{item.icon}</span>;
        return <span style={qa30SquareGlyphStyle}>{(item.short ?? item.title).slice(0, 3).toUpperCase()}</span>;
    }
    const text = density == "label" ? (item.short ?? item.title) : item.title;
    return <span style={qa30SquareGlyphStyle}>{text}</span>;
}
const Qa30SquareButton = (p: {
    title: string;
    pressed?: boolean;
    disabled?: boolean;
    fixed?: boolean;
    children: React.ReactNode;
    clickable?: boolean;
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}) => {
    const [hover, setHover] = useState(false);
    const interactive = (!!p.onClick || p.clickable) && !p.disabled;
    const state: React.CSSProperties = p.disabled
        ? { background: "#0b1020", border: "1px dashed #526179", color: "#738096", opacity: 0.72 }
        : p.pressed
            ? { background: "#f8fafc", border: "1px solid #f8fafc", color: "#0f172a" }
            : hover
                ? { background: "#172238", border: "1px solid #f8fafc", color: "#f8fafc" }
                : { background: "#111a2c", border: "1px solid #34445f", color: "#d8e7ff" };
    return <div title={p.title}
                role={p.onClick && !p.disabled ? "button" : undefined}
                tabIndex={p.onClick && !p.disabled ? 0 : undefined}
                aria-pressed={p.pressed}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                onClick={p.onClick && !p.disabled ? p.onClick : undefined}
                onKeyDown={p.onClick && !p.disabled ? e => {
                    if (e.key != "Enter" && e.key != " ") return;
                    e.preventDefault();
                    p.onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
                } : undefined}
                style={{
                    ...qa30SquareButtonBase,
                    ...state,
                    cursor: interactive ? "pointer" : "default",
                    ...(p.fixed ? { borderColor: "#9db3d1" } : null),
                }}>
        {p.children}
    </div>;
};

const Qa30ModeDots = () => {
    const count = qa30BlockModeState.i + 1;
    return <span aria-hidden style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, marginLeft: 1 }}>
        {Array.from({ length: count }, (_, i) => <span key={i} style={{ width: 3, height: 3, borderRadius: 0, background: "currentColor", opacity: 0.95 }} />)}
    </span>;
};
const BlockModeButton = (p: {density: string}) => {
    updateBy(qa30BlockModeState);
    const mode = qa30BlockMode();
    const visible = qa30BlockVisible(mode);
    return <Qa30SquareButton title={visible ? mode.hint : `${mode.hint}; block is not displayed`}
                             pressed={visible}
                             clickable>
        {qa30SquareGlyph(qa30BlockModeItem, p.density)}
        <Qa30ModeDots />
    </Qa30SquareButton>;
};

// Client skin over the toolbar config: createToolbar owns order/membership/density,
// while this stand draws the face as square-edged content tiles. State: pressed = column
// visible in the grid, unpressed = hidden, dashed = removed by the block mode
// (present=false). Click toggles the column's grid visibility.
const MenuStateButton = (p: { state: typeof qaMenuState; colKey: string; density: string }) => {
    const cfg = p.state.api.useConfig();
    const present = p.state.api.usePresent();
    const col = p.state.columns.find(c => c.key === p.colKey);
    if (!col) return null;
    const disabled = !!present && !present[p.colKey];
    const on = cfg.visible[p.colKey] != false;
    return <Qa30SquareButton title={col.title}
                             pressed={on}
                             disabled={disabled}
                             fixed={col.fixed}
                             clickable={!disabled && !col.fixed}>
        {qa30SquareGlyph(col, p.density)}
    </Qa30SquareButton>;
};

// A "card 25" toolbar (createToolbar) whose ITEMS are those on/off buttons.
// sourceMode:'order' lets columnState own only the real-column order while the
// toolbar keeps MENU MEMBERSHIP local. The button's pressed/unpressed state is
// still the grid visibility from qaMenuState, and blockMode is a local extra item
// that is not pushed into the grid order.
const qa30MenuToolbar = createToolbar({
    key: "qa30.menuToolbar",
    items: [
        ...qaMenuState.columns.map(c => ({
            key: c.key, title: c.title, short: c.short, icon: c.icon, fixed: c.fixed,
            onClick: () => {
                const present = qaMenuState.api.getPresent();
                if (c.fixed || (!!present && !present[c.key])) return;
                const cfg = qaMenuState.api.getConfig();
                qaMenuState.api.show(c.key, cfg.visible[c.key] == false);
            },
            render: (density: string) => <MenuStateButton state={qaMenuState} colKey={c.key} density={density} />,
        })),
        { key: "blockMode", title: "Block display mode", onClick: () => nextQa30BlockMode(), render: (density: string) => <BlockModeButton density={density} /> },
    ],
    source: qaMenuState.api.listSource,
    sourceMode: "order",
});

const Qa30ResetIcon = () => <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3.2 5.5 A5.2 5.2 0 1 1 4.1 11.7 M3.2 5.5 H6.4 M3.2 5.5 V2.3"
          fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
</svg>;
const qa30ToolbarSkinCss = `
.qa30MenuSkin {
  display: inline-flex;
  align-items: stretch;
  flex-wrap: wrap;
  gap: 1px;
  background: transparent;
  border: 0;
  border-radius: 0;
  color: inherit;
}
.qa30MenuSkin .wenayTbItem {
  padding: 0;
  border-radius: 0;
  gap: 0;
  align-items: stretch;
  cursor: default;
}
.qa30MenuSkin .wenayTbItem:hover {
  background: transparent;
}
.qa30MenuSkin .qa30MenuTile {
  will-change: transform;
}
`;

const Qa30AnimatedMenuBar = () => {
    const items = qa30MenuToolbar.api.useItems();
    const tileRefs = useRef(new Map<string, HTMLDivElement>());
    const prevRects = useRef(new Map<string, {left: number, top: number}>());
    const layoutKey = items.map(x => `${x.item.key}:${x.density}`).join("|");

    useLayoutEffect(() => {
        const prev = prevRects.current;
        const next = new Map<string, {left: number, top: number}>();
        tileRefs.current.forEach((node, key) => {
            const rect = node.getBoundingClientRect();
            next.set(key, {left: rect.left, top: rect.top});
            const old = prev.get(key);
            if (old == null) return;
            const dx = old.left - rect.left;
            const dy = old.top - rect.top;
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
            node.style.transition = "none";
            node.style.transform = `translate(${dx}px, ${dy}px)`;
            node.getBoundingClientRect();
            requestAnimationFrame(() => {
                node.style.transition = "transform 180ms ease";
                node.style.transform = "";
            });
        });
        prevRects.current = next;
    }, [layoutKey]);

    return <div className="wenayTb qa30MenuSkin">
        {items.map(x => <div key={x.item.key}
                            ref={node => {
                                if (node) tileRefs.current.set(x.item.key, node);
                                else tileRefs.current.delete(x.item.key);
                            }}
                            className="wenayTbItem qa30MenuTile"
                            title={x.density == "icon" ? x.item.title : undefined}
                            onClick={x.item.onClick}>
            {x.content}
        </div>)}
    </div>;
};

const ColumnsMenuDemo = () => {
    const [win, setWin] = useState(false); // Settings window open? (client-owned container, see below)
    const cfg = qa30MenuToolbar.api.useConfig();
    const resetOn = cfg.visible["__reset"] != false;
    return (
        // position: relative -> the Settings window (its own layer, position: absolute) is
        // anchored to THIS card, so it scrolls with the card instead of running off-screen.
        // FloatingWindow's --wnd-* theme tokens are UNDECLARED by default (the window renders
        // transparent) - declare them HERE for a dark modal look. Scoped to this card ON
        // PURPOSE: stand-only styling, not a global tokens change (a client brings its own).
        <div style={{
            position: "relative",
            "--wnd-bg": "var(--color-bg-dark)",
            "--wnd-border": "1px solid var(--color-border-common)",
            "--wnd-radius": "8px",
            "--wnd-shadow": "0 10px 30px rgba(0,0,0,0.55)",
            "--wnd-header-bg": "rgba(255,255,255,0.06)",
            "--wnd-header-border": "1px solid var(--color-border-common)",
            "--wnd-header-color": "var(--color-text-base)",
        } as React.CSSProperties}>
            {/* Square client skin over the same "card 25" toolbar functionality
                (createToolbar). Membership (gear -> Settings) stays separate
                from each button's pressed = grid visibility.
                NOTE: this uses the standard Toolbar.Bar; only the item face is client-styled.
                The gear here opens Settings in a DRAGGABLE WINDOW (see below), not
                the core inline popover - a client-side choice; the toolbar core is untouched. */}
            <div style={{ background: "#26354f", border: "1px solid #40516d", borderRadius: 0, padding: 1, width: "fit-content", maxWidth: "100%", marginBottom: 10, display: "inline-flex", alignItems: "stretch", gap: 1, flexWrap: "wrap" }}>
                <style>{qa30ToolbarSkinCss}</style>
                <Qa30AnimatedMenuBar />
                {resetOn && <Qa30SquareButton title="Reset toolbar" onClick={() => qa30MenuToolbar.api.reset()}><Qa30ResetIcon /></Qa30SquareButton>}
                {/* Client-owned Settings container: <Settings/> in a FloatingWindow -
                    draggable by its header, close X, and closes on an outside click. Rendered
                    in its own layer, so toggling members reflows the bar WITHOUT moving this
                    window (no popover twitch). The library core does NOT ship this - clients
                    wire their own modal; see doc/wenay-react2-rare.md recommendation. */}
                <OutsideClickArea status={win} outsideClick={() => setWin(false)} style={{ display: "inline-flex" }}>
                    <Qa30SquareButton title="Настройки меню" pressed={win} onClick={() => setWin(v => !v)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H8a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V8a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </Qa30SquareButton>
                    {win && (
                        <FloatingWindow
                            keyForSave="qa30.menuSettingsWin"
                            position={{ x: 0, y: 44 }}
                            size={{ width: 300, height: 320 }}
                            zIndex={40}
                            header={<span style={{ padding: "0 10px", fontSize: 12, lineHeight: "26px", color: "#cdd6e4" }}>Настройки меню</span>}
                            onCLickClose={() => setWin(false)}
                        >
                            <div style={{ padding: 12, color: "var(--color-text-base)", height: "100%", boxSizing: "border-box", overflow: "auto" }}>
                                <qa30MenuToolbar.Settings />
                            </div>
                        </FloatingWindow>
                    )}
                </OutsideClickArea>
            </div>
            <div style={{ height: 190 }}>
                <AgGridTable<tMenuRow>
                    rowData={menuRows}
                    getRowId={pp => pp.data.id}
                    columnDefs={qa30MenuColumnDefs}
                    autoSizeColumns={false}
                    onGridReady={e => {
                        qaMenuState.grid.attach(e.api);
                        applyQa30BlockMode();
                    }}
                    onGridPreDestroyed={() => qaMenuState.grid.detach()}
                />
            </div>
        </div>
    );
};


/* ---------- 31. Toolbar over columnState: ONE config drives toolbar + menu + grid ---------- */
type tTbColRow = { id: string; name: string; price: number; qty: number; note: string };
const tbColRows: tTbColRow[] = [
    { id: "a", name: "Alpha", price: 10.5, qty: 3, note: "spot" },
    { id: "b", name: "Beta", price: 22.1, qty: 7, note: "swap" },
    { id: "c", name: "Gamma", price: 5.8, qty: 1, note: "spot" },
];
const tbColDefs = [
    { colId: "name", field: "name" },
    { colId: "price", field: "price" },
    { colId: "qty", field: "qty", headerName: "Qty" },
    { colId: "note", field: "note" },
] satisfies ColDef<tTbColRow>[];
const qaTbColState = createColumnState({
    key: "qa31.tbColumns",
    columns: [
        { key: "name", title: "Name", fixed: true },
        { key: "price", title: "Price", icon: <span>💰</span> },
        { key: "qty", title: "Quantity", short: "qty" },
        { key: "note", title: "Note", short: "note" },
    ],
});
// the toolbar does NOT own order/visibility here: it runs on the columnState
// config (source) - grid, toolbar, menu and Settings all edit the same thing.
// Items without an icon get a letter pseudo-icon in icon density.
const qaTbOverColumns = createToolbar({
    key: "qa31.toolbar",
    items: qaTbColState.columns.map(c => ({ key: c.key, title: c.title, short: c.short, icon: c.icon, fixed: c.fixed })),
    source: qaTbColState.api.listSource,
});

const ToolbarColumnsDemo = () => (
    <div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 8, flexWrap: "wrap" }}>
            <qaTbOverColumns.Bar settings popAlign="left" />
            <ColumnsMenu state={qaTbColState} compact />
        </div>
        <div style={{ height: 170 }}>
            <AgGridTable<tTbColRow>
                rowData={tbColRows}
                getRowId={pp => pp.data.id}
                columnDefs={tbColDefs}
                autoSizeColumns={false}
                onGridReady={e => qaTbColState.grid.attach(e.api)}
                onGridPreDestroyed={() => qaTbColState.grid.detach()}
            />
        </div>
        <div style={{ marginTop: 8, maxWidth: 320 }}>
            <qaTbOverColumns.Settings />
        </div>
    </div>
);

/* ---------- 32. createColumnGrid: auto kit over table/cards/menu/dots ---------- */
const qaAutoColumnGrid = createColumnGrid<tTbColRow>({
    key: "qa32.columnGrid",
    columnDefs: tbColDefs,
    data: tbColRows,
    getId: r => r.id,
    autoSizeOnColumnCountChange: true,
    columns: [
        { key: "name", fixed: true, cardRole: "title" },
        { key: "price", icon: <span>PX</span>, cardRole: "accent" },
        { key: "qty", short: "qty" },
        { key: "note", short: "note", defaultVisible: false },
    ],
});

const ColumnGridKitDemo = () => {
    const [mode, setMode] = useState<"table" | "cards">("table");
    return <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button style={btn(mode == "table", "#0969da")} onClick={() => setMode("table")}>table</button>
            <button style={btn(mode == "cards", "#0969da")} onClick={() => setMode("cards")}>cards</button>
        </div>
        <qaAutoColumnGrid.View
            mode={mode}
            tableHeight={180}
            table={{ getRowId: pp => pp.data.id }}
        />
    </div>;
};


/* ---------- 18. Observe local store/listen hooks ---------- */
type tObserveLocalState = {
    count: number;
    meta: { status: string };
    items: Record<string, number>;
};

const observeLocalMask = { count: true, meta: { status: true }, items: { a: true } } as const;

const ObserveStoreLocalDemo = () => {
    const store = useMemo(() => Observe.createStore<tObserveLocalState>({
        count: 0,
        meta: { status: "idle" },
        items: { a: 1, b: 2 },
    }), []);
    const count = useStoreNode<number>(store.node.at("count"));
    const status = useStoreNode(store.node.meta.status);
    const itemKeys = useStoreKeys(store.node.items);
    const selection = useStoreSelect(useMemo(() => store.update(observeLocalMask), [store]), { drain: "micro" });
    const [emit, listen] = useMemo(() => createListen<[number, string]>(), []);
    const listenArgs = useListenArgs(listen, { initial: [0, "initial"] });
    const listenValue = useListenValue<number, [number, string]>(listen, { initial: 0, map: (n) => n });

    function mutatePlainState() {
        store.state.meta.status = "plain " + new Date().toLocaleTimeString();
        void Observe.flushReactive(store.state);
    }

    return <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => count.replace((count.value ?? 0) + 1)}>node.at("count") +1</button>
            <button onClick={() => status.replace("replace " + new Date().toLocaleTimeString())}>replace status</button>
            <button onClick={() => { store.state.items.c = Date.now(); void Observe.flushReactive(store.state); }}>add key c</button>
            <button onClick={() => { delete store.state.items.b; void Observe.flushReactive(store.state); }}>delete key b</button>
            <button onClick={mutatePlainState}>plain state mutation + flush</button>
            <button onClick={() => emit(Date.now(), status.value ?? "-")}>emit listen</button>
            <button onClick={() => store.replace({ count: 0, meta: { status: "reset" }, items: { a: 1, b: 2 } })}>replace whole store</button>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
            <span>count exists: <b>{String(count.exists)}</b></span>
            <span>count value: <b>{count.value}</b></span>
            <span>status: <b>{status.value}</b></span>
            <span>item keys: <b>{itemKeys.stringKeys.join(",")}</b></span>
            <span>listen value: <b>{listenValue}</b></span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <pre style={{ background: "#f6f8fa", padding: 8, borderRadius: 6, overflow: "auto", fontSize: 11 }}>selection\n{JSON.stringify(selection.value, null, 2)}</pre>
            <pre style={{ background: "#f6f8fa", padding: 8, borderRadius: 6, overflow: "auto", fontSize: 11 }}>listen args\n{JSON.stringify(listenArgs, null, 2)}</pre>
        </div>
    </div>;
};
/* ---------- 17. Observe store mirror hooks over HTTP/SSE ---------- */
type tObserveQaState = {
    value: number;
    nested: { label: string };
    updatedAt: string;
    events: number;
    bag: Record<string, number>;
    deep: {
        level1: {
            level2: {
                leaf: string;
                counters: Record<string, number>;
            };
        };
    };
};

const observeMirrorMask = { value: true, nested: { label: true }, updatedAt: true, events: true, bag: true, deep: { level1: { level2: { leaf: true, counters: true } } } } as const;
const observeLabelMask = { nested: { label: true }, events: true } as const;

function createSseChangedListen(url: string) {
    const listeners = new Set<() => void>();
    let source: EventSource | null = null;

    function notify() {
        listeners.forEach(listener => listener());
    }

    function ensureSource() {
        if (source || typeof EventSource == "undefined") return;
        source = new EventSource(url);
        source.addEventListener("changed", notify);
        source.onerror = () => {
            // EventSource reconnects itself; the visible QA state comes from fetch errors/successes.
        };
    }

    return {
        on(cb: () => void) {
            listeners.add(cb);
            ensureSource();
            return () => {
                listeners.delete(cb);
                if (listeners.size == 0) {
                    source?.close();
                    source = null;
                }
            };
        },
    };
}


function createSseChangedPathsListen(url: string) {
    const listeners = new Set<(change: { paths: PropertyKey[][] }) => void>();
    let source: EventSource | null = null;

    function ensureSource() {
        if (source || typeof EventSource == "undefined") return;
        source = new EventSource(url);
        source.addEventListener("changedPaths", event => {
            const change = JSON.parse((event as MessageEvent).data) as { paths: PropertyKey[][] };
            listeners.forEach(listener => listener(change));
        });
        source.onerror = () => {};
    }

    return {
        on(cb: (change: { paths: PropertyKey[][] }) => void) {
            listeners.add(cb);
            ensureSource();
            return () => {
                listeners.delete(cb);
                if (listeners.size == 0) {
                    source?.close();
                    source = null;
                }
            };
        },
    };
}
async function postObserveMutation(body: object) {
    const res = await fetch("/__qa/observe-store/mutate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

const ObserveStoreMirrorDemo = () => {
    const remote = useMemo(() => {
        const changed = createSseChangedListen("/__qa/observe-store/events");
        const changedPaths = createSseChangedPathsListen("/__qa/observe-store/events-paths");
        return {
            changed,
            changedPaths,
            async get(mask?: any) {
                const url = new URL("/__qa/observe-store/get", window.location.origin);
                if (mask !== undefined) url.searchParams.set("mask", JSON.stringify(mask));
                const res = await fetch(url);
                if (!res.ok) throw new Error(await res.text());
                return res.json() as Promise<tObserveQaState>;
            },
        };
    }, []);
    const initial = useMemo<tObserveQaState>(() => ({
        value: 0,
        nested: { label: "client initial" },
        updatedAt: "",
        events: 0,
        bag: {},
        deep: { level1: { level2: { leaf: "client deep initial", counters: {} } } },
    }), []);
    const mirror = useStoreMirror<tObserveQaState, typeof observeMirrorMask>(remote, initial, { mask: observeMirrorMask, current: true, drain: 50 });
    const value = useStoreNode(mirror.store.node.value);
    const label = useStoreNode(mirror.store.node.nested.label);
    const bagKeys = useStoreKeys(mirror.store.node.bag);
    const deepLeaf = useStoreNode(mirror.store.node.deep.level1.level2.leaf);
    const deepCounterKeys = useStoreKeys(mirror.store.node.deep.level1.level2.counters);
    const labelSelection = useStoreSelect(useMemo(() => mirror.store.update(observeLabelMask), [mirror.store]), { drain: 50 });
    const pathEvents = useStoreChangedPaths(remote.changedPaths);
    const [pushes, setPushes] = useState(0);
    const [lastPost, setLastPost] = useState("-");

    useListenEffect(remote.changed, () => setPushes(v => v + 1));

    async function mutate(body: object) {
        setLastPost("posting...");
        try {
            const data = await postObserveMutation(body);
            setLastPost(JSON.stringify(data));
        } catch (e) {
            setLastPost(String(e));
        }
    }

    return <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => mutate({ type: "inc" })}>server +1</button>
            <button onClick={() => mutate({ type: "label", label: "srv " + new Date().toLocaleTimeString() })}>server label</button>
            <button onClick={() => mutate({ type: "bag-add", key: "c", value: Date.now() })}>server add key c</button>
            <button onClick={() => mutate({ type: "bag-delete", key: "b" })}>server delete key b</button>
            <button onClick={() => mutate({ type: "deep-leaf", value: "deep " + new Date().toLocaleTimeString() })}>server deep leaf</button>
            <button onClick={() => mutate({ type: "deep-add", key: "z", value: Date.now() })}>server deep add z</button>
            <button onClick={() => mutate({ type: "deep-delete", key: "y" })}>server deep delete y</button>
            <button onClick={() => mutate({ type: "reset" })}>server reset</button>
            <button onClick={() => value.replace((value.value ?? 0) + 1000)}>local mirror +1000</button>
            <button onClick={() => mirror.sync()}>manual sync</button>
            <button onClick={() => mirror.stop()}>stop sync</button>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
            <span>ready: <b>{String(mirror.ready)}</b></span>
            <span>syncing: <b>{String(mirror.syncing)}</b></span>
            <span>SSE pushes: <b>{pushes}</b></span>
            <span>path pushes: <b>{pathEvents.count}</b></span>
            <span>node value: <b>{value.value}</b></span>
            <span>node label: <b>{label.value}</b></span>
            <span>bag keys: <b>{bagKeys.stringKeys.join(",")}</b></span>
            <span>deep leaf: <b>{deepLeaf.value}</b></span>
            <span>deep keys: <b>{deepCounterKeys.stringKeys.join(",")}</b></span>
        </div>
        {mirror.error != null && <div style={{ color: "#cf222e" }}>error: {String(mirror.error)}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <pre style={{ background: "#f6f8fa", padding: 8, borderRadius: 6, overflow: "auto", fontSize: 11 }}>mirror.value\n{JSON.stringify(mirror.value, null, 2)}</pre>
            <pre style={{ background: "#f6f8fa", padding: 8, borderRadius: 6, overflow: "auto", fontSize: 11 }}>label selection\n{JSON.stringify(labelSelection.value, null, 2)}\n\nchanged paths\n{JSON.stringify(pathEvents.paths)}\n\nlast POST\n{lastPost}</pre>
        </div>
    </div>;
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
/* ---------- 20. SettingsDialog + section registry ---------- */
const dlgBody: React.CSSProperties = { fontSize: 13, lineHeight: 1.6 };
const dlgStaticSections = [
    {
        key: "general",
        name: "General",
        keywords: ["workspace", "startup"],
        searchText: "autosave project defaults",
        render: () => <div style={dlgBody}><b>General</b><div>Static root section passed via the sections prop.</div></div>,
        children: [
            {
                key: "general-project",
                name: "Project",
                searchText: "workspace autosave startup folder",
                render: () => <div style={dlgBody}><b>Project</b><div>Workspace folder, startup page, and autosave defaults.</div></div>,
                children: [
                    {
                        key: "general-project-indexing",
                        name: "Indexing",
                        searchText: "file watcher cache suffix tree",
                        render: () => <div style={dlgBody}><b>Indexing</b><div>File watcher cache and recursive search index settings.</div></div>,
                        children: [
                            {
                                key: "general-project-indexing-suffix",
                                name: "Suffix tree",
                                searchText: "suffix tree trie token depth recursive auto expand",
                                render: () => <div style={dlgBody}><b>Suffix tree</b><div>Deep branch used to verify auto-expansion for any tree depth.</div></div>,
                                children: [
                                    {
                                        key: "general-project-indexing-suffix-leaves",
                                        name: "Leaf buckets",
                                        searchText: "suffix tree leaves buckets compact path",
                                        render: () => <div style={dlgBody}><b>Leaf buckets</b><div>Nested leaf configuration under the suffix tree branch.</div></div>,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        key: "display",
        name: "Display",
        keywords: ["appearance", "theme"],
        render: () => <div style={dlgBody}><b>Display</b><div>Display root. Long content to test scrolling:</div>{Array.from({ length: 30 }, (_, i) => <div key={i}>line {i + 1}</div>)}</div>,
        children: [
            {
                key: "display-theme",
                name: "Theme",
                searchText: "dark light contrast palette",
                render: () => <div style={dlgBody}><b>Theme</b><div>Dark, light, contrast, and palette options.</div></div>,
                children: [
                    {
                        key: "display-theme-palette",
                        name: "Palette",
                        searchText: "semantic colors accent warning success",
                        render: () => <div style={dlgBody}><b>Palette</b><div>Semantic colors shared by settings, windows, and toolbars.</div></div>,
                        children: [
                            {
                                key: "display-theme-palette-accent",
                                name: "Accent color",
                                searchText: "accent primary focus selected highlight",
                                render: () => <div style={dlgBody}><b>Accent color</b><div>Primary focus and selected-state color tokens.</div></div>,
                            },
                        ],
                    },
                ],
            },
            { key: "display-font", name: "Font", searchText: () => "font size editor line height", render: () => <div style={dlgBody}><b>Font</b><div>Editor font size and line height settings.</div></div> },
        ],
    },
];

// Any module: register on mount, the returned unregister runs on unmount.
const ExternalSectionModule = () => {
    useEffect(() => registerSettingsSection({
        key: "external",
        parentKey: "display",
        name: "External module",
        searchText: "registered plugin mount unmount external",
        render: () => <div style={dlgBody}><b>External</b><div>Registered by a module on mount and removed on unmount.</div></div>,
    }), []);
    return <span style={{ padding: "2px 8px", background: "#dafbe1", borderRadius: 6, fontSize: 12 }}>external module mounted</span>;
};
const SettingsDialogDemo = () => {
    const [mounted, setMounted] = useState(true);
    useCacheMapPersistence(memoryCache);
    return <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <SettingsDialog
            sections={dlgStaticSections}
            defaultSection="general"
        />
        <button onClick={() => setMounted(v => !v)}>{mounted ? "unmount external module" : "mount external module"}</button>
        {mounted && <ExternalSectionModule />}
    </div>;
};

/* ---------- 21. createUiSlot - configurable placement ---------- */
const qaSlot = createUiSlot({
    key: "qa-ui-slot",
    places: { top: "Top bar", side: "Sidebar" },
    def: "top",
});
const slotContent = <span style={{ padding: "4px 10px", background: "#0969da", color: "#fff", borderRadius: 6, fontSize: 12 }}>the block</span>;

const UiSlotDemo = () => {
    // App-side persistence contract in one hook: memoryCache.load() on start, then the dirty
    // channel -> saveDebounced(300) - the persisted maps are observable and mark their
    // memoryCache dirty themselves, the app owns the write policy.
    useCacheMapPersistence(memoryCache);
    return <div style={{ display: "grid", gap: 10 }}>
        <style>{`.qaChip{border:1px solid #6e7781;border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;display:inline-block}.qaChipActive{background:#0969da;border-color:#0969da;color:#fff}`}</style>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 13 }}>place:</span>
            <qaSlot.PlacementSetting className="qaChip" activeClassName="qaChipActive" />
        </div>
        <div style={{ border: "1px dashed #6e7781", borderRadius: 6, padding: 8, minHeight: 38, fontSize: 13 }}>
            Top bar: <qaSlot.Slot place="top">{slotContent}</qaSlot.Slot>
        </div>
        <div style={{ border: "1px dashed #6e7781", borderRadius: 6, padding: 8, minHeight: 38, fontSize: 13 }}>
            Sidebar: <qaSlot.Slot place="side">{slotContent}</qaSlot.Slot>
        </div>
    </div>;
};

/* ---------- 22. createCallbackHub - single callback slot multiplexer ---------- */
// Fake legacy API with ONE callback slot: a second direct subscriber would silently
// overwrite the first. The hub takes the slot once and fans events out.
const hubSlot: { cb: ((n: number) => void) | null } = { cb: null };
let hubTick = 0;
const qaHub = createCallbackHub<[number]>(emit => { hubSlot.cb = emit });

const HubDemo = () => {
    const [a, setA] = useState<number[]>([]);
    const [b, setB] = useState<number[]>([]);
    const [aOn, setAOn] = useState(false);
    const [bOn, setBOn] = useState(false);
    useEffect(() => { if (aOn) return qaHub.on(n => setA(v => [...v, n])); }, [aOn]);
    useEffect(() => { if (bOn) return qaHub.on(n => setB(v => [...v, n])); }, [bOn]);
    return <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => hubSlot.cb?.(++hubTick)}>fire source event</button>
            <button onClick={() => setAOn(v => !v)}>{aOn ? "off A" : "on A"}</button>
            <button onClick={() => setBOn(v => !v)}>{bOn ? "off B" : "on B"}</button>
            <span>slot bound (lazy): <b>{String(hubSlot.cb != null)}</b></span>
            <span>hub.count(): <b>{qaHub.count()}</b></span>
        </div>
        <div>A received: <b>{a.join(", ") || "-"}</b></div>
        <div>B received: <b>{b.join(", ") || "-"}</b></div>
    </div>;
};

/* ---------- 35. DragBox - imperative delta drag (adapter over useDraggableApi) ---------- */
const DragBoxDemo = () => {
    const base = useRef({ x: 20, y: 20 });
    const delta = useRef({ x: 0, y: 0 });
    const chipRef = useRef<HTMLDivElement | null>(null);
    const renders = useRef(0);
    const [starts, setStarts] = useState(0);
    const [stops, setStops] = useState(0);
    renders.current++;
    const apply = () => {
        const el = chipRef.current;
        if (el) el.style.transform = `translate(${base.current.x + delta.current.x}px, ${base.current.y + delta.current.y}px)`;
    };
    useEffect(apply, []);
    return <div style={{ position: "relative", height: 220, border: "1px dashed #d0d7de", borderRadius: 8, overflow: "hidden" }}>
        <DragBox
            onStart={() => { delta.current = { x: 0, y: 0 }; setStarts(v => v + 1); }}
            onX={x => { delta.current.x = x; apply(); }}
            onY={y => { delta.current.y = y; apply(); }}
            onStop={() => {
                base.current = { x: base.current.x + delta.current.x, y: base.current.y + delta.current.y };
                delta.current = { x: 0, y: 0 };
                apply();
                setStops(v => v + 1);
            }}
        >
            <div ref={chipRef} style={{ width: 90, padding: "10px 0", textAlign: "center", background: "#0969da", color: "#fff", borderRadius: 8, cursor: "grab", userSelect: "none", touchAction: "none" }}>drag me</div>
        </DragBox>
        <div style={{ position: "absolute", right: 10, bottom: 8, fontSize: 12, color: "#57606a" }}>
            starts: <b>{starts}</b> · stops: <b>{stops}</b> · renders: <b>{renders.current}</b>
        </div>
    </div>;
};

/* ---------- 25. createToolbar - customizable toolbar ---------- */
// Item actions land in a module store (the demo component reads it via updateBy).
const tbActions = { last: "-", count: 0 };
function tbAct(name: string) {
    return () => {
        tbActions.last = name;
        tbActions.count++;
        renderBy(tbActions);
    };
}
const tbBaseItems: ToolbarItem[] = [
    { key: "home", title: "Home (fixed)", short: "Home", icon: <span>🏠</span>, fixed: true, onClick: tbAct("home") },
    { key: "star", title: "Add to favorites", short: "Star", icon: <span>⭐</span>, onClick: tbAct("star") },
    { key: "bell", title: "Notifications", short: "Alerts", icon: <span>🔔</span>, onClick: tbAct("bell") },
    { key: "chart", title: "Open chart window", short: "Chart", icon: <span>📈</span>, onClick: tbAct("chart") },
    { key: "trash", title: "Clear workspace", short: "Clear", icon: <span>🗑️</span>, defaultVisible: false, onClick: tbAct("trash") },
];
const qaToolbar = createToolbar({ key: "qa-toolbar", items: tbBaseItems });
// The merge case (acceptance #3): the SAME persist key, one EXTRA item - as if the app
// shipped an update. Created lazily so the base bar is what the page starts with.
let qaToolbarExtra: ReturnType<typeof createToolbar> | null = null;
const getQaToolbarExtra = () => qaToolbarExtra ??= createToolbar({
    key: "qa-toolbar",
    items: [...tbBaseItems, { key: "help", title: "Help (added in the update)", short: "Help", icon: <span>❓</span>, onClick: tbAct("help") }],
});

const ToolbarDemo = () => {
    updateBy(tbActions);
    const [extra, setExtra] = useState(false);
    const [thirdDensity, setThirdDensity] = useState(false);
    const [changes, setChanges] = useState(0);
    const [lastCfg, setLastCfg] = useState<ToolbarConfig | null>(null);
    const tb = extra ? getQaToolbarExtra() : qaToolbar;

    // App-side persistence contract - same wiring as the UiSlot card.
    useCacheMapPersistence(memoryCache);
    // Same pure Settings element registered as a global settings section (see card 20's dialog).
    useEffect(() => registerSettingsSection({
        key: "qa-toolbar",
        name: "Toolbar",
        render: () => <tb.Settings />,
    }), [tb]);
    // Both bars share one persist key -> both apis emit; subscribe to the visible one.
    useListenEffect(tb.api.onChange, cfg => {
        setChanges(v => v + 1);
        setLastCfg(cfg);
    });
    // Density registry extensibility: a third level is just one more registration.
    useEffect(() => {
        if (!thirdDensity) return;
        return registerToolbarDensity({
            key: "full",
            name: "Full text",
            renderItem: item => <span>{item.icon} {item.title}</span>,
        });
    }, [thirdDensity]);

    return <div style={{ display: "grid", gap: 10 }}>
        <div style={{ background: "#17202e", borderRadius: 8, padding: 6, width: "fit-content", maxWidth: "100%" }}>
            <tb.Bar settings popAlign="left" />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
            <SettingsDialog trigger={<span style={{ display: "inline-block", padding: "4px 10px", border: "1px solid #0969da", borderRadius: 6, color: "#0969da" }}>global settings</span>} />

            <button onClick={() => setExtra(v => !v)}>{extra ? "app update: extra item ON" : "simulate app update (+1 item)"}</button>
            <label><input type="checkbox" checked={thirdDensity} onChange={e => setThirdDensity(e.target.checked)} /> register 3rd density (Full text)</label>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
            <span>last action: <b>{tbActions.last}</b> ({tbActions.count})</span>
            <span>onChange fired: <b>{changes}</b></span>
        </div>
        {lastCfg && <div style={{ fontSize: 11, fontFamily: "monospace", color: "#57606a", overflowX: "auto" }}>{JSON.stringify(lastCfg)}</div>}
    </div>;
};

/* ---------- 26. useReorder - a field of blocks ---------- */
// Module store: the hook owns NO state beyond the live drag - order lives with the app.
const reorderState = { order: ["A", "B", "C", "D", "E", "F", "G", "H"], varied: false, commits: 0 };

const ReorderDemo = () => {
    updateBy(reorderState);
    const r = useReorder({
        order: reorderState.order,
        commit: next => {
            reorderState.order = next;
            reorderState.commits++;
            renderBy(reorderState);
        },
        // equal blocks: 'slots' is exact; varied sizes: FLIP-measure the real layout
        preview: reorderState.varied ? "measure" : "slots",
    });
    const width = (k: string) => reorderState.varied ? 56 + (k.charCodeAt(0) % 4) * 26 : 64;
    return <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
        <label>
            <input type="checkbox" checked={reorderState.varied}
                   onChange={() => { reorderState.varied = !reorderState.varied; renderBy(reorderState); }} />
            {" "}varied block widths (preview: measure / FLIP)
        </label>
        <div ref={r.listRef} style={{ display: "flex", flexWrap: "wrap", gap: 8, width: 300, background: "#17202e", padding: 8, borderRadius: 8 }}>
            {reorderState.order.map(k => {
                const it = r.item(k);
                return <div key={k} {...it.props}
                            style={{
                                width: width(k), height: 44, lineHeight: "44px", textAlign: "center",
                                background: it.dragging ? "#2f5a8f" : "#2b3648", color: "#dfe6ef", borderRadius: 6,
                                cursor: "grab", userSelect: "none", touchAction: "none",
                                transition: it.active && !it.dragging ? "transform 0.12s ease" : undefined,
                                position: it.dragging ? "relative" : undefined, zIndex: it.dragging ? 1 : undefined,
                                boxShadow: it.dragging ? "0 4px 14px rgba(0,0,0,0.4)" : undefined,
                                ...it.style,
                            }}>{k}</div>;
            })}
        </div>
        <div style={{ color: "#57606a", fontFamily: "monospace", fontSize: 12 }}>order: {reorderState.order.join(" ")} | commits: {reorderState.commits}</div>
    </div>;
};

/* ---------- 27. useReorderBoard - columns with per-column gravity ---------- */
const boardState = {
    cols: [
        { key: "c1", items: ["A1", "A2", "A3"] },
        { key: "c2", items: ["B1", "B2"] },
        { key: "c3", items: ["C1", "C2", "C3", "C4"] },
        { key: "c4", items: ["D1"] },
        { key: "c5", items: [] as string[] },
    ] as BoardColumn[],
    gravity: { c1: "top", c2: "bottom", c3: "top", c4: "bottom", c5: "top" } as { [k: string]: string },
    commits: 0, events: 0, last: "-", nextCol: 6,
};

const qaBoardStyles: Record<string, React.CSSProperties> = {
    root: { display: "grid", gap: 8, fontSize: 13 },
    columns: { display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" },
    insertStrip: {
        width: 14, height: 240, borderRadius: 6, cursor: "pointer", userSelect: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#57606a", background: "#151b26", fontSize: 12,
    },
    column: { display: "flex", flexDirection: "column", gap: 6, width: 78, height: 240, padding: 6, borderRadius: 8 },
    item: {
        height: 32, lineHeight: "32px", textAlign: "center", borderRadius: 6,
        color: "#dfe6ef", cursor: "grab", userSelect: "none", touchAction: "none",
    },
    status: { color: "#57606a", fontFamily: "monospace", fontSize: 12 },
};

function qaBoardColumnStyle(over: boolean, bottom: boolean): React.CSSProperties {
    return {
        ...qaBoardStyles.column,
        justifyContent: bottom ? "flex-end" : "flex-start",
        background: over ? "#1d2b40" : "#17202e",
        outline: over ? "1px solid #2f5a8f" : undefined,
    };
}

function qaBoardItemStyle(it: {dragging: boolean; active: boolean; style?: React.CSSProperties}): React.CSSProperties {
    return {
        ...qaBoardStyles.item,
        background: it.dragging ? "#2f5a8f" : "#2b3648",
        transition: it.active && !it.dragging ? "transform 0.12s ease" : undefined,
        position: it.dragging ? "relative" : undefined,
        zIndex: it.dragging ? 1 : undefined,
        boxShadow: it.dragging ? "0 4px 14px rgba(0,0,0,0.4)" : undefined,
        ...it.style,
    };
}

const BoardDemo = () => {
    updateBy(boardState);
    const log = (s: string) => { boardState.last = s; boardState.events++; renderBy(boardState); };
    const r = useReorderBoard({
        columns: boardState.cols,
        commit: next => { boardState.cols = next; boardState.commits++; renderBy(boardState); },
        onOverChange: e => log(`over ${e.over.col}#${e.over.index}` + (e.prev && e.prev.col != e.over.col ? " (column crossed)" : "")),
        onDragEnd: e => log(`drop ${e.key} -> ${e.over.col}#${e.over.index} committed=${e.committed}`),
    });
    // A column is consumer state: splice at ANY position, the hook picks it up
    // via the live columnRef registry - nothing to tell the hook.
    const addColumnAt = (i: number) => {
        const k = "c" + boardState.nextCol++;
        const cols = boardState.cols.slice();
        cols.splice(i, 0, { key: k, items: [] });
        boardState.cols = cols;
        boardState.gravity[k] = boardState.nextCol % 2 ? "bottom" : "top";
        renderBy(boardState);
    };
    const InsertStrip = ({ at }: { at: number }) => (
        <div title="insert column here" onClick={() => addColumnAt(at)} style={qaBoardStyles.insertStrip}>+</div>
    );
    return <div style={qaBoardStyles.root}>
        <div style={qaBoardStyles.columns}>
            <InsertStrip at={0} />
            {boardState.cols.map((c, ci) => (
                <React.Fragment key={c.key}>
                    <div ref={r.columnRef(c.key)}
                         style={qaBoardColumnStyle(r.over?.col == c.key, boardState.gravity[c.key] == "bottom")}>
                        {c.items.map(k => {
                            const it = r.item(k);
                            return <div key={k} {...it.props} style={qaBoardItemStyle(it)}>{k}</div>;
                        })}
                    </div>
                    <InsertStrip at={ci + 1} />
                </React.Fragment>
            ))}
        </div>
        <div style={qaBoardStyles.status}>
            {boardState.cols.map(c => c.key + (boardState.gravity[c.key] == "bottom" ? "↓" : "↑") + ":[" + c.items.join(",") + "]").join(" ")} | commits: {boardState.commits} | events: {boardState.events} | last: {boardState.last}
        </div>
    </div>;
};

/* ---------- borad ---------- */
function ActiveChecks() {
    return (
        <>
            <Check n={18} title="Observe hooks - local store and listen"
                   do="Click node.at(count) +1, replace status, plain state mutation + flush, emit listen, and replace whole store."
                   expect="Leaf node, selection, direct state mutation after flush, add/delete object keys, and listen hooks all rerender. The count key is read through node.at(count), so it does not conflict with node.count()."
                   note="This isolates the React adapter from transport: no fetch/SSE/RPC involved."
                   tall>
                <ObserveStoreLocalDemo />
            </Check>
            <Check n={17} title="Observe hooks - store mirror over HTTP/SSE"
                   do="Click server +1, label, add/delete key, deep leaf/deep add/deep delete, local mirror +1000, stop sync, then manual sync."
                   expect="Server buttons POST to the Vite QA server, including add/delete object keys and deep mutations. SSE pushes changedPaths; mirror pulls only the intersecting mask when possible. Local mirror edits render immediately and are overwritten by the next server sync."
                   note="This checks the React adapter only in wenay-react2: common2 remains React-free; transport policy stays outside the hook."
                   tall>
                <ObserveStoreMirrorDemo />
            </Check>
            <Check n={23} title="Replay hooks - video line, conflation, time travel, freshness"
                   do="Watch A and B play the same synthetic video. Toggle slow network for B, switch resolution, unmount/remount A. In C drag the slider (playback pauses), then press live. In D: note the renders counter while the line is fresh, check stall producer, wait 2s, uncheck; while stalled press new client (keyframe). In E: switch pull pace (250ms/1s/3s), press pull now."
                   expect="A plays smoothly at 10 fps. B on slow network stays CURRENT (bounded latency): frames drop (dropped/coalesced counters grow), the wire buffer never grows past highWater, and each recovery is one coalesced last-frame envelope. Resolution switches on all clients within a frame. Remounting A continues from the kept seq (seq does not reset, frames counter continues from the tail). C seeks to any archived seq via keyframe+tail fold and hands over to live seamlessly. D: renders stays FLAT while frames grow (no per-event re-renders); on stall the STALE badge appears after ~2s and disappears on the first frame after resume; a client mounted during a stall goes STALE within staleMs (this in-proc keyframe is stamped at request time; a tail/keyframe carrying an old producer ts goes stale from the first paint); StrictMode double-effect leaves one watchdog and no badge flicker. E advances ONLY at the pull cadence: frames jumps by ~pace×10fps per pull while pulls grows by one; seq keeps up with head; switching pace keeps the position (no keyframe restart, frames does not re-fold); pull now folds immediately."
                   note="All in-proc: the socket transport is already proven in wenay-common2 (replay/video-socket.demo, canvas-socket.test). This card tests the React side: useReplaySubscribe lifecycle (off on unmount, reconnect by since), useReplayHistory scrubber, frames drawn to canvas via ref - bypassing VDOM, stale/staleMs mirroring common2's edge-triggered watchdog into React state, useReplayFrame pull path (timer around remote.frame(), rev2 frame model; policy:'frame'/hint ride ReplaySubscribeOpts but need a server frameLine - the wire test lives in common2 replay/rpc-auto.test.ts). The producer starts on first render and runs until page reload."
                   tall>
                <ReplayVideoDemo />
            </Check>
            <Check n={24} title="Replay hooks - store sync (useStoreReplayMirror)"
                   do="Watch ticks/price advance. Click server note / add key / delete key. Uncheck sync enabled, mutate the server a few times, recheck. Click restart. Check stall producer, wait 2.5s, then click server note."
                   expect="Mirror follows the server store with seq ascending. While sync is disabled the mirror freezes; on re-enable it catches up through the journal tail (seq jumps to head, no full reset flicker). Object key add/delete replicate. restart resubscribes from the kept seq. On stall the stale flag flips true after 2.5s and lastTs freezes; any server mutation (e.g. server note) flips it back to fresh."
                   note="exposeStoreReplay/syncStoreReplay in-proc: the remote is the exposed {line, since, keyframe} facade, exactly what createRpcServerAuto would expose over a socket. staleMs rides the same ReplaySubscribeOpts as the video card.">
                <ReplayStoreDemo />
            </Check>
            <Check n={33} title="Replay hooks - per-key feed (useStoreReplayEach)"
                   do="Watch the table for a few producer ticks. Click server add row, server delete row, server replace ALL, then remount client (fresh keyframe)."
                   expect="On mount every row appears with cb calls=1 (keyframe expanded per key). Between clicks only the mutated row's cb calls counter grows - the whole dict is never re-delivered per tick. Delete removes the row via (key, undefined). replace ALL swaps the table: removed rows leave, new rows enter with cb calls=1. Remount folds a fresh keyframe (all counters reset to 1); StrictMode double-effect does not double-count."
                   note="React counterpart of Observe.syncStoreReplayEach (wenay-common2 1.0.62): internal mirror store + syncStoreReplay + store.each(). The mirror lives in a ref, so in-mount resubscribes reconnect by journal tail on top of kept state; the fold target is a plain Map (grid-api style), not React state. drain:100 coalesces multiple writes to one key into one call per window."
                   tall>
                <ReplayStoreEachDemo />
            </Check>
            <Check n={34} title="Replay hooks - route hand-off (useReplayRouteSubscribe)"
                   do="Watch one canvas draw the synthetic video. Click switch direct, then switch relay, then fail route. Repeat while the producer is moving."
                   expect="The canvas keeps advancing as one logical fold: route switches catch up by seq before the old route closes, so frames do not reset or duplicate. The label changes to direct/relay only after ready. fail route reports an error but keeps the previous active route alive and the canvas continues."
                   note="React wrapper over wenay-common2 1.0.65 Replay.replayRouteSubscribe. Route hand-off is explicit through switchRoute(); changing the remote prop remains a fresh subscription boundary. This route helper does not expose stale/lastTs, so freshness stays on the non-route hooks until common2 grows that surface."
                   tall>
                <ReplayRouteDemo />
            </Check>
            <Check n={13} title="ModalProvider / useModal - Escape and outside click"
                   do="Click open modal. Close it with Escape. Open it again and close with an outside click. Open it again and close with the close button."
                   expect="All three methods close it. The dimmed backdrop is above everything (z-index from token --wenay-z-modal)."
                   note="M1: Escape and closeOnEscape/closeOnOutsideClick options were added; useModal remains the app-level path and createModalElementStore remains low-level.">
                <ModalDemo />
            </Check>

            <Check n={20} title="SettingsDialog - searchable settings tree + registry"
                   do="Click the three-dot toolbar-style settings button: drag the window by its header, drag the divider between tree and content, double-click it to reset width, use the tree icons and the dotted tree-cycle button, search for suffix/leaf/palette/accent/font/external and wrong-layout examples like ыгаашч for suffix. Press Enter to save a query into search history, reopen history from the clock button, pick a saved query, then clear history. Clear search via the x and via Escape, then close via window x/outside click/Escape with empty search. Unmount external module and open again."
                   expect="The default trigger is the same compact toolbar-button style as createToolbar, using a three-dot icon. Dialog opens as the standard draggable FloatingWindow with a header, larger size, shared close x, and outside-click close. The tree/content divider changes the tree width, persists it through memoryCache, supports keyboard arrows, and double-click/Enter resets to default. Search uses original input plus RU/EN keyboard-layout variants, selects the first real match, auto-expands parents, and highlights only the matched word once. Enter stores non-empty queries in a small persisted search history; choosing a history item restores the query; clearing history removes the dropdown; leaving the search box closes the dropdown. The dotted tree-cycle button switches expanded/current branch/collapsed and stays in the search row. The clear x and Escape both cancel search text; Escape with empty search closes the dialog. The external child under Display appears only while mounted."
                   note="Registry is a module singleton (registerSettingsSection -> unregister), no React context. Tree shape comes from children or parentKey. Search history uses createSearchHistory -> memoryGetOrCreate/memoryCache dirty channel; this demo loads memoryCache and saves dirty changes with saveDebounced(300). Look via --dlg-* tokens; apps pass their own section classes via sectionClassName/sectionActiveClassName.">
                <SettingsDialogDemo />
            </Check>
<Check n={38} title="Media video - capture lifecycle + canvas viewer"
                   do="Press start camera and grant permission. Move the tab to background for a short time, then return. Press stop, then start again."
                   expect="The canvas renders without React re-rendering per frame. State changes idle → requesting → live; the stats line shows drawn frames and frame age. Hidden-tab capture is owned by common2 worker/ImageCapture defaults."
                   note="useMediaSource owns only permission/device lifecycle. Media.attachVideoCanvas owns JPEG decode and drawing; frame data never enters React state.">
                <MediaVideoDemo />
            </Check>

            <Check n={39} title="Media audio - mic lifecycle + sequential player"
                   do="Press enable + start mic, grant permission, speak briefly, then stop. If browser autoplay blocks audio, press the same button again."
                   expect="Audio activation happens in a user gesture; common2 player keeps a short live backlog and reports played/dropped frames. React renders only the half-second stats snapshot."
                   note="The PCM player is common2 imperative code. This card proves the React wrapper's start/stop cleanup and gesture boundary, not an audio implementation in React.">
                <MediaAudioDemo />
            </Check>
            <Check n={40} title="Peer SDK - mirrored store + explicit resync"
                   do="Click peer A +1 several times. Watch mirrored value on peer B. Press resync B; the mirror must stay coherent."
                   expect="Peer SDK owns relay journal and repair. React reads the peer store normally and exposes route/ready/seq as low-frequency control state; no transport or patch protocol is reimplemented here."
                   note="In-process host replaces a fake UI mock: this card proves the actual Peer.createPeerClient contract. Direct WebRTC needs the app's real signaling/rtc factory and remains a separate browser recipe.">
                <PeerSdkDemo />
            </Check>
            <Check n={21} title="createUiSlot - configurable block placement"
                   do="Switch Top bar / Sidebar. Then reload the page (F5)."
                   expect="The block moves between the two containers WITHOUT a reload; only one mount point shows it at a time. After F5 the chosen place is restored (memoryGetOrCreate -> memoryCache)."
                   note="Mount points render <Slot place=...> themselves and stay ignorant of each other. The demo calls memoryCache.load() on mount and subscribes memoryCache.onDirty -> saveDebounced(300): the persisted maps are observable and mark memoryCache dirty themselves, the app owns the write policy.">
                <UiSlotDemo />
            </Check>

            <Check n={22} title="createCallbackHub - one slot, many subscribers"
                   do="Note slot bound = false. Click on A (bound becomes true), fire source event, then on B and fire again. Then off A and fire once more."
                   expect="Before the first on() the slot is untouched (lazy bind). With A+B subscribed both receive the same events. After off A, B keeps receiving; hub.count() tracks subscribers."
                   note="Fixes the real bug where two onX(cb) subscribers silently overwrote each other. Built on `listen` from wenay-common2; bind(emit) runs once.">
                <HubDemo />
            </Check>

            <Check n={25} title="createToolbar - customizable toolbar (config / Bar / Settings)"
                   do="Click toolbar items (last action updates). Open the gear popover: toggle Clear workspace on, drag rows to reorder - grab ANYWHERE on the row, mouse or touch, try dragging above the fixed Home too (or focus the handle and press arrow keys), switch density Icons / Icons + labels. Open global settings -> Toolbar section and repeat an edit there. Register the 3rd density and switch to Full text. Uncheck the separated Toolbar settings row at the bottom - the gear (and this popover) disappears from the bar; re-enable it via global settings -> Toolbar. Click simulate app update. Reload the page (F5). In Settings, click the Reset toolbar action button inside its row. Then check the Reset toolbar row, confirm the reset icon appears in the bar, click it, and uncheck the row again."
                   expect="The bar renders visible items in config order; density switches icon-only <-> icon+label (tooltips show titles in icon mode). Home is fixed: checkbox disabled, no drag handle, pinned first - it never moves during a drag preview and a row dragged above it lands right below it, exactly as previewed (no snap-back on drop). The gear popover and the global settings section are THE SAME editor - an edit in one is instantly visible in the other and on the bar. The 3rd density appears in the editor as one more segment and renders icon + full title. The app update appends Help as visible WITHOUT wiping your order/visibility. After F5 everything is restored (memoryGetOrCreate -> memoryCache). onChange fires on every edit with the new config (JSON below); Settings is visible by default, the reset icon is hidden by default, the Reset toolbar row action restores defaults, and that row can hide/show the bar icon."
                   note="Three decoupled layers: serializable config (single source of truth, persisted like createUiSlot), Bar, and a PURE Settings editor over config. Density levels live in an extensible module registry (registerToolbarDensity); reorder is a built-in nearest-slot pointer sort (no dnd deps, layout-agnostic: list / bar / grid) + keyboard arrows; the preview simulates the commit incl. fixed pinning, so what you see is what you drop. v1 has no overflow menu - visibility is the space tool."
                   tall>
                <ToolbarDemo />
            </Check>

            <Check n={26} title="useReorder - drag blocks in a field (mini dnd)"
                   do="Drag blocks around the wrapped field (mouse or touch) - within a row, across rows, to the first/last slot. Click a block without moving. Then enable varied block widths and repeat: rows re-wrap differently, blocks still glide exactly to where they will land."
                   expect="During a drag the grabbed block follows the pointer, the rest GLIDE to their preview slots; on drop everything is already where the preview showed - no snap-back, no jumps. A plain click commits nothing (commits counter unchanged). With varied widths the preview is measured from the real CSS layout (FLIP via the order property), so wrapping changes are previewed exactly too."
                   note="The library's own mini reorder-by-drag (useReorder, extracted from the Toolbar editor): keyed blocks in ANY CSS layout - list, bar, wrapped grid; DOM order never changes mid-drag, targeting runs against START slots (no boundary oscillation), ONE commit on drop. Deliberately not a dnd framework: no nesting, no cross-container moves, no collision packing.">
                <ReorderDemo />
            </Check>

            <Check n={27} title="useReorderBoard - columns, per-column gravity, cross-column drag"
                   do="Drag blocks between columns: from a top-packed (up arrow) into a bottom-packed (down arrow) column, into the EMPTY column, back. Watch the landing gap: in a bottom-packed column the blocks ABOVE the slot slide UP to make room. Drag within one column too. Click a thin + strip BETWEEN columns (or at either edge) - a new column appears exactly there; drag something into it. Watch the events line: over changes, column crossings, drop."
                   expect="The dragged block follows the pointer; the hovered column highlights (r.over); survivors glide to exactly where they land on drop - including the source column compacting per ITS gravity and the target column opening a real gap per ITS gravity. One commit per drop (counter); a plain click commits nothing. onOverChange fires only when the slot changes, onDragEnd reports the final slot and committed flag."
                   note="useReorderBoard - the columns extension of useReorder: column gravity is pure consumer CSS (justify-content), the hook never knows it - it measures the real layout (offset-based FLIP with display:none for the dragged and a real margin gap at the landing slot, so CSS decides who moves aside). Columns register via live callback refs - adding one is just consumer state. Same non-goals: no nesting, no collision packing, no autoscroll."
                   tall>
                <BoardDemo />
            </Check>
            <Check n={35} title="DragBox - imperative delta drag (adapter over useDraggableApi)"
                   do="Drag the blue chip around (mouse or touch), several gestures in a row. Watch the counters while moving."
                   expect="The chip follows the pointer 1:1; releasing commits the position - the next drag continues from where it stopped (no jump-back, no accumulation drift). starts/stops grow by 1 per gesture; renders grows only with starts/stops, NOT per move pixel (the per-tick path is imperative onX/onY over refs)."
                   note="DragBox is now a thin adapter over useDraggableApi (holdMs 0, trackState:false, onMove) - the old bespoke document-listener loop is gone; contract pinned by __test/dragBox.test.tsx. Production consumer: LeftModal sidebar. DragArea deliberately stays as-is (@deprecated: unique semantics - body listeners, stopPropagation per tick, absolute coords).">
                <DragBoxDemo />
            </Check>

            <Check n={31} title="Toolbar over columnState - one config drives toolbar + menu + grid"
                   do="Drag the qty column in the GRID before price - watch the toolbar buttons AND the compact menu reorder. Open the toolbar gear: drag rows in Settings, toggle checkboxes - the grid and the menu follow. Toggle a button in the compact menu - the toolbar Bar drops/regains the item. Switch density in Settings (Icons / Icons + labels)."
                   expect="All four surfaces (grid, toolbar Bar, Settings editor, compact menu) mirror ONE config: any reorder or visibility change made on any of them lands on all others. In icon density, items without an icon show their first letters (NAM, QTY, NOT) as a text pseudo-icon; price keeps its emoji. Density and the gear checkbox are toolbar-local (they do not touch the column config); Name is fixed everywhere - not draggable, not hideable."
                   note="createToolbar({source}) - the toolbar's order/visibility now can live OUTSIDE it: UiListSource is the extracted control contract, and columnState.api.listSource implements it over the same config the grid adapter syncs. No bridge, no double storage - Toolbar became a VIEW. Backward compatible: without source the toolbar keeps its own store exactly as in card 25."
                   tall>
                <ToolbarColumnsDemo />
            </Check>

            <Check n={32} title="createColumnGrid - default grid menu + mobile dots for table/cards"
                   do="Switch table/cards. Use the dots overlay: hide/show/replace fields. DRAG a dot slowly along the track and watch the table/cards: every empty mark it crosses swaps the shown column IMMEDIATELY, and a small label above the finger names the column - this is how you search for a column on a phone. Release anywhere."
                   expect="createColumnGrid inferred column metadata from columnDefs, applied small overrides, took default data/getId at the controller level, and rendered dots as the built-in overlay with no manual max. Dots are not card-only: the same selector drives the table through columnState.grid.attach - LIVE while dragging (show/hide follows the finger, nothing waits for the drop; the drop only settles selection). Width restore stays protected because Table defaults autoSizeColumns=false; this card explicitly enables fit on visible column-count changes."
                   note="This is the reusable wrapper for the card-29/30/31 pattern: one keyed controller, auto ColumnMeta from ag-grid defs, optional overrides/default data, built-in dots overlay, and ready-made representations. Use View for quick table/card switching, or use the returned pieces manually."
                   tall>
                <ColumnGridKitDemo />
            </Check>

            <Check n={30} title="columnState toolbar menu - grouped sub-columns"
                   do="TOP is our menu drawn with a square-edged client skin over the card-25 toolbar config; the old lower ColumnsMenu is intentionally gone. Change menu order in Settings and watch the horizontal tiles glide into place, then click column tiles to toggle grid visibility; switch density in Settings and check that labels expand by content. Click the BLO tile with vertical square dots several times. The grid has a Mode block group with 3 sub-columns: Values has text, Zeros has only 0, Empty has blanks. Enable Reset toolbar in Settings and click its tile."
                   expect="The grouped block changes by dot count without rebuilding grid columnDefs: 1 dot shows Values+Zeros+Empty; 2 dots shows only Values; 3 dots shows Values+Zeros; 4 dots hides the whole group. The top menu has large square-edged content tiles: 1px separators between tiles, comfortable internal padding, dark by default, white border on hover, white fill when pressed/open. When order/density changes elsewhere, existing tiles animate to their new places; the menu itself remains click-only, without drag handles or drag reorder. Label/full densities grow by text content. BLO uses square vertical dots and remains clickable when the whole group is off. Hidden-by-mode sub-columns keep dashed/inert tiles and revive when the mode brings them back. Reset appears as a small-icon tile only when enabled."
                   note="This demonstrates the multi-state layer and replaceable face: the menu uses the standard Toolbar.Bar for structure/order/membership/density while the client fully draws the square-edged item face. The mode tile is not a column; it changes a runtime columnState presentGate over a stable grouped schema. columnState presence marks gated leaf columns disabled; createToolbar({source, sourceMode:'order'}) lets the source own only real-column order, while blockMode position/membership stay local and are never pushed into the grid config."
                   tall>
                <ColumnsMenuDemo />
            </Check>

            <Check n={29} title="columnState mobile - ColumnDots + CardList (dots create the blocks)"
                   do="Tap an EMPTY mark (qty / ver / note) - a dot appears and the field is created in every card below. Drag a dot slowly along the track - every empty mark it crosses replaces the field LIVE in the cards (a small label above the finger names the current field); release anywhere. Swipe a dot UP (quick vertical flick) - the dot tears off, the field disappears. Tap a dot without moving - the field gets selected (blue); press the sort button several times (asc -> desc -> off). Select ANOTHER dot - note the sort did not change. Enable sort by price, then swipe the price dot away - cards stay ordered by price."
                   expect="Dots ARE the visible fields: every dot change instantly rebuilds the cards (no table involved), INCLUDING mid-drag - the swap happens as the dot crosses an empty mark, the drop commits nothing extra. Symbol is fixed (ring): its dot cannot be dragged away or torn off, it is the card title. ver shows as a badge (accent role). The sort is STICKY: it survives selecting other dots AND hiding its own field; the arrow marker above the track shows the sorted column. Max 4 dots: taps on empty marks beyond that are ignored."
                   note="ColumnDots + CardList run on the columnState config alone - no ag-grid, no storage. The same config could drive a desktop grid via grid.attach (card 28). Touch works: gestures are pointer events with a dominant-axis test, so a horizontal drag never removes and a vertical flick never reorders."
                   tall>
                <MobileColumnsDemo />
            </Check>

            <Check n={28} title="columnState - persisted column layout (external layer)"
                   do="Drag the qty column before price, resize it, hide price via the button, click the qty header to sort. Try dragging a column BEFORE the fixed Name too. Then: unmount -> mount the grid."
                   expect="The JSON below mirrors every change (order/visible/width/sort) - the reverse reactivity: whatever the GRID does lands in the config. A column dropped before Name snaps back: Name is fixed and stays first, in the grid AND in the config. After remount the grid restores the exact layout from the in-memory config. sort price cycles asc -> desc -> off and the header arrow follows; sort survives hiding the column (sticky sort)."
                   note="createColumnState: standalone config store + two-way ag-grid adapter attached via onGridReady - agGrid4 itself is untouched. Name is fixed (fixed: true): it cannot be hidden and always stays first. Storage wiring is deliberately NOT here: what to persist will become a library-level setting later, components stay storage-free."
                   tall>
                <ColumnStateDemo />
            </Check>

            <Check n={8} title="Outside-click closing (OutsideClickArea)"
                   do="Click open. Then click ANY place outside the panel, including on the same horizontal line and slightly to the right of the open button, within the panel width where there used to be a dead zone."
                   expect="A click anywhere outside the panel/button closes it, including the area to the right of the button above the panel. Clicking the panel or button does NOT close it."
                   note="Library BUG, this card used to fail on it: Button+outClick wraps in OutsideClickArea, which is a full-width block div, so the entire horizontal strip counts as inside. Here OutsideClickArea uses display:inline-block, and the popup uses position:absolute; otherwise it expands the wrapper rectangle and creates a dead zone to the right of the button. Real library fix: wrap content by default, or let Button narrow the wrapper.">
                <OutsideDemo />
            </Check>
        </>
    );
}

function ArchiveChecks() {
    return (
        <>
            <Check n={1} title="Reactivity updateBy / renderBy"
                   do="Click +1 and renderBy, then +1 WITHOUT renderBy, then renderBy only."
                   expect="+1 and renderBy increases the number. +1 WITHOUT renderBy does NOT change the number on screen. renderBy only shows the accumulated value."
                   note="This is the split between change and notification. After migration to the store, app.set(...) performs both steps at once.">
                <ReactivityDemo />
            </Check>

            <Check n={14} title="Keyboard API - useKeyboard / keyboard"
                   do="Press any key, then click clear."
                   expect="Last key updates through keyboard.on; reset clears the value and also notifies subscribers."
                   note="The new pub/sub is built with `listen`: listen.on(cb) -> off(). The old keyboardState remains compatible.">
                <KeyDownDemo />
            </Check>
            <Check n={2} title="Drag + Resize (FloatingWindow / FloatingWindow)"
                   do="Click window, drag the window by its header, resize it from the edges, and close it with the x button. Open the console (F12)."
                   expect="The window moves and resizes smoothly; the x button closes it; position and size are restored on reopen (keyForSave)."
                   note="Plan bug: the console must NOT contain xxx spam (FloatingWindow:532); listener resubscription on every tick is a candidate for usePointerDrag."
                   tall>
                <Button button={(e: any) => <div style={{ display: "inline-block", padding: "6px 12px", border: "1px solid #0969da", borderRadius: 6, cursor: "pointer", background: e ? "#0969da" : "#fff", color: e ? "#fff" : "#0969da" }}>window</div>}>
                    {(api: any) => (
                        <FloatingWindow keyForSave={"qa-rnd"} key={"qa-rnd"} size={{ height: 220, width: 280 }}
                                 className={"fon border fonLight"} moveOnlyHeader={true} onCLickClose={api.onClose} limit={{ y: { min: 0 } }} onUpdate={() => {}}>
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#eef2f6" }}>drag header / resize / close</div>
                        </FloatingWindow>
                    )}
                </Button>
            </Check>

            <Check n={3} title="Nested menu (Menu) + hover"
                   do="Hover menu, then move the cursor to the item with ▶ and into its submenu."
                   expect="The menu opens ONLY when hovering the menu trigger itself, not the full row width."
                   note="Library BUG confirmed: HoverButton wraps in a <div> with no width, so it becomes a full-row block, unlike ButtonBase (width:min-content). This board wraps it with width:min-content as a workaround; add width:min-content to HoverButton in the library.">
                <div style={{ width: "min-content" }}>
                    <HoverButton button={() => <div style={{ display: "inline-block", padding: "6px 12px", border: "1px solid #888", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}>menu</div>}>
                        <Menu zIndex={50} coordinate={{ x: 0, y: 0 }} data={[
                            { name: "item 1", onClick: () => alert("item 1") },
                            { name: "submenu ▶", next: () => [{ name: "leaf A", onClick: () => alert("A") }, { name: "leaf B", onClick: () => alert("B") }] },
                        ]} />
                    </HoverButton>
                </div>
            </Check>

            <Check n={5} title="Grid + transactions (applyGridRows)"
                   do="update Tesla uses a random price and updates by ID. Then remove Tesla should make the row disappear."
                   expect="Update by ID without duplicates. remove Tesla removes the row. ✅ Remove-only updates used to be lost, leaving the row in place."
                   note="Fix: applyGridRows applies remove once, INDEPENDENTLY of add/update. Previously remove was lost when add/update were empty, and duplicated when both were present."
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

            <Check n={7} title="Parameters (ParamsEditor / ParamsEditor)"
                   do="Move sliders and fields. The test3 field has a name and a hover comment."
                   expect="The value changes in the UI while editing; range/number stay in sync; commentary appears on hover."
                   note="Plan bugs: ParamsArrayEdit loses edits (Other.tsx); broken debounce and missing ResizeObserver cleanup in ParamsEditor."
                   tall>
                <div style={{ minHeight: 260 }}><TestParams /></div>
            </Check>

            <Check n={19} title="Parameters - resize observer shrink repro"
                   do="Click rerender many times and change the asset select. Then click parent 150/240px, or narrow the blue wrapper in DevTools."
                   expect="The red auto-width select does not ratchet down. The blue fixed-parent select gets narrower when the parent is 150px and grows back when the parent is 240px."
                   note="This is the setResizeableElement repro: repeated ref/ResizeObserver runs must keep the natural width and avoid feedback in shrink-to-content containers."
                   tall>
                <ResizeBugRepro />
            </Check>
            <Check n={12} title="agGrid4 - controller, removal, external buffer"
                   do="add/update Tesla and Apple should make rows appear/update. remove Tesla should remove it. Then: unmount grid -> write MSFT directly to the buffer -> mount grid."
                   expect="Updates by ID have no duplicates; removal works. After remount, the grid catches up with the buffer itself: Tesla/Apple are still present, MSFT appears (attach->sync). Theme is dark, like production grids (GridStyleDefault)."
                   note="Controller path over createGridBuffer; the old transaction helper names were removed. The createGridBuffer core also works outside React."
                   tall>
                <AgGrid4Demo />
            </Check>

            <Check n={15} title="agGrid4 - overlay rowData"
                   do="Click stream C before rowData. C must not appear. Then add C to rowData: C appears and receives the buffered stream price. Stream A updates A only."
                   expect="Overlay sync updates only rowData-owned rows, never adds stream-only rows and never removes rowData rows."
                   note="This covers selectHistory/portfolio/symbol tables where React state owns the row set."
                   tall>
                <AgGrid4OverlayDemo />
            </Check>

            <Check n={16} title="agGrid4 - dynamic column buffer"
                   do="Switch alpha / alpha+beta / gamma+alpha / clear. Reloading the stand should keep the component API path clean; detach itself does not clear names."
                   expect="The explicit dynamic group shows exactly the selected columns, deduped and in order. Base columns remain intact."
                   note="This covers dynamic add/remove columns without any business-specific default in the shared utility."
                   tall>
                <AgGrid4ColumnBufferDemo />
            </Check>

            <Check n={4} title="Right-click context menu (contextMenu)"
                   do="Right-click the gray area to open the menu. Then right-click somewhere ELSE."
                   expect="Right-clicking elsewhere closes the previous menu and opens a new one with items. ✅ Fixed."
                   note="Fix: menuR stores an item snapshot on open + menuMouse onConsume. Menu items now use explicit actionKey for local action stats."
                   tall>
                <contextMenu.Layer zIndex={40}>
                    <div style={{ width: "100%", height: 300, background: "#e7ebef", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#57606a" }}
                         onContextMenu={(e) => contextMenu.openAt(e, [
                             { name: "action 1", actionKey: "qa4.action1", onClick: () => alert("action 1") },
                             { name: "submenu ▶", actionKey: "qa4.submenu", next: () => [{ name: "nested", actionKey: "qa4.nested", onClick: () => alert("nested") }] },
                         ])}>right-click here</div>
                </contextMenu.Layer>
            </Check>

            <Check n={9} title="Logs - time format + MiniLogs layers"
                   do="Click add log several times, watch the corner notification layer, then click a row in the compact MiniLogs table."
                   expect="PageLogs and MiniLogs show time in hh:mm:ss format; a temporary notification appears in the card corner; MiniLogs row click updates the small click label."
                   note="This card mounts logsApi.React.Message; that compatibility wrapper now uses useMessageEventLogsController -> MessageEventLogsView. The newer context LogsNotifications remains a separate LogsProvider-based surface. MiniLogs is hook/controller-first: useMiniLogsTable -> MiniLogsView/MiniLogsTable -> compatibility MiniLogs."
                   tall>
                <LogsDemo />
            </Check>

            <Check n={10} title="ParamsArrayEdit vs ParamsEdit - what is sent to onSave"
                   do="Change the value in EACH column (test/test2), then click save. Compare what was sent to onSave and the console (F12)."
                   expect="BOTH save the CHANGED value (ParamsArrayEdit matches ParamsEdit). ✅ Fixed (regression check)."
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
/* ---------- 38/39. Media sources: common2 capture + viewer helpers ---------- */
const MediaVideoDemo = () => {
    const media = useMediaSource("video", {fps: 12, replay: {history: 32, current: "last"}});
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [stats, setStats] = useState({frames: 0, drawn: 0, perSec: 0, ageMs: 0});
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const view = Media.attachVideoCanvas(media.listen, canvas, {onError: e => setError(String(e))});
        const timer = window.setInterval(() => setStats(view.stats()), 500);
        return () => { window.clearInterval(timer); view.off(); };
    }, [media.listen]);
    return <div style={{display: "grid", gap: 8}}>
        <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
            <button onClick={() => void media.start()}>start camera</button>
            <button onClick={media.stop}>stop</button>
            <b>state: {media.state}</b>
            <span style={{fontSize: 12}}>drawn {stats.drawn}, {stats.perSec}/s, age {Math.round(stats.ageMs)}ms</span>
        </div>
        {error && <div style={{color: "#cf222e"}}>viewer error: {error}</div>}
        <canvas ref={canvasRef} width={320} height={180} style={{width: 320, height: 180, background: "#111", borderRadius: 8}} />
    </div>;
};

const MediaAudioDemo = () => {
    const media = useMediaSource("audio", {mode: "pcm", bufferSize: 4096, replay: {history: 64, current: "last"}});
    const playerRef = useRef<ReturnType<typeof Media.attachAudioPlayer> | null>(null);
    const [stats, setStats] = useState({frames: 0, played: 0, dropped: 0, perSec: 0, ageMs: 0});
    useEffect(() => {
        const player = Media.attachAudioPlayer(media.listen, {maxBacklogSec: .35});
        playerRef.current = player;
        const timer = window.setInterval(() => setStats(player.stats()), 500);
        return () => { window.clearInterval(timer); player.off(); playerRef.current = null; };
    }, [media.listen]);
    return <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
        <button onClick={() => { playerRef.current?.enable(); void media.start(); }}>enable + start mic</button>
        <button onClick={media.stop}>stop</button>
        <b>state: {media.state}</b>
        <span style={{fontSize: 12}}>played {stats.played}, dropped {stats.dropped}, {stats.perSec}/s</span>
    </div>;
};
/* ---------- 40. Peer SDK: in-process mirrored store ---------- */
const PeerSdkDemo = () => {
    const pair = useMemo(() => {
        const host = Peer.createPeerHost();
        const a = Peer.createPeerClient<{value: number}>({remote: host.connection("qa-peer-a").fragment, account: "qa-peer-a", initial: {value: 0}});
        const b = Peer.createPeerClient<{value: number}>({remote: host.connection("qa-peer-b").fragment, account: "qa-peer-b", initial: {value: 0}});
        return {host, a, b};
    }, []);
    useEffect(() => () => { pair.a.close(); pair.b.close(); }, [pair]);
    const remote = usePeer(pair.b, "qa-peer-a");
    const value = useStoreNode(remote.store.node.value);
    return <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
        <button onClick={() => { pair.a.store.state.value += 1; }}>peer A +1</button>
        <button onClick={() => void remote.resync()}>resync B</button>
        <b>mirrored value: {value.value}</b>
        <span style={{fontSize: 12}}>ready={String(remote.ready)} route={remote.route} state={remote.state} seq={remote.seq()}</span>
    </div>;
};