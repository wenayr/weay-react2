// ag-grid theme. Pure builder + hook. Self-contained (no ThemeProvider in this project yet;
// when one appears, useAgGridTheme will start reading mode from it without a signature change).
import { colorSchemeDarkBlue, colorSchemeLight, iconSetMaterial, themeAlpine } from 'ag-grid-community'
import { tokens } from '../../styles/tokens'

export type ThemeMode = 'light' | 'dark'

const themeCache: Partial<Record<ThemeMode, ReturnType<typeof themeAlpine.withParams>>> = {}

/** Pure ag-grid theme builder from mode. No React. Cached per mode: one shared
 *  theme object across all grids instead of one per component instance.
 *  dark uses the same parts and params as legacy GridStyleDefault for a consistent grid look. */
export function buildAgTheme(mode: ThemeMode) {
    return themeCache[mode] ??= themeAlpine
        .withPart(mode == 'dark' ? colorSchemeDarkBlue : colorSchemeLight)
        .withPart(iconSetMaterial)
        .withParams({ ...tokens.grid, browserColorScheme: mode })
}

/** Application theme; default is dark, as in production. */
export function useAgGridTheme(mode: ThemeMode = 'dark') {
    return buildAgTheme(mode)
}
