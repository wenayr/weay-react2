import { CellClassParams } from "ag-grid-community";
import type { Theme, ThemeDefaultParams } from "ag-grid-community";
import { provideGlobalGridOptions } from "ag-grid-community";
export { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
export declare function GridStyleDefault(): {
    theme: Theme<ThemeDefaultParams>;
    provideGlobalGridOptions: typeof provideGlobalGridOptions;
};
export declare const StyleGridDefault: {
    fontFamily: string;
    fontStyle: string;
    fontWeight: string;
    fontSize: string;
    textAlign: string;
};
export declare function StyleCSSHeadGridEdit(name: string, rules: string): void;
export declare function StyleCSSHeadGrid(): void;
export type tCallFuncAgGrid<T> = (params: CellClassParams & {
    data: T;
}) => {};
