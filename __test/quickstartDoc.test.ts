// doc/QUICKSTART.md snippets are compiled through __test/quickstart.types.tsx. This pins that
// every code line of the doc's tsx blocks is present there, so the two cannot drift apart.
// Imports differ by design (package subpaths vs ../src), quotes and trailing comments are ignored.
import {readFileSync} from "node:fs";
import {join} from "node:path";

const root = join(__dirname, "..");
const norm = (line: string) => line.replace(/\s+\/\/.*$/, "").trim().replace(/["']/g, "'");

test("every QUICKSTART tsx code line is compiled by quickstart.types.tsx", () => {
    const doc = readFileSync(join(root, "doc/QUICKSTART.md"), "utf8");
    const compiled = new Set(readFileSync(join(root, "__test/quickstart.types.tsx"), "utf8").split(/\r?\n/).map(norm));
    const blocks = [...doc.matchAll(/```tsx\r?\n([\s\S]*?)```/g)].map(match => match[1]);
    expect(blocks.length).toBeGreaterThanOrEqual(6);
    const missing = blocks.flatMap(block => block.split(/\r?\n/).map(norm))
        .filter(line => line && !line.startsWith("import ") && !compiled.has(line));
    expect(missing).toEqual([]);
});
