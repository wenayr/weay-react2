import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalEntries = {
    "./core": "src/core/index.ts",
    "./react": "src/react/index.ts",
    "./grid": "src/grid/index.ts",
    "./windows": "src/windows/index.ts",
    "./logs": "src/logs/index.ts",
    "./communication": "src/communication/index.ts",
};

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

// Asset subpaths (./styles*) are plain string targets: a stylesheet has no types and no
// import/require split. Without these keys a consumer of ./core or ./react cannot reach the
// CSS at all - a defined "exports" field blocks every unlisted subpath.
function isAssetSubpath(subpath) {
    return subpath === "./package.json" || subpath === "./styles" || subpath.startsWith("./styles/");
}

function validateExportConditions(manifest, label) {
    for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
        if (subpath === "./package.json") continue;
        if (isAssetSubpath(subpath)) {
            assert(typeof target === "string" && target.endsWith(".css"),
                `${label}: ${subpath} must point straight at a .css file`);
            continue;
        }
        assert(target && typeof target === "object" && !Array.isArray(target),
            `${label}: ${subpath} must use conditional exports`);
        assert(Object.keys(target)[0] === "types", `${label}: ${subpath} must put the types condition first`);
        assert(typeof target.types === "string" && target.types.endsWith(".d.ts"),
            `${label}: ${subpath} has no declaration target`);
        assert(typeof target.import === "string" && target.import.endsWith(".js"),
            `${label}: ${subpath} has no ESM import target`);
        assert(target.default === target.import,
            `${label}: ${subpath} default target must match its import target`);
    }
}

const sourceManifest = readJson(path.join(projectRoot, "package.json"));
validateExportConditions(sourceManifest, "source package.json");

for (const [subpath, source] of Object.entries(canonicalEntries)) {
    assert(sourceManifest.exports?.[subpath], `source package.json: missing ${subpath}`);
    const text = fs.readFileSync(path.join(projectRoot, source), "utf8");
    assert(!/^\s*export\s+\*/m.test(text), `${source}: canonical entrypoints must use explicit exports`);
    assert(!/(?:[/\\]demo[/\\]|OutlineDragDemo|logsContext|FResizableReact|mapResiReact|components[/\\]Dnd[/\\]DragArea)/.test(text),
        `${source}: canonical entrypoint contains a demo or compatibility export`);
}

const distRoot = path.join(projectRoot, "dist");
const distManifestFile = path.join(distRoot, "package.json");
assert(fs.existsSync(distManifestFile), "dist/package.json is missing; run npm run build first");
const distManifest = readJson(distManifestFile);
validateExportConditions(distManifest, "dist/package.json");
assert(JSON.stringify(distManifest.exports) === JSON.stringify(sourceManifest.exports),
    "dist/package.json exports differ from the source manifest");

for (const [subpath, target] of Object.entries(distManifest.exports)) {
    if (subpath === "./package.json") continue;
    for (const [condition, value] of typeof target === "string"
        ? [["asset", target]]
        : ["types", "import", "default"].map(condition => [condition, target[condition]])) {
        const file = path.resolve(distRoot, value);
        assert(file.startsWith(distRoot + path.sep), `${subpath}/${condition} escapes dist`);
        assert(fs.existsSync(file), `${subpath}/${condition} target is missing: ${value}`);
    }
}

console.log(`checks: ${Object.keys(canonicalEntries).length} canonical entrypoints; explicit surfaces; dist runtime/types targets`);
