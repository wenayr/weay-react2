import React from "react";
import {InputPageModal} from "./input";
import {renderBy, updateBy} from "../updateBy";

export function inputModal({setModalJSX, func, name, txt}: {
    txt?: string,
    name?: string,
    setModalJSX: React.Dispatch<React.SetStateAction<React.JSX.Element | null>>,
    func: (txt: string) => void
}) {
    setModalJSX(<InputPageModal callback={txt => {
        func(txt)
        setModalJSX(null)
    }} outClick={() => setModalJSX(null)} name={name ?? "name"} txt={txt}/>)
}

export function confirmModal({setModalJSX, func}: {
    setModalJSX: React.Dispatch<React.SetStateAction<React.JSX.Element | null>>,
    func: () => any
}) {
    setModalJSX(<InputPageModal callback={txt => {
        if (txt == "111") func()
        setModalJSX(null)
    }} outClick={() => setModalJSX(null)} name={"password 111"}/>)
}

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