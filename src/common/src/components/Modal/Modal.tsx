import React from "react";
import {renderBy, updateBy} from "../../../updateBy";
import {InputPageModal} from "../Input";

export function inputModal({setModalJSX, func, name, txt}: {
    txt?: string,
    name?: string,
    /** Любой сеттер модалки: setState или setModal из useModal (ModalProvider) */
    setModalJSX: (jsx: React.JSX.Element | null) => void,
    func: (txt: string) => void
}) {
    setModalJSX(<InputPageModal callback={txt => {
        func(txt)
        setModalJSX(null)
    }} outClick={() => setModalJSX(null)} name={name ?? "name"} txt={txt}/>)
}

export function confirmModal({setModalJSX, func, password = "111"}: {
    /** Любой сеттер модалки: setState или setModal из useModal (ModalProvider) */
    setModalJSX: (jsx: React.JSX.Element | null) => void,
    func: () => any,
    /** Кодовое слово подтверждения. Дефолт "111" оставлен для совместимости; задайте своё. */
    password?: string
}) {
    // свой пароль в подсказке не светим; легаси-дефолт показываем как раньше
    const hint = password == "111" ? "password 111" : "password"
    setModalJSX(<InputPageModal callback={txt => {
        if (txt == password) func()
        setModalJSX(null)
    }} outClick={() => setModalJSX(null)} name={hint}/>)
}

/**
 * @deprecated Императивное хранилище JSX на updateBy/renderBy.
 * Используйте `ModalProvider`/`useModal` (ModalContextProvider) — контекст + портал.
 */
export function GetModalJSX(){
    const data = (() => {
        let _jsx = null as React.JSX.Element | null
        let _jsxArr =[] as {jsx: React.JSX.Element, key: number}[]
        let key = 0
        const check = (jsx: React.JSX.Element) => _jsxArr.findIndex(e => e.jsx == jsx)
        return {
            set(jsx: React.JSX.Element | null) {
                _jsx = jsx
                renderBy(data)
            },
            set JSX(jsx: React.JSX.Element | null) {
                _jsx = jsx
                renderBy(data)
            },
            get JSX() {return _jsx},
            Render(){
                updateBy(data)
                return _jsx
            },
            addJSX(jsx: React.JSX.Element) {
                const c = check(jsx)
                if (c == -1) {
                    _jsxArr.push({jsx, key: key++});
                    renderBy(data)
                }
                return jsx
            },
            dellBy(jsx: React.JSX.Element) {
                const c = check(jsx)
                if (c != -1) {
                    _jsxArr.splice(c,1)
                    renderBy(data)
                }
            },
            get arrJSX() {return _jsxArr.map(e=><div key={e.key}>{e.jsx}</div>)},
            RenderArr(){
                updateBy(data)
                return _jsxArr.map(e=><div key={e.key}>{e.jsx}</div>)
            }
        }
    })()
    return data
}
type t1 = (()=>React.JSX.Element | null) | null
/**
 * @deprecated Императивное хранилище JSX на updateBy/renderBy.
 * Используйте `ModalProvider`/`useModal` (ModalContextProvider) — контекст + портал.
 */
export function GetModalFuncJSX(){
    const data = (() => {
        let _jsx: t1 = null
        let _jsxArr =[] as {jsx: t1, key: number}[]
        let key = 0
        const check = (jsx: t1) => _jsxArr.findIndex(e => e.jsx == jsx)
        return {
            set(jsx: t1) {
                _jsx = jsx
                renderBy(data)
            },
            set JSX(jsx: t1) {
                _jsx = jsx
                renderBy(data)
            },
            get JSX() {return _jsx},
            Render(){
                updateBy(data)
                return _jsx? _jsx () : null
            },
            addJSX(jsx: t1) {
                const c = check(jsx)
                if (c == -1) {
                    _jsxArr.push({jsx, key: key++});
                    renderBy(data)
                }
                return jsx
            },
            dellBy(jsx: t1) {
                const c = check(jsx)
                if (c != -1) {
                    _jsxArr.splice(c,1)
                    renderBy(data)
                }
            },
            get arrJSX() {return _jsxArr.map(e=> e.jsx && <div key={e.key}>{e.jsx()}</div>)},
            RenderArr(){
                updateBy(data)
                return _jsxArr.map(e=> e.jsx && <div key={e.key}>{e.jsx()}</div>)
            }
        }
    })()
    return data
}

