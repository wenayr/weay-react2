import React, { useState, useEffect } from "react";
import { Menu, contextMenu, ModalProvider, useModal, SettingsDialog, registerSettingsSection, createUiSlot, createCallbackHub, createToolbar, registerToolbarDensity, useCacheMapPersistence, memoryCache, useListenEffect, updateBy, renderBy, type ToolbarItem, type ToolbarConfig } from "../../api";
import { HoverButton } from "../../src/hooks";
import { Check } from "../standKit";


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


/* ---------- card wrappers ---------- */

export function Card13() {
    return (
    <Check n={13} title="ModalProvider / useModal - Escape and outside click"
                       do="Click open modal. Close it with Escape. Open it again and close with an outside click. Open it again and close with the close button."
                       expect="All three methods close it. The dimmed backdrop is above everything (z-index from token --wenay-z-modal)."
                       note="M1: Escape and closeOnEscape/closeOnOutsideClick options were added; useModal remains the app-level path and createModalElementStore remains low-level.">
                    <ModalDemo />
                </Check>
    );
}

export function Card20() {
    return (
    <Check n={20} title="SettingsDialog - searchable settings tree + registry"
                       do="Click the three-dot toolbar-style settings button: drag the window by its header, drag the divider between tree and content, double-click it to reset width, use the tree icons and the dotted tree-cycle button, search for suffix/leaf/palette/accent/font/external and wrong-layout examples like ыгаашч for suffix. Press Enter to save a query into search history, reopen history from the clock button, pick a saved query, then clear history. Clear search via the x and via Escape, then close via window x/outside click/Escape with empty search. Unmount external module and open again."
                       expect="The default trigger is the same compact toolbar-button style as createToolbar, using a three-dot icon. Dialog opens as the standard draggable FloatingWindow with a header, larger size, shared close x, and outside-click close. The tree/content divider changes the tree width, persists it through memoryCache, supports keyboard arrows, and double-click/Enter resets to default. Search uses original input plus RU/EN keyboard-layout variants, selects the first real match, auto-expands parents, and highlights only the matched word once. Enter stores non-empty queries in a small persisted search history; choosing a history item restores the query; clearing history removes the dropdown; leaving the search box closes the dropdown. The dotted tree-cycle button switches expanded/current branch/collapsed and stays in the search row. The clear x and Escape both cancel search text; Escape with empty search closes the dialog. The external child under Display appears only while mounted."
                       note="Registry is a module singleton (registerSettingsSection -> unregister), no React context. Tree shape comes from children or parentKey. Search history uses createSearchHistory -> memoryGetOrCreate/memoryCache dirty channel; this demo loads memoryCache and saves dirty changes with saveDebounced(300). Look via --dlg-* tokens; apps pass their own section classes via sectionClassName/sectionActiveClassName.">
                    <SettingsDialogDemo />
                </Check>
    );
}

export function Card21() {
    return (
    <Check n={21} title="createUiSlot - configurable block placement"
                       do="Switch Top bar / Sidebar. Then reload the page (F5)."
                       expect="The block moves between the two containers WITHOUT a reload; only one mount point shows it at a time. After F5 the chosen place is restored (memoryGetOrCreate -> memoryCache)."
                       note="Mount points render <Slot place=...> themselves and stay ignorant of each other. The demo calls memoryCache.load() on mount and subscribes memoryCache.onDirty -> saveDebounced(300): the persisted maps are observable and mark memoryCache dirty themselves, the app owns the write policy.">
                    <UiSlotDemo />
                </Check>
    );
}

export function Card22() {
    return (
    <Check n={22} title="createCallbackHub - one slot, many subscribers"
                       do="Note slot bound = false. Click on A (bound becomes true), fire source event, then on B and fire again. Then off A and fire once more."
                       expect="Before the first on() the slot is untouched (lazy bind). With A+B subscribed both receive the same events. After off A, B keeps receiving; hub.count() tracks subscribers."
                       note="Fixes the real bug where two onX(cb) subscribers silently overwrote each other. Built on `listen` from wenay-common2; bind(emit) runs once.">
                    <HubDemo />
                </Check>
    );
}

export function Card25() {
    return (
    <Check n={25} title="createToolbar - customizable toolbar (config / Bar / Settings)"
                       do="Click toolbar items (last action updates). Open the gear popover: toggle Clear workspace on, drag rows to reorder - grab ANYWHERE on the row, mouse or touch, try dragging above the fixed Home too (or focus the handle and press arrow keys), switch density Icons / Icons + labels. Open global settings -> Toolbar section and repeat an edit there. Register the 3rd density and switch to Full text. Uncheck the separated Toolbar settings row at the bottom - the gear (and this popover) disappears from the bar; re-enable it via global settings -> Toolbar. Click simulate app update. Reload the page (F5). In Settings, click the Reset toolbar action button inside its row. Then check the Reset toolbar row, confirm the reset icon appears in the bar, click it, and uncheck the row again."
                       expect="The bar renders visible items in config order; density switches icon-only <-> icon+label (tooltips show titles in icon mode). Home is fixed: checkbox disabled, no drag handle, pinned first - it never moves during a drag preview and a row dragged above it lands right below it, exactly as previewed (no snap-back on drop). The gear popover and the global settings section are THE SAME editor - an edit in one is instantly visible in the other and on the bar. The 3rd density appears in the editor as one more segment and renders icon + full title. The app update appends Help as visible WITHOUT wiping your order/visibility. After F5 everything is restored (memoryGetOrCreate -> memoryCache). onChange fires on every edit with the new config (JSON below); Settings is visible by default, the reset icon is hidden by default, the Reset toolbar row action restores defaults, and that row can hide/show the bar icon."
                       note="Three decoupled layers: serializable config (single source of truth, persisted like createUiSlot), Bar, and a PURE Settings editor over config. Density levels live in an extensible module registry (registerToolbarDensity); reorder is a built-in nearest-slot pointer sort (no dnd deps, layout-agnostic: list / bar / grid) + keyboard arrows; the preview simulates the commit incl. fixed pinning, so what you see is what you drop. v1 has no overflow menu - visibility is the space tool."
                       tall>
                    <ToolbarDemo />
                </Check>
    );
}

export function Card3() {
    return (
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
    );
}

export function Card4() {
    return (
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
    );
}
