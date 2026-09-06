import * as root from "../src/index";
import * as core from "../src/core/index";
import * as react from "../src/react/index";
import * as grid from "../src/grid/index";
import * as windows from "../src/windows/index";
import * as logs from "../src/logs/index";
import * as communication from "../src/communication/index";
import * as persist from "../src/persist/index";
import * as params from "../src/params/index";
import * as modal from "../src/modal/index";
import * as menu from "../src/menu/index";
import * as chart from "../src/chart/index";
import * as ui from "../src/ui/index";
import * as native from "../src/native/index";

/** The subpath barrels are hand-maintained lists over the same modules the root
 *  `export *` already covers, so they drift silently: `renderByRevers` sat in the root
 *  surface but was missing from ./react. Type-only exports vanish at runtime, so this
 *  compares runtime values -- exactly the half that breaks a consumer's import.
 *
 *  ./native is the documented exception (doc/native.md): a DOM/CSS/ag-grid-free React
 *  Native entrypoint. Its absence from the root barrel is the point -- the root pulls in
 *  react-dom and ag-grid -- so it gets the opposite assertion. */
const mirrored: [string, Record<string, unknown>][] = [
    ["./core", core],
    ["./react", react],
    ["./grid", grid],
    ["./windows", windows],
    ["./logs", logs],
    ["./communication", communication],
    ["./persist", persist],
    ["./params", params],
    ["./modal", modal],
    ["./menu", menu],
    ["./chart", chart],
    ["./ui", ui],
];

const runtimeNames = (module: Record<string, unknown>) =>
    Object.keys(module).filter(name => name != "default" && module[name] !== undefined);

describe("package barrels", () => {
    test.each(mirrored)("%s exports nothing the root barrel lacks", (_label, module) => {
        const missing = runtimeNames(module).filter(name => !(name in root));
        expect(missing).toEqual([]);
    });

    test.each(mirrored)("%s re-exports the same binding as the root barrel", (_label, module) => {
        const diverged = runtimeNames(module).filter(
            name => name in root && (root as Record<string, unknown>)[name] !== module[name],
        );
        expect(diverged).toEqual([]);
    });

    test("./native stays out of the root barrel so it keeps no DOM dependency", () => {
        const names = runtimeNames(native);
        expect(names.length).toBeGreaterThan(0);
        expect(names.filter(name => name in root)).toEqual([]);
    });
});

/** Inverse direction: the root is `export *` over everything, so a new module lands there
 *  by default and nobody notices it never reached a subpath. Every root-only runtime name
 *  must be on this list, so adding a module makes you choose its subpath explicitly.
 *
 *  3.0.0: the list is empty. The root is a pure compatibility union - every runtime name has a
 *  canonical subpath (params/modal/menu/chart/ui joined the six earlier entries, persist took
 *  the storage layer). Keep it empty: a name that lands here has no documented home. */
const ROOT_ONLY: string[] = [];

test("root-only runtime names are exactly the documented root-only surface", () => {
    const inSubpath = new Set(mirrored.flatMap(([, module]) => runtimeNames(module)));
    const rootOnly = runtimeNames(root as Record<string, unknown>).filter(name => !inSubpath.has(name)).sort();
    expect(rootOnly).toEqual(ROOT_ONLY);
});
