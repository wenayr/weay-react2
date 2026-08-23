import {createNativeColumnState} from "../src/native/columnState";
import {pinFixedOrder} from "../src/common/src/utils/fixedOrder";
import {createColumnState} from "../src/common/src/grid/columnState/columnState";

/** `src/native` may not import a single value from the shared tree - that is the whole point of
 *  the subpath (see nativeIsolation.test.ts), so its `pinFixed` is a deliberate copy of
 *  utils/fixedOrder's `pinFixedOrder` rather than a reuse. A copy that nothing compares WILL
 *  drift: fix an invariant on one side and the two platforms quietly disagree about the same
 *  persisted JSON, which doc/native.md promises is identical.
 *
 *  This file is the comparison. It exercises the copies through their PUBLIC surfaces, so it
 *  keeps working regardless of how either side is refactored internally. */

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
