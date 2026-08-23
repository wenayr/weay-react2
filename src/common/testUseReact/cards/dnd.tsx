import React, { useState, useRef, useEffect } from "react";
import { useReorder, useReorderBoard, renderBy, updateBy, useCacheMapPersistence, memoryCache, type BoardColumn } from "../../api.js";
import { Button } from "../../src/hooks/index.js";
import { FloatingWindow, FloatingWindowTaskbar, WindowPortal, type FloatingWindowMode, type FloatingWindowSnapRegion } from "../../src/components/index.js";
import { DragBox } from "../../src/components/Dnd/FloatingWindow.js";
import { Check } from "../standKit.js";


/* ---------- 52. FloatingWindow viewport layer + window stacking ---------- */
const stackWindowBody: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    padding: 16,
    boxSizing: "border-box",
    overflow: "hidden",
    color: "#f8fafc",
    fontSize: 13,
};

const stackWindowHeader: React.CSSProperties = {
    height: 34,
    display: "flex",
    alignItems: "center",
    padding: "0 14px",
    boxSizing: "border-box",
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: 750,
    letterSpacing: ".02em",
};

function WindowABody() {
    const [popupOpen, setPopupOpen] = useState(false);
    const [nestedOpen, setNestedOpen] = useState(false);
    return <div style={{...stackWindowBody, background: "#991b1b"}}>
        <b>A starts below B.</b>
        <div>Click any visible part of A to raise its complete layer.</div>
        <div style={{display: "flex", gap: 6, marginTop: 8}}>
            <button onClick={() => setPopupOpen(value => !value)}>toggle A popup</button>
            <button onClick={() => setNestedOpen(value => !value)}>toggle A child window</button>
        </div>
        {popupOpen && <WindowPortal style={{left: 150, top: 72}}>
            <div style={{padding: 10, color: "#172554", background: "#dbeafe", border: "1px solid #60a5fa", borderRadius: 7, boxShadow: "0 8px 24px rgba(0,0,0,.3)"}}>
                A scoped popup: it rises and falls together with A
            </div>
        </WindowPortal>}
        {/* A window opened from inside A (clientBacktest: "user strategies" -> "history"/"remote"): a
            React child of A that portals to body. It must open above A and stay above A while its
            content is pressed, although its React events still bubble through A. */}
        {nestedOpen && <FloatingWindow
            windowId="qa-window-a-child"
            stackGroup="qa-desktop"
            taskbarLabel="A child window"
            position={{x: 120, y: 90}}
            size={{width: 300, height: 170}}
            moveOnlyHeader
            onClickClose={() => setNestedOpen(false)}
            header={<div style={{...stackWindowHeader, background: "#9a3412"}}>A child window · opened from A</div>}
        >
            <div style={{...stackWindowBody, background: "#c2410c"}}>
                <b>Opened from inside A.</b>
                <div>Pressing here must keep this window above A; pressing A raises A again.</div>
                <button style={{marginTop: 8}}>press me</button>
            </div>
        </FloatingWindow>}
        <div style={{
            position: "absolute",
            right: 16,
            bottom: 18,
            zIndex: 999999,
            padding: "8px 10px",
            borderRadius: 7,
            color: "#450a0a",
            background: "#fecaca",
            boxShadow: "0 5px 14px rgba(0,0,0,.28)",
        }}>A child: z-index 999999</div>
    </div>;
}

function FloatingWindowStackDemo() {
    useCacheMapPersistence(memoryCache);
    const [firstOpen, setFirstOpen] = useState(false);
    const [secondOpen, setSecondOpen] = useState(false);
    const [firstActive, setFirstActive] = useState(false);
    const [firstMode, setFirstMode] = useState<FloatingWindowMode>("normal");
    const [firstSnap, setFirstSnap] = useState<FloatingWindowSnapRegion | null>(null);

    const openBoth = () => {
        setFirstOpen(true);
        setSecondOpen(true);
    };

    useEffect(() => {
        const openDirectDemo = () => {
            if (location.hash === "#floating-window-stack") openBoth();
        };
        openDirectDemo();
        window.addEventListener("hashchange", openDirectDemo);
        return () => window.removeEventListener("hashchange", openDirectDemo);
    }, []);

    return <div style={{
        position: "relative",
        transform: "translateZ(0)",
        zIndex: 0,
        overflow: "hidden",
        minHeight: 120,
        padding: 12,
        border: "1px dashed #8c959f",
        borderRadius: 8,
        background: "#f6f8fa",
    }}>
        <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
            <button onClick={openBoth} style={{fontWeight: 700, padding: "6px 10px"}}>launch desktop demo</button>
            <button onClick={() => setFirstOpen(value => !value)}>{firstOpen ? "close A" : "open A"}</button>
            <button onClick={() => setSecondOpen(value => !value)}>{secondOpen ? "close B (no x)" : "open B"}</button>
        </div>
        <div style={{display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10}}>
            {["shared taskbar", "session Snap", "cascade", "Win/Meta + Arrow", "nested window from A"].map(label =>
                <span key={label} style={{padding: "3px 7px", borderRadius: 999, color: "#0550ae", background: "#ddf4ff", fontSize: 11, fontWeight: 650}}>{label}</span>
            )}
        </div>
        <p style={{margin: "10px 0 0", color: "#57606a", fontSize: 12}}>
            Double-click/double-tap a title bar to maximize/restore. Drag it to the top centre, then choose a Snap Layout target.
        </p>
        <p style={{margin: "5px 0 0", color: "#57606a", fontSize: 12, fontFamily: "monospace"}}>
            A: {firstActive ? "active" : "inactive"} · {firstMode}{firstSnap ? ` · snap:${firstSnap}` : ""}
        </p>

        {firstOpen && <FloatingWindow
            windowId="qa-window-a"
            stackGroup="qa-desktop"
            layoutGroup="qa-desktop-layout-v2"
            taskbarLabel="Window A"
            size={{width: 340, height: 220}}
            moveOnlyHeader
            minimizable
            overflow={false}
            onClickClose={() => setFirstOpen(false)}
            onActiveChange={setFirstActive}
            onModeChange={setFirstMode}
            onSnapChange={setFirstSnap}
            header={<div style={{...stackWindowHeader, background: "#7f1d1d"}}>Window A · with close x</div>}
        >
            <WindowABody />
        </FloatingWindow>}

        {secondOpen && <FloatingWindow
            windowId="qa-window-b"
            stackGroup="qa-desktop"
            layoutGroup="qa-desktop-layout-v2"
            taskbarLabel="Window B"
            size={{width: 340, height: 220}}
            moveOnlyHeader
            minimizable
            minimizeButton={false}
            overflow={false}
            header={<div style={{...stackWindowHeader, background: "#1e3a8a"}}>Window B · intentionally no x</div>}
        >
            <div style={{...stackWindowBody, background: "#1d4ed8"}}>
                <b>B opens on top.</b>
                <div>After raising A, click B: all of B must cover every child of A.</div>
                <div style={{
                    position: "absolute",
                    left: 16,
                    bottom: 18,
                    zIndex: 999999,
                    padding: "8px 10px",
                    borderRadius: 7,
                    color: "#172554",
                    background: "#bfdbfe",
                    boxShadow: "0 5px 14px rgba(0,0,0,.28)",
                }}>B child: z-index 999999</div>
            </div>
        </FloatingWindow>}
        <FloatingWindowTaskbar stackGroup="qa-desktop" />
    </div>;
}


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
    // side tray: freshly created blocks land here, then drag into the board
    tray: [] as string[],
    commits: 0, columnCommits: 0, events: 0, last: "-", nextCol: 6, nextItem: 1,
};
const qaBoardTray = "tray";
// left-rail trash: a registered board column whose content the commit discards
const qaBoardTrash = "trash";

const qaBoardStyles: Record<string, React.CSSProperties> = {
    root: { display: "grid", gap: 8, fontSize: 13 },
    workspace: { display: "flex", alignItems: "flex-start", gap: 12, overflowX: "auto", paddingBottom: 6 },
    columns: { display: "flex", alignItems: "flex-start", gap: 10, minWidth: "max-content" },
    columnWrap: { width: 112, border: "1px solid #38506d", borderRadius: 9, overflow: "hidden", background: "#17202e" },
    columnHeader: { display: "flex", alignItems: "center", gap: 4, height: 32, padding: "0 5px 0 8px", color: "#dfe6ef", background: "#243247", userSelect: "none" },
    columnHandle: { flex: 1, minWidth: 0, cursor: "grab", fontWeight: 700, touchAction: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    columnAction: { height: 22, minWidth: 22, padding: "0 5px", border: "1px solid #52647a", borderRadius: 5, color: "#c7d4e3", background: "#1b2737", fontSize: 10, cursor: "pointer" },
    columnDelete: { height: 22, padding: "0 5px", border: "1px solid #8b4b55", borderRadius: 5, color: "#ff9aa6", background: "#321f29", fontSize: 10, cursor: "pointer" },
    column: { display: "flex", flexDirection: "column", gap: 6, width: "100%", minHeight: 164, padding: 7, boxSizing: "border-box" },
    leftRail: { display: "grid", gap: 7, width: 104, flex: "0 0 104px", alignContent: "start" },
    toolButtons: { display: "flex", gap: 5 },
    toolButton: { flex: 1, height: 28, padding: "0 6px", border: "1px solid #38506d", borderRadius: 6, color: "#c7d4e3", background: "#202c3c", fontSize: 11, cursor: "pointer" },
    trayShell: { display: "grid", gap: 5, padding: 6, border: "1px dashed #52647a", borderRadius: 8, color: "#9fb3c8", background: "#151e2a" },
    trayLabel: { fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" },
    tray: { display: "flex", flexDirection: "column", gap: 6, width: "100%", minHeight: 34 },
    trashZone: {
        width: "100%", height: 34, borderRadius: 7, boxSizing: "border-box", userSelect: "none",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700,
    },
    item: {
        height: 32, width: "100%", boxSizing: "border-box", lineHeight: "32px", textAlign: "center", borderRadius: 6,
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
        // The hook may supply a measured drag width. It is valid only while
        // dragging; idle board items must fill their own column.
        width: it.dragging ? it.style?.width : "100%",
    };
}

const BoardDemo = () => {
    updateBy(boardState);
    const log = (s: string) => { boardState.last = s; boardState.events++; renderBy(boardState); };
    // The tray and the trash are just MORE columns of the same hook (registered
    // via columnRef like the rest) - rendered aside, excluded from the board grid.
    // Whatever lands in the trash column is simply not stored back: it disappears.
    const r = useReorderBoard({
        columns: [...boardState.cols, { key: qaBoardTray, items: boardState.tray }, { key: qaBoardTrash, items: [] }],
        commit: next => {
            const trashed = next.find(c => c.key == qaBoardTrash)?.items ?? [];
            boardState.tray = next.find(c => c.key == qaBoardTray)?.items ?? [];
            boardState.cols = next.filter(c => c.key != qaBoardTray && c.key != qaBoardTrash);
            boardState.commits++;
            if (trashed.length) { boardState.last = `deleted ${trashed.join(",")}`; boardState.events++; }
            renderBy(boardState);
        },
        onOverChange: e => log(`over ${e.over.col}#${e.over.index}` + (e.prev && e.prev.col != e.over.col ? " (column crossed)" : "")),
        onDragEnd: e => log(`drop ${e.key} -> ${e.over.col}#${e.over.index} committed=${e.committed}`),
    });
    const columnsReorder = useReorder({
        order: boardState.cols.map(column => column.key),
        preview: "measure",
        commit: keys => {
            const byKey = new Map(boardState.cols.map(column => [column.key, column]));
            boardState.cols = keys.map(key => byKey.get(key)!).filter(Boolean);
            boardState.columnCommits++;
            log(`columns -> ${keys.join(",")}`);
        },
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
    const removeColumn = (key: string) => {
        const removed = boardState.cols.find(column => column.key == key);
        boardState.cols = boardState.cols.filter(column => column.key != key);
        if (removed?.items.length) boardState.tray = [...boardState.tray, ...removed.items];
        delete boardState.gravity[key];
        log(`deleted ${key}${removed?.items.length ? `; ${removed.items.length} items -> tray` : ""}`);
    };
    const toggleGravity = (key: string) => {
        boardState.gravity[key] = boardState.gravity[key] == "bottom" ? "top" : "bottom";
        log(`${key} gravity ${boardState.gravity[key]}`);
    };
    const addItem = () => {
        const k = "E" + boardState.nextItem++;
        boardState.tray = [...boardState.tray, k];
        log(`created ${k}`);
    };
    const trashOver = r.over?.col == qaBoardTrash;
    return <div style={qaBoardStyles.root}>
        <div style={qaBoardStyles.workspace}>
            <div style={qaBoardStyles.leftRail}>
                <div style={qaBoardStyles.toolButtons}>
                    <button title="create a new block in the tray" onClick={addItem} style={qaBoardStyles.toolButton}>+ item</button>
                    <button title="add a column at the start" onClick={() => addColumnAt(0)} style={qaBoardStyles.toolButton}>+ col</button>
                </div>
                <div style={qaBoardStyles.trayShell}>
                    <div style={qaBoardStyles.trayLabel}>new items</div>
                    <div ref={r.columnRef(qaBoardTray)} style={{
                        ...qaBoardStyles.tray,
                        outline: r.over?.col == qaBoardTray ? "1px solid #5d8dcc" : undefined,
                    }}>
                        {boardState.tray.map(k => {
                            const it = r.item(k);
                            return <div key={k} {...it.props} style={qaBoardItemStyle(it)}>{k}</div>;
                        })}
                    </div>
                </div>
                <div ref={r.columnRef(qaBoardTrash)} title="drop an item here to delete it"
                     style={{
                         ...qaBoardStyles.trashZone,
                         border: trashOver ? "1px solid #cf5b6a" : "1px dashed #6b4a55",
                         background: trashOver ? "#3a2230" : "#1c1622",
                         color: trashOver ? "#ff8896" : "#cf5b6a",
                     }}>delete item</div>
            </div>
            <div ref={columnsReorder.listRef} style={qaBoardStyles.columns} data-testid="board-columns">
                {boardState.cols.map(c => {
                    const columnDrag = columnsReorder.item(c.key);
                    const bottom = boardState.gravity[c.key] == "bottom";
                    return <section
                        key={c.key}
                        data-column-key={c.key}
                        style={{
                            ...qaBoardStyles.columnWrap,
                            ...columnDrag.style,
                            transition: columnDrag.active && !columnDrag.dragging ? "transform .14s ease" : undefined,
                            zIndex: columnDrag.dragging ? 2 : undefined,
                            boxShadow: columnDrag.dragging ? "0 10px 24px rgba(0,0,0,.35)" : undefined,
                        }}
                    >
                        <header {...columnDrag.props} style={qaBoardStyles.columnHeader}>
                            <span style={qaBoardStyles.columnHandle} title={`drag column ${c.key}`}>⠿ {c.key}</span>
                            <button title={`toggle ${c.key} gravity`} onClick={() => toggleGravity(c.key)} style={qaBoardStyles.columnAction}>{bottom ? "↓" : "↑"}</button>
                            <button title={`delete column ${c.key}`} onClick={() => removeColumn(c.key)} style={qaBoardStyles.columnDelete}>Del</button>
                        </header>
                        <div ref={r.columnRef(c.key)} style={qaBoardColumnStyle(r.over?.col == c.key, bottom)}>
                            {c.items.map(k => {
                                const it = r.item(k);
                                return <div key={k} {...it.props} style={qaBoardItemStyle(it)}>{k}</div>;
                            })}
                        </div>
                    </section>;
                })}
            </div>
        </div>
        <div style={qaBoardStyles.status}>
            order:[{boardState.cols.map(c => c.key).join(",")}] · {boardState.cols.map(c => c.key + (boardState.gravity[c.key] == "bottom" ? "↓" : "↑") + ":[" + c.items.join(",") + "]").join(" ")} tray:[{boardState.tray.join(",")}] | item commits: {boardState.commits} | column commits: {boardState.columnCommits} | events: {boardState.events} | last: {boardState.last}
        </div>
    </div>;
};


/* ---------- card wrappers ---------- */

export function Card26() {
    return (
    <Check n={26} title="useReorder - drag blocks in a field (mini dnd)"
                       do="Drag blocks around the wrapped field (mouse or touch) - within a row, across rows, to the first/last slot. Click a block without moving. Then enable varied block widths and repeat: rows re-wrap differently, blocks still glide exactly to where they will land."
                       expect="During a drag the grabbed block follows the pointer, the rest GLIDE to their preview slots; on drop everything is already where the preview showed - no snap-back, no jumps. A plain click commits nothing (commits counter unchanged). With varied widths the preview is measured from the real CSS layout (FLIP via the order property), so wrapping changes are previewed exactly too."
                       note="The library's own mini reorder-by-drag (useReorder, extracted from the Toolbar editor): keyed blocks in ANY CSS layout - list, bar, wrapped grid; DOM order never changes mid-drag, targeting runs against START slots (no boundary oscillation), ONE commit on drop. Deliberately not a dnd framework: no nesting, no cross-container moves, no collision packing.">
                    <ReorderDemo />
                </Check>
    );
}

export function Card27() {
    return (
    <Check n={27} title="useReorderBoard + useReorder - draggable columns and items"
                       do="Use the compact controls on the left to create an item or a column. Drag new items from the small tray into columns and between columns. Drag an entire column left/right by its ⠿ header. Change top/bottom gravity from the arrow in a header. Press Del in a header; any items from that column must return to the tray. Drop an individual item on delete item to remove only that item."
                       expect="Items and columns preview and commit independently: item drag never moves a container, header drag moves the complete container, and header buttons stay clickable. The tray grows only with its contents instead of occupying a tall empty box. A new column appears at the start and can immediately be moved anywhere. Deleting a non-empty column preserves its items in the tray."
                       note="Canonical headless composition: useReorderBoard owns item movement across registered bodies; useReorder owns the outer column order. All section/header/button/body markup and styling belong to the consumer. The stand supplies one compact default design only—neither hook renders UI or assumes a header."
                       tall>
                    <BoardDemo />
                </Check>
    );
}

export function Card35() {
    return (
    <Check n={35} title="DragBox - imperative delta drag (adapter over useDraggableApi)"
                       do="Drag the blue chip around (mouse or touch), several gestures in a row. Watch the counters while moving."
                       expect="The chip follows the pointer 1:1; releasing commits the position - the next drag continues from where it stopped (no jump-back, no accumulation drift). starts/stops grow by 1 per gesture; renders grows only with starts/stops, NOT per move pixel (the per-tick path is imperative onX/onY over refs)."
                       note="DragBox is now a thin adapter over useDraggableApi (holdMs 0, trackState:false, onMove) - the old bespoke document-listener loop is gone; contract pinned by __test/dragBox.test.tsx. Production consumer: LeftModal sidebar. DragArea deliberately stays as-is (@deprecated: unique semantics - body listeners, stopPropagation per tick, absolute coords).">
                    <DragBoxDemo />
                </Check>
    );
}

export function Card52() {
    return (
        <Check id="floating-window-stack" n={52} title="FloatingWindow - desktop taskbar, sessions, cascade and Snap"
               do="Open both windows. A has a title-bar minimize button; B intentionally hides it—focus B and use Win/Meta+Down instead. Restore either window from the common bottom panel. Double-click/tap a title twice to maximize and restore: there is intentionally no maximize button. Drag to the top centre and inspect all four Snap presets; the last must be a complete 2x2 with four clickable corners. Reload after snapping to confirm the group layout returns."
               expect="Only one visible window is active. Exactly one title-bar Minimize button is rendered, while both windows remain minimizable through external surfaces. Restoring raises the whole isolated layer including scoped popups. The Snap picker contains 2, 3, 3 and 4 zones—never two detached bottom cells. Snap/free geometry returns after reload; new windows cascade."
               note="FloatingDesktop is a small optional manager separate from FloatingWindow. FloatingWindowTaskbar can be replaced through renderItem or omitted in favour of useFloatingWindowManager. Chrome is consumer policy: minimizable enables the behavior, minimizeButton can hide its control, and maximizeButton is opt-in; double-click/two taps remain."
               tall>
            <FloatingWindowStackDemo />
        </Check>
    );
}

export function Card2() {
    return (
    <Check n={2} title="Drag + Resize (FloatingWindow / FloatingWindow)"
                       do="Click window, drag the window by its header, resize it from the edges, and close it with the x button. Open the console (F12)."
                       expect="The window moves and resizes smoothly; the x button closes it; position and size are restored on reopen (keyForSave)."
                       note="Historical bug (fixed): the console used to fill with xxx spam from a FloatingWindow debug log; the log is gone, so any console spam during drag/resize is a regression."
                       tall>
                    <Button button={(e: any) => <div style={{ display: "inline-block", padding: "6px 12px", border: "1px solid #0969da", borderRadius: 6, cursor: "pointer", background: e ? "#0969da" : "#fff", color: e ? "#fff" : "#0969da" }}>window</div>}>
                        {(api: any) => (
                            <FloatingWindow keyForSave={"qa-rnd"} key={"qa-rnd"} size={{ height: 220, width: 280 }}
                                     className={"fon border fonLight"} moveOnlyHeader={true} onClickClose={api.onClose} limit={{ y: { min: 0 } }} onUpdate={() => {}}>
                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#eef2f6" }}>drag header / resize / close</div>
                            </FloatingWindow>
                        )}
                    </Button>
                </Check>
    );
}
