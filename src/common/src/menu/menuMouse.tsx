import React, {useEffect, useRef, useState} from "react";
import {Menu, MenuItem, MenuItemStrict} from "./menu";
import {OutsideClickArea} from "../hooks/useOutside";

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
    seq: number;
};
export type ContextMenuLayerProps = {
    children: React.ReactElement;
    zIndex?: number;
    other?: () => MenuItem[];
    statusOn?: boolean;
    onUnClick?: (e: boolean) => void;
    onConsume?: () => void;
    className?: (active?: boolean) => string;
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
};
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

function anchorLayerId(anchor: ContextMenuAnchor) {
    const target = "clientX" in anchor ? anchor.target : undefined;
    return target instanceof Element
        ? target.closest("[data-wenay-menu-layer-id]")?.getAttribute("data-wenay-menu-layer-id") ?? undefined
        : undefined;
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
        };
    }

    function emitStats() {
        const snapshot = statsSnapshot();
        for (const cb of [...statsListeners]) cb(snapshot);
    }

    function bumpStat(key: keyof Omit<ContextMenuStatsSnapshot, "sources" | "layers">) {
        statsState[key] += 1;
        emitStats();
    }

    function bumpMapStat(map: Record<string, number>, key: string | undefined) {
        if (!key) return;
        map[key] = (map[key] ?? 0) + 1;
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

    function hasQueuedItems(other?: () => MenuItem[]) {
        return !!other || map.size > 0;
    }

    function close() {
        if (!state.open && state.items.length == 0) return;
        bumpStat("close");
        state.open = false;
        state.items = [];
        state.layerId = undefined;
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
        const timeEvent = useRef(Date.now());
        const touchXY = useRef({x: 0, y: 0});
        const touchTime = useRef<null | number>(null);
        const enabled = statusOn ?? menuMouse.value.status;

        useEffect(() => {
            layers.add(layerId);
            return () => {
                layers.delete(layerId);
                if (state.layerId == layerId) close();
            };
        }, [layerId]);

        useEffect(() => subscribe(() => forceRender(v => v + 1)), []);

        function queuedItems() {
            return other ? normalizeItems(other()) : legacyItems();
        }

        function openQueued(anchor: ContextMenuAnchor) {
            const opened = openMenu(anchor, queuedItems(), {source: "layer", layerId}, "legacyLayer");
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
                if (!state.open || hasQueuedItems(other)) openQueued(e);
            }}
            onTouchStart={e => {
                if (touchXY.current.x == 0) touchXY.current.x = e.touches[0].screenX;
                if (touchXY.current.y == 0) touchXY.current.y = e.touches[0].screenY;
                touchTime.current = Date.now();
            }}
            onTouchMove={e => {
                const x2 = e.touches[0].screenX;
                const y2 = e.touches[0].screenY;
                const pX = Math.max(1, Math.abs(e.touches[0].pageX));
                const pY = Math.max(1, Math.abs(e.touches[0].pageY));
                if ((Math.abs(x2 - touchXY.current.x) / pX > 0.05) || (Math.abs(y2 - touchXY.current.y) / pY > 0.05)) {
                    touchTime.current = null;
                }
            }}
            onTouchEnd={e => {
                if (!enabled) return;
                if (touchTime.current && Date.now() - touchTime.current > 300) {
                    touchTime.current = null;
                    touchXY.current.x = touchXY.current.y = 0;
                    if (!state.open || hasQueuedItems(other)) {
                        openQueued({clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY, target: e.target, preventDefault: () => e.preventDefault(), stopPropagation: () => e.stopPropagation()});
                    }
                }
            }}
            onDoubleClick={() => {
                timeEvent.current = Date.now();
            }}
            onMouseUp={event => {
                if (!enabled) return;
                if (event.button == 2 || Date.now() - timeEvent.current < 300) {
                    if (!state.open || hasQueuedItems(other)) openQueued(event);
                }
            }}
        >
            {children}
            {state.open && enabled && state.layerId == layerId && <OutsideClickArea outsideClick={handleClose}>
                <Menu className={className} data={state.items} coordinate={relativePoint()} zIndex={zIndex}/>
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