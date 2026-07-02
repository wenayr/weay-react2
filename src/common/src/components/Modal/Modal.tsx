import React from "react";
import {renderBy, updateBy} from "../../../updateBy";
import {InputPageModal} from "../Input";
import type {ModalApi} from "./ModalContextProvider";

type LegacyModalSetter = (jsx: React.ReactNode | null) => void;
type ModalTarget = LegacyModalSetter | ModalApi;

function setModalTarget(target: ModalTarget, jsx: React.ReactNode | null) {
    if (typeof target == "function") target(jsx);
    else target.replace(jsx);
}

export function inputModal({setModalJSX, func, name, txt}: {
    txt?: string,
    name?: string,
    /** Any modal setter: setState/useModal or ModalApi from useModal */
    setModalJSX: ModalTarget,
    func: (txt: string) => void
}) {
    setModalTarget(setModalJSX, <InputPageModal callback={txt => {
        func(txt)
        setModalTarget(setModalJSX, null)
    }} outClick={() => setModalTarget(setModalJSX, null)} name={name ?? "name"} txt={txt}/>)
}

export function confirmModal({setModalJSX, func, password = "111"}: {
    /** Any modal setter: setState/useModal or ModalApi from useModal */
    setModalJSX: ModalTarget,
    func: () => any,
    /** Confirmation code word. Default "111" is kept for compatibility; pass your own. */
    password?: string
}) {
    // Do not expose custom passwords in the hint; show the legacy default as before.
    const hint = password == "111" ? "password 111" : "password"
    setModalTarget(setModalJSX, <InputPageModal callback={txt => {
        if (txt == password) func()
        setModalTarget(setModalJSX, null)
    }} outClick={() => setModalTarget(setModalJSX, null)} name={hint}/>)
}
// Shared store for GetModalJSX/GetModalFuncJSX: identical logic, the only
// difference is how a stored value turns into an element (renderItem)
function createJsxStore<J extends object>(renderItem: (jsx: J) => React.JSX.Element | null) {
    let _jsx = null as J | null
    let _jsxArr = [] as {jsx: J | null, key: number}[]
    let key = 0
    const check = (jsx: J | null) => _jsxArr.findIndex(e => e.jsx == jsx)
    const data = {
        set(jsx: J | null) {
            _jsx = jsx
            renderBy(data)
        },
        set JSX(jsx: J | null) {
            _jsx = jsx
            renderBy(data)
        },
        get JSX() {return _jsx},
        Render(){
            updateBy(data)
            return _jsx && renderItem(_jsx)
        },
        addJSX<A extends J | null>(jsx: A): A {
            if (check(jsx) == -1) {
                _jsxArr.push({jsx, key: key++});
                renderBy(data)
            }
            return jsx
        },
        dellBy(jsx: J | null) {
            const c = check(jsx)
            if (c != -1) {
                _jsxArr.splice(c,1)
                renderBy(data)
            }
        },
        get arrJSX() {return _jsxArr.map(e=> e.jsx && <div key={e.key}>{renderItem(e.jsx)}</div>)},
        RenderArr(){
            updateBy(data)
            return data.arrJSX
        }
    }
    return data
}

/**
 * @deprecated Imperative JSX storage based on updateBy/renderBy.
 * Use `ModalProvider`/`useModal` (ModalContextProvider): context plus portal.
 */
export function GetModalJSX(){
    return createJsxStore<React.JSX.Element>(jsx => jsx)
}

/**
 * @deprecated Imperative JSX storage based on updateBy/renderBy.
 * Use `ModalProvider`/`useModal` (ModalContextProvider): context plus portal.
 */
export function GetModalFuncJSX(){
    return createJsxStore<() => React.JSX.Element | null>(f => f())
}

