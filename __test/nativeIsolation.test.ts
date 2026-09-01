import {readdirSync, readFileSync} from "fs";
import {join} from "path";

/** `wenay-react2/native` is documented (doc/native.md, PROJECT_FUNCTIONALITY "Public Entry")
 *  as the DOM/CSS/ag-grid/react-dom-free entrypoint. That guarantee is the reason the subpath
 *  exists, but nothing enforced it: one value import from the shared tree would silently drag
 *  react-dom, ag-grid or a CSS side effect into every React Native consumer, and the packaging
 *  probes would not notice -- esbuild resolves it happily.
 *
 *  Type-only imports erase at compile time and stay allowed; value imports must not leave the
 *  folder. */
const NATIVE_DIR = join(__dirname, "..", "src", "native");

const VALUE_IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s*)?["']([^"']+)["']/gm;
const SIDE_EFFECT_IMPORT = /^\s*import\s*["']([^"']+)["']/gm;

function specifiersOf(source: string): string[] {
    // A bare `import 'x'` matches both patterns, so collect into a set.
    const found = new Set<string>();
    for (const re of [VALUE_IMPORT, SIDE_EFFECT_IMPORT]) {
        re.lastIndex = 0;
        for (let m = re.exec(source); m; m = re.exec(source)) found.add(m[1]);
    }
    return [...found];
}

const escapingSpecifiers = (source: string) =>
    specifiersOf(source).filter(spec => !/^\.\/[^/]+$/.test(spec));

describe("wenay-react2/native isolation", () => {
    const files = readdirSync(NATIVE_DIR).filter(name => name.endsWith(".ts") || name.endsWith(".tsx"));

    test("the entrypoint has source files to check", () => {
        expect(files.length).toBeGreaterThan(0);
    });

    // A guard that cannot fail is worse than none: pin what it must catch.
    test("the detector flags the imports that would break the guarantee", () => {
        expect(escapingSpecifiers(`import {structEqual} from '../internal/utils/structEqual'`))
            .toEqual(["../internal/utils/structEqual"]);
        expect(escapingSpecifiers(`import React from "react"`)).toEqual(["react"]);
        expect(escapingSpecifiers(`import 'ag-grid-community/styles/ag-grid.css'`))
            .toEqual(["ag-grid-community/styles/ag-grid.css"]);
        expect(escapingSpecifiers(`export * from './deeper/thing.js'`)).toEqual(["./deeper/thing.js"]);
        expect(escapingSpecifiers(`import type {X} from '../common/types'`)).toEqual([]);
        expect(escapingSpecifiers(`export * from './columnState.js'`)).toEqual([]);
    });

    test.each(files)("%s pulls in no value import from outside the native folder", file => {
        const source = readFileSync(join(NATIVE_DIR, file), "utf8");
        const escaping = specifiersOf(source).filter(spec => !/^\.\/[^/]+$/.test(spec));
        expect(escaping).toEqual([]);
    });
});
