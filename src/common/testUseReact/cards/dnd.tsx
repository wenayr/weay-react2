import React, { useState, useRef, useEffect } from "react";
import { useReorder, useReorderBoard, renderBy, updateBy, type BoardColumn } from "../../api";
import { Button } from "../../src/hooks";
import { FloatingWindow, WindowPortal, type FloatingWindowMode, type FloatingWindowSnapRegion } from "../../src/components";
import { DragBox } from "../../src/components/Dnd/FloatingWindow";
import { Check } from "../standKit";


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
    return <div style={{...stackWindowBody, background: "#991b1b"}}>
        <b>A starts below B.</b>
        <div>Click any visible part of A to raise its complete layer.</div>
        <button onClick={() => setPopupOpen(value => !value)} style={{marginTop: 8}}>toggle A popup</button>
        {popupOpen && <WindowPortal style={{left: 150, top: 72}}>
            <div style={{padding: 10, color: "#172554", background: "#dbeafe", border: "1px solid #60a5fa", borderRadius: 7, boxShadow: "0 8px 24px rgba(0,0,0,.3)"}}>
                A scoped popup: it rises and falls together with A
            </div>
        </WindowPortal>}
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
    const [firstOpen, setFirstOpen] = useState(false);
    const [secondOpen, setSecondOpen] = useState(false);
    const [firstActive, setFirstActive] = useState(false);
    const [firstMode, setFirstMode] = useState<FloatingWindowMode>("normal");
    const [firstSnap, setFirstSnap] = useState<FloatingWindowSnapRegion | null>(null);

    const openBoth = () => {
        setFirstOpen(true);
        setSecondOpen(true);
    };

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
            <button onClick={openBoth}>open both windows</button>
            <button onClick={() => setFirstOpen(value => !value)}>{firstOpen ? "close A" : "open A"}</button>
            <button onClick={() => setSecondOpen(value => !value)}>{secondOpen ? "close B (no x)" : "open B"}</button>
        </div>
        <p style={{margin: "10px 0 0", color: "#57606a", fontSize: 12}}>
            Double-click/double-tap a title bar to maximize/restore. Drag it to the top centre, then choose a Snap Layout target.
        </p>
        <p style={{margin: "5px 0 0", color: "#57606a", fontSize: 12, fontFamily: "monospace"}}>
            A: {firstActive ? "active" : "inactive"} · {firstMode}{firstSnap ? ` · snap:${firstSnap}` : ""}
        </p>

        {firstOpen && <FloatingWindow
            windowId="qa-window-a"
            position={{x: 110, y: 110}}
            size={{width: 340, height: 220}}
            moveOnlyHeader
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
            position={{x: 300, y: 200}}
            size={{width: 340, height: 220}}
            moveOnlyHeader
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
    commits: 0, events: 0, last: "-", nextCol: 6, nextItem: 1,
};
const qaBoardTray = "tray";
// left-rail trash: a registered board column whose content the commit discards
const qaBoardTrash = "trash";

const qaBoardStyles: Record<string, React.CSSProperties> = {
    root: { display: "grid", gap: 8, fontSize: 13 },
    columns: { display: "grid", alignItems: "start", columnGap: 6 },
    columnControls: { display: "grid", alignItems: "center", columnGap: 6, marginTop: -6 },
    insertStrip: {
        width: 20, height: 20, borderRadius: 10, cursor: "pointer", userSelect: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#9fb3c8", background: "#202c3c", border: "1px solid #38506d", fontSize: 11, fontWeight: 700,
    },
    column: { display: "flex", flexDirection: "column", gap: 6, width: 78, height: 240, padding: 6, borderRadius: 8 },
    columnWrap: { display: "grid", width: 90 },
    tray: { display: "grid", gap: 6, width: 90, alignContent: "start" },
    newItem: {
        height: 24, borderRadius: 6, cursor: "pointer", userSelect: "none",
        border: "1px dashed #38506d", background: "#202c3c", color: "#9fb3c8", fontSize: 12,
    },
    leftRail: { display: "grid", gap: 8, alignContent: "start", width: 44 },
    addColumn: {
        width: 44, height: 44, borderRadius: 8, cursor: "pointer", userSelect: "none",
        border: "1px solid #38506d", background: "#202c3c", color: "#9fb3c8", fontSize: 18, lineHeight: "42px",
    },
    trashZone: {
        width: 44, height: 64, borderRadius: 8, boxSizing: "border-box", userSelect: "none",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
    },
    removeColumn: { width: 24, height: 20, border: "1px solid #f4b1aa", borderRadius: 6, cursor: "pointer", color: "#cf222e", background: "#fff", fontSize: 15, lineHeight: "16px" },
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
        delete boardState.gravity[key];
        log(`removed ${key}${removed?.items.length ? ` (${removed.items.length} items)` : ""}`);
    };
    const InsertStrip = ({ at }: { at: number }) => (
        <button title="insert column between" onClick={() => addColumnAt(at)} style={qaBoardStyles.insertStrip}>↔</button>
    );
    const addItem = () => {
        const k = "E" + boardState.nextItem++;
        boardState.tray = [...boardState.tray, k];
        log(`created ${k}`);
    };
    const tracks = boardState.cols.map((_, i) => i < boardState.cols.length - 1 ? "90px 20px" : "90px").join(" ");
    const trashOver = r.over?.col == qaBoardTrash;
    return <div style={qaBoardStyles.root}>
        <div style={{display: "flex", alignItems: "flex-start", gap: 14}}>
            <div style={qaBoardStyles.leftRail}>
                <button title="add a column at the start" onClick={() => addColumnAt(0)} style={qaBoardStyles.addColumn}>+</button>
                <div ref={r.columnRef(qaBoardTrash)} title="drop a block here to delete it"
                     style={{
                         ...qaBoardStyles.trashZone,
                         border: trashOver ? "1px solid #cf5b6a" : "1px dashed #6b4a55",
                         background: trashOver ? "#3a2230" : "#1c1622",
                         color: trashOver ? "#ff8896" : "#cf5b6a",
                     }}>−</div>
            </div>
            <div style={{display: "grid", gap: 8}}>
                <div style={{...qaBoardStyles.columns, gridTemplateColumns: tracks}}>
                    {boardState.cols.map((c, ci) => (
                        <div key={c.key} style={{...qaBoardStyles.columnWrap, gridColumn: ci * 2 + 1}}>
                            <div ref={r.columnRef(c.key)}
                                 style={qaBoardColumnStyle(r.over?.col == c.key, boardState.gravity[c.key] == "bottom")}>
                                {c.items.map(k => {
                                    const it = r.item(k);
                                    return <div key={k} {...it.props} style={qaBoardItemStyle(it)}>{k}</div>;
                                })}
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{...qaBoardStyles.columnControls, gridTemplateColumns: tracks}}>
                    {boardState.cols.map((c, ci) => <React.Fragment key={c.key}>
                        <button title={`remove ${c.key}`} onClick={() => removeColumn(c.key)}
                                style={{...qaBoardStyles.removeColumn, gridColumn: ci * 2 + 1, justifySelf: "center"}}>−</button>
                        {ci < boardState.cols.length - 1 && <span style={{gridColumn: ci * 2 + 2, justifySelf: "center"}}><InsertStrip at={ci + 1} /></span>}
                    </React.Fragment>)}
                </div>
            </div>
            <div style={qaBoardStyles.tray}>
                <button title="create a new block in the tray" onClick={addItem} style={qaBoardStyles.newItem}>+ item</button>
                <div ref={r.columnRef(qaBoardTray)}
                     style={{...qaBoardColumnStyle(r.over?.col == qaBoardTray, false), border: "1px dashed #2c3c55"}}>
                    {boardState.tray.map(k => {
                        const it = r.item(k);
                        return <div key={k} {...it.props} style={qaBoardItemStyle(it)}>{k}</div>;
                    })}
                </div>
            </div>
        </div>
        <div style={qaBoardStyles.status}>
            {boardState.cols.map(c => c.key + (boardState.gravity[c.key] == "bottom" ? "↓" : "↑") + ":[" + c.items.join(",") + "]").join(" ")} tray:[{boardState.tray.join(",")}] | commits: {boardState.commits} | events: {boardState.events} | last: {boardState.last}
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
    <Check n={27} title="useReorderBoard - columns, per-column gravity, cross-column drag"
                       do="Drag blocks between columns: from a top-packed (up arrow) into a bottom-packed (down arrow) column, into the EMPTY column, back. Watch the landing gap: in a bottom-packed column the blocks ABOVE the slot slide UP to make room. Drag within one column too. Use ↔ strictly between two columns to insert a new one. The − directly below a column removes that column; all actions form one aligned lower rail. Click + item in the side tray a few times, drag the created blocks into any column and drag a block back into the tray. On the left rail: + adds a column at the start; drag any block onto the − trash to delete it. Watch the events line: over changes, column crossings, drop."
                       expect="The dragged block follows the pointer; the hovered column highlights (r.over); survivors glide to exactly where they land on drop - including the source column compacting per ITS gravity and the target column opening a real gap per ITS gravity. One commit per drop (counter); a plain click commits nothing. onOverChange fires only when the slot changes, onDragEnd reports the final slot and committed flag. + item spawns E1, E2... into the dashed tray; the tray highlights on hover-over and accepts blocks like any column, and the status line tracks tray:[...]. The − trash highlights while hovered and swallows the dropped block (last: deleted ...) - it is one more registered column whose content the commit discards."
                       note="useReorderBoard - the columns extension of useReorder: column gravity is pure consumer CSS (justify-content), the hook never knows it - it measures the real layout (offset-based FLIP with display:none for the dragged and a real margin gap at the landing slot, so CSS decides who moves aside). Columns register via live callback refs - adding one is just consumer state; the side tray IS one more such column rendered aside, so creating blocks needed no new hook API. Same non-goals: no nesting, no collision packing, no autoscroll."
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
        <Check n={52} title="FloatingWindow - desktop stacking, maximize and Snap Layout"
               do="Open both windows. Raise A and B by clicking them. Double-click or double-tap either title bar twice. Drag a title bar to the top centre, hover a layout cell, and release. Toggle A's scoped popup, then raise B over A. Also resize and drag against the viewport edges."
               expect="The active window rises as one complete isolated layer, including its high-z child and scoped popup. Double-click/two taps maximize and restore the previous geometry. The top-centre picker previews and applies halves/quarters; dragging a snapped window restores its free size. Windows and close chrome remain recoverable inside the viewport."
               note="The default body portal escapes ancestor transform/overflow. WindowPortal keeps menus/tooltips in their owner's layer. Use portal={false} only for deliberately parent-relative embedded UI. Keyboard: Alt+Enter maximize; Alt+Arrow move; Alt+Ctrl+Arrow resize."
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
