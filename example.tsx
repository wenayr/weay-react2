/* example.tsx - updateBy reactivity: current approach -> preferred approach -> old interfaces.
 * Reference file, not included in the build (tsconfig files: ["src/index.ts"]). */

import React, { useLayoutEffect, useSyncExternalStore } from "react";


/* === 1. CURRENT APPROACH =====================================================
 * State is an external mutable object. Mutating it in place does not change the
 * reference, so Object.is cannot detect it. React receives a version counter as
 * the snapshot, while mutation and notification are done as two separate steps. */

const subsOld = new WeakMap<object, { v: number; ls: Set<() => void> }>();
const regOld = (a: object) => subsOld.get(a) ?? subsOld.set(a, { v: 0, ls: new Set() }).get(a)!;

function updateByOld<T extends object>(a: T) {
    const r = regOld(a);
    useSyncExternalStore(l => (r.ls.add(l), () => r.ls.delete(l)), () => r.v); // snapshot = counter
}
function renderByOld(a: object) {
    const r = regOld(a);
    r.v++;                    // 1) bump the counter
    r.ls.forEach(l => l());   // 2) notify as a separate step; easy to forget or duplicate
}
// Data is read from `a` itself: updateByOld(state); ... return <>{state.count}</>


/* === 2. PREFERRED APPROACH (MODERN, COMPACT) =================================
 * State belongs to the store. set() changes the value (new reference) AND
 * notifies in one action. Snapshot means the data itself through a selector:
 * rerender only when the selected slice changes. (useSyncExternalStore appeared
 * in React 18 (2022); it did not exist in 2020.) */

type Upd<T> = T | ((p: T) => T);

function makeStore<T>(initial: T) {
    let state = initial, timer: ReturnType<typeof setTimeout> | undefined;
    const subs = new Set<() => void>();
    const emit = () => subs.forEach(f => f());
    return {
        get: () => state,
        set(next: Upd<T>, ms?: number) {
            const v = typeof next === "function" ? (next as (p: T) => T)(state) : next;
            if (Object.is(v, state)) return;                                   // no change, no render
            state = v;
            ms ? (clearTimeout(timer), timer = setTimeout(emit, ms)) : emit(); // built-in debounce
        },
        subscribe: (f: () => void) => (subs.add(f), () => { subs.delete(f); }),
    };
}
function useSlice<T, S>(s: ReturnType<typeof makeStore<T>>, select: (st: T) => S): S {
    return useSyncExternalStore(s.subscribe, () => select(s.get()));
}
// Usage:
//   const app = makeStore({ count: 0, theme: "light" });
//   const count = useSlice(app, s => s.count);            // rerender only on count
//   app.set(s => ({ ...s, count: s.count + 1 }));         // immediately
//   app.set(s => ({ ...s, count: s.count + 1 }), 300);    // with 300 ms debounce


/* === 3. SAME IDEA FOR OLD INTERFACES =========================================
 * Names and types match your updateBy.ts one-to-one, so consumers do not change
 * a line. Internally this uses the store from block 2. Data remains in external
 * `a` because old code reads it directly; the store only notifies: tick wakes
 * updateBy(a) subscribers, cbs is the updateBy(a, f) mode. */

const reg = new WeakMap<object, { tick: ReturnType<typeof makeStore<number>>; cbs: Set<(a: any) => void>; timer?: ReturnType<typeof setTimeout> }>();
const regOf = (a: object) => reg.get(a) ?? reg.set(a, { tick: makeStore(0), cbs: new Set() }).get(a)!;

function fire(a: object, order: "normal" | "reverse" | "last", ms?: number) {
    const r = regOf(a);
    const run = () => {
        const cbs = [...r.cbs];
        order === "last" ? cbs.at(-1)?.(a) : (order === "reverse" ? cbs.reverse() : cbs).forEach(f => f(a));
        r.tick.set(t => t + 1);                                          // wake updateBy(a) subscribers
    };
    ms ? (clearTimeout(r.timer), r.timer = setTimeout(run, ms)) : run(); // debounce like renderBy(a, ms)
}

/** @deprecated -> makeStore + useSlice */
function updateBy<T extends object>(a: T, f?: React.Dispatch<React.SetStateAction<T>> | ((a: T) => void)) {
    const r = regOf(a);
    useSlice(r.tick, t => (f ? 0 : t));   // f mode: constant snapshot, no auto-rerender (as in old code)
    useLayoutEffect(() => {
        if (!f) return;
        const cb = f as (a: any) => void;
        r.cbs.add(cb);
        return () => { r.cbs.delete(cb); };
    }, [a, f]);
}
/** @deprecated -> app.set(...) */
const renderBy = (a: object, ms?: number) => fire(a, "normal", ms);
/** @deprecated order only matters for f callbacks */
const renderByRevers = (a: object, ms?: number, reverse = true) => fire(a, reverse ? "reverse" : "normal", ms);
/** @deprecated "last" is for f callbacks; reactive subscribers all update, which is safer than the old behavior */
const renderByLast = (a: object, ms?: number) => fire(a, "last", ms);
const useUpdateBy = updateBy;


export { updateByOld, renderByOld, makeStore, useSlice, updateBy, useUpdateBy, renderBy, renderByRevers, renderByLast };
