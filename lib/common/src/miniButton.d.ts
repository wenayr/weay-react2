import React from "react";
export declare function MiniButton({ name, arr, get, onClick, style }: {
    name: string;
    arr: (string | number)[];
    get: () => {
        [k: string]: boolean;
    };
    onClick: (index: number) => void;
    style?: React.CSSProperties | undefined;
}): import("react/jsx-runtime").JSX.Element;
export declare function MiniButton2({ name, children, statusDef }: {
    name: string;
    statusDef?: boolean;
    children: React.ReactElement;
}): import("react/jsx-runtime").JSX.Element;
export declare function MiniButton3({ name, children }: {
    name: string;
    children: () => React.ReactElement;
}): import("react/jsx-runtime").JSX.Element;
