import type {CSSProperties} from "react";
import {CellClassParams} from "ag-grid-community";
import type {Theme, ThemeDefaultParams} from "ag-grid-community";
import {
    colorSchemeDarkBlue,
    iconSetMaterial,
    provideGlobalGridOptions,
    themeAlpine
} from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
 export { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import {tokens} from "./tokens";



// import 'ag-grid-community/styles/ag-grid.css';
// import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register all community features
export function GridStyleDefault(){
    ModuleRegistry.registerModules([AllCommunityModule]);
    const theme:  Theme<ThemeDefaultParams> = themeAlpine
        .withPart(colorSchemeDarkBlue)
        .withPart(iconSetMaterial)
        .withParams({...tokens.grid});
// Mark all grids as using legacy themes
    provideGlobalGridOptions({ theme: theme});
    return {theme, provideGlobalGridOptions};
}

export const StyleGridDefault = {
    //    'color':'#1d262c',
    'fontFamily': 'Roboto',
    'fontStyle': 'normal',
    'fontWeight': '400',
    'fontSize': '12px',
    // 'paddingLeft': '1px',
    // 'paddingRight': '1px',
    // 'lineHeight': '12px',
    // 'paddingTop': '10px',
    // 'paddingBottom': '3px',
    //    'background-color': 'whitesmoke',
    'textAlign': 'center',

    // "justifyContent":'center'
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

export type tCallFuncAgGrid<T> = (params: CellClassParams & { data: T }) => CSSProperties | Record<string, any>
