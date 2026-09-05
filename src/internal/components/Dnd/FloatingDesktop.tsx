import React, {ReactNode, useCallback, useEffect, useRef, useSyncExternalStore} from "react";
import {createPortal} from "react-dom";
import {createUpdateApi} from "../../updateBy.js";
import type {FloatingWindowMode, FloatingWindowSnapRegion} from "../../utils/floatingWindowTypes.js";

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
const subscribeDesktop = (onStoreChange: () => void) => desktopApi.subscribe(onStoreChange);
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

export type FloatingDesktopStack = {index: number; zIndex: number; active: boolean};

/** Every raise/register/minimize re-runs resolveStack for every window, but it only *changes*
 *  for the few windows whose slot moved. Windows subscribe to this memoised tuple instead of to
 *  the desktop object, so an unchanged stack position is an identical snapshot and React bails
 *  the window (and its whole subtree) out of the re-render. */
const stackSnapshots = new WeakMap<FloatingDesktopEntry, FloatingDesktopStack>();

function stackSnapshot(entry: FloatingDesktopEntry): FloatingDesktopStack {
    const next = resolveStack(entry) ?? {index: 0, zIndex: entry.baseZIndex, active: false};
    const previous = stackSnapshots.get(entry);
    if (previous && previous.index == next.index && previous.zIndex == next.zIndex && previous.active == next.active)
        return previous;
    stackSnapshots.set(entry, next);
    return next;
}

function registerEntry(entry: FloatingDesktopEntry) {
    // Effects run children-first, so a window nested in another window's React tree (a
    // FloatingWindow opened by a Button inside a FloatingWindow) registers before its opener; a
    // plain push would then put the opener on top of it. `key` is handed out during render, i.e.
    // in document order, so slot the entry below anything created after it. Entries created later
    // can only be ahead of it inside the same effect flush -- passive effects are drained before
    // the next render, and bringToFront only runs from events.
    const later = desktopState.entries.findIndex(candidate => candidate.key > entry.key);
    if (later >= 0) desktopState.entries.splice(later, 0, entry);
    else desktopState.entries.push(entry);
    desktopApi.render();
}

function bringEntryToFront(entry: FloatingDesktopEntry) {
    const index = desktopState.entries.indexOf(entry);
    if (index < 0) return;
    const last = desktopState.entries.findLastIndex(candidate => candidate.group == entry.group);
    if (index == last) return;
    desktopState.entries.splice(index, 1);
    desktopState.entries.push(entry);
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

    const getStack = useCallback(() => stackSnapshot(entry), [entry]);
    const stack = useSyncExternalStore(subscribeDesktop, getStack, getStack);
    useEffect(() => {
        registerEntry(entry);
        return () => {
            const index = desktopState.entries.indexOf(entry);
            if (index >= 0) desktopState.entries.splice(index, 1);
            desktopApi.render();
        };
    }, [entry]);

    return {
        entry,
        stack,
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
