import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {API} from 'typescript/unstable/sync';
import assert from 'node:assert/strict';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'react2-deprecation-'));
const api = new API({cwd: dir});
try {
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({compilerOptions: {module: 'esnext', moduleResolution: 'bundler', types: [], noEmit: true}, include: ['*.ts']}));
    const lib = path.resolve('lib').replaceAll('\\', '/');
    const file = path.join(dir, 'consumer.ts');
    fs.writeFileSync(file, `import {structEqual, type FloatingDesktopEntry} from '${lib}/index.js'; console.log(structEqual); let entry: FloatingDesktopEntry | undefined; console.log(entry);`);
    const canonical = path.join(dir, 'canonical.ts');
    fs.writeFileSync(canonical, `import {structEqual} from '${lib}/core/index.js'; import type {FloatingDesktopEntry} from '${lib}/windows/index.js'; console.log(structEqual); let entry: FloatingDesktopEntry | undefined; console.log(entry);`);
    const snapshot = api.updateSnapshot({openProjects: [path.join(dir, 'tsconfig.json')]});
    const project = snapshot.getProjects()[0];
    assert.equal(project.program.getSemanticDiagnostics(file).length, 0);
    assert.equal(project.program.getSemanticDiagnostics(canonical).length, 0);
    const deprecated = project.program.getSuggestionDiagnostics(file).filter(d => d.reportsDeprecated);
    for (const name of ['structEqual', 'FloatingDesktopEntry']) assert(deprecated.some(d => d.text.includes(name)), `${name} must be deprecated on root`);
    assert.equal(project.program.getSuggestionDiagnostics(canonical).filter(d => d.reportsDeprecated).length, 0);
    console.log('checks: generated root value/type exports deprecated in TS language service; canonical exports not deprecated');
    snapshot.dispose();
} finally {
    api.close();
    fs.rmSync(dir, {recursive: true, force: true});
}
