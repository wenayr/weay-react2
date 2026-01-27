import React from "react";
import { tMenuReact } from "./menu";
export declare function GetMenuR(): {
    /**
     * Управление глобальной переменной `bb`, предотвращающей множественное
     * открытие меню.
     */
    bb(b?: boolean): boolean | undefined;
    MenuR: ({ children, other, statusOn, onUnClick, zIndex, className }: {
        children: React.ReactElement;
        zIndex?: number | undefined;
        other?: (() => (tMenuReact)[]) | undefined;
        statusOn?: boolean | undefined;
        onUnClick?: ((e: boolean) => void) | undefined;
        className?: ((active?: boolean) => string) | undefined;
    }) => import("react/jsx-runtime").JSX.Element;
};
