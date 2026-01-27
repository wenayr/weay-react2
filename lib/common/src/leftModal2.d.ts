import React from "react";
import { ColorString } from "wenay-common";
export declare function LeftModal({ arr, zIndex }: {
    arr: [React.JSX.Element, React.JSX.Element][];
    zIndex: number;
}): import("react/jsx-runtime").JSX.Element;
type menu = {
    id?: number;
    button: React.JSX.Element;
    color?: ColorString;
    textB?: string;
    el: () => React.JSX.Element;
};
type menu2 = Omit<menu, "button"> & {
    button?: menu["button"];
};
export declare function getApiLeftMenu(): {
    modal: {
        set(jsx: React.JSX.Element | null): void;
        JSX: React.JSX.Element | null;
        Render(): React.JSX.Element | null;
        addJSX(jsx: React.JSX.Element): React.JSX.Element;
        dellBy(jsx: React.JSX.Element): void;
        readonly arrJSX: import("react/jsx-runtime").JSX.Element[];
        RenderArr(): import("react/jsx-runtime").JSX.Element[];
    };
    renderBy(): void;
    getMenu: () => Map<string, menu[]>;
    setMenu: (e: (menu2 | menu)[], key?: string) => void;
    Modal2: ({ menu: mm, zIndex, zIndex0, key }: {
        zIndex: number;
        zIndex0?: number | undefined;
        key?: string | undefined;
        menu?: (menu | menu2)[] | undefined;
    }) => import("react/jsx-runtime").JSX.Element;
};
export declare const ApiLeftMenu: {
    modal: {
        set(jsx: React.JSX.Element | null): void;
        JSX: React.JSX.Element | null;
        Render(): React.JSX.Element | null;
        addJSX(jsx: React.JSX.Element): React.JSX.Element;
        dellBy(jsx: React.JSX.Element): void;
        readonly arrJSX: import("react/jsx-runtime").JSX.Element[];
        RenderArr(): import("react/jsx-runtime").JSX.Element[];
    };
    renderBy(): void;
    getMenu: () => Map<string, menu[]>;
    setMenu: (e: (menu2 | menu)[], key?: string) => void;
    Modal2: ({ menu: mm, zIndex, zIndex0, key }: {
        zIndex: number;
        zIndex0?: number | undefined;
        key?: string | undefined;
        menu?: (menu | menu2)[] | undefined;
    }) => import("react/jsx-runtime").JSX.Element;
};
export declare function TestLeft333(): import("react/jsx-runtime").JSX.Element;
export {};
