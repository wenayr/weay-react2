// ag-grid theme. Pure builder + hook. Self-contained (no ThemeProvider in this project yet;
// when one appears, useAgGridTheme will start reading mode from it without a signature change).
import { colorSchemeDarkBlue, colorSchemeLight, iconSetMaterial, themeAlpine } from 'ag-grid-community'
import { tokensVar } from '../../styles/tokens.js'

export type ThemeMode = 'light' | 'dark'

export interface BuildAgThemeOptions {
    /** `false` omits the `browserColorScheme` param, so form controls and scrollbars inside the
     *  grid keep the browser default instead of following the mode. The legacy global entry
     *  (`GridStyleDefault`) is built this way; everything else keeps the default `true`. */
    browserColorScheme?: boolean
}

const themeCache: Partial<Record<string, ReturnType<typeof themeAlpine.withParams>>> = {}

/** Pure ag-grid theme builder from mode. No React. Cached per mode: one shared
 *  theme object across all grids instead of one per component instance.
 *  dark is also what legacy GridStyleDefault builds on, for a consistent grid look. */
export function buildAgTheme(mode: ThemeMode, options: BuildAgThemeOptions = {}) {
    const withScheme = options.browserColorScheme !== false
    const key = withScheme ? mode : `${mode}:no-scheme`
    return themeCache[key] ??= themeAlpine
        .withPart(mode == 'dark' ? colorSchemeDarkBlue : colorSchemeLight)
        .withPart(iconSetMaterial)
        // tokensVar.grid, not tokens.grid: the var() form makes the grid follow a
        // :root[data-theme=...] override like the rest of the library, and falls back to the
        // very same literals when the consumer ships no overrides.
        .withParams(withScheme ? { ...tokensVar.grid, browserColorScheme: mode } : { ...tokensVar.grid })
}

/** Application theme; default is dark, as in production. */
export function useAgGridTheme(mode: ThemeMode = 'dark') {
    return buildAgTheme(mode)
}
