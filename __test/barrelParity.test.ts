import {readFileSync} from "node:fs";
import {join} from "node:path";
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

/** 4.0.0 removed the root compatibility union, so parity now holds between the entries
 *  themselves. Several entries re-export the same name on purpose (the persisted maps and the
 *  memory API from ./persist): each copy must be the SAME binding, or a consumer switching
 *  `wenay-react2/ui` for `wenay-react2/persist` would get a second map. ./native stays disjoint
 *  from the web entries (no DOM dependency), and the names cut in 4.0.0 must not come back. */
const web: [string, Record<string, unknown>][] = [
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

test("a name exported by several entries is the same binding in each", () => {
    const first = new Map<string, [string, unknown]>();
    const diverged: string[] = [];
    for (const [label, module] of web) for (const name of runtimeNames(module)) {
        const seen = first.get(name);
        if (!seen) first.set(name, [label, module[name]]);
        else if (seen[1] !== module[name]) diverged.push(`${name}: ${seen[0]} vs ${label}`);
    }
    expect(diverged).toEqual([]);
});

test("./native shares no runtime name with the web entries", () => {
    const webNames = new Set(web.flatMap(([, module]) => runtimeNames(module)));
    const names = runtimeNames(native);
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter(name => webNames.has(name))).toEqual([]);
});

test("names cut in 4.0.0 stay out of every entry", () => {
    const cut = new Set(["renderByRevers", "mapResiReact", "mapRightMenu", "FResizableReact", "CResizeObserver", "memorySet", "__observerStateForTests"]);
    const found = [...web, ["./native", native] as [string, Record<string, unknown>]]
        .flatMap(([label, module]) => runtimeNames(module).filter(name => cut.has(name)).map(name => `${label}: ${name}`));
    expect(found).toEqual([]);
});

test("the package has no root entry", () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));
    expect(manifest.exports["."]).toBeUndefined();
    expect(manifest.main).toBeUndefined();
    expect(manifest.types).toBeUndefined();
});
