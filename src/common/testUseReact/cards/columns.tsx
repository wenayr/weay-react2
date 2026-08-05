import React, { useState, useRef, useLayoutEffect, useEffect } from "react";
import { createColumnState, createColumnGrid, createToolbar, ColumnsMenu, ColumnDots, CardList, AgGridTable, contextMenu, renderBy, updateBy } from "../../api";
import type { ColDef, ColGroupDef } from "ag-grid-community";
import { FloatingWindow } from "../../src/components";
import { OutsideClickArea } from "../../src/hooks";
import { Check, ShowcasePanel, ExampleCode, DemoHint, btn } from "../standKit";


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
        <CardList<tMobRow> state={qaMobColumns} data={mobRows} getId={r => r.id} layout="compact" className="qa29MobileCards" />
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
                            portal={false}
                            keyForSave="qa30.menuSettingsWin"
                            position={{ x: 0, y: 44 }}
                            size={{ width: 300, height: 320 }}
                            zIndex={40}
                            header={<span style={{ padding: "0 10px", fontSize: 12, lineHeight: "26px", color: "#cdd6e4" }}>Настройки меню</span>}
                            onClickClose={() => setWin(false)}
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


/* ---------- 47. Grid Chrome: one compact command surface over createColumnGrid ---------- */
const gridChromeLooks = [
    {key: "paper", name: "Панель", note: "светлая, спокойная"},
    {key: "palette", name: "Палитра", note: "тёмная, контрастная"},
    {key: "compact", name: "Компакт", note: "плотная, рабочая"},
    {key: "sections", name: "Секции", note: "явно сгруппированная"},
] as const;

const GridChromeDemo = () => {
    const [last, setLast] = useState("Откройте ⋮ или нажмите правой кнопкой по строке");
    const [mounted, setMounted] = useState(true);
    const [look, setLook] = useState<typeof gridChromeLooks[number]["key"]>("paper");
    const [grid] = useState(() => createColumnGrid<tTbColRow>({
        key: "qa47.gridChrome",
        columnDefs: tbColDefs,
        data: tbColRows,
        getId: row => row.id,
        columns: [
            {key: "name", title: "Name", fixed: true},
            {key: "price", title: "Price"},
            {key: "qty", title: "Quantity", short: "qty"},
            {key: "note", title: "Note", short: "note"},
        ],
        chrome: {
            commandGroups: [
                {key: "columns", label: "Колонки", collapsible: true, defaultOpen: true},
                {key: "table", label: "Команды приложения", collapsible: true, defaultOpen: false},
            ],
            copy({rows}) {
                setLast(rows.length ? `Скопированы строки: ${rows.map(row => row.name).join(", ")}` : "Сначала выберите строку");
            },
            saveColumns({columnState}) {
                setLast(`Сохранена раскладка: ${columnState?.api.visibleKeys().join(", ") ?? "—"}`);
            },
            contextItems(event) {
                return [{
                    name: "Показать строку",
                    actionKey: "qa47.inspect-row",
                    onClick: () => setLast(`Строка: ${event.node?.data?.name ?? "—"}`),
                }];
            },
            commands: [{
                key: "refresh", group: "table", name: "Обновить данные", title: "Имитировать обновление таблицы",
                run: () => setLast(`Таблица обновлена в ${new Date().toLocaleTimeString()}`),
            }],
        },
    }));
    useEffect(() => () => grid.dispose(), [grid]);
    const Chrome = grid.Chrome;
    const Table = grid.Table;

    return <div className="wenayQaShowcaseGrid">
        <ShowcasePanel eyebrow="LIVE EXAMPLE" title="Список сделок без вечной полосы кнопок" tone="violet">
        <DemoHint>Выберите вид меню, затем наведите на шапку и откройте ⋮. Все варианты используют одну и ту же реальную командную поверхность.</DemoHint>
        <div className="wenayQaChromeLookPicker" role="group" aria-label="Вариант Grid Chrome">
            {gridChromeLooks.map(option => <button key={option.key} type="button"
                className={look == option.key ? "wenayQaChromeLook_active" : undefined}
                aria-pressed={look == option.key} onClick={() => setLook(option.key)}>
                <b>{option.name}</b><small>{option.note}</small>
            </button>)}
        </div>
        <div className="wenayQaGridDemo">
        <div className="wenayGridChromeArea wenayQaGridHeader">
            <div style={{minWidth: 0}}>
                <b>Сделки</b><span style={{marginLeft: 8, opacity: .7, fontSize: 12}}>4 колонки · 3 строки</span>
            </div>
            <Chrome className={`wenayGridChrome_preview_${look}`} />
        </div>
        <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12}}>
            <button onClick={() => setMounted(value => !value)}>{mounted ? "Перемонтировать grid" : "Подключить grid"}</button>
            <span aria-live="polite">{last}</span>
        </div>
        <contextMenu.Layer zIndex={120}>
            <div style={{height: 210}}>
                {mounted
                    ? <Table rowData={tbColRows} getRowId={params => params.data.id} />
                    : <div style={{height: "100%", display: "grid", placeItems: "center", color: "#57606a", border: "1px dashed #8c959f"}}>Grid отключён; Chrome сохраняет только своё UI-состояние.</div>}
            </div>
        </contextMenu.Layer>
        </div>
        <div className="wenayQaPills"><span>Колонки</span><span>Размер</span><span>Данные</span><span>Команды приложения</span><span>Выбран вид: {gridChromeLooks.find(option => option.key == look)?.name}</span></div>
        </ShowcasePanel>
        <ShowcasePanel eyebrow="CONNECT IT" title="Подключение — один существующий column state" tone="blue">
            <ExampleCode>{`
const grid = createColumnGrid<Order>({
  key: "orders", columnDefs,
  chrome: {
    copy: ({rows}) => copyOrders(rows),
    saveColumns: ({columnState}) => saveLayout(columnState),
    contextItems: appRowMenu,
    commandGroups: [
      {key: "columns", collapsible: true},
      {key: "table", label: "Действия", collapsible: true},
    ],
    commands: [{key: "refresh", group: "table", name: "Обновить", run}],
  },
})

<header className="wenayGridChromeArea">
  <h2>Сделки</h2><grid.Chrome />
</header>
<grid.Table rowData={rows} />`}</ExampleCode>
            <div className="wenayQaMiniChecklist">
                <span>✓ Никакого второго column state</span>
                <span>✓ Copy остаётся доменной функцией приложения</span>
                <span>✓ App context menu дополняется, а не заменяется</span>
            </div>
        </ShowcasePanel>
    </div>;
};



/* ---------- card wrappers ---------- */

export function Card31() {
    return (
    <Check n={31} title="Toolbar over columnState - one config drives toolbar + menu + grid"
                       do="Drag the qty column in the GRID before price and HOLD it over the target - toolbar buttons and compact menu must preview the same order BEFORE drop. Open the toolbar gear: drag rows in Settings, toggle checkboxes - the grid and the menu follow. Toggle a button in the compact menu - the toolbar Bar drops/regains the item. Switch density in Settings (Icons / Icons + labels)."
                       expect="All four surfaces (grid, toolbar Bar, Settings editor, compact menu) mirror ONE config: any reorder or visibility change made on any of them lands on all others. In icon density, items without an icon show their first letters (NAM, QTY, NOT) as a text pseudo-icon; price keeps its emoji. Density and the gear checkbox are toolbar-local (they do not touch the column config); Name is fixed everywhere - not draggable, not hideable."
                       note="createToolbar({source}) - the toolbar's order/visibility now can live OUTSIDE it: UiListSource is the extracted control contract, and columnState.api.listSource implements it over the same config the grid adapter syncs. No bridge, no double storage - Toolbar became a VIEW. Backward compatible: without source the toolbar keeps its own store exactly as in card 25."
                       tall>
                    <ToolbarColumnsDemo />
                </Check>
    );
}

export function Card32() {
    return (
    <Check n={32} title="createColumnGrid - default grid menu + mobile dots for table/cards"
                       do="Switch table/cards. Use the dots overlay: hide/show/replace fields. DRAG a dot slowly along the track and watch the table/cards: every empty mark it crosses swaps the shown column IMMEDIATELY, and a small label above the finger names the column - this is how you search for a column on a phone. Release anywhere."
                       expect="createColumnGrid inferred column metadata from columnDefs, applied small overrides, took default data/getId at the controller level, and rendered dots as the built-in overlay with no manual max. Dots are not card-only: the same selector drives the table through columnState.grid.attach - LIVE while dragging (show/hide follows the finger, nothing waits for the drop; the drop only settles selection). Width restore stays protected because Table defaults autoSizeColumns=false; this card explicitly enables fit on visible column-count changes."
                       note="This is the reusable wrapper for the card-29/30/31 pattern: one keyed controller, auto ColumnMeta from ag-grid defs, optional overrides/default data, built-in dots overlay, and ready-made representations. Use View for quick table/card switching, or use the returned pieces manually."
                       tall>
                    <ColumnGridKitDemo />
                </Check>
    );
}

export function Card47() {
    return (
    <Check id="grid-chrome" n={47} title="Grid Chrome — compact table commands"
                       do="Hover the dark header, then open ⋮ with mouse or keyboard. Collapse and reopen «Колонки», then check grouped Size / Data / Table actions. Select a row and copy it; right-click another row and use both the app item and ‘Копировать строки’. Press Escape or click outside the popover. Use remount grid, then open the menu again. On a narrow/coarse screen the ⋮ trigger remains visible and touch-sized."
                       expect="The header reserves a stable slot: desktop trigger fades in on header hover/focus without shifting columns; touch keeps a 44px target. The popover stays usable while pointer/focus is inside, closes on Escape/outside/one-shot commands, and ColumnsMenu edits the same persisted column state. A one-shot command leaves a short status toast. Right-click makes the clicked row the sole selection, then composes ‘Показать строку’ and ‘Копировать строки’; no permanent copy button or Ctrl/Cmd+C listener is required. After remount, exactly one current Grid API is attached."
                       note="This is the required live integration card for createGridChrome/createColumnGrid({chrome}). The dark header is app skin only; Grid Chrome itself ships neutral .wenayGridChrome* classes and --grid-chrome-* variables.">
                    <GridChromeDemo />
                </Check>
    );
}

export function Card30() {
    return (
    <Check n={30} title="columnState toolbar menu - grouped sub-columns"
                       do="TOP is our menu drawn with a square-edged client skin over the card-25 toolbar config; the old lower ColumnsMenu is intentionally gone. Drag menu order in Settings and HOLD before drop: the grid and horizontal tiles must preview the same order live, then click column tiles to toggle grid visibility; switch density in Settings and check that labels expand by content. Click the BLO tile with vertical square dots several times. The grid has a Mode block group with 3 sub-columns: Values has text, Zeros has only 0, Empty has blanks. Enable Reset toolbar in Settings and click its tile."
                       expect="The grouped block changes by dot count without rebuilding grid columnDefs: 1 dot shows Values+Zeros+Empty; 2 dots shows only Values; 3 dots shows Values+Zeros; 4 dots hides the whole group. The top menu has large square-edged content tiles: 1px separators between tiles, comfortable internal padding, dark by default, white border on hover, white fill when pressed/open. When order/density changes elsewhere, existing tiles animate to their new places; the menu itself remains click-only, without drag handles or drag reorder. Label/full densities grow by text content. BLO uses square vertical dots and remains clickable when the whole group is off. Hidden-by-mode sub-columns keep dashed/inert tiles and revive when the mode brings them back. Reset appears as a small-icon tile only when enabled."
                       note="This demonstrates the multi-state layer and replaceable face: the menu uses the standard Toolbar.Bar for structure/order/membership/density while the client fully draws the square-edged item face. The mode tile is not a column; it changes a runtime columnState presentGate over a stable grouped schema. columnState presence marks gated leaf columns disabled; createToolbar({source, sourceMode:'order'}) lets the source own only real-column order, while blockMode position/membership stay local and are never pushed into the grid config."
                       tall>
                    <ColumnsMenuDemo />
                </Check>
    );
}

export function Card29() {
    return (
    <Check n={29} title="columnState mobile - ColumnDots + CardList (dots create the blocks)"
                       do="Tap an EMPTY mark (qty / ver / note) - a dot appears and the field is created in every card below. Drag a dot slowly along the track - every empty mark it crosses replaces the field LIVE in the cards (a small label above the finger names the current field); release anywhere. Swipe a dot UP (quick vertical flick) - the dot tears off, the field disappears. Tap a dot without moving - the field gets selected (blue); press the sort button several times (asc -> desc -> off). Select ANOTHER dot - note the sort did not change. Enable sort by price, then swipe the price dot away - cards stay ordered by price."
                       expect="Dots ARE the visible fields: every dot change instantly rebuilds the cards (no table involved), INCLUDING mid-drag - the swap happens as the dot crosses an empty mark, the drop commits nothing extra. Symbol is fixed (ring): its dot cannot be dragged away or torn off, it is the card title. ver shows as a badge (accent role). The sort is STICKY: it survives selecting other dots AND hiding its own field; the arrow marker above the track shows the sorted column. max=8 here equals the column count, so the dot cap never bites in this demo."
                       note="ColumnDots + CardList run on the columnState config alone; this stand uses optional layout=compact (two-column key/value fields, one column below 320px) - no ag-grid, no storage. The same config could drive a desktop grid via grid.attach (card 28). Touch works: gestures are pointer events with a dominant-axis test, so a horizontal drag never removes and a vertical flick never reorders."
                       tall>
                    <MobileColumnsDemo />
                </Check>
    );
}

export function Card28() {
    return (
    <Check n={28} title="columnState - persisted column layout (external layer)"
                       do="Drag the qty column before price, resize it, hide price via the button, click the qty header to sort. Try dragging a column BEFORE the fixed Name too. Then: unmount -> mount the grid."
                       expect="The JSON below mirrors every change (order/visible/width/sort) - the reverse reactivity: whatever the GRID does lands in the config. A column dropped before Name snaps back: Name is fixed and stays first, in the grid AND in the config. After remount the grid restores the exact layout from the in-memory config. sort price cycles asc -> desc -> off and the header arrow follows; sort survives hiding the column (sticky sort)."
                       note="createColumnState: standalone config store + two-way ag-grid adapter attached via onGridReady - agGrid4 itself is untouched. Name is fixed (fixed: true): it cannot be hidden and always stays first. Storage wiring is deliberately NOT here: what to persist will become a library-level setting later, components stay storage-free."
                       tall>
                    <ColumnStateDemo />
                </Check>
    );
}
