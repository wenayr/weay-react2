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
        import {defaultAgGridModules} from './src/internal/grid/agGrid4/modules.ts'
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
    canonicalCore: `
        import {structEqual} from './src/core/index.ts'
        console.log(structEqual)
    `,
    canonicalReact: `
        import {createUpdateApi} from './src/react/index.ts'
        console.log(createUpdateApi)
    `,
    canonicalGrid: `
        import {createGridBuffer} from './src/grid/index.ts'
        console.log(createGridBuffer)
    `,
    canonicalWindows: `
        import {FloatingWindow} from './src/windows/index.ts'
        console.log(FloatingWindow)
    `,
    canonicalLogs: `
        import {createLogsController} from './src/logs/index.ts'
        console.log(createLogsController)
    `,
    canonicalCommunication: `
        import {VideoCall} from './src/communication/index.ts'
        console.log(VideoCall)
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
const canonical = {
    core: await bundle('canonicalCore', 'production'),
    react: await bundle('canonicalReact', 'production'),
    grid: await bundle('canonicalGrid', 'production'),
    windows: await bundle('canonicalWindows', 'production'),
    logs: await bundle('canonicalLogs', 'production'),
    communication: await bundle('canonicalCommunication', 'production'),
}

for (const [name, value] of Object.entries({allCommunity, targeted, rootUtility, wrapper}))
    console.log(`${name}: ${value.bytes} raw / ${value.gzip} gzip`)
for (const [name, value] of Object.entries(canonical))
    console.log(`canonical/${name}: ${value.bytes} raw / ${value.gzip} gzip`)

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

function emittedInputBytes(probe, pattern) {
    return Object.values(probe.result.metafile.outputs)
        .flatMap(output => Object.entries(output.inputs ?? {}))
        .filter(([input]) => pattern.test(input.replaceAll('\\', '/')))
        .reduce((sum, [, value]) => sum + value.bytesInOutput, 0)
}

function assertBoundary(name, patterns) {
    for (const pattern of patterns) {
        const bytes = emittedInputBytes(canonical[name], pattern)
        if (bytes != 0) throw new Error(`Canonical ${name} entry contains ${bytes} bytes matching ${pattern}`)
    }
}

assertBoundary('core', [
    /node_modules\/(?:react|ag-grid-|react-rnd|re-resizable)/,
    /src\/internal\/(?:components|grid|hooks|logs|myChart)\//,
])
assertBoundary('react', [
    /node_modules\/(?:ag-grid-|react-rnd|re-resizable)/,
    /src\/internal\/(?:components\/Communication|grid|logs|myChart)\//,
])
assertBoundary('grid', [
    /src\/stand\//,
    /src\/internal\/(?:components\/Dnd|components\/Communication|logs|myChart)\//,
])
assertBoundary('windows', [
    /node_modules\/ag-grid-/,
    /src\/stand\//,
    /src\/internal\/(?:components\/Communication|grid|logs|myChart)\//,
])
assertBoundary('logs', [
    /src\/stand\//,
    /src\/internal\/(?:components\/Dnd|components\/Communication|myChart)\//,
])
assertBoundary('communication', [
    /node_modules\/(?:ag-grid-|react-rnd|re-resizable)/,
    /src\/stand\//,
    /src\/internal\/(?:components\/Dnd|grid|logs|myChart)\//,
])

console.log('checks: targeted smaller; root utility AG Grid-free; validation development-only; canonical boundaries isolated')
