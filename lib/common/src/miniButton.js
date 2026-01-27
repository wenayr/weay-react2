import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Button } from "./commonFuncReact";
export function MiniButton({ name, arr, get, onClick, style }) {
    const data = get();
    const a = Object.values(data);
    const status = a.length > 0 && !(a.indexOf(false) >= 0);
    return _jsx(Button, { style: style, className: "newButtonSimple", button: (e) => _jsx("div", { className: status ? "msTradeAlt msTradeActive" : "msTradeAlt", children: name }), children: _jsx(_Fragment, { children: _jsx("div", { className: "maxSize", style: { height: "auto", display: "flex", flexWrap: "wrap" }, children: arr.map((k, i) => _jsx("div", { className: data[k] ? 'msTradeAlt msTradeActive' : 'msTradeAlt', onClick: () => {
                        const t = data;
                        t[k] = !(t[k] ?? false);
                        onClick(i);
                    }, children: k }, i)) }) }) });
}
export function MiniButton2({ name, children, statusDef }) {
    return _jsx(Button, { className: "newButtonSimple", statusDef: statusDef, button: (e) => _jsx("div", { className: e ? "msTradeAlt msTradeActive" : "msTradeAlt", children: name }), children: children });
}
export function MiniButton3({ name, children }) {
    return _jsx(Button, { button: (e) => _jsx("div", { className: e ? "msTradeAlt msTradeActive" : "msTradeAlt", children: name }), children: children });
}
