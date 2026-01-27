import { Params } from "wenay-common";
export declare function ParametersReact<TParams extends Params.IParamsExpandableReadonly = Params.IParamsExpandableReadonly>(data: {
    params: TParams;
    expandStatus?: boolean;
    expandStatusLvl?: number;
    onChange: (params: TParams) => void;
    onExpand?: (params: TParams) => void;
}): import("react/jsx-runtime").JSX.Element;
