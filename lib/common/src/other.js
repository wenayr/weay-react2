import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { ParametersReact } from "./Parameters2";
export function EditParams2({ onSave, params: paramsDef }) {
    useEffect(() => {
        paramsDef().then(e => {
            setParamsD(e);
        });
    }, [true]);
    const [paramsD, setParamsD] = useState(null);
    const params = useRef(null);
    return _jsxs("div", { className: "maxSize", children: [paramsD && _jsx(ParametersReact, { params: paramsD, onChange: e => params.current = e }), onSave && _jsx("div", { className: "msTradeActive msTradeAlt", onClick: async () => {
                    const t = params.current || paramsD;
                    if (t)
                        onSave?.(t);
                }, children: "save" })] });
}
export function EditParams3({ onSave, params: paramsDef }) {
    useEffect(() => {
        paramsDef().then(e => {
            setParams(e);
        });
    }, [true]);
    const [params, setParams] = useState(null);
    return _jsxs("div", { className: "maxSize", children: [params && params.map((z, i) => _jsx(ParametersReact, { params: z, onChange: e => {
                    params[i] = z;
                    setParams(params);
                } }, i)), onSave && _jsx("div", { className: "msTradeActive msTradeAlt", onClick: async () => {
                    params && onSave?.(params);
                }, children: "save" })] });
}
