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
    canonicalPersist: `
        import {memoryCache} from './src/persist/index.ts'
        console.log(memoryCache)
    `,
    canonicalParams: `
        import {ParamsEditor} from './src/params/index.ts'
        console.log(ParamsEditor)
    `,
    canonicalModal: `
        import {ModalProvider} from './src/modal/index.ts'
        console.log(ModalProvider)
    `,
    canonicalMenu: `
        import {createContextMenu} from './src/menu/index.ts'
        console.log(createContextMenu)
    `,
    canonicalChart: `
        import {createChartEngine} from './src/chart/index.ts'
        console.log(createChartEngine)
    `,
    canonicalUi: `
        import {createToolbar} from './src/ui/index.ts'
        console.log(createToolbar)
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
    persist: await bundle('canonicalPersist', 'production'),
    params: await bundle('canonicalParams', 'production'),
    modal: await bundle('canonicalModal', 'production'),
    menu: await bundle('canonicalMenu', 'production'),
    chart: await bundle('canonicalChart', 'production'),
    ui: await bundle('canonicalUi', 'production'),
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

// wenay-common2 ships as CommonJS, so one helper imported from its `./client` barrel drags the
// whole barrel (RPC client, media, exchange bars: ~61 KB gzip) into the bundle. The entries below
// must reach wenay-common2 only through its narrow entries (observe/replay/listen/peer/media).
const COMMON2_CLIENT_BARREL = /wenay-common2\/lib\/(?:client\.js|Common\/rcp\/|Exchange\/)/
assertBoundary('core', [
    COMMON2_CLIENT_BARREL,
    /node_modules\/(?:react|ag-grid-|react-rnd|re-resizable)/,
    /src\/internal\/(?:components|grid|hooks|logs|myChart)\//,
])
assertBoundary('react', [
    COMMON2_CLIENT_BARREL,
    /node_modules\/(?:ag-grid-|react-rnd|re-resizable)/,
    /src\/internal\/(?:components\/Communication|grid|logs|myChart)\//,
])
assertBoundary('grid', [
    COMMON2_CLIENT_BARREL,
    /src\/stand\//,
    /src\/internal\/(?:components\/Dnd|components\/Communication|logs|myChart)\//,
])
assertBoundary('windows', [
    COMMON2_CLIENT_BARREL,
    /node_modules\/ag-grid-/,
    /src\/stand\//,
    /src\/internal\/(?:components\/Communication|grid|logs|myChart)\//,
])
assertBoundary('logs', [
    /src\/stand\//,
    /src\/internal\/(?:components\/Dnd|components\/Communication|myChart)\//,
])
assertBoundary('communication', [
    COMMON2_CLIENT_BARREL,
    /node_modules\/(?:ag-grid-|react-rnd|re-resizable)/,
    /src\/stand\//,
    /src\/internal\/(?:components\/Dnd|grid|logs|myChart)\//,
])
// 3.0.0 entries. ./persist is the storage layer: React is allowed (useCacheMapPersistence,
// updateBy) but nothing from the component layer, no grid, no window libraries.
assertBoundary('persist', [
    COMMON2_CLIENT_BARREL,
    /node_modules\/(?:ag-grid-|react-rnd|re-resizable)/,
    /src\/stand\//,
    /src\/internal\/(?:components|grid|logs|myChart)\//,
])
// ./params reaches wenay-common2 through the `Params` model, which only its client barrel
// exports - that one is a documented cost of the entry, so it is not on the list.
assertBoundary('params', [
    /node_modules\/(?:ag-grid-|react-rnd|re-resizable)/,
    /src\/stand\//,
    /src\/internal\/(?:components\/Dnd|components\/Communication|grid|logs|myChart)\//,
])
// ./modal, ./menu and ./ui host themselves in floating windows (Input -> FloatingWindow,
// DropdownMenu -> modal render store, SettingsDialog -> FloatingWindowBase), so react-rnd and
// re-resizable are theirs to pull; ag-grid and the data blocks are not.
assertBoundary('modal', [
    COMMON2_CLIENT_BARREL,
    /node_modules\/ag-grid-/,
    /src\/stand\//,
    /src\/internal\/(?:components\/Communication|grid|logs|myChart)\//,
])
assertBoundary('menu', [
    COMMON2_CLIENT_BARREL,
    /node_modules\/ag-grid-/,
    /src\/stand\//,
    /src\/internal\/(?:components\/Communication|grid|logs|myChart)\//,
])
assertBoundary('chart', [
    COMMON2_CLIENT_BARREL,
    /node_modules\/(?:ag-grid-|react-rnd|re-resizable)/,
    /src\/stand\//,
    /src\/internal\/(?:components|grid|hooks|logs|persist)\//,
])
assertBoundary('ui', [
    COMMON2_CLIENT_BARREL,
    /node_modules\/ag-grid-/,
    /src\/stand\//,
    /src\/internal\/(?:components\/Communication|grid|logs|myChart)\//,
])

console.log('checks: targeted smaller; root utility AG Grid-free; validation development-only; canonical boundaries isolated')
