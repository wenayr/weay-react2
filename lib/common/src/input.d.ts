import React from "react";
export declare function InputPage({ callback, name, txt }: {
    callback: (txt: string) => void;
    name?: string;
    txt?: string;
}): import("react/jsx-runtime").JSX.Element;
export declare function InputPageModal({ callback, name, outClick, keyForSave, txt }: Parameters<typeof InputPage>[0] & {
    outClick: () => any;
    keyForSave?: string;
}): import("react/jsx-runtime").JSX.Element;
export declare function InputFileModal({ callback, name, outClick, keyForSave }: Parameters<typeof InputFile>[0] & {
    outClick: () => any;
    keyForSave?: string;
}): import("react/jsx-runtime").JSX.Element;
export declare function InputFile({ callback, name }: {
    callback: (file: File | null) => void;
    name?: string;
}): import("react/jsx-runtime").JSX.Element;
export declare function PageModalFree({ outClick, children, zIndex, size, keyForSave }: {
    zIndex?: number;
    outClick: () => any;
    children: React.JSX.Element;
    size?: {
        height: number;
        width: number;
    };
    keyForSave?: string;
}): import("react/jsx-runtime").JSX.Element;
