import React, {useEffect, useRef, useState} from "react";
import {Params} from "wenay-common2/client";
import {ParamsEditor} from "./ParamsEditor.js";

export function ParamsEdit<TParams extends Params.IParamsExpandableReadonly = Params.IParamsExpandableReadonly>({onSave, params: paramsDef}: {
    params: ()=>Promise<TParams>,
    onSave?: (params: TParams) => any
}) {
    // `params` is read once on mount (remount through a React key to reload): keeping the
    // loader in the deps would refetch on every render for the usual inline arrow.
    // The alive flag is what matters - without it an unmount before the promise settles, or
    // StrictMode's double invoke, set state on a dead component.
    useEffect(() => {
        let alive = true
        paramsDef().then(e => { if (alive) setParamsD(e) })
        return () => { alive = false }
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
    // see ParamsEdit: mount-only load, guarded against a settle after unmount
    useEffect(() => {
        let alive = true
        paramsDef().then(e => { if (alive) setParams(e) })
        return () => { alive = false }
    }, []);
    const [params, setParams] = useState<Awaited<ReturnType<typeof paramsDef>>|null>(null)
    return <div className={"maxSize"}>
        {/* a new array, not params[i] = e + setParams(params): the same reference makes React
            bail out, so edits never re-rendered and only survived because onSave read the
            mutated array */}
        {params && params.map((z, i)=><ParamsEditor key={i} params={z} onChange={e => {
            setParams(prev => prev ? prev.map((item, j) => j == i ? e as TParams : item) : prev)
        }}/>)}
        {onSave && <button type="button" style={{border: 0, font: "inherit"}} className={"msTradeActive msTradeAlt"} onClick={async () => {
            if (params) onSave(params)
        }}>save
        </button>}
    </div>
}

