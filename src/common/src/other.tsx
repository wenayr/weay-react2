import React, {useEffect, useRef, useState} from "react";
import {Params, UnAwaited} from "wenay-common";
import {ParametersReact} from "./Parameters2";

export function EditParams2<TParams extends Params.IParamsExpandableReadonly = Params.IParamsExpandableReadonly>({onSave, params: paramsDef}: {
    params: ()=>Promise<TParams>,
    onSave?: (params: TParams) => any
}) {
    useEffect(() => {
        paramsDef().then(e=> {
            setParamsD(e)})
    }, [true]);
    const [paramsD, setParamsD] = useState<TParams|null>(null)
    const params = useRef<TParams|null>(null);

    return <div className={"maxSize"}>
        {paramsD && <ParametersReact params={paramsD} onChange={e => params.current = e}/>}
        {onSave && <div className={"msTradeActive msTradeAlt"} onClick={async () => {
            const t = params.current || paramsD
            if (t) onSave?.(t)
        }}>save
        </div>}
    </div>
}

export function EditParams3<TParams extends Params.IParamsExpandableReadonly = Params.IParamsExpandableReadonly>({onSave, params: paramsDef}: {
    params: ()=>Promise<TParams[]>,
    onSave?: (params: TParams[]) => any
}) {
    useEffect(() => {
        paramsDef().then(e=> {
            setParams(e)})
    }, [true]);
    const [params, setParams] = useState<UnAwaited<ReturnType<typeof paramsDef>>|null>(null)
    return <div className={"maxSize"}>
        {params && params.map((z, i)=><ParametersReact key={i} params={z} onChange={e => {
            params[i] = z
            setParams(params)
        }}/>)}
        {onSave && <div className={"msTradeActive msTradeAlt"} onClick={async () => {
            params && onSave?.(params)
        }}>save
        </div>}
    </div>
}

