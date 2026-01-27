import React, { ReactElement } from "react";
export declare function FButton(name: string | ReactElement): import("react/jsx-runtime").JSX.Element;
export declare function FNameButton(type: boolean, name: string | ReactElement): import("react/jsx-runtime").JSX.Element;
export declare function CParameter(props: {
    name: ReactElement | string;
    children?: React.ReactNode | readonly React.ReactNode[];
    style?: React.CSSProperties | undefined;
    enabled?: boolean;
    commentary?: string[];
}): import("react/jsx-runtime").JSX.Element;
