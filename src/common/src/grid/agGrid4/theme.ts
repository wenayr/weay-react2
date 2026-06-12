// Тема ag-grid. Чистая сборка + хук. Самодостаточно (без ThemeProvider — его в проекте нет;
// появится — useAgGridTheme начнёт брать режим из него, сигнатура не изменится).
import { useMemo } from 'react'
import { colorSchemeDark, colorSchemeLight, themeAlpine } from 'ag-grid-community'

export type tThemeMode = 'light' | 'dark'

/** Чистая сборка ag-grid темы из режима. Без React. */
export function buildAgTheme(mode: tThemeMode) {
    const colorScheme = mode == 'dark' ? colorSchemeDark : colorSchemeLight
    return themeAlpine.withPart(colorScheme).withParams({ browserColorScheme: mode })
}

/** Тема приложения; дефолт — тёмная, как в проде. */
export function useAgGridTheme(mode: tThemeMode = 'dark') {
    return useMemo(() => buildAgTheme(mode), [mode])
}
