#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';

export const priority = ['core', 'persist', 'react', 'grid', 'windows', 'logs', 'communication', 'params', 'modal', 'menu', 'chart', 'ui'];
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const syntax = (text, file) => parse(text, {sourceType: 'unambiguous', plugins: [
    ['typescript', {dts: file.endsWith('.d.ts')}], ...(/\.[cm]?ts$/.test(file) ? [] : ['jsx']),
]});

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
    for (const node of ast.program.body) {
        if (node.source?.value !== 'wenay-react2') continue;
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
            const name = (importing ? spec.imported : spec.local).name ?? (importing ? spec.imported : spec.local).value;
            const target = map.get(name);
            if (!target) { diagnostics.push(`line ${node.loc.start.line}: unknown/removed export ${name}; see WENAY_REACT2_RENAMES.md`); unknown = true; continue; }
            let raw = text.slice(spec.start, spec.end);
            // Keep comments inside a specifier verbatim; carry inter-specifier comments along.
            const comments = innerComments.filter(c => !(c.start >= spec.start && c.end <= spec.end) &&
                (node.specifiers.find(s => s.start >= c.end) ?? node.specifiers.at(-1)) === spec);
            if (comments.length) raw = comments.map(c => text.slice(c.start, c.end) + '\n').join('') + raw;
            const group = groups.get(target.sub) ?? [];
            group.push(raw);
            groups.set(target.sub, group);
        }
        if (unknown) continue;
        const quote = text[node.source.start];
        const semi = text.slice(node.start, node.end).endsWith(';') ? ';' : '';
        const type = (importing ? node.importKind : node.exportKind) === 'type' ? ' type' : '';
        const newline = text.includes('\r\n') ? '\r\n' : '\n';
        const indent = text.slice(text.lastIndexOf('\n', node.start - 1) + 1, node.start).match(/^\s*/)[0];
        const replacement = [...groups].map(([sub, specs]) => {
            const body = specs.join(', ');
            return `${importing ? 'import' : 'export'}${type} { ${body}${body.includes('//') ? newline : ' '}} from ${quote}wenay-react2/${sub}${quote}${semi}`;
        }).join(newline + indent);
        edits.push({start: node.start, end: node.end, replacement});
    }
    // Do not silently pass dynamic import/require or module augmentation. Ordinary strings,
    // comments, snapshots and regex-based contract tests are deliberately not rewritten.
    function walk(node, parent) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'StringLiteral' && node.value === 'wenay-react2' && !handled.has(node) &&
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
        console.log('Usage: node node_modules/wenay-react2/scripts/migrate-root-imports.mjs [--check | --write] <files/directories...>\nDefault: preview only. --check: fail if migration is needed. --write: edit only if every input is supported.\nSkips symlinks, node_modules, .git, dist, build and coverage. Review string/regex import-contract tests manually.');
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
