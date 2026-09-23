import {spawnSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import * as esbuild from "esbuild";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wenay-react2-package-consumer-"));

function quoteForCmd(value) {
    return `"${String(value).replaceAll('"', '""')}"`;
}

function run(command, args, options = {}) {
    const windows = process.platform === "win32";
    const executable = windows ? process.env.ComSpec ?? "cmd.exe" : command;
    const executableArgs = windows
        ? ["/d", "/c", [command, ...args.map(quoteForCmd)].join(" ")]
        : args;
    const result = spawnSync(executable, executableArgs, {
        cwd: projectRoot,
        encoding: "utf8",
        windowsVerbatimArguments: windows,
        ...options,
    });
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    }
    return result.stdout.trim();
}

const consumerSource = `
import "wenay-react2/styles";
import "wenay-react2/styles/tokens";
import "wenay-react2/styles/menu-right";
import "wenay-react2/styles/communication";
import {structEqual} from "wenay-react2/core";
import {createUpdateApi} from "wenay-react2/react";
import {createGridBuffer} from "wenay-react2/grid";
import {FloatingWindow} from "wenay-react2/windows";
import {createLogsController} from "wenay-react2/logs";
import {VideoCall} from "wenay-react2/communication";
import {memoryCache, restoreDates} from "wenay-react2/persist";
import {ParamsEditor} from "wenay-react2/params";
import {ModalProvider} from "wenay-react2/modal";
import {createContextMenu} from "wenay-react2/menu";
import {createChartEngine} from "wenay-react2/chart";
import {createToolbar} from "wenay-react2/ui";

console.log(structEqual, createUpdateApi, createGridBuffer, FloatingWindow, createLogsController, VideoCall);
console.log(memoryCache, ParamsEditor, ModalProvider, createContextMenu, createChartEngine, createToolbar);
restoreDates({nested: ["2026-09-10T00:00:00.000Z"]});
`;

try {
    const packOutput = run("npm", ["pack", path.join(projectRoot, "dist"), "--pack-destination", tempRoot, "--json"]);
    const packed = JSON.parse(packOutput);
    const unpackRoot = path.join(tempRoot, "unpacked");
    fs.mkdirSync(unpackRoot);
    // Relative paths: GNU tar (Git Bash, Linux) reads "C:\..." as host:path, Windows tar does not.
    run("tar", ["-xzf", packed[0].filename, "-C", "unpacked"], {cwd: tempRoot});

    const installedPackage = path.join(tempRoot, "node_modules", "wenay-react2");
    fs.mkdirSync(path.dirname(installedPackage), {recursive: true});
    fs.cpSync(path.join(unpackRoot, "package"), installedPackage, {recursive: true});
    if (!fs.existsSync(path.join(installedPackage, "lib", "style", "style.css"))) {
        throw new Error("packed package is missing lib/style/style.css");
    }
    // The maintainer backlog and working notes live next to the public docs but must not ship.
    for (const internal of ["target", "progress"]) {
        if (fs.existsSync(path.join(installedPackage, "doc", internal))) {
            throw new Error(`packed package contains internal doc/${internal}`);
        }
    }

    const consumerFile = path.join(tempRoot, "consumer.ts");
    fs.symlinkSync(path.join(projectRoot, "node_modules", "vite"), path.join(tempRoot, "node_modules", "vite"), 'junction');
    fs.writeFileSync(consumerFile, consumerSource);
    run(path.join(projectRoot, "node_modules", ".bin", "tsc"), [
        "--ignoreConfig",
        "--noEmit",
        "--target", "ESNext",
        "--module", "ESNext",
        "--moduleResolution", "Bundler",
        "--jsx", "react-jsx",
        "--strict",
        "--types", "vite/client",
        "--noUncheckedSideEffectImports",
        "--skipLibCheck", "true",
        consumerFile,
    ]);

    // Verify the CLI actually ships and runs from the extracted package, not this checkout.
    const migrationFile = path.join(tempRoot, 'migration.ts');
    fs.writeFileSync(migrationFile, 'import {structEqual, type CacheMap} from "wenay-react2"; export {PageLogs} from "wenay-react2"; import {mapResiReact} from "wenay-react2/ui";');
    const cli = path.join(installedPackage, 'scripts', 'migrate-root-imports.mjs');
    // @babel/parser is an optional peer: without it the CLI must stop with an install hint.
    const bare = spawnSync(process.execPath, [cli, '--check', migrationFile], {cwd: tempRoot, encoding: 'utf8'});
    if (bare.status !== 2 || !bare.stderr.includes('npm i -D @babel/parser')) {
        throw new Error(`CLI without @babel/parser must exit 2 with an install hint\n${bare.stdout}\n${bare.stderr}`);
    }
    fs.mkdirSync(path.join(tempRoot, 'node_modules', '@babel'));
    fs.symlinkSync(path.join(projectRoot, 'node_modules', '@babel', 'parser'), path.join(tempRoot, 'node_modules', '@babel', 'parser'), 'junction');
    run('node', [cli, '--write', migrationFile]);
    run('node', [cli, '--check', migrationFile]);
    const migrated = fs.readFileSync(migrationFile, 'utf8');
    for (const sub of ['core', 'persist', 'logs']) if (!migrated.includes(`wenay-react2/${sub}`)) throw new Error(`CLI did not migrate ${sub}`);
    if (!migrated.includes('resizableSizeMap as mapResiReact')) throw new Error('CLI did not apply the 4.0.0 rename');
    for (const major of ['v2.0.0.md', 'v3.0.0.md', 'v4.0.0.md'])
        if (!fs.existsSync(path.join(installedPackage, 'doc', 'changes', major))) throw new Error(`Packed major migration guide missing: ${major}`);

    await esbuild.build({
        stdin: {
            contents: consumerSource,
            resolveDir: tempRoot,
            sourcefile: "packed-consumer.ts",
            loader: "ts",
        },
        bundle: true,
        define: {"process.env.NODE_ENV": JSON.stringify("production")},
        format: "esm",
        loader: {".css": "empty"},
        logLevel: "silent",
        minify: true,
        platform: "browser",
        plugins: [{
            name: "external-consumer-dependencies",
            setup(build) {
                build.onResolve({filter: /^[^./]/}, args =>
                    args.path === "wenay-react2" || args.path.startsWith("wenay-react2/")
                        ? undefined
                        : {path: args.path, external: true});
            },
        }],
        treeShaking: true,
        write: false,
    });

    // Node's own loader, on the packed artifact. The three probes above all read the package
    // through a bundler (tsc with moduleResolution Bundler, esbuild), so none of them can see
    // an emit Node cannot parse - extensionless relative imports, or ESM under a manifest with
    // no "type". That blind spot is exactly how the format bug survived several reviews.
    //
    // Representative Node-safe surfaces. CSS is explicitly imported by consumers, never by
    // package entrypoints; browser UI surfaces may have additional runtime environment needs.
    const NODE_LOADABLE = ["core", "react", "native"];
    const selfLink = path.join(projectRoot, "node_modules", "wenay-react2");
    if (fs.existsSync(selfLink)) throw new Error("node_modules/wenay-react2 already exists; refusing to overwrite it");
    fs.cpSync(installedPackage, selfLink, {recursive: true});
    try {
        const script = NODE_LOADABLE.map(name => `await import("wenay-react2/${name}");`).join("");
        run("node", ["--input-type=module", "-e", script], {cwd: projectRoot});
    } finally {
        fs.rmSync(selfLink, {recursive: true, force: true});
    }

    console.log(`checks: packed tarball without internal docs; checked CSS imports with vite/client; TypeScript subpath types; shipped migration CLI (root imports, 4.0.0 renames, missing @babel/parser) and major guides; esbuild runtime resolution; Node ESM (${NODE_LOADABLE.join(", ")})`);
} finally {
    const tempBase = path.resolve(os.tmpdir());
    const relative = path.relative(tempBase, tempRoot);
    if (relative.startsWith("wenay-react2-package-consumer-") && !relative.includes(path.sep)) {
        fs.rmSync(tempRoot, {recursive: true, force: true});
    }
}
