import React from "react";
export declare function inputModal({ setModalJSX, func, name, txt }: {
    txt?: string;
    name?: string;
    setModalJSX: React.Dispatch<React.SetStateAction<React.JSX.Element | null>>;
    func: (txt: string) => void;
}): void;
export declare function confirmModal({ setModalJSX, func }: {
    setModalJSX: React.Dispatch<React.SetStateAction<React.JSX.Element | null>>;
    func: () => any;
}): void;
export declare function GetModalJSX(): {
    set(jsx: React.JSX.Element | null): void;
    JSX: React.JSX.Element | null;
    Render(): React.JSX.Element | null;
    addJSX(jsx: React.JSX.Element): React.JSX.Element;
    dellBy(jsx: React.JSX.Element): void;
    readonly arrJSX: import("react/jsx-runtime").JSX.Element[];
    RenderArr(): import("react/jsx-runtime").JSX.Element[];
};
type t1 = (() => React.JSX.Element | null) | null;
export declare function GetModalFuncJSX(): {
    set(jsx: t1): void;
    JSX: t1;
    Render(): React.JSX.Element | null;
    addJSX(jsx: t1): t1;
    dellBy(jsx: t1): void;
    readonly arrJSX: (import("react/jsx-runtime").JSX.Element | null)[];
    RenderArr(): (import("react/jsx-runtime").JSX.Element | null)[];
};
export {};
