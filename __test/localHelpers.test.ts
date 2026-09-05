// The helpers under src/internal/utils that replaced imports from the CommonJS
// `wenay-common2/client` barrel (2.2.0) must behave exactly like the originals.
// This pins them against the real implementations, so an upstream change shows up here.
import * as common2 from "wenay-common2/client";
import {deepClone} from "../src/internal/utils/deepClone";
import {promiseProgress, sleepAsync} from "../src/internal/utils/async";
import {colorGenerator2} from "../src/internal/utils/colorGenerator";

test("deepClone matches wenay-common2 for nested objects, arrays, Date, Map, Set and cycles", () => {
    const shared = {n: 1};
    const src: any = {
        a: [1, {b: shared}, shared],
        d: new Date(1700000000000),
        m: new Map<any, any>([["k", {v: [1, 2]}]]),
        s: new Set<any>([1, {x: 1}]),
        nested: {deep: {deeper: "x"}},
    };
    src.self = src;

    const ours = deepClone(src);
    const theirs = common2.deepClone(src);

    expect(ours).not.toBe(src);
    expect(ours.self).toBe(ours);
    expect(theirs.self).toBe(theirs);
    expect(ours.a[1].b).toBe(ours.a[2]);          // shared reference stays shared
    expect(ours.a[1].b).not.toBe(shared);
    expect(ours.d).toEqual(src.d);
    expect(ours.d).not.toBe(src.d);
    expect(ours.m.get("k")).toEqual({v: [1, 2]});
    expect(ours.m.get("k")).not.toBe(src.m.get("k"));
    expect([...ours.s][1]).toEqual({x: 1});
    expect(ours.nested).toEqual(theirs.nested);
    expect(deepClone(null)).toBeNull();
    expect(deepClone(5)).toBe(5);
});

test("promiseProgress reports ok/error counts like wenay-common2 and starts factories lazily", async () => {
    const runFor = async (impl: typeof promiseProgress) => {
        let started = 0;
        const tasks = [
            Promise.resolve("a"),
            () => { started++; return Promise.resolve("b"); },
            () => { started++; return Promise.reject(new Error("c")); },
        ];
        const p = impl(tasks as any);
        const ok: number[][] = [];
        const errors: number[][] = [];
        p.onOk((_d: any, i: number, okCount: number, errCount: number, count: number) => ok.push([i, okCount, errCount, count]));
        p.onError((_e: any, i: number, okCount: number, errCount: number, count: number) => errors.push([i, okCount, errCount, count]));
        await sleepAsync(0);
        const startedBeforeAll = started;
        const settled = await p.allSettled();
        return {startedBeforeAll, started, ok: ok.sort(), errors, stats: p.stats(), statuses: settled.map(s => s.status)};
    };
    const ours = await runFor(promiseProgress);
    const theirs = await runFor(common2.promiseProgress as any);
    expect(ours).toEqual(theirs);
    expect(ours.startedBeforeAll).toBe(0);
    expect(ours.stats).toEqual({ok: 2, error: 1, count: 3});
});

test("colorGenerator2 yields the same sequence as wenay-common2", () => {
    const take = (gen: Iterator<any>, n: number) => Array.from({length: n}, () => [...gen.next().value]);
    expect(take(colorGenerator2({min: 0, max: 90}), 40)).toEqual(take(common2.colorGenerator2({min: 0, max: 90}), 40));
    expect(take(colorGenerator2(), 25)).toEqual(take(common2.colorGenerator2(), 25));
});
