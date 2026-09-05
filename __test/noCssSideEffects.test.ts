// 2.0.0 contract: no library module imports CSS as a side effect - apps import
// `wenay-react2/styles` (+ `styles/menu-right`, `styles/communication`) themselves. The
// Communication barrel kept one such import through 2.2.0, which put style.css back into the
// root entry for every bundler that honours CSS imports. Scans src/ minus the stand and the
// css.d.ts shims.
import {readdirSync, readFileSync, statSync} from "node:fs";
import {join, relative} from "node:path";

function walk(dir: string, out: string[] = []) {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) { if (name != "stand") walk(full, out); }
        else if (/\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) out.push(full);
    }
    return out;
}

test("no library module imports a stylesheet", () => {
    const root = join(__dirname, "..", "src");
    const offenders = walk(root)
        .filter(file => /^\s*import\s+["'][^"']+\.css["']/m.test(readFileSync(file, "utf8")))
        .map(file => relative(root, file));
    expect(offenders).toEqual([]);
});
