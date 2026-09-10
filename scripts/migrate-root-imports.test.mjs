import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportMap, migrate, main} from './migrate-root-imports.mjs';

const map = exportMap();
test('published names and duplicate priority are deterministic', () => {
    for (const [name, sub] of Object.entries({ObservableMap: 'core', floatingWindowMap: 'persist', mapResiReact: 'persist', mapRightMenu: 'persist', restoreDates: 'persist', FloatingDesktopEntry: 'windows'})) assert.equal(map.get(name).sub, sub);
    assert.equal(map.get('CacheMap').type, true);
    assert.equal(map.has('LogsPage'), false);
});
test('splits mixed import aliases and inline types, preserving quote and semicolon style', () => {
    const result = migrate(`import { ObservableMap as OM, type CacheMap, PageLogs } from 'wenay-react2';\nconst x = 1;`, map);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.text, `import { ObservableMap as OM } from 'wenay-react2/core';\nimport { type CacheMap } from 'wenay-react2/persist';\nimport { PageLogs } from 'wenay-react2/logs';\nconst x = 1;`);
    assert.equal(migrate(result.text, map).changed, false);
});
test('type imports and re-exports preserve type-only and local aliases', () => {
    const input = 'import type { CacheMap, Position as Pos } from "wenay-react2"\r\nexport { structEqual as equal, type CacheMap } from "wenay-react2"\r\nexport type { Position } from "wenay-react2"';
    const result = migrate(input, map);
    assert.deepEqual(result.diagnostics, []);
    assert.match(result.text, /import type \{ CacheMap \} from "wenay-react2\/persist"\r\n/);
    assert.match(result.text, /export \{ structEqual as equal \} from "wenay-react2\/core"/);
    assert.match(result.text, /export \{ type CacheMap \} from "wenay-react2\/persist"/);
    assert.match(result.text, /export type \{ Position \} from "wenay-react2\/react"/);
    assert(!result.text.includes(';'));
});
test('comments, JSX, strings, regex contracts and unrelated source survive', () => {
    const input = `// intro\nimport { /* keep */ structEqual, // table\n PageLogs /* tail */ } from 'wenay-react2';\nconst view = <div/>; const contract = /from 'wenay-react2'/; const s = "wenay-react2";`;
    const result = migrate(input, map, 'file.tsx');
    assert.deepEqual(result.diagnostics, []);
    for (const comment of ['// intro', '/* keep */', '// table', '/* tail */']) assert(result.text.includes(comment));
    assert(result.text.includes(`const view = <div/>; const contract = /from 'wenay-react2'/; const s = "wenay-react2";`));
    assert.equal(migrate(result.text, map, 'file.tsx').changed, false);
});
for (const input of [
    `import * as kit from 'wenay-react2';`, `export * from 'wenay-react2';`,
    `import kit, {structEqual as other} from 'wenay-react2';`, `import 'wenay-react2';`,
    `import {LogsPage} from 'wenay-react2';`, `const kit = import('wenay-react2');`,
    `const kit = require('wenay-react2');`, `type T = import('wenay-react2').CacheMap;`,
    `declare module 'wenay-react2' { interface X {} }`,
]) test(`refuses unsupported case without partial rewrite: ${input}`, () => {
    const text = `import {structEqual} from 'wenay-react2';\n${input}`;
    const result = migrate(text, map);
    assert(result.diagnostics.length);
    assert.equal(result.text, text);
});
test('CLI previews, checks, refuses atomic batch, writes and is idempotent', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'react2-migrate-test-'));
    try {
        const good = path.join(dir, 'good.ts'); const bad = path.join(dir, 'bad.ts');
        const original = `import {structEqual} from 'wenay-react2';`;
        fs.writeFileSync(good, original);
        assert.equal(main([good]), 0); assert.equal(fs.readFileSync(good, 'utf8'), original);
        assert.equal(main(['--check', good]), 1);
        fs.writeFileSync(bad, `import {LogsPage} from 'wenay-react2';`);
        assert.equal(main(['--write', dir]), 2); assert.equal(fs.readFileSync(good, 'utf8'), original);
        fs.unlinkSync(bad);
        assert.equal(main(['--write', dir]), 0);
        assert.equal(main(['--check', dir]), 0);
    } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
