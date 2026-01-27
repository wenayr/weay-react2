import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect, useRef, useState } from "react";
export const StyleOtherRow = { display: "flex", flexDirection: "row", flex: "auto 1 1" };
export const StyleOtherColum = { display: "flex", flexDirection: "column", flex: "auto 0 1" };
export function useOutside({ outsideClick, ref = useRef(null), status = true }) {
    useEffect(() => {
        if (status) {
            function handleClickOutside(event) {
                if (ref.current && !ref.current.contains(event.target))
                    outsideClick();
            }
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [ref, status, outsideClick]);
    return ref;
}
export function DivOutsideClick2({ children, outsideClick, zIndex, key, style = {}, status = true }) {
    const style2 = zIndex ? { ...style, zIndex } : style;
    const ref = useOutside({ outsideClick: outsideClick, status });
    return _jsx("div", { ref: ref, style: style2, children: children }, key);
}
export function DivOutsideClick({ children, outsideClick, zIndex, key, style = {}, status = true, ...other }) {
    const style2 = zIndex ? { ...style, zIndex } : style;
    const ref = useOutside({ outsideClick: outsideClick, status });
    return React.createElement("div", { ...other, ref, key, style: style2 }, children);
}
function ButtonBase({ children, button, style = {}, className = "", state: [a, setA] }) {
    return _jsxs("div", { style: { position: "relative", width: "min-content", ...style }, className: className, children: [_jsx("div", { onClick: () => setA(!a), children: typeof button == "function" ? button(a) : button }), a && (typeof children == "function" ? children({ onClose: () => setA(!a) }) : children)] });
}
const saveStatus = {};
export function Button({ keySave, statusDef, outClick, ...data }) {
    if (keySave && saveStatus[keySave])
        statusDef = saveStatus[keySave];
    const state = useState(statusDef ?? false);
    return outClick ? DivOutsideClick({
        status: state[0],
        children: ButtonBase({ ...data, state }),
        outsideClick: () => {
            state[1](false);
            if (typeof outClick == "function")
                outClick();
        }
    })
        : ButtonBase({ ...data, state });
}
export function ButtonHover(props) {
    const [hover, setHover] = useState(false);
    return _jsxs("div", { onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false), style: { position: "relative" }, children: [typeof props.button == "function" ? props.button(hover) : props.button, hover &&
                _jsx("div", { style: { position: "absolute" }, children: typeof props.children == "function" ? props.children({ onClose: () => setHover(false) }) : props.children })] });
}
export const ButtonOutClick = ({ outClick = true, ...a }) => Button({ ...a, outClick });
export function ButtonAbs(...a) {
    const children = (api) => _jsx("div", { style: { position: "relative" }, children: _jsx("div", { style: {
                position: "absolute",
                zIndex: a[0]?.zIndex ?? 9
            }, children: typeof a[0].children == "function" ? a[0].children(api) : a[0].children }) });
    return Button({ ...a[0], children });
}
