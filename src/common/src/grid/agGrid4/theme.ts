// Тема ag-grid. Чистая сборка + хук. Самодостаточно (без ThemeProvider — его в проекте нет;
// появится — useAgGridTheme начнёт брать режим из него, сигнатура не изменится).
import { useMemo } from 'react'
import { colorSchemeDarkBlue, colorSchemeLight, iconSetMaterial, themeAlpine } from 'ag-grid-community'
import { tokens } from '../../styles/tokens'

export type tThemeMode = 'light' | 'dark'

/** Чистая сборка ag-grid темы из режима. Без React.
 *  dark — те же part'ы и параметры, что у легаси GridStyleDefault: единый вид гридов. */
export function buildAgTheme(mode: tThemeMode) {
    const colorScheme = mode == 'dark' ? colorSchemeDarkBlue : colorSchemeLight
    return themeAlpine
        .withPart(colorScheme)
        .withPart(iconSetMaterial)
        .withParams({ ...tokens.grid, browserColorScheme: mode })
}

/** Тема приложения; дефолт — тёмная, как в проде. */
export function useAgGridTheme(mode: tThemeMode = 'dark') {
    return useMemo(() => buildAgTheme(mode), [mode])
}
