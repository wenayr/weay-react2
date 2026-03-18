import React, {HTMLAttributes, ReactElement, useEffect, useRef, useState} from "react";

export const StyleOtherRow: React.CSSProperties = {display: "flex", flexDirection: "row", flex: "auto 1 1"}
export const StyleOtherColum: React.CSSProperties = {display: "flex", flexDirection: "column", flex: "auto 0 1"}

export function useOutside({outsideClick, ref = useRef<HTMLDivElement|null>(null), status = true}: {ref?: React.RefObject<HTMLDivElement|null>, outsideClick: () => void, status?: boolean}) {
    useEffect(() => {
        if (status) {
            function handleClickOutside(event: MouseEvent | TouchEvent) {
                if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) outsideClick();
            }
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [ref, status, outsideClick]);
    return ref
}

type key = React.Key | null | undefined
type tChildrenFunc = (api: {onClose: () => void}) => ReactElement | React.JSX.Element
type tChildrenEl = ReactElement | React. ReactNode
type tChildren = tChildrenEl | tChildrenFunc
type tButtonBase = {
    children: tChildren,
    button: ReactElement | ((status: boolean) => ReactElement),
    style?: React.CSSProperties,
    className?: string
}
type tButton = tButtonBase & {
    statusDef?: boolean, keySave?: string,
    outClick?: boolean | (() => void), zIndex?: number,
}

type tState = {
    state: [boolean, React.Dispatch<React.SetStateAction<boolean>>],
}
export const DivOutsideClick = React.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & {
    outsideClick: () => void,
    status?: boolean,
    zIndex?: number,
}>( ({children, outsideClick, zIndex, style={}, status = true, ...other}, forwardedRef) => {
    const style2 = zIndex ? {...style, zIndex} : style
    const internalRef = useOutside({outsideClick: outsideClick, status});

    // Combine refs if forwardedRef is provided
    const ref = forwardedRef
        ? (node: HTMLDivElement | null) => {
            internalRef.current = node;
            if (typeof forwardedRef === 'function') {
                forwardedRef(node);
            } else if (forwardedRef) {
                forwardedRef.current = node;
            }
        }
        : internalRef;

    return <div ref={ref} style={style2} {...other}>{children}</div>;
});

// Deprecated: Use DivOutsideClick instead
export const DivOutsideClick2 = DivOutsideClick;

function ButtonBase({children, button, style = {}, className = "", state: [a, setA]}: tButtonBase & tState) {
    return <div style={{position: "relative", width: "min-content", ...style}} className={className}>
        <div onClick={() => setA(!a)}>
            {typeof button == "function" ? button(a) : button}
        </div>
        {a && (typeof children == "function" ? children({onClose: () => setA(!a)}) : children)}
    </div>
}

const saveStatus: {[key: string]: boolean} = {}
export function Button({keySave, statusDef, outClick, ...data}: tButton) {
    if (keySave && saveStatus[keySave]) statusDef = saveStatus[keySave]
    const state = useState(statusDef ?? false)
    
    const handleOutsideClick = () => {
        state[1](false);
        if (typeof outClick == "function") outClick()
    }

    return outClick ? (
        <DivOutsideClick status={state[0]} outsideClick={handleOutsideClick}>
            <ButtonBase {...data} state={state} />
        </DivOutsideClick>
    ) : (
        <ButtonBase {...data} state={state} />
    )
}

export function ButtonHover(props: tButtonBase){
    const [hover, setHover] = useState(false)
    return <div
        onMouseEnter={()=>setHover(true)}
        onMouseLeave={()=>setHover(false)}
        style={{position: "relative"}}
    >
        {typeof props.button == "function" ? props.button(hover) : props.button}
        {hover &&
            <div style={{position: "absolute"}}>{typeof props.children == "function" ? props.children({onClose: ()=>setHover(false)}) : props.children}</div>
        }</div>
}
export const ButtonOutClick: typeof Button = ({outClick = true, ...a}) => Button({...a, outClick})
export function ButtonAbs(props: Parameters<typeof Button>[0]) {
    const children: typeof props.children = (api) =>
        <div style={{position: "relative"}}>
            <div style={{
                position: "absolute",
                zIndex: props.zIndex ?? 9
            }}>{typeof props.children == "function" ? props.children(api) : props.children}</div>
        </div>
    return <Button {...props} children={children} />
}
