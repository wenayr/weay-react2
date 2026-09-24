// Packs packages/wenay-calls and checks it the way a consumer sees it: the tarball contents, the
// exports map, TypeScript subpath types, an esbuild bundle and Node ESM. Runs after `build:calls`.
import {spawnSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import * as esbuild from "esbuild";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = path.join(projectRoot, "packages", "wenay-calls");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wenay-calls-consumer-"));

function run(command, args, options = {}) {
    const windows = process.platform === "win32";
    const quote = value => `"${String(value).replaceAll('"', '""')}"`;
    const result = spawnSync(windows ? process.env.ComSpec ?? "cmd.exe" : command,
        windows ? ["/d", "/c", [command, ...args.map(quote)].join(" ")] : args,
        {cwd: projectRoot, encoding: "utf8", windowsVerbatimArguments: windows, ...options});
    if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    return result.stdout.trim();
}

const consumerSource = `
import "wenay-calls/styles";
import {VideoCall, useMediaSource, usePeer, usePeerCalls, usePeerPresence, useRouteState, videoCallLabelsEn} from "wenay-calls";
import type {VideoCallLabels} from "wenay-calls";
import {PeerCallDemo} from "wenay-calls/demo/peer-media";
import {ConferenceCallDemo} from "wenay-calls/demo/peer-conference";
const labels: Partial<VideoCallLabels> = {join: videoCallLabelsEn.join};
console.log(VideoCall, useMediaSource, usePeer, usePeerCalls, usePeerPresence, useRouteState, PeerCallDemo, ConferenceCallDemo, labels);
`;

try {
    const packed = JSON.parse(run("npm", ["pack", packageDir, "--pack-destination", tempRoot, "--json"]))[0];
    const files = packed.files.map(file => file.path);
    for (const required of ["package.json", "README.md", "lib/index.js", "lib/index.d.ts", "lib/style/calls.css",
        "lib/style/styles.d.ts", "lib/demo/peerMedia.js", "lib/demo/peerConference.js"]) {
        if (!files.includes(required)) throw new Error(`wenay-calls tarball is missing ${required}`);
    }
    const stray = files.filter(file => file.startsWith("src/") || file === "tsconfig.json");
    if (stray.length) throw new Error(`wenay-calls tarball ships sources: ${stray.join(", ")}`);

    fs.mkdirSync(path.join(tempRoot, "unpacked"));
    // Relative paths: GNU tar (Git Bash, Linux) reads "C:\..." as host:path, Windows tar does not.
    run("tar", ["-xzf", packed.filename, "-C", "unpacked"], {cwd: tempRoot});
    const installed = path.join(tempRoot, "node_modules", "wenay-calls");
    fs.mkdirSync(path.dirname(installed), {recursive: true});
    fs.cpSync(path.join(tempRoot, "unpacked", "package"), installed, {recursive: true});

    const manifest = JSON.parse(fs.readFileSync(path.join(installed, "package.json"), "utf8"));
    for (const [subpath, target] of Object.entries(manifest.exports)) {
        for (const value of typeof target === "string" ? [target] : Object.values(target)) {
            if (!fs.existsSync(path.join(installed, value))) throw new Error(`wenay-calls ${subpath} target is missing: ${value}`);
        }
    }
    if (Object.keys(manifest.dependencies ?? {}).length) throw new Error("wenay-calls must declare peers only");
    if (Object.keys(manifest.peerDependencies ?? {}).some(name => name.startsWith("wenay-react2")))
        throw new Error("wenay-calls must not depend on wenay-react2");

    const consumerFile = path.join(tempRoot, "consumer.ts");
    fs.writeFileSync(consumerFile, consumerSource);
    run(path.join(projectRoot, "node_modules", ".bin", "tsc"), [
        "--ignoreConfig", "--noEmit", "--target", "ESNext", "--module", "ESNext", "--moduleResolution", "Bundler",
        "--jsx", "react-jsx", "--strict", "--types", "", "--noUncheckedSideEffectImports", "--skipLibCheck", "true", consumerFile,
    ]);

    await esbuild.build({
        stdin: {contents: consumerSource, resolveDir: tempRoot, sourcefile: "calls-consumer.ts", loader: "ts"},
        bundle: true, write: false, format: "esm", platform: "browser", logLevel: "silent", loader: {".css": "empty"},
        plugins: [{
            name: "external-peers",
            setup(build) {
                build.onResolve({filter: /^[^./]/}, args =>
                    args.path === "wenay-calls" || args.path.startsWith("wenay-calls/") ? undefined : {path: args.path, external: true});
            },
        }],
    });

    // Node's own loader on the packed artifact, resolving react and wenay-common2 from this checkout.
    const selfLink = path.join(projectRoot, "node_modules", "wenay-calls");
    if (fs.existsSync(selfLink)) throw new Error("node_modules/wenay-calls already exists; refusing to overwrite it");
    fs.cpSync(installed, selfLink, {recursive: true});
    try {
        run("node", ["--input-type=module", "-e", "const m = await import('wenay-calls'); if (typeof m.VideoCall !== 'function') process.exit(1);"]);
    } finally {
        fs.rmSync(selfLink, {recursive: true, force: true});
    }

    console.log(`checks: wenay-calls ${manifest.version} tarball (${files.length} files, no sources); exports targets; peers only; TypeScript subpath types; esbuild resolution; Node ESM`);
} finally {
    const relative = path.relative(path.resolve(os.tmpdir()), tempRoot);
    if (relative.startsWith("wenay-calls-consumer-") && !relative.includes(path.sep)) fs.rmSync(tempRoot, {recursive: true, force: true});
}
