import { jsx as _jsx_1 } from "react/jsx-runtime";
import { InputPageModal } from "./input";
import { renderBy, updateBy } from "../updateBy";
export function inputModal({ setModalJSX, func, name, txt }) {
    setModalJSX(_jsx_1(InputPageModal, { callback: txt => {
            func(txt);
            setModalJSX(null);
        }, outClick: () => setModalJSX(null), name: name ?? "name", txt: txt }));
}
export function confirmModal({ setModalJSX, func }) {
    setModalJSX(_jsx_1(InputPageModal, { callback: txt => {
            if (txt == "111")
                func();
            setModalJSX(null);
        }, outClick: () => setModalJSX(null), name: "password 111" }));
}
export function GetModalJSX() {
    const data = (() => {
        let _jsx = null;
        let _jsxArr = [];
        let key = 0;
        const check = (jsx) => _jsxArr.findIndex(e => e.jsx == jsx);
        return {
            set(jsx) {
                _jsx = jsx;
                renderBy(data);
            },
            set JSX(jsx) {
                _jsx = jsx;
                renderBy(data);
            },
            get JSX() { return _jsx; },
            Render() {
                updateBy(data);
                return _jsx;
            },
            addJSX(jsx) {
                const c = check(jsx);
                if (c == -1) {
                    _jsxArr.push({ jsx, key: key++ });
                    renderBy(data);
                }
                return jsx;
            },
            dellBy(jsx) {
                const c = check(jsx);
                if (c != -1) {
                    _jsxArr.splice(c, 1);
                    renderBy(data);
                }
            },
            get arrJSX() { return _jsxArr.map(e => _jsx_1("div", { children: e.jsx }, e.key)); },
            RenderArr() {
                updateBy(data);
                return _jsxArr.map(e => _jsx_1("div", { children: e.jsx }, e.key));
            }
        };
    })();
    return data;
}
export function GetModalFuncJSX() {
    const data = (() => {
        let _jsx = null;
        let _jsxArr = [];
        let key = 0;
        const check = (jsx) => _jsxArr.findIndex(e => e.jsx == jsx);
        return {
            set(jsx) {
                _jsx = jsx;
                renderBy(data);
            },
            set JSX(jsx) {
                _jsx = jsx;
                renderBy(data);
            },
            get JSX() { return _jsx; },
            Render() {
                updateBy(data);
                return _jsx ? _jsx() : null;
            },
            addJSX(jsx) {
                const c = check(jsx);
                if (c == -1) {
                    _jsxArr.push({ jsx, key: key++ });
                    renderBy(data);
                }
                return jsx;
            },
            dellBy(jsx) {
                const c = check(jsx);
                if (c != -1) {
                    _jsxArr.splice(c, 1);
                    renderBy(data);
                }
            },
            get arrJSX() { return _jsxArr.map(e => e.jsx && _jsx_1("div", { children: e.jsx() }, e.key)); },
            RenderArr() {
                updateBy(data);
                return _jsxArr.map(e => e.jsx && _jsx_1("div", { children: e.jsx() }, e.key));
            }
        };
    })();
    return data;
}
