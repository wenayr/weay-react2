import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef } from "react";
import { DivRnd3 } from "./RNDFunc3";
import { DivOutsideClick, useOutside } from "./commonFuncReact";
export function InputPage({ callback, name = "", txt = "" }) {
    const txtName = useRef(txt);
    return _jsxs("div", { className: "maxSize", style: { padding: 20, }, children: [_jsx("label", { children: name }), _jsx("input", { type: "text", style: { width: "100%" }, defaultValue: txtName.current, onChange: (e) => {
                    txtName.current = e.target.value; //?? txt
                } }), _jsx("div", { style: { marginTop: 20 }, className: "msTradeAlt msTradeActive", onClick: () => { callback(txtName.current); }, children: "send" })] });
}
export function InputPageModal({ callback, name, outClick, keyForSave = "InputPage2", txt }) {
    return _jsx(DivOutsideClick, { outsideClick: outClick, style: { position: "absolute", top: "50%", left: "50%" }, children: _jsx(DivRnd3, { keyForSave: keyForSave, size: { height: 150, width: 300 }, position: { y: -150, x: -250 }, className: "fon border fonLight", moveOnlyHeader: true, children: InputPage({ callback, name, txt }) }) });
}
export function InputFileModal({ callback, name, outClick, keyForSave = "InputFile2" }) {
    const ref = useRef(null);
    useOutside({ ref, outsideClick: outClick });
    return _jsx("div", { ref: ref, style: { position: "absolute", top: "50%", left: "50%" }, children: _jsx(DivRnd3, { keyForSave: keyForSave, size: { height: 150, width: 300 }, position: { y: -150, x: -250 }, className: "fon border fonLight", moveOnlyHeader: true, children: InputFile({ callback, name }) }) });
}
export function InputFile({ callback, name = "" }) {
    let file = null;
    return _jsxs("div", { className: "maxSize", style: { padding: 20, }, children: [_jsx("label", { children: name }), _jsx("input", { type: "file", style: { width: "100%" }, onChange: (e) => {
                    file = e.target.files?.[0] ?? null;
                } }), _jsx("div", { style: { marginTop: 20 }, className: "msTradeAlt msTradeActive", onClick: () => { callback(file); }, children: "send" })] });
}
export function PageModalFree({ outClick, children, zIndex, size = { height: 150, width: 300 }, keyForSave = "PageModalFree2" }) {
    const ref = useRef(null);
    useOutside({ ref, outsideClick: outClick });
    return _jsx("div", { ref: ref, style: { position: "absolute", top: "50%", left: "50%" }, children: _jsx(DivRnd3, { keyForSave: keyForSave, size: size, zIndex: zIndex, position: { y: -(size.height / 2), x: -(size.width / 2) }, className: "fon border fonLight", moveOnlyHeader: true, children: children }) });
}
