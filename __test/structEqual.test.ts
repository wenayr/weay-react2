import {structEqual} from "../src/common/src/utils/structEqual";

// structEqual replaces the JSON.stringify guard in columnState.readFromGrid.
// It must keep stringify's tolerances (undefined props absent, NaN==NaN) while
// dropping its key-order sensitivity - the exact false-positive the grid's
// getFilterModel() used to trigger.

describe("structEqual", () => {
    test("primitives and identity", () => {
        expect(structEqual(1, 1)).toBe(true);
        expect(structEqual("a", "a")).toBe(true);
        expect(structEqual(1, "1")).toBe(false);
        expect(structEqual(null, null)).toBe(true);
        expect(structEqual(null, {})).toBe(false);
        expect(structEqual(undefined, undefined)).toBe(true);
        expect(structEqual(0, -0)).toBe(true);
    });

    test("NaN equals NaN (JSON serialized both to null)", () => {
        expect(structEqual(NaN, NaN)).toBe(true);
        expect(structEqual({w: NaN}, {w: NaN})).toBe(true);
        expect(structEqual(NaN, 1)).toBe(false);
    });

    test("object key order does not matter", () => {
        expect(structEqual({a: 1, b: 2}, {b: 2, a: 1})).toBe(true);
        expect(structEqual({f: {x: 1, y: 2}}, {f: {y: 2, x: 1}})).toBe(true);
    });

    test("undefined-valued props count as absent", () => {
        expect(structEqual({a: 1, b: undefined}, {a: 1})).toBe(true);
        expect(structEqual({a: undefined}, {})).toBe(true);
        expect(structEqual({a: undefined}, {a: null})).toBe(false);
    });

    test("arrays are ordered", () => {
        expect(structEqual(["a", "b"], ["a", "b"])).toBe(true);
        expect(structEqual(["a", "b"], ["b", "a"])).toBe(false);
        expect(structEqual([1, 2], [1, 2, 3])).toBe(false);
        expect(structEqual([], {})).toBe(false);
    });

    test("columns-config shaped trees", () => {
        const cfg = {order: ["a", "b"], visible: {a: true, b: false}, width: {a: 100}, sort: {key: "a", dir: "asc"}, filter: {a: {type: "contains", filter: "x"}}};
        const sameOtherKeyOrder = {filter: {a: {filter: "x", type: "contains"}}, sort: {dir: "asc", key: "a"}, width: {a: 100}, visible: {b: false, a: true}, order: ["a", "b"]};
        expect(structEqual(cfg, sameOtherKeyOrder)).toBe(true);
        expect(structEqual(cfg, {...cfg, sort: null})).toBe(false);
        expect(structEqual(cfg, {...cfg, order: ["b", "a"]})).toBe(false);
        expect(structEqual(cfg, {...cfg, width: {a: 101}})).toBe(false);
    });
});
