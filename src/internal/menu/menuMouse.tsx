import React, {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {Menu, MenuActionEvent, MenuItem, MenuItemStrict} from "./menu.js";
import {OutsideClickArea} from "../components/OutsideClickArea.js";
import {useContextMenuGesture} from "./useContextMenuGesture.js";


/** Inside the window's own isolate, so it only has to clear the window's chrome. Same value
 *  WindowPortal uses for the popups it hosts. */
const WINDOW_MENU_Z_INDEX = 2147483646;

export type ContextMenuPoint = {x: number; y: number};
export type ContextMenuAnchor = ContextMenuPoint | {
    clientX: number;
    clientY: number;
    target?: EventTarget | null;
    preventDefault?: () => void;
    stopPropagation?: () => void;
};
export type ContextMenuState = {
    open: boolean;
    items: MenuItemStrict[];
    point: ContextMenuPoint;
    source?: string;
    layerId?: string;
    /** Isolated stacking layer of the FloatingWindow the press came from, when it came from
     *  one. The serving Layer portals the menu in there instead of rendering it inline. */
    windowPortal?: Element | null;
    seq: number;
};

/** What produced the menu, handed to the Layer's item provider so it can build items for
 *  whatever sits under the pointer - the reason a touch long press no longer has to preload
 *  `contextMenu.map` before the gesture. */
export type ContextMenuGesture = {
    x: number;
    y: number;
    target: Element | null;
    pointer: "mouse" | "touch";
};

/** A provider may return plain items, or items plus the `source` label it wants recorded -
 *  the latter puts the Layer path on a par with openAt for stats. */
export type ContextMenuProvided = MenuItem[] | {items: MenuItem[]; source?: string};

export type ContextMenuLayerProps = {
    children: React.ReactElement;
    zIndex?: number;
    other?: (gesture: ContextMenuGesture) => ContextMenuProvided;
    statusOn?: boolean;
    onUnClick?: (e: boolean) => void;
    onConsume?: () => void;
    className?: (active?: boolean) => string;
};
export type ContextMenuActionCounters = {
    click: number;
    ok: number;
    error: number;
    taskOk: number;
    taskError: number;
    submenuOpen: number;
    submenuOk: number;
    submenuError: number;
    funcOpen: number;
    funcOk: number;
    funcError: number;
    focusOpen: number;
    focusOk: number;
    focusError: number;
};

export type ContextMenuStatsSnapshot = {
    openAt: number;
    openAtPoint: number;
    legacyLayer: number;
    close: number;
    replace: number;
    empty: number;
    sources: Record<string, number>;
    layers: Record<string, number>;
    actionTotals: ContextMenuActionCounters;
    actions: Record<string, ContextMenuActionCounters>;
};

type ContextMenuOpenStat = "openAt" | "openAtPoint" | "legacyLayer" | "close" | "replace" | "empty";

function createActionCounters(): ContextMenuActionCounters {
    return {
        click: 0,
        ok: 0,
        error: 0,
        taskOk: 0,
        taskError: 0,
        submenuOpen: 0,
        submenuOk: 0,
        submenuError: 0,
        funcOpen: 0,
        funcOk: 0,
        funcError: 0,
        focusOpen: 0,
        focusOk: 0,
        focusError: 0,
    };
}

function cloneActionCounters(counters: ContextMenuActionCounters): ContextMenuActionCounters {
    return {...counters};
}

function cloneActions(actions: Record<string, ContextMenuActionCounters>) {
    const result: Record<string, ContextMenuActionCounters> = {};
    for (const [key, counters] of Object.entries(actions)) result[key] = cloneActionCounters(counters);
    return result;
}
export type ContextMenuStats = {
    getSnapshot(): ContextMenuStatsSnapshot;
    reset(): void;
    onChange(cb: (snapshot: ContextMenuStatsSnapshot) => void): () => void;
};

function normalizeItems(items: readonly MenuItem[] | null | undefined): MenuItemStrict[] {
    return (items ?? []).filter(Boolean) as MenuItemStrict[];
}

function anchorPoint(anchor: ContextMenuAnchor): ContextMenuPoint {
    if ("clientX" in anchor) return {x: anchor.clientX, y: anchor.clientY};
    return anchor;
}

function anchorTarget(anchor: ContextMenuAnchor) {
    const target = "clientX" in anchor ? anchor.target : undefined;
    return target instanceof Element ? target : null;
}

function anchorLayerId(anchor: ContextMenuAnchor) {
    return anchorTarget(anchor)?.closest("[data-wenay-menu-layer-id]")?.getAttribute("data-wenay-menu-layer-id") ?? undefined;
}

/** A viewport FloatingWindow portals to body, so a press inside it has no Layer among its DOM
 *  ancestors: the menu used to land in the page's root Layer, underneath the window. It also
 *  has no way out of the window body's `overflow: auto`, which is why nesting a Layer in the
 *  window clipped the menu. Both go away by portalling the menu into the window's own portal
 *  root - the fixed, isolated layer the window itself lives in, above its content. */
function anchorWindowPortal(anchor: ContextMenuAnchor) {
    return anchorTarget(anchor)?.closest("[data-wenay-window-portal-root]") ?? null;
}

function preventNative(anchor: ContextMenuAnchor) {
    if ("clientX" in anchor) {
        anchor.preventDefault?.();
        anchor.stopPropagation?.();
    }
}

export function createContextMenu(data?: {name?: string}) {
    const {name = "mouse"} = data ?? {};
    const value = {status: true, clicks: 0};
    const menuMouse = {
        name,
        get value() {return value;}
    };

    const map = new Map<string, MenuItem[]>();
    const state: ContextMenuState = {open: false, items: [], point: {x: 0, y: 0}, seq: 0};
    const listeners = new Set<() => void>();
    const statsListeners = new Set<(snapshot: ContextMenuStatsSnapshot) => void>();
    const statsState: ContextMenuStatsSnapshot = {
        openAt: 0,
        openAtPoint: 0,
        legacyLayer: 0,
        close: 0,
        replace: 0,
        empty: 0,
        sources: {},
        layers: {},
        actionTotals: createActionCounters(),
        actions: {},
    };
    const layers = new Set<string>();
    let layerSeq = 0;

    function emit() {
        state.seq += 1;
        for (const cb of [...listeners]) cb();
    }

    function subscribe(cb: () => void) {
        listeners.add(cb);
        return () => { listeners.delete(cb); };
    }

    function statsSnapshot(): ContextMenuStatsSnapshot {
        return {
            openAt: statsState.openAt,
            openAtPoint: statsState.openAtPoint,
            legacyLayer: statsState.legacyLayer,
            close: statsState.close,
            replace: statsState.replace,
            empty: statsState.empty,
            sources: {...statsState.sources},
            layers: {...statsState.layers},
            actionTotals: cloneActionCounters(statsState.actionTotals),
            actions: cloneActions(statsState.actions),
        };
    }

    function emitStats() {
        // every open/close/action calls this; with nobody listening the snapshot (four object
        // spreads plus two deep clones of the action counters) was built and thrown away
        if (statsListeners.size === 0) return;
        const snapshot = statsSnapshot();
        for (const cb of [...statsListeners]) cb(snapshot);
    }

    function bumpStat(key: ContextMenuOpenStat) {
        statsState[key] += 1;
        emitStats();
    }

    function bumpMapStat(map: Record<string, number>, key: string | undefined) {
        if (!key) return;
        map[key] = (map[key] ?? 0) + 1;
    }
    function recordMenuAction(event: MenuActionEvent) {
        const stat = event.type;
        statsState.actionTotals[stat] += 1;
        if (event.actionKey) {
            const counters = statsState.actions[event.actionKey] ??= createActionCounters();
            counters[stat] += 1;
        }
        emitStats();
    }

    const stats: ContextMenuStats = {
        getSnapshot: statsSnapshot,
        reset() {
            statsState.openAt = 0;
            statsState.openAtPoint = 0;
            statsState.legacyLayer = 0;
            statsState.close = 0;
            statsState.replace = 0;
            statsState.empty = 0;
            statsState.sources = {};
            statsState.layers = {};
            statsState.actionTotals = createActionCounters();
            statsState.actions = {};
            emitStats();
        },
        onChange(cb) {
            statsListeners.add(cb);
            return () => { statsListeners.delete(cb); };
        },
    };

    function legacyItems() {
        if (map.has("only")) return normalizeItems(map.get("only"));
        const items: MenuItem[] = [];
        map.forEach(e => { items.unshift(...e); });
        return normalizeItems(items);
    }

    function hasQueuedItems(other?: ContextMenuLayerProps["other"]) {
        return !!other || map.size > 0;
    }

    function close() {
        if (!state.open && state.items.length == 0) return;
        bumpStat("close");
        state.open = false;
        state.items = [];
        state.layerId = undefined;
        state.windowPortal = null;
        emit();
    }

    function openMenu(anchor: ContextMenuAnchor, items: readonly MenuItem[] | null | undefined, opts: {source?: string, layerId?: string} = {}, kind: "openAt" | "openAtPoint" | "legacyLayer") {
        preventNative(anchor);
        const nextItems = normalizeItems(items);
        if (nextItems.length == 0) {
            bumpStat("empty");
            close();
            return false;
        }
        if (state.open) bumpStat("replace");
        bumpStat(kind);
        state.open = true;
        state.items = nextItems;
        state.point = anchorPoint(anchor);
        state.source = opts.source;
        state.layerId = opts.layerId ?? anchorLayerId(anchor) ?? [...layers][0];
        state.windowPortal = anchorWindowPortal(anchor);
        bumpMapStat(statsState.sources, state.source);
        bumpMapStat(statsState.layers, state.layerId);
        emitStats();
        emit();
        return true;
    }

    function openAt(anchor: ContextMenuAnchor, items: readonly MenuItem[] | null | undefined, opts: {source?: string, layerId?: string} = {}) {
        return openMenu(anchor, items, opts, "openAt");
    }

    function openAtPoint(point: ContextMenuPoint, items: readonly MenuItem[] | null | undefined, opts: {source?: string, layerId?: string} = {}) {
        return openMenu(point, items, opts, "openAtPoint");
    }

    function getState(): ContextMenuState {
        return {
            open: state.open,
            items: state.items.slice(),
            point: {...state.point},
            source: state.source,
            layerId: state.layerId,
            windowPortal: state.windowPortal,
            seq: state.seq,
        };
    }

    function bb(b?: boolean) {
        if (b != undefined) {
            if (b) {
                state.open = true;
                emit();
            } else {
                close();
            }
            return;
        }
        return state.open;
    }

    function Layer({children, other, statusOn, onUnClick, onConsume, zIndex, className}: ContextMenuLayerProps) {
        const [, forceRender] = useState(0);
        const [layerId] = useState(() => `${name}-${++layerSeq}`);
        const layerRef = useRef<HTMLDivElement | null>(null);
        const enabled = statusOn ?? menuMouse.value.status;
        const gesture = useContextMenuGesture({
            enabled,
            onOpen: (anchor, pointer) => { if (!state.open || hasQueuedItems(other)) openQueued(anchor, pointer); },
        });

        useEffect(() => {
            layers.add(layerId);
            return () => {
                layers.delete(layerId);
                if (state.layerId == layerId) close();
            };
        }, [layerId]);

        useEffect(() => subscribe(() => forceRender(v => v + 1)), []);

        function openQueued(anchor: ContextMenuAnchor, pointer: ContextMenuGesture["pointer"]) {
            const point = anchorPoint(anchor);
            const provided = other?.({x: point.x, y: point.y, target: anchorTarget(anchor), pointer});
            const items = provided == undefined
                ? legacyItems()
                : normalizeItems(Array.isArray(provided) ? provided : provided.items);
            const source = provided != undefined && !Array.isArray(provided) ? provided.source : undefined;
            const opened = openMenu(anchor, items, {source: source ?? "layer", layerId}, "legacyLayer");
            if (opened) {
                map.clear();
                onConsume?.();
            }
            return opened;
        }

        function handleClose() {
            if (!state.open) return;
            close();
            onUnClick?.(false);
        }

        function relativePoint() {
            const rect = layerRef.current?.getBoundingClientRect();
            return {
                x: state.point.x - (rect?.left ?? 0),
                y: state.point.y - (rect?.top ?? 0),
            };
        }

        /** The window's portal root is `position: fixed; inset: 0`, so a point inside it is the
         *  client point unshifted, and its `pointer-events: none` has to be undone for the menu.
         *  A window that closed while its menu was open leaves a detached node behind - fall
         *  back to the inline layer rather than portalling into nothing. */
        function windowPortalTarget() {
            const target = state.windowPortal;
            return target && target.isConnected ? target : null;
        }

        function menuView(coordinate: ContextMenuPoint) {
            return <Menu className={className} data={state.items} coordinate={coordinate} zIndex={zIndex} onActionEvent={recordMenuAction}/>;
        }

        return <div
            data-wenay-menu-layer="root"
            data-wenay-menu-layer-id={layerId}
            className="maxSize"
            style={{position: "relative"}}
            ref={layerRef}
            onContextMenu={e => {
                if (!enabled) return;
                e.preventDefault();
                e.stopPropagation();
                if (!state.open || hasQueuedItems(other)) openQueued(e, "mouse");
            }}
            {...gesture}
        >
            {children}
            {state.open && enabled && state.layerId == layerId && <OutsideClickArea outsideClick={handleClose}>
                {(target => target
                    // Still a child of this OutsideClickArea in the React tree, so a click in the
                    // portalled menu is recognised as inside exactly like the inline one.
                    ? createPortal(
                        <div
                            data-wenay-menu-window-layer={layerId}
                            style={{position: "absolute", left: 0, top: 0, zIndex: WINDOW_MENU_Z_INDEX, pointerEvents: "auto"}}
                        >
                            {menuView(state.point)}
                        </div>,
                        target,
                    )
                    : menuView(relativePoint()))(windowPortalTarget())}
            </OutsideClickArea>}
        </div>;
    }

    return {
        bb,
        get map() {return map;},
        get menuMouse() {return menuMouse;},
        getState,
        subscribe,
        openAt,
        openAtPoint,
        close,
        stats,
        Layer,
        MenuView: Menu,
    };
}

export const contextMenu = createContextMenu();
