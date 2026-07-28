import * as fs from 'fs'
import path from 'path'

const sourceDir = path.resolve('src/style')
const targetDir = path.resolve('lib/style')

fs.mkdirSync(targetDir, {recursive: true})

for (const name of fs.readdirSync(sourceDir)) {
    if (!name.endsWith('.css.d.ts')) continue
    fs.copyFileSync(path.join(sourceDir, name), path.join(targetDir, name))
}
