import {gzipSync} from 'node:zlib'
import * as esbuild from 'esbuild'

const root = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const entries = {
    allCommunity: `
        import {AllCommunityModule, ModuleRegistry} from 'ag-grid-community'
        import {AgGridReact} from 'ag-grid-react'
        ModuleRegistry.registerModules([AllCommunityModule])
        console.log(AgGridReact)
    `,
    targeted: `
        import {defaultAgGridModules} from './src/common/src/grid/agGrid4/modules.ts'
        import {ModuleRegistry} from 'ag-grid-community'
        import {AgGridReact} from 'ag-grid-react'
        ModuleRegistry.registerModules(defaultAgGridModules)
        console.log(AgGridReact)
    `,
    rootUtility: `
        import {memoryCache} from './src/index.ts'
        console.log(memoryCache)
    `,
    wrapper: `
        import {AgGridTable} from './src/index.ts'
        console.log(AgGridTable)
    `,
}

async function bundle(name, nodeEnv, minify = true) {
    const result = await esbuild.build({
        stdin: {
            contents: entries[name],
            resolveDir: root,
            sourcefile: `${name}.tsx`,
            loader: 'tsx',
        },
        bundle: true,
        define: {'process.env.NODE_ENV': JSON.stringify(nodeEnv)},
        format: 'esm',
        loader: {'.css': 'empty'},
        logLevel: 'silent',
        metafile: true,
        minify,
        platform: 'browser',
        treeShaking: true,
        write: false,
    })
    const bytes = result.outputFiles.reduce((sum, file) => sum + file.contents.length, 0)
    const gzip = result.outputFiles.reduce((sum, file) => sum + gzipSync(file.contents).length, 0)
    return {bytes, gzip, result, text: result.outputFiles.map(file => file.text).join('\n')}
}

const allCommunity = await bundle('allCommunity', 'production')
const targeted = await bundle('targeted', 'production')
const rootUtility = await bundle('rootUtility', 'production')
const wrapper = await bundle('wrapper', 'production')
const productionReadable = await bundle('wrapper', 'production', false)
const developmentReadable = await bundle('wrapper', 'development', false)

for (const [name, value] of Object.entries({allCommunity, targeted, rootUtility, wrapper}))
    console.log(`${name}: ${value.bytes} raw / ${value.gzip} gzip`)

if (targeted.bytes >= allCommunity.bytes || targeted.gzip >= allCommunity.gzip)
    throw new Error('Targeted AG Grid bundle must be smaller than AllCommunityModule')

const utilityAgBytes = Object.values(rootUtility.result.metafile.outputs)
    .flatMap(output => Object.entries(output.inputs ?? {}))
    .filter(([path]) => /ag-grid-(community|react)/.test(path))
    .reduce((sum, [, input]) => sum + input.bytesInOutput, 0)
if (utilityAgBytes != 0)
    throw new Error(`Root utility bundle contains ${utilityAgBytes} bytes of AG Grid`)

if (productionReadable.text.includes('var AllCommunityModule'))
    throw new Error('Production wrapper bundle defines AllCommunityModule')
if (productionReadable.text.includes('function enableDevValidations'))
    throw new Error('Production wrapper bundle contains development validation implementation')
if (!developmentReadable.text.includes('function enableDevValidations'))
    throw new Error('Development wrapper bundle is missing AG Grid validation')

console.log('checks: targeted smaller; root utility AG Grid-free; validation development-only')
