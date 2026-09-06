import React, {ReactElement, useEffect, useRef, useState} from "react";
import {buttonStatusMap} from "../../persist/persistedMaps.js";
import {OutsideClickArea} from "../OutsideClickArea.js";

/** Moved out of hooks/useOutside.tsx: a persisted toggle button family is a component with
 *  storage policy, not a hook. MiniButton (this folder) already built on it, so the dependency
 *  arrow now points components -> hooks instead of the reverse. */

type ChildrenFunc = (api: {onClose: () => void}) => ReactElement | React.JSX.Element
type ButtonChildren = ReactElement | React.ReactNode | ChildrenFunc
type ButtonBaseProps = {
    children: ButtonChildren,
    button: ReactElement | ((status: boolean) => ReactElement),
    style?: React.CSSProperties,
    className?: string
}
type ButtonProps = ButtonBaseProps & {
    statusDef?: boolean,
    /** Persist the open/closed status under this key (module-lifetime). Same naming as FloatingWindow/Resizable/RightMenu. */
    keyForSave?: string,
    outClick?: boolean | (() => void), zIndex?: number,
}

type ButtonState = {
    state: [boolean, React.Dispatch<React.SetStateAction<boolean>>],
}

function ButtonBase({children, button, style = {}, className = "", state: [a, setA]}: ButtonBaseProps & ButtonState) {
    return <div style={{position: "relative", width: "min-content", ...style}} className={className}>
        <div onClick={() => setA(!a)}>
            {typeof button == "function" ? button(a) : button}
        </div>
        {a && (typeof children == "function" ? children({onClose: () => setA(!a)}) : children)}
    </div>
}

export function Button({keyForSave, statusDef, outClick, ...data}: ButtonProps) {
    // keyForSave means the same thing here as on FloatingWindow and FResizableReact: the state
    // rides an ObservableMap registered in memoryCache, and the APP decides when storage is
    // written. This used to be a private module object instead - a second, undeclared
    // persistence path that PROJECT_FUNCTIONALITY lists under Non-Goals ("a hidden persistence
    // service"), and one that made keyForSave mean "until reload" on this component only.
    const saveKey = keyForSave
    const [status, setStatusRaw] = useState(() =>
        (saveKey ? buttonStatusMap.get(saveKey)?.open : undefined) ?? statusDef ?? false)

    // Storage is loaded after mount, so the saved entry can land later than the first render.
    useEffect(() => {
        if (!saveKey) return
        const apply = (changed?: string) => {
            if (changed !== undefined && changed !== saveKey) return
            const saved = buttonStatusMap.get(saveKey)
            if (saved) setStatusRaw(saved.open)
        }
        apply()
        return buttonStatusMap.onChange(apply)
    }, [saveKey])

    // The persist write must stay OUT of the state updater: buttonStatusMap.set notifies its
    // subscribers synchronously, so a second Button sharing this keyForSave used to setState
    // while this one was still rendering. The ref keeps successive calls in one tick correct,
    // which is what the functional form was there for.
    const statusRef = useRef(status)
    statusRef.current = status
    const setStatus: typeof setStatusRaw = (v) => {
        const next = typeof v === "function" ? (v as (p: boolean) => boolean)(statusRef.current) : v
        statusRef.current = next
        setStatusRaw(next)
        if (saveKey && buttonStatusMap.get(saveKey)?.open !== next) buttonStatusMap.set(saveKey, {open: next})
    }
    const state: [boolean, typeof setStatusRaw] = [status, setStatus]

    const handleOutsideClick = () => {
        state[1](false);
        if (typeof outClick == "function") outClick()
    }

    return outClick ? (
        <OutsideClickArea status={state[0]} outsideClick={handleOutsideClick}>
            <ButtonBase {...data} state={state} />
        </OutsideClickArea>
    ) : (
        <ButtonBase {...data} state={state} />
    )
}

export function HoverButton(props: ButtonBaseProps){
    const [hover, setHover] = useState(false)
    return <div
        onMouseEnter={()=>setHover(true)}
        onMouseLeave={()=>setHover(false)}
        style={{position: "relative", width: "min-content"}}
    >
        {typeof props.button == "function" ? props.button(hover) : props.button}
        {hover &&
            <div style={{position: "absolute"}}>{typeof props.children == "function" ? props.children({onClose: ()=>setHover(false)}) : props.children}</div>
        }</div>
}

// JSX, not a bare Button(...) call: called as a function its hooks are attributed to this
// component, and Button disappears from the React tree (DevTools, memo, future lazy wrappers).
export const OutsideButton: typeof Button = ({outClick = true, ...a}) => <Button {...a} outClick={outClick}/>

export function AbsoluteButton(props: Parameters<typeof Button>[0]) {
    const children: typeof props.children = (api) =>
        <div style={{position: "relative"}}>
            <div style={{
                position: "absolute",
                zIndex: props.zIndex ?? 9
            }}>{typeof props.children == "function" ? props.children(api) : props.children}</div>
        </div>
    return <Button {...props} children={children} />
}
