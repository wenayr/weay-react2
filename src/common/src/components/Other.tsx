import React, {useEffect, useRef, useState} from "react";
import {Params} from "wenay-common2/client";
import {ParamsEditor} from "./ParamsEditor";

export function ParamsEdit<TParams extends Params.IParamsExpandableReadonly = Params.IParamsExpandableReadonly>({onSave, params: paramsDef}: {
    params: ()=>Promise<TParams>,
    onSave?: (params: TParams) => any
}) {
    useEffect(() => {
        paramsDef().then(e=> {
            setParamsD(e)})
    }, []);
    const [paramsD, setParamsD] = useState<TParams|null>(null)
    const params = useRef<TParams|null>(null);

    return <div className={"maxSize"}>
        {paramsD && <ParamsEditor params={paramsD} onChange={e => params.current = e}/>}
        {onSave && <button type="button" style={{border: 0, font: "inherit"}} className={"msTradeActive msTradeAlt"} onClick={async () => {
            const t = params.current || paramsD
            if (t) onSave(t)
        }}>save
        </button>}
    </div>
}

export function ParamsArrayEdit<TParams extends Params.IParamsExpandableReadonly = Params.IParamsExpandableReadonly>({onSave, params: paramsDef}: {
    params: ()=>Promise<TParams[]>,
    onSave?: (params: TParams[]) => any
}) {
    useEffect(() => {
        paramsDef().then(e=> {
            setParams(e)})
    }, []);
    const [params, setParams] = useState<Awaited<ReturnType<typeof paramsDef>>|null>(null)
    return <div className={"maxSize"}>
        {params && params.map((z, i)=><ParamsEditor key={i} params={z} onChange={e => {
            params[i] = e
            setParams(params)
        }}/>)}
        {onSave && <button type="button" style={{border: 0, font: "inherit"}} className={"msTradeActive msTradeAlt"} onClick={async () => {
            if (params) onSave(params)
        }}>save
        </button>}
    </div>
}

