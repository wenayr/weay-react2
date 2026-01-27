import React, { JSX } from 'react';
type MenuElement = {
    label: string;
    subMenuContent: () => JSX.Element;
};
type DropdownMenuProps = {
    elements: MenuElement[];
    style?: React.CSSProperties;
    position?: 'left' | 'right';
    position2?: 'top' | 'bottom';
};
export declare function DropdownMenu({ elements, style, position: initialPosition, position2: initialPos2 }: DropdownMenuProps): import("react/jsx-runtime").JSX.Element;
export declare function MenuRightApi(): {
    set(array: MenuElement[]): void;
    delete(array: MenuElement[]): void;
    get(): MenuElement[];
    Render({ style }: {
        style?: React.CSSProperties | undefined;
    }): import("react/jsx-runtime").JSX.Element;
};
export declare function DropdownMenuTest(): import("react/jsx-runtime").JSX.Element;
export {};
