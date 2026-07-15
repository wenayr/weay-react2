import fs from "fs";
import path from "path";
import {tokens} from "../src/common/src/styles/tokens";

// tokens.ts is a hand-written mirror of tokens.css (A10: codegen rejected to keep the
// build pipeline untouched). This test IS the sync guarantee: every CSS custom property
// in :root must have a TS mirror entry with the same (var()-resolved) value, and every
// mirrored TS entry must still exist in CSS. Groups without a CSS counterpart
// (font, grid, zIndex fallbacks) are listed explicitly below.

function parseRootVars(css: string): Map<string, string> {
    const root = css.slice(css.indexOf("{") + 1, css.lastIndexOf("}"));
    const noComments = root.replace(/\/\*[\s\S]*?\*\//g, "");
    const vars = new Map<string, string>();
    for (const m of noComments.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
        vars.set(m[1], m[2].trim());
    }
    return vars;
}

function resolveVars(value: string, vars: Map<string, string>, depth = 0): string {
    if (depth > 10) throw new Error(`var() reference loop in: ${value}`);
    return value.replace(/var\((--[\w-]+)\)/g, (_, name) => {
        const v = vars.get(name);
        if (v == null) throw new Error(`Unknown var reference ${name}`);
        return resolveVars(v, vars, depth + 1);
    });
}

const kebabToCamel = (s: string) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

// CSS prefix -> tokens group. --base-* are internal building blocks (referenced via var()),
// --wenay-z-modal is special-cased below.
const GROUPS: Array<[cssPrefix: string, group: Record<string, string | number>]> = [
    ["--cols-menu-", tokens.colsMenu],
    ["--cols-dots-", tokens.colsDots],
    ["--cols-card-", tokens.colsCard],
    ["--color-", tokens.color],
    ["--menu-", tokens.menu],
    ["--wnd-", tokens.wnd],
    ["--dlg-", tokens.dlg],
    ["--tb-", tokens.tb],
    ["--grid-chrome-", tokens.gridChrome],
    ["--logs-", tokens.logs],
];

const cssText = fs.readFileSync(path.join(__dirname, "../src/style/tokens.css"), "utf8");
const cssVars = parseRootVars(cssText);

describe("tokens.ts mirrors tokens.css", () => {
    test("every :root token is mirrored with the same resolved value", () => {
        const problems: string[] = [];
        for (const [name, raw] of cssVars) {
            if (name.startsWith("--base-")) continue; // internal, consumed via var()
            if (name === "--wenay-z-modal") {
                if (String(tokens.zIndex.modal) !== raw) problems.push(`${name}: css=${raw} ts=${tokens.zIndex.modal}`);
                continue;
            }
            const entry = GROUPS.find(([prefix]) => name.startsWith(prefix));
            if (!entry) {
                problems.push(`${name}: no tokens.ts group for this prefix`);
                continue;
            }
            const [prefix, group] = entry;
            const key = kebabToCamel(name.slice(prefix.length));
            if (!(key in group)) {
                problems.push(`${name}: missing tokens key ${key}`);
                continue;
            }
            const resolved = resolveVars(raw, cssVars);
            if (String(group[key]) !== resolved) {
                problems.push(`${name}: css=${resolved} ts=${group[key]}`);
            }
        }
        expect(problems).toEqual([]);
    });

    test("every mirrored tokens.ts key still exists in tokens.css", () => {
        const problems: string[] = [];
        for (const [prefix, group] of GROUPS) {
            for (const key of Object.keys(group)) {
                const cssName = prefix + key.replace(/([A-Z])/g, c => "-" + c.toLowerCase());
                if (!cssVars.has(cssName)) {
                    problems.push(`tokens key ${key} has no CSS var ${cssName}`);
                }
            }
        }
        expect(problems).toEqual([]);
    });
});
