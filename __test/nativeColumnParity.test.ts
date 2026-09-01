import {createNativeColumnState} from "../src/native/columnState";
import {pinFixedOrder} from "../src/internal/utils/fixedOrder";
import {createColumnState} from "../src/internal/grid/columnState/columnState";

/** `src/native` may not import a single value from the shared tree - that is the whole point of
 *  the subpath (see nativeIsolation.test.ts). The two controllers therefore used to carry copies
 *  of the same defaults / normalize / pinFixed / visibleKeys / sort-cycle logic, and a copy that
 *  nothing compares WILL drift: fix an invariant on one side and the two platforms quietly
 *  disagree about the same persisted JSON, which doc/native.md promises is identical.
 *
 *  They now share src/native/columnStateCore.ts - the allowed direction, since the shared tree
 *  may import from native but never the reverse - and utils/fixedOrder delegates to it. This
 *  file is the comparison that keeps them honest: it exercises both sides through their PUBLIC
 *  surfaces, so it keeps working regardless of how either is refactored internally. */

type Col = {key: string; title: string; fixed?: boolean};

const CASES: Array<{name: string; columns: Col[]; order: string[]}> = [
    {
        name: "no fixed columns keeps the requested order",
        columns: [{key: "a", title: "A"}, {key: "b", title: "B"}, {key: "c", title: "C"}],
        order: ["c", "a", "b"],
    },
    {
        name: "a leading fixed column is pinned back to its index",
        columns: [{key: "a", title: "A", fixed: true}, {key: "b", title: "B"}, {key: "c", title: "C"}],
        order: ["c", "b", "a"],
    },
    {
        name: "a fixed column in the middle lands at its own index",
        columns: [{key: "a", title: "A"}, {key: "b", title: "B", fixed: true}, {key: "c", title: "C"}],
        order: ["c", "b", "a"],
    },
    {
        name: "several fixed columns keep their relative descriptor order",
        columns: [
            {key: "a", title: "A", fixed: true},
            {key: "b", title: "B"},
            {key: "c", title: "C", fixed: true},
            {key: "d", title: "D"},
        ],
        order: ["d", "c", "b", "a"],
    },
    {
        name: "a fixed column declared last is pinned to the tail",
        columns: [{key: "a", title: "A"}, {key: "b", title: "B"}, {key: "c", title: "C", fixed: true}],
        order: ["c", "b", "a"],
    },
];

describe("native and web agree on fixed-column pinning", () => {
    test.each(CASES)("$name", ({name, columns, order}) => {
        const expected = pinFixedOrder(order, columns);

        const native = createNativeColumnState({key: `test.parity.native.${name}`, columns});
        native.api.setConfig({...native.api.getConfig(), order: order.slice()});

        const web = createColumnState({key: `test.parity.web.${name}`, columns});
        web.api.setConfig({...web.api.getConfig(), order: order.slice()});

        expect(native.api.getConfig().order).toEqual(expected);
        expect(web.api.getConfig().order).toEqual(expected);
    });
});

describe("native and web agree on the persisted config shape", () => {
    const columns: Col[] = [{key: "a", title: "A", fixed: true}, {key: "b", title: "B"}, {key: "c", title: "C"}];

    test("both start from the descriptor order with everything visible", () => {
        const native = createNativeColumnState({key: "test.parity.shape.native", columns}).api.getConfig();
        const web = createColumnState({key: "test.parity.shape.web", columns}).api.getConfig();

        expect(native.order).toEqual(web.order);
        expect(native.visible).toEqual(web.visible);
        expect(native.sort).toEqual(web.sort);
    });

    test("both append keys the stored order does not mention", () => {
        // a config written before a column existed must not hide it - and the two platforms
        // have to agree on WHERE the newcomer lands. pinFixedOrder alone does not cover this:
        // the appending happens in each side's normalize(), which is the other copied part.
        const partial = ["c"];
        const native = createNativeColumnState({key: "test.parity.append.native", columns});
        native.api.setConfig({...native.api.getConfig(), order: partial.slice()});
        const web = createColumnState({key: "test.parity.append.web", columns});
        web.api.setConfig({...web.api.getConfig(), order: partial.slice()});

        expect(native.api.getConfig().order).toEqual(web.api.getConfig().order);
        expect(native.api.getConfig().order).toEqual(expect.arrayContaining(["a", "b", "c"]));
    });

    test("both carry the same schema version", () => {
        // doc/native.md states the persisted JSON is interchangeable; a bump on one side only
        // would silently invalidate the other platform's stored layouts.
        const native = createNativeColumnState({key: "test.parity.v.native", columns}).api.getConfig();
        const web = createColumnState({key: "test.parity.v.web", columns}).api.getConfig();
        expect(native.v).toBe(web.v);
    });
});


describe("native and web agree on the shared core rules", () => {
    type FullCol = {key: string; title: string; fixed?: boolean; group?: string; defaultVisible?: boolean};

    const pair = (name: string, columns: FullCol[]) => ({
        native: createNativeColumnState({key: `test.parity.core.native.${name}`, columns}),
        web: createColumnState({key: `test.parity.core.web.${name}`, columns}),
    });

    test("grouped columns default to visible with a full group membership", () => {
        // a grouped column reaches visibleKeys only while its group still lists it; the DEFAULT
        // membership is "every member", so nothing is hidden merely for being grouped.
        const columns: FullCol[] = [
            {key: "a", title: "A"},
            {key: "v1", title: "V1", group: "versions"},
            {key: "v2", title: "V2", group: "versions"},
            {key: "h", title: "H", defaultVisible: false},
        ];
        const {native, web} = pair("grouped", columns);

        expect(native.api.getConfig().groups).toEqual({versions: ["v1", "v2"]});
        expect(web.api.getConfig().groups).toEqual(native.api.getConfig().groups);
        expect(native.api.getConfig().visible).toEqual(web.api.getConfig().visible);
        expect(native.api.getConfig().visible.h).toBe(false);
        expect(native.api.visibleKeys()).toEqual(web.api.visibleKeys());
        expect(native.api.visibleKeys()).toEqual(["a", "v1", "v2"]);
    });

    test("a group listing only some members hides the rest from visibleKeys", () => {
        const columns: FullCol[] = [
            {key: "a", title: "A"},
            {key: "v1", title: "V1", group: "versions"},
            {key: "v2", title: "V2", group: "versions"},
        ];
        const {native, web} = pair("groupSubset", columns);
        native.api.setConfig({...native.api.getConfig(), groups: {versions: ["v2"]}});
        web.api.setConfig({...web.api.getConfig(), groups: {versions: ["v2"]}});

        expect(native.api.visibleKeys()).toEqual(["a", "v2"]);
        expect(web.api.visibleKeys()).toEqual(native.api.visibleKeys());
    });

    test("groups are clamped to their own members; a non-array group falls back to all", () => {
        const columns: FullCol[] = [
            {key: "a", title: "A"},
            {key: "v1", title: "V1", group: "versions"},
            {key: "v2", title: "V2", group: "versions"},
            {key: "s1", title: "S1", group: "sizes"},
        ];
        const {native, web} = pair("groupClamp", columns);
        // "a" is not a member of "versions", "nope" is not a column at all, "sizes" is garbage
        // and "ghost" is not a group: only real members of real groups may survive.
        const dirty = {versions: ["v2", "a", "nope"], sizes: "not-an-array", ghost: ["x"]} as never;
        native.api.setConfig({...native.api.getConfig(), groups: dirty});
        web.api.setConfig({...web.api.getConfig(), groups: dirty});

        const expected = {versions: ["v2"], sizes: ["s1"]};
        expect(native.api.getConfig().groups).toEqual(expected);
        expect(web.api.getConfig().groups).toEqual(expected);
    });

    test("widths keep only finite positive numbers for known keys", () => {
        const columns: FullCol[] = [{key: "a", title: "A"}, {key: "b", title: "B"}];
        const {native, web} = pair("width", columns);
        const dirty = {a: 120, b: 0, ghost: 200, neg: -5, nan: NaN, inf: Infinity, str: "80"} as never;
        native.api.setConfig({...native.api.getConfig(), width: dirty});
        web.api.setConfig({...web.api.getConfig(), width: dirty});

        expect(native.api.getConfig().width).toEqual({a: 120});
        expect(web.api.getConfig().width).toEqual({a: 120});
    });

    test("filter entries survive only for known keys, values untouched", () => {
        const columns: FullCol[] = [{key: "a", title: "A"}, {key: "b", title: "B"}];
        const {native, web} = pair("filter", columns);
        const dirty = {a: {type: "contains", filter: "x"}, ghost: {type: "equals"}, b: null} as never;
        native.api.setConfig({...native.api.getConfig(), filter: dirty});
        web.api.setConfig({...web.api.getConfig(), filter: dirty});

        const expected = {a: {type: "contains", filter: "x"}, b: null};
        expect(native.api.getConfig().filter).toEqual(expected);
        expect(web.api.getConfig().filter).toEqual(expected);
    });

    test("an unknown or malformed sort normalizes to null on both sides", () => {
        const columns: FullCol[] = [{key: "a", title: "A"}, {key: "b", title: "B"}];
        const {native, web} = pair("sortNorm", columns);
        for (const bad of [{key: "ghost", dir: "asc"}, {key: "a", dir: "sideways"}] as never[]) {
            native.api.setConfig({...native.api.getConfig(), sort: bad});
            web.api.setConfig({...web.api.getConfig(), sort: bad});
            expect(native.api.getConfig().sort).toBeNull();
            expect(web.api.getConfig().sort).toBeNull();
        }
    });

    test("toggleSort cycles asc -> desc -> off, and another column restarts at asc", () => {
        const columns: FullCol[] = [{key: "a", title: "A"}, {key: "b", title: "B"}];
        const {native, web} = pair("toggle", columns);
        const both = (key: string) => {
            native.api.toggleSort(key);
            web.api.toggleSort(key);
            expect(native.api.getConfig().sort).toEqual(web.api.getConfig().sort);
            return native.api.getConfig().sort;
        };

        expect(both("a")).toEqual({key: "a", dir: "asc"});
        expect(both("a")).toEqual({key: "a", dir: "desc"});
        expect(both("a")).toBeNull();
        expect(both("a")).toEqual({key: "a", dir: "asc"});
        // a different column replaces the sticky sort and starts its own cycle
        expect(both("b")).toEqual({key: "b", dir: "asc"});
        expect(both("b")).toEqual({key: "b", dir: "desc"});
    });

    test("a fixed column is force-visible and cannot be hidden through the config", () => {
        const columns: FullCol[] = [{key: "a", title: "A", fixed: true}, {key: "b", title: "B"}];
        const {native, web} = pair("fixedVisible", columns);
        native.api.setConfig({...native.api.getConfig(), visible: {a: false, b: false}});
        web.api.setConfig({...web.api.getConfig(), visible: {a: false, b: false}});

        expect(native.api.getConfig().visible).toEqual({a: true, b: false});
        expect(web.api.getConfig().visible).toEqual({a: true, b: false});
        expect(native.api.visibleKeys()).toEqual(["a"]);
        expect(web.api.visibleKeys()).toEqual(["a"]);
    });
});
