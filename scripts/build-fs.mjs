// Cross-platform file steps of the build; they replace the cmd-only `rd /s /q` and `xcopy`.
//   node scripts/build-fs.mjs clean <dir>         remove <dir> and recreate it empty
//   node scripts/build-fs.mjs copy <from> <to>    copy the contents of <from> into <to>, recursively
import fs from 'node:fs';

const [command, from, to] = process.argv.slice(2);
if (command === 'clean' && from) {
    fs.rmSync(from, {recursive: true, force: true});
    fs.mkdirSync(from, {recursive: true});
} else if (command === 'copy' && from && to) {
    fs.cpSync(from, to, {recursive: true, force: true});
} else {
    console.error('Usage: node scripts/build-fs.mjs clean <dir> | copy <from> <to>');
    process.exitCode = 2;
}
