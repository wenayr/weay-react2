/** The floatingWindowMap side of the window controller: reading the persisted entry during
 *  render, healing a damaged one, and re-applying the entry the application's storage layer
 *  installs after mount. Extracted from FloatingWindow.tsx unchanged - the hooks below are
 *  called from useFloatingWindowController in exactly the order they used to run inline, so
 *  hook order, effect order and dependency arrays are the same as before. */
import type React from "react";
import { useEffect, useRef } from "react";
import { floatingWindowMap } from "../../utils/persistedMaps.js";
import { isUsableSize, snapGeometry, viewportUnusable } from "./windowGeometry.js";
import type {
    FloatingWindowPosition,
    FloatingWindowSavedGeometry,
    FloatingWindowSize,
    FloatingWindowSnapRegion,
} from "../../utils/floatingWindowTypes.js";

type tRND = FloatingWindowSavedGeometry;
type tSize = FloatingWindowSize;

export type PersistedGeometry = {
    map: tRND | undefined;
    persistedMapRef: React.MutableRefObject<tRND | undefined>;
    appliedMapRef: React.MutableRefObject<tRND | undefined>;
    propSizeRef: React.MutableRefObject<FloatingWindowSize>;
};

/** Render-phase read of the persisted entry plus the in-place repair of a 0x0 record. */
export function usePersistedGeometry(
    ks: string | undefined,
    positionDef: FloatingWindowPosition,
    sizeDef: FloatingWindowSize,
): PersistedGeometry {
    const repaired = useRef(false);
    let map: tRND | undefined;
    if (ks) {
        map = floatingWindowMap.get(ks) ?? floatingWindowMap.set(ks, { size: sizeDef, position: positionDef }).get(ks);
        // A session that ran at a zero viewport (hidden tab, prerender) could have stored a 0x0
        // size before this was guarded, and the stored geometry outranks the size prop - the
        // window came back 2px wide with nothing to grab. Heal the entry in place instead of
        // just ignoring it, so the mirror below keeps writing through to the same object.
        if (map && !isUsableSize(map.size)) { map.size = {...sizeDef}; repaired.current = true; }
        if (map?.freeGeometry && !isUsableSize(map.freeGeometry.size)) { map.freeGeometry.size = {...sizeDef}; repaired.current = true; }
    }
    const persistedMapRef = useRef<tRND | undefined>(map);
    persistedMapRef.current = map;
    // What a damaged entry falls back to, readable from the hydration effect (which only
    // re-subscribes on ks/snappable and would otherwise close over the first render's props).
    const propSizeRef = useRef<tSize>(sizeDef);
    propSizeRef.current = sizeDef;
    // Announce a repair once, out of the render phase, so the damaged record is rewritten to
    // storage instead of being re-healed on every load for the rest of its life.
    useEffect(() => {
        if (!ks || !repaired.current) return;
        repaired.current = false;
        floatingWindowMap.touch(ks);
    });
    const appliedMapRef = useRef<tRND | undefined>(map);
    return {map, persistedMapRef, appliedMapRef, propSizeRef};
}

export type PersistedGeometrySubscription = {
    ks: string | undefined;
    snappable: boolean;
    persistedMapRef: React.MutableRefObject<tRND | undefined>;
    appliedMapRef: React.MutableRefObject<tRND | undefined>;
    propSizeRef: React.MutableRefObject<tSize>;
    unsnappedGeometry: React.MutableRefObject<FloatingWindowSavedGeometry>;
    restoreGeometry: React.MutableRefObject<FloatingWindowSavedGeometry>;
    callbacksRef: React.MutableRefObject<{onSnapChange?: (region: FloatingWindowSnapRegion | null) => void}>;
    setSnapRegion: (region: FloatingWindowSnapRegion | null) => void;
    setX: (value: number) => void;
    setY: (value: number) => void;
    setWidth: (value: number | string) => void;
    setHeight: (value: number | string) => void;
};

/** The application loads storage after mount, so a window can render once with defaults before
 *  memoryCache replaces its entry. Object identity separates that hydration from this
 *  controller's own in-place geometry edits. */
export function usePersistedGeometrySubscription(o: PersistedGeometrySubscription) {
    const {ks, snappable} = o;
    useEffect(() => {
        if (!ks) return;
        const applyPersistedEntry = (changedKey?: string) => {
            if (changedKey !== undefined && changedKey !== ks) return;
            const next = floatingWindowMap.get(ks);
            if (!next || next === o.appliedMapRef.current) return;
            o.appliedMapRef.current = next;
            o.persistedMapRef.current = next;
            // Same repair as at mount: storage loaded after the first render can carry the
            // damaged 0x0 entry just as well.
            if (!isUsableSize(next.size)) next.size = {...o.propSizeRef.current};
            if (next.freeGeometry && !isUsableSize(next.freeGeometry.size)) next.freeGeometry.size = {...o.propSizeRef.current};
            const free = next.freeGeometry ?? next;
            o.unsnappedGeometry.current = {
                position: {...free.position},
                size: {...free.size},
            };
            o.restoreGeometry.current = {
                position: {...next.position},
                size: {...next.size},
            };
            const nextSnap = next.snapRegion ?? null;
            o.setSnapRegion(nextSnap);
            o.callbacksRef.current.onSnapChange?.(nextSnap);
            if (nextSnap && snappable && !viewportUnusable()) {
                const geometry = snapGeometry(nextSnap);
                o.setX(geometry.position.x);
                o.setY(geometry.position.y);
                o.setWidth(geometry.size.width);
                o.setHeight(geometry.size.height);
            } else {
                o.setX(next.position.x);
                o.setY(next.position.y);
                o.setWidth(next.size.width);
                o.setHeight(next.size.height);
            }
        };
        applyPersistedEntry();
        return floatingWindowMap.onChange(applyPersistedEntry);
    }, [ks, snappable]);
}
