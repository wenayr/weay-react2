import type {Theme, ThemeDefaultParams} from "ag-grid-community";
import {provideGlobalGridOptions} from "ag-grid-community";
import {buildAgTheme} from "../grid/agGrid4/theme.js";

// The cell-style concerns now live next to the grid that uses them; re-exported here so the
// root public names (`StyleGridDefault`, `AgGridClassRule`) survive.
export {StyleGridDefault} from "../grid/agGrid4/cellStyle.js";
export type {AgGridClassRule} from "../grid/agGrid4/cellStyle.js";

// import 'ag-grid-community/styles/ag-grid.css';
// import 'ag-grid-community/styles/ag-theme-alpine.css';

/** Legacy global-theme entry. Builds on `buildAgTheme('dark')` (agGrid4/theme.ts) with ONE
 *  deliberate difference: no `browserColorScheme` param, which changes how form controls and
 *  scrollbars inside the grid render. Unlike buildAgTheme this one also has a global side
 *  effect (provideGlobalGridOptions). */
export function GridStyleDefault(){
    const theme: Theme<ThemeDefaultParams> = buildAgTheme('dark', {browserColorScheme: false});
// Mark all grids as using legacy themes
    provideGlobalGridOptions({ theme: theme});
    return {theme, provideGlobalGridOptions};
}

export function StyleCSSHeadGridEdit(name: string, rules: string) {
    let style = document.createElement('style');
    document.head.appendChild(style);
    style.sheet?.insertRule(name + "{" + rules + "}", 0);
}

let headGridStylesApplied = false;
export function StyleCSSHeadGrid() {
    // idempotent: repeated calls used to append a new <style> to <head> every time
    if (headGridStylesApplied) return;
    headGridStylesApplied = true;
    // Reduce side padding for headers
    StyleCSSHeadGridEdit('.ag-theme-alpine-dark .ag-theme-alpine .ag-header-cell, .ag-theme-alpine-dark .ag-header-group-cell',
        "padding-left: 3px; padding-right: 3px;"
    );
    // Center header content
    StyleCSSHeadGridEdit('.ag-header-cell-label', 'justify-content: center');
}
