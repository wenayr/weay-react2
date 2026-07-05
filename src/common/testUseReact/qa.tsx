/* qa.tsx - ONE board for manual library checks.
 *
 * Run:  npm run testReact -- --host 127.0.0.1 --port 3002
 * Each card: a live element + what to do + what is expected.
 * Use the ✓/✗ buttons to mark results as you go. These are also the acceptance criteria for changes from REFACTOR_PLAN.md.
 */

import React, { useState, useMemo, useEffect } from "react";
import { MenuBase, mouseMenuApi, renderBy, updateBy, logsApi, EditParams2, EditParams3, ParametersReact, ModalProvider, useModal, useKeyDown, keyDownApi, useAgGrid, AgGridMy, createGridBuffer, createColumnBuffer, useStoreMirror, useStoreNode, useStoreKeys, useStoreSelect, useStoreChangedPaths, useListenEffect, useListenArgs, useListenValue, SettingsDialog, registerSettingsSection, createUiSlot, createCallbackHub, Cash, type BufferTable } from "../api";
import type { ColDef, ColGroupDef } from "ag-grid-community";
import { ListenNext, ObserveAll2, Params } from "wenay-common2";
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
                <AgGridMy<tOverlayRow>
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
                <AgGridMy<tDynamicRow>
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


/* ---------- 18. ObserveAll2 local store/listen hooks ---------- */
type tObserveLocalState = {
    count: number;
    meta: { status: string };
    items: Record<string, number>;
};

const observeLocalMask = { count: true, meta: { status: true }, items: { a: true } } as const;

const ObserveStoreLocalDemo = () => {
    const store = useMemo(() => ObserveAll2.createStore<tObserveLocalState>({
        count: 0,
        meta: { status: "idle" },
        items: { a: 1, b: 2 },
    }), []);
    const count = useStoreNode<number>(store.node.at("count"));
    const status = useStoreNode(store.node.meta.status);
    const itemKeys = useStoreKeys(store.node.items);
    const selection = useStoreSelect(useMemo(() => store.update(observeLocalMask), [store]), { drain: "micro" });
    const [emit, listen] = useMemo(() => ListenNext.UseListen<[number, string]>(), []);
    const listenArgs = useListenArgs(listen, { initial: [0, "initial"] });
    const listenValue = useListenValue<number, [number, string]>(listen, { initial: 0, map: (n) => n });

    function mutatePlainState() {
        store.state.meta.status = "plain " + new Date().toLocaleTimeString();
        void ObserveAll2.flushReactive(store.state);
    }

    return <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => count.replace((count.value ?? 0) + 1)}>node.at("count") +1</button>
            <button onClick={() => status.replace("replace " + new Date().toLocaleTimeString())}>replace status</button>
            <button onClick={() => { store.state.items.c = Date.now(); void ObserveAll2.flushReactive(store.state); }}>add key c</button>
            <button onClick={() => { delete store.state.items.b; void ObserveAll2.flushReactive(store.state); }}>delete key b</button>
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
/* ---------- 17. ObserveAll2 store mirror hooks over HTTP/SSE ---------- */
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
    const autoRef = React.useRef<HTMLDivElement>(null);
    const fixedRef = React.useRef<HTMLDivElement>(null);

    const onChange = (params: ReturnType<typeof makeResizeParams>) => {
        setAsset(params.asset.value);
        setN(v => v + 1);
    };

    React.useLayoutEffect(() => {
        const readWidths = () => {
            const autoSelect = autoRef.current?.querySelector("select");
            const fixedSelect = fixedRef.current?.querySelector("select");
            setAutoWidth(Math.round(autoSelect?.getBoundingClientRect().width ?? 0));
            setFixedSelectWidth(Math.round(fixedSelect?.getBoundingClientRect().width ?? 0));
        };
        readWidths();
        const id = requestAnimationFrame(readWidths);
        const observer = typeof ResizeObserver != "undefined" ? new ResizeObserver(readWidths) : null;
        if (autoRef.current) observer?.observe(autoRef.current);
        if (fixedRef.current) observer?.observe(fixedRef.current);
        return () => {
            cancelAnimationFrame(id);
            observer?.disconnect();
        };
    }, [n, asset, fixedWidth]);

    const selectInfo: React.CSSProperties = { fontSize: 12, color: "#57606a", marginTop: 6 };

    return <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
                <div ref={autoRef} style={{ display: "inline-flex", flexDirection: "column", alignItems: "stretch", border: "1px solid #cf222e", padding: 6 }}>
                    <ParametersReact params={makeResizeParams(asset)} onChange={onChange}/>
                    <button onClick={() => setN(v => v + 1)}>rerender {n}</button>
                </div>
                <div style={selectInfo}>auto-width select: <b>{autoWidth}px</b></div>
            </div>
            <div>
                <div ref={fixedRef} style={{ width: fixedWidth, minWidth: 90, maxWidth: 300, resize: "horizontal", overflow: "auto", border: "1px solid #0969da", padding: 6 }}>
                    <ParametersReact params={makeResizeParams(asset)} onChange={onChange}/>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    <button onClick={() => setFixedWidth(w => w == 150 ? 240 : 150)}>parent {fixedWidth}px</button>
                    <button onClick={() => setN(v => v + 1)}>rerender</button>
                </div>
                <div style={selectInfo}>fixed-parent select: <b>{fixedSelectWidth}px</b></div>
            </div>
        </div>
        <div style={{ fontSize: 13 }}>selected asset: <b>{asset}</b></div>
    </div>;
};
/* ---------- 20. SettingsDialog + section registry ---------- */
const dlgBody: React.CSSProperties = { fontSize: 13, lineHeight: 1.6 };
const dlgStaticSections = [
    { key: "general", name: "General", render: () => <div style={dlgBody}><b>General</b><div>Static section passed via the sections prop.</div></div> },
    { key: "display", name: "Display", render: () => <div style={dlgBody}><b>Display</b><div>Second static section. Long content to test scrolling:</div>{Array.from({ length: 30 }, (_, i) => <div key={i}>line {i + 1}</div>)}</div> },
];

// Any module: register on mount, the returned unregister runs on unmount.
const ExternalSectionModule = () => {
    useEffect(() => registerSettingsSection({
        key: "external",
        name: "External",
        render: () => <div style={dlgBody}><b>External</b><div>Registered by a module on mount and removed on unmount.</div></div>,
    }), []);
    return <span style={{ padding: "2px 8px", background: "#dafbe1", borderRadius: 6, fontSize: 12 }}>external module mounted</span>;
};

const SettingsDialogDemo = () => {
    const [mounted, setMounted] = useState(true);
    return <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <SettingsDialog
            trigger={<span style={{ display: "inline-block", padding: "6px 12px", border: "1px solid #0969da", borderRadius: 6, color: "#0969da" }}>open settings</span>}
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
    // App-side persistence contract: Cash.load() on start, then subscribe to the dirty
    // channel - the lib marks dirty on real user changes, the app owns the write policy.
    useEffect(() => {
        void Cash.load();
        const off = Cash.onDirty(() => Cash.saveDebounced(300));
        return off;
    }, []);
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
                   note="New path instead of applyTransactionAsyncUpdate (v1 is marked @deprecated). The createGridBuffer core also works outside React."
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
            <Check n={18} title="ObserveAll2 hooks - local store and listen"
                   do="Click node.at(count) +1, replace status, plain state mutation + flush, emit listen, and replace whole store."
                   expect="Leaf node, selection, direct state mutation after flush, add/delete object keys, and listen hooks all rerender. The count key is read through node.at(count), so it does not conflict with node.count()."
                   note="This isolates the React adapter from transport: no fetch/SSE/RPC involved."
                   tall>
                <ObserveStoreLocalDemo />
            </Check>
            <Check n={17} title="ObserveAll2 hooks - store mirror over HTTP/SSE"
                   do="Click server +1, label, add/delete key, deep leaf/deep add/deep delete, local mirror +1000, stop sync, then manual sync."
                   expect="Server buttons POST to the Vite QA server, including add/delete object keys and deep mutations. SSE pushes changedPaths; mirror pulls only the intersecting mask when possible. Local mirror edits render immediately and are overwritten by the next server sync."
                   note="This checks the React adapter only in wenay-react2: common2 remains React-free; transport policy stays outside the hook."
                   tall>
                <ObserveStoreMirrorDemo />
            </Check>
            <Check n={13} title="ModalProvider / useModal - Escape and outside click"
                   do="Click open modal. Close it with Escape. Open it again and close with an outside click. Open it again and close with the close button."
                   expect="All three methods close it. The dimmed backdrop is above everything (z-index from token --wenay-z-modal)."
                   note="M1: Escape and closeOnEscape/closeOnOutsideClick options were added; useModal and previous behavior are unchanged. GetModalJSX is marked @deprecated.">
                <ModalDemo />
            </Check>

            <Check n={20} title="SettingsDialog - centered dialog + section registry"
                   do="Click open settings: switch sections on the left, scroll Display, close via the x, the scrim, and Escape. Then unmount external module and open the dialog again."
                   expect="The dialog is centered with a scrim; the active section is highlighted; content switches. The External section is present while the module is mounted and disappears after unmount (falls back to the first section if it was active)."
                   note="Registry is a module singleton (registerSettingsSection -> unregister), no React context. Look via --dlg-* tokens; apps pass their own section classes via sectionClassName/sectionActiveClassName.">
                <SettingsDialogDemo />
            </Check>

            <Check n={21} title="createUiSlot - configurable block placement"
                   do="Switch Top bar / Sidebar. Then reload the page (F5)."
                   expect="The block moves between the two containers WITHOUT a reload; only one mount point shows it at a time. After F5 the chosen place is restored (staticGetAdd -> Cash)."
                   note="Mount points render <Slot place=...> themselves and stay ignorant of each other. The demo calls Cash.load() on mount and subscribes Cash.onDirty -> saveDebounced(300): the lib only marks dirty on setPlace, the app owns the write policy.">
                <UiSlotDemo />
            </Check>

            <Check n={22} title="createCallbackHub - one slot, many subscribers"
                   do="Note slot bound = false. Click on A (bound becomes true), fire source event, then on B and fire again. Then off A and fire once more."
                   expect="Before the first on() the slot is untouched (lazy bind). With A+B subscribed both receive the same events. After off A, B keeps receiving; hub.count() tracks subscribers."
                   note="Fixes the real bug where two onX(cb) subscribers silently overwrote each other. Built on UseListen from wenay-common2; bind(emit) runs once.">
                <HubDemo />
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
