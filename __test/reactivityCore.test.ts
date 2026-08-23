import {deepMergeWithMap} from "../src/common/src/utils/memoryStore";
import {map3, renderBy, createUpdateApi} from "../src/common/updateBy";

// deepMergeWithMap fed the visited map a {} placeholder it never filled in, treated a truthy
// primitive as a merge base, and aliased the def's arrays straight into persisted state.
describe("deepMergeWithMap", () => {
    test("a subtree shared by two keys lands as the same merged object, not as {}", () => {
        const shared = {mode: 1, deep: {n: 2}};
        const def = {a: shared, b: shared};
        const out = deepMergeWithMap({}, def);

        expect(out.a).toEqual({mode: 1, deep: {n: 2}});
        expect(out.b).toEqual({mode: 1, deep: {n: 2}});
        expect(out.b).toBe(out.a);
    });

    test("a cyclic def terminates and keeps the back-reference", () => {
        const node: any = {name: "root"};
        node.self = node;
        const out = deepMergeWithMap({}, {node});

        expect(out.node.name).toBe("root");
        expect(out.node.self).toBe(out.node);
    });

    test("a stored primitive does not swallow the def's subtree", () => {
        const out = deepMergeWithMap({opt: 5}, {opt: {mode: 1}});
        expect(out.opt).toEqual({mode: 1});
    });

    test("a stored object under a primitive def is overwritten by the primitive", () => {
        const out = deepMergeWithMap({opt: {mode: 1}}, {opt: 5});
        expect(out.opt).toBe(5);
    });

    test("the def's arrays are copied, so mutating state never touches the module const", () => {
        const def = {items: ["a", "b"]};
        const out = deepMergeWithMap({}, def);

        expect(out.items).toEqual(["a", "b"]);
        expect(out.items).not.toBe(def.items);
        out.items.push("c");
        expect(def.items).toEqual(["a", "b"]);
    });

    test("merging is still source-wins and returns the target", () => {
        const target = {keep: 1, over: "old"};
        const out = deepMergeWithMap(target, {over: "new", add: 2});
        expect(out).toBe(target);
        expect(out).toEqual({keep: 1, over: "new", add: 2});
    });
});

// getSnapshot reads the version during render; React re-reads it right after subscribing.
// triggerUpdate used to return before bumping when nothing was subscribed yet, so a mutation
// landing in that window compared equal and the component stayed stale.
describe("updateBy version", () => {
    test("the version moves even with no subscribers", () => {
        const store = {n: 0};
        const before = map3.get(store)?.version ?? 0;

        store.n = 1;
        renderBy(store);

        const after = map3.get(store)?.version ?? 0;
        expect(after).toBeGreaterThan(before);
    });

    test("repeated unsubscribed updates keep moving the version", () => {
        const store = {n: 0};
        renderBy(store);
        const first = map3.get(store)!.version;
        renderBy(store);
        expect(map3.get(store)!.version).toBeGreaterThan(first);
    });

    test("a subscribed store still gets exactly one bump per renderBy", () => {
        const store = {n: 0};
        const api = createUpdateApi(store);
        const off = api.on(() => {});
        api.render();   // the observer state is created lazily, on the first trigger

        const before = map3.get(store)!.version;
        api.render();
        expect(map3.get(store)!.version).toBe(before + 1);

        off();
    });
});
