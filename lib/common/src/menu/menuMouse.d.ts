/// <reference types="react" />
import { MenuBase, tMenuReact } from "./menu";
export declare const mouseMenuApi: {
    bb: (b?: boolean | undefined) => boolean | undefined;
    readonly map: Map<string, tMenuReact<any>[]>;
    readonly menuMouse: {
        name: string;
        readonly value: {
            status: boolean;
            clicks: number;
        };
    };
    ReactMouse: (agr: {
        children: import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
        zIndex?: number | undefined;
        other?: (() => tMenuReact<any>[]) | undefined;
        statusOn?: boolean | undefined;
        onUnClick?: ((e: boolean) => void) | undefined;
        className?: ((active?: boolean | undefined) => string) | undefined;
    }) => import("react/jsx-runtime").JSX.Element;
    ReactMenu: typeof MenuBase;
};
