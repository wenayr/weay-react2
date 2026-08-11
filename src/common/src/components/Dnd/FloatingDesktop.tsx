import React, {ReactNode, useEffect, useRef} from "react";
import {createPortal} from "react-dom";
import {createUpdateApi} from "../../../updateBy";
import type {FloatingWindowMode, FloatingWindowSnapRegion} from "./FloatingWindowTypes";

export type FloatingDesktopWindow = {
    id: string;
    label: ReactNode;
    active: boolean;
    minimized: boolean;
    mode: FloatingWindowMode;
    snapRegion: FloatingWindowSnapRegion | null;
};

type DesktopActions = {
    minimize(): void;
    restore(): void;
};

export type FloatingDesktopEntry = {
    key: number;
    publicId: string;
    group: string;
    baseZIndex: number;
    label: ReactNode;
    minimized: boolean;
    mode: FloatingWindowMode;
    snapRegion: FloatingWindowSnapRegion | null;
    actions: DesktopActions;
};

const desktopState = {entries: [] as FloatingDesktopEntry[]};
const desktopApi = createUpdateApi(desktopState);
let desktopKey = 0;

function groupEntries(group: string, includeMinimized = true) {
    return desktopState.entries.filter(entry => entry.group == group && (includeMinimized || !entry.minimized));
}

function resolveStack(entry: FloatingDesktopEntry) {
    const visible = groupEntries(entry.group, false);
    let zIndex = entry.baseZIndex;
    for (let index = 0; index < visible.length; index++) {
        const current = visible[index];
        zIndex = index == 0 ? current.baseZIndex : Math.max(current.baseZIndex, zIndex + 2);
        if (current === entry) return {index, zIndex, active: index == visible.length - 1};
    }
    return null;
}

function bringEntryToFront(entry: FloatingDesktopEntry) {
    const index = desktopState.entries.indexOf(entry);
    if (index < 0) return;
    const last = desktopState.entries.findLastIndex(candidate => candidate.group == entry.group);
    if (index != last) {
        desktopState.entries.splice(index, 1);
        desktopState.entries.push(entry);
    }
    desktopApi.render();
}

export function cascadeWindowPosition(sequence: number) {
    const slot = sequence % 8;
    return {x: 32 + slot * 28, y: 32 + slot * 28};
}

export function useFloatingDesktopWindow({windowId, group, baseZIndex, label}: {
    windowId?: string;
    group: string;
    baseZIndex: number;
    label?: ReactNode;
}) {
    const entryRef = useRef<FloatingDesktopEntry | null>(null);
    if (!entryRef.current) {
        const key = desktopKey++;
        const publicId = windowId ?? `wenay-window-${key}`;
        entryRef.current = {
            key,
            publicId,
            group,
            baseZIndex,
            label: label ?? publicId,
            minimized: false,
            mode: "normal",
            snapRegion: null,
            actions: {minimize() {}, restore() {}},
        };
    }
    const entry = entryRef.current;
    entry.publicId = windowId ?? entry.publicId;
    entry.group = group;
    entry.baseZIndex = baseZIndex;
    entry.label = label ?? entry.publicId;

    desktopApi.use();
    useEffect(() => {
        desktopState.entries.push(entry);
        desktopApi.render();
        return () => {
            const index = desktopState.entries.indexOf(entry);
            if (index >= 0) desktopState.entries.splice(index, 1);
            desktopApi.render();
        };
    }, [entry]);

    return {
        entry,
        stack: resolveStack(entry) ?? {index: 0, zIndex: baseZIndex, active: false},
        bringToFront: () => bringEntryToFront(entry),
        sync(next: Pick<FloatingDesktopEntry, "minimized" | "mode" | "snapRegion"> & {actions: DesktopActions}) {
            const changed = entry.minimized != next.minimized || entry.mode != next.mode || entry.snapRegion != next.snapRegion;
            entry.minimized = next.minimized;
            entry.mode = next.mode;
            entry.snapRegion = next.snapRegion;
            entry.actions = next.actions;
            if (changed) desktopApi.render();
        },
    };
}

export type FloatingWindowManager = {
    ids: readonly string[];
    activeId?: string;
    windows: readonly FloatingDesktopWindow[];
    bringToFront(windowId: string): void;
    minimize(windowId: string): void;
    restore(windowId: string): void;
};

export function useFloatingWindowManager(stackGroup = "window"): FloatingWindowManager {
    desktopApi.use();
    const entries = groupEntries(stackGroup);
    const active = groupEntries(stackGroup, false).at(-1);
    const find = (id: string) => entries.find(entry => entry.publicId == id);
    return {
        ids: entries.map(entry => entry.publicId),
        activeId: active?.publicId,
        windows: entries.map(entry => ({
            id: entry.publicId,
            label: entry.label,
            active: entry === active,
            minimized: entry.minimized,
            mode: entry.mode,
            snapRegion: entry.snapRegion,
        })),
        bringToFront(windowId) {
            const entry = find(windowId);
            if (entry) bringEntryToFront(entry);
        },
        minimize(windowId) {
            find(windowId)?.actions.minimize();
        },
        restore(windowId) {
            const entry = find(windowId);
            if (!entry) return;
            entry.actions.restore();
            bringEntryToFront(entry);
        },
    };
}

export type FloatingWindowTaskbarProps = {
    stackGroup?: string;
    portal?: boolean;
    container?: Element;
    className?: string;
    style?: React.CSSProperties;
    renderItem?: (window: FloatingDesktopWindow, manager: FloatingWindowManager) => ReactNode;
};

/** Optional common window panel. Its manager/renderItem API is headless; the
 * default markup is intentionally tiny and can be replaced by the consumer. */
export function FloatingWindowTaskbar({
    stackGroup = "window",
    portal = true,
    container,
    className,
    style,
    renderItem,
}: FloatingWindowTaskbarProps) {
    const manager = useFloatingWindowManager(stackGroup);
    if (!manager.windows.length) return null;
    const node = <nav className={className ?? "wenayWindowTaskbar"} style={style} aria-label="Windows">
        {manager.windows.map(window => <React.Fragment key={window.id}>
            {renderItem
                ? renderItem(window, manager)
                : <button
                    type="button"
                    className="wenayWindowTaskbarItem"
                    data-active={window.active ? "true" : "false"}
                    data-minimized={window.minimized ? "true" : "false"}
                    aria-pressed={window.active && !window.minimized}
                    onClick={() => manager.restore(window.id)}
                >{window.label}</button>}
        </React.Fragment>)}
    </nav>;
    return portal && typeof document != "undefined" ? createPortal(node, container ?? document.body) : node;
}
