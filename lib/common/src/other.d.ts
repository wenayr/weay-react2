import { Params } from "wenay-common";
export declare function EditParams2<TParams extends Params.IParamsExpandableReadonly = Params.IParamsExpandableReadonly>({ onSave, params: paramsDef }: {
    params: () => Promise<TParams>;
    onSave?: (params: TParams) => any;
}): import("react/jsx-runtime").JSX.Element;
export declare function EditParams3<TParams extends Params.IParamsExpandableReadonly = Params.IParamsExpandableReadonly>({ onSave, params: paramsDef }: {
    params: () => Promise<TParams[]>;
    onSave?: (params: TParams[]) => any;
}): import("react/jsx-runtime").JSX.Element;
