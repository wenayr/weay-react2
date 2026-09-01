// Grid cell-style concerns for agGrid4: the default inline cellStyle and the
// cell class-rule signature. Lived in styles/styleGrid.ts before; styleGrid.ts
// re-exports both so the root public names survive.
import type {CSSProperties} from "react";
import type {CellClassParams} from "ag-grid-community";

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

export type AgGridClassRule<T> = (params: CellClassParams & { data: T }) => CSSProperties | Record<string, any>
