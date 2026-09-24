#!/usr/bin/env node
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const priority = ['core', 'persist', 'react', 'grid', 'windows', 'logs', 'params', 'modal', 'menu', 'chart', 'ui'];
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// @babel/parser is an optional peer: a one-off migration must not make every UI install carry a
// parser. Loaded on first use so a missing parser surfaces as a CLI error (exit 2), not a crash.
let babel;
function parser() {
    if (babel) return babel;
    try { return babel = createRequire(import.meta.url)('@babel/parser'); }
    catch (error) {
        if (error?.code !== 'MODULE_NOT_FOUND') throw error;
        throw new Error('The migration CLI needs @babel/parser (an optional peer of wenay-react2). ' +
            'Install it for the migration run, e.g. `npm i -D @babel/parser`, then run the command again.');
    }
}
const syntax = (text, file) => parser().parse(text, {sourceType: 'unambiguous', plugins: [
    ['typescript', {dts: file.endsWith('.d.ts')}], ...(/\.[cm]?ts$/.test(file) ? [] : ['jsx']),
]});

/** 4.0.0 renames. The CLI imports the new name under the old local one (`{new as old}`), so the
 *  code below the import keeps compiling unchanged; root and subpath imports alike. */
export const renamed = new Map([
    ['renderByRevers', 'renderByReverse'],
    ['mapResiReact', 'resizableSizeMap'],
    ['mapRightMenu', 'rightMenuMap'],
    ['FResizableReact', 'ResizableBox'],
    ['CResizeObserver', 'ResizeObserverHub'],
    ['memorySet', 'memorySetIfAbsent'],
]);
/** Removed in 4.0.0 without a public replacement: reported, never guessed. */
export const removed = new Set(['__observerStateForTests']);

/** 5.0.0 moved the call UI into the `wenay-calls` package: the 4.x `./communication` names plus
 *  `useRouteState`. Kept as data because the consumer may not have installed wenay-calls yet. */
export const callsPackage = 'wenay-calls';
export const movedToCalls = new Set([
    'useMediaSource', 'usePeer', 'usePeerCalls', 'usePeerPresence', 'useRouteState', 'VideoCall', 'useVideoCallController',
    'videoCallLabelsEn', 'videoCallLabelsRu', 'UseMediaSourceController', 'PeerPresence', 'RouteLogEntry',
    'UseVideoCallControllerOptions', 'VideoCallAssistant', 'VideoCallController', 'VideoCallFocusMode', 'VideoCallLabels',
    'VideoCallLayout', 'VideoCallMediaState', 'VideoCallMeeting', 'VideoCallMessage', 'VideoCallPanel', 'VideoCallParticipant',
    'VideoCallPhase', 'VideoCallPoll', 'VideoCallProps', 'VideoCallRecording', 'VideoCallRecordingState', 'VideoCallRoom',
    'VideoCallScreenState', 'VideoCallTone',
]);
/** 5.0.0 whole-module moves; side-effect, namespace and re-export statements included. */
export const movedModules = new Map([
    ['wenay-react2/communication', callsPackage],
    ['wenay-react2/styles/communication', `${callsPackage}/styles`],
    ['wenay-react2/demo/peer-media', `${callsPackage}/demo/peer-media`],
    ['wenay-react2/demo/peer-conference', `${callsPackage}/demo/peer-conference`],
]);

const importedName = (spec, importing) => {
    const source = importing ? spec.imported : spec.local;
    return source.name ?? source.value;
};

// `{old}` -> `{new as old}`, `{old as x}` -> `{new as x}`; `type` modifiers and comments stay.
function renameSpecifier(text, spec, importing) {
    const source = importing ? spec.imported : spec.local;
    const name = source.name ?? source.value;
    const raw = text.slice(spec.start, spec.end);
    const next = renamed.get(name);
    if (!next) return {name, raw};
    const alias = importing ? spec.local : spec.exported;
    const offset = source.start - spec.start;
    const tail = alias.start === source.start ? ` as ${name}` : '';
    return {name: next, raw: raw.slice(0, offset) + next + tail + raw.slice(offset + source.end - source.start)};
}

// First published home wins, including type exports. Never infer a private/deep path.
export function exportMap(root = packageRoot, source = false) {
    const map = new Map();
    for (const sub of priority) {
        const file = path.join(root, source ? 'src' : 'lib', sub, source ? 'index.ts' : 'index.d.ts');
        for (const node of syntax(fs.readFileSync(file, 'utf8'), file).program.body) {
            if (node.type !== 'ExportNamedDeclaration' || !node.source) throw new Error(`Expected explicit re-exports in ${file}`);
            for (const spec of node.specifiers) {
                const name = spec.exported.name ?? spec.exported.value;
                if (!map.has(name)) map.set(name, {sub, type: node.exportKind === 'type' || spec.exportKind === 'type'});
            }
        }
    }
    return map;
}

export function migrate(text, map, file = 'input.ts') {
    const ast = syntax(text, file);
    const edits = [];
    const diagnostics = [];
    const handled = new Set();
    const newline = text.includes('\r\n') ? '\r\n' : '\n';
    // One statement per target module, in first-use order, keeping the quote/semicolon/`type` style.
    function statements(node, importing, groups) {
        const quote = text[node.source.start];
        const semi = text.slice(node.start, node.end).endsWith(';') ? ';' : '';
        const type = (importing ? node.importKind : node.exportKind) === 'type' ? ' type' : '';
        const indent = text.slice(text.lastIndexOf('\n', node.start - 1) + 1, node.start).match(/^\s*/)[0];
        return [...groups].map(([module, specs]) => {
            const body = specs.join(', ');
            return `${importing ? 'import' : 'export'}${type} { ${body}${body.includes('//') ? newline : ' '}} from ${quote}${module}${quote}${semi}`;
        }).join(newline + indent);
    }
    const add = (groups, module, raw) => (groups.get(module) ?? groups.set(module, []).get(module)).push(raw);
    for (const node of ast.program.body) {
        const source = node.source?.value;
        if (typeof source !== 'string') continue;
        // 5.0.0: a whole module moved to wenay-calls; only the specifier string changes.
        if (movedModules.has(source)) {
            handled.add(node.source);
            const quote = text[node.source.start];
            edits.push({start: node.source.start, end: node.source.end, replacement: quote + movedModules.get(source) + quote});
            continue;
        }
        // Canonical subpath imports stay where they are; only 4.0.0 renames/removals and names that
        // moved to wenay-calls in 5.0.0 touch them.
        if (/^wenay-react2\/[\w-]+$/.test(source) && node.specifiers?.length) {
            const importing = node.type === 'ImportDeclaration';
            const specs = node.specifiers.filter(spec => spec.type === (importing ? 'ImportSpecifier' : 'ExportSpecifier'));
            for (const spec of specs) {
                const name = importedName(spec, importing);
                if (removed.has(name)) diagnostics.push(`line ${node.loc.start.line}: ${name} was removed in 4.0.0; see WENAY_REACT2_RENAMES.md`);
            }
            if (specs.some(spec => movedToCalls.has(importedName(spec, importing)))) {
                if (specs.length !== node.specifiers.length) {
                    diagnostics.push(`line ${node.loc.start.line}: default/namespace import next to a name that moved to ${callsPackage} needs manual migration`);
                    continue;
                }
                const groups = new Map();
                for (const spec of specs) add(groups, movedToCalls.has(importedName(spec, importing)) ? callsPackage : source,
                    renameSpecifier(text, spec, importing).raw);
                edits.push({start: node.start, end: node.end, replacement: statements(node, importing, groups)});
            } else {
                for (const spec of specs) if (renamed.has(importedName(spec, importing)))
                    edits.push({start: spec.start, end: spec.end, replacement: renameSpecifier(text, spec, importing).raw});
            }
            continue;
        }
        if (source !== 'wenay-react2') continue;
        handled.add(node.source);
        const importing = node.type === 'ImportDeclaration';
        if ((!importing && node.type !== 'ExportNamedDeclaration') || !node.specifiers.length ||
            node.specifiers.some(s => s.type !== (importing ? 'ImportSpecifier' : 'ExportSpecifier')) ||
            node.attributes?.length || node.assertions?.length) {
            diagnostics.push(`line ${node.loc.start.line}: namespace/default/star/side-effect import or attributes need manual migration`);
            continue;
        }
        const groups = new Map();
        let unknown = false;
        const innerComments = ast.comments.filter(c => c.start > text.indexOf('{', node.start) && c.end < node.source.start);
        for (const spec of node.specifiers) {
            const renamedSpec = renameSpecifier(text, spec, importing);
            const name = renamedSpec.name;
            const target = movedToCalls.has(name) ? callsPackage : map.get(name) && `wenay-react2/${map.get(name).sub}`;
            if (!target) { diagnostics.push(`line ${node.loc.start.line}: unknown/removed export ${name}; see WENAY_REACT2_RENAMES.md`); unknown = true; continue; }
            let raw = renamedSpec.raw;
            // Keep comments inside a specifier verbatim; carry inter-specifier comments along.
            const comments = innerComments.filter(c => !(c.start >= spec.start && c.end <= spec.end) &&
                (node.specifiers.find(s => s.start >= c.end) ?? node.specifiers.at(-1)) === spec);
            if (comments.length) raw = comments.map(c => text.slice(c.start, c.end) + '\n').join('') + raw;
            add(groups, target, raw);
        }
        if (unknown) continue;
        edits.push({start: node.start, end: node.end, replacement: statements(node, importing, groups)});
    }
    // Do not silently pass dynamic import/require or module augmentation. Ordinary strings,
    // comments, snapshots and regex-based contract tests are deliberately not rewritten.
    function walk(node, parent) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'StringLiteral' && (node.value === 'wenay-react2' || movedModules.has(node.value)) && !handled.has(node) &&
            (['CallExpression', 'ImportExpression', 'TSModuleDeclaration', 'TSImportType', 'TSExternalModuleReference', 'ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(parent?.type))) {
            diagnostics.push(`line ${node.loc.start.line}: dynamic/require/type-query/augmentation needs manual migration`);
        }
        for (const [key, value] of Object.entries(node)) {
            if (key === 'loc' || key.endsWith('Comments') || key === 'comments' || key === 'tokens') continue;
            if (Array.isArray(value)) value.forEach(child => walk(child, node));
            else if (value && typeof value === 'object') walk(value, node);
        }
    }
    walk(ast);
    if (diagnostics.length) return {text, diagnostics, changed: false};
    let result = text;
    for (const edit of edits.reverse()) result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
    return {text: result, diagnostics, changed: result !== text};
}

export function main(args) {
    if (args.includes('--help') || args.length === 0) {
        console.log('Usage: node node_modules/wenay-react2/scripts/migrate-root-imports.mjs [--check | --write] <files/directories...>\nMoves root imports to canonical subpaths, applies the 4.0.0 renames as `{new as old}` and the 5.0.0 moves to wenay-calls (3.x -> 5.0 in one run).\nDefault: preview only. --check: fail if migration is needed. --write: edit only if every input is supported.\nSkips symlinks, node_modules, .git, dist, build and coverage. Review string/regex import-contract tests manually.');
        return 0;
    }
    const flags = args.filter(arg => arg.startsWith('--'));
    if (flags.some(flag => !['--check', '--write'].includes(flag)) || new Set(flags).size > 1) throw new Error('Use only one of --check or --write');
    const inputs = args.filter(arg => !arg.startsWith('--'));
    if (!inputs.length) throw new Error('Provide at least one file or directory');
    const files = new Set();
    function collect(file) {
        const stat = fs.lstatSync(file);
        if (stat.isSymbolicLink()) return;
        if (stat.isDirectory()) {
            if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(path.basename(file))) return;
            for (const name of fs.readdirSync(file).sort()) collect(path.join(file, name));
        } else if (/\.[cm]?[jt]sx?$/.test(file)) files.add(path.resolve(file));
    }
    inputs.forEach(collect);
    if (!files.size) throw new Error('No JavaScript/TypeScript files found');
    const map = exportMap();
    const results = [...files].map(file => {
        try { return {file, ...migrate(fs.readFileSync(file, 'utf8'), map, file)}; }
        catch (error) { return {file, diagnostics: [error.message], changed: false}; }
    });
    const errors = results.filter(result => result.diagnostics.length);
    if (errors.length) {
        for (const result of errors) console.error(`${result.file}: ${result.diagnostics.join('\n')}`);
        console.error('No files written. Resolve the reported cases and rerun.');
        return 2;
    }
    const changed = results.filter(result => result.changed);
    for (const result of changed) {
        console.log(result.file);
        if (flags.includes('--write')) fs.writeFileSync(result.file, result.text);
        else if (!flags.includes('--check')) console.log(result.text);
    }
    console.log(`${changed.length} file(s) ${flags.includes('--write') ? 'updated' : 'need migration'}. Review regex/string contract tests; run types, tests and builds.`);
    return flags.includes('--check') && changed.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { process.exitCode = main(process.argv.slice(2)); }
    catch (error) { console.error(error.message); process.exitCode = 2; }
}
