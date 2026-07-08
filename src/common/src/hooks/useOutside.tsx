import React, {HTMLAttributes, ReactElement, useEffect, useMemo, useRef, useState} from "react";

export const StyleOtherRow: React.CSSProperties = {display: "flex", flexDirection: "row", flex: "auto 1 1"}
export const StyleOtherColumn: React.CSSProperties = {display: "flex", flexDirection: "column", flex: "auto 0 1"}

export type UseOutsideOptions<T extends HTMLElement = HTMLDivElement> = {
    ref?: React.RefObject<T | null>;
    outsideClick?: () => void;
    onOutside?: () => void;
    status?: boolean;
    enabled?: boolean;
}

export type UseOutsideApi<T extends HTMLElement = HTMLDivElement> = {
    current: T | null;
    ref: React.RefObject<T | null>;
    props: { ref: React.Ref<T> };
    bind: { ref: React.Ref<T> };
    contains(target: EventTarget | null): boolean;
    enable(): void;
    disable(): void;
    readonly enabled: boolean;
}

export function useOutsideApi<T extends HTMLElement = HTMLDivElement>(options: UseOutsideOptions<T>): UseOutsideApi<T> {
    const {outsideClick, onOutside, ref, status = options.enabled ?? true} = options;
    const internalRef = useRef<T|null>(null);
    const r = ref ?? internalRef;
    const outsideClickRef = useRef(outsideClick ?? onOutside);
    const [enabled, setEnabled] = useState(status);
    const enabledRef = useRef(enabled);

    outsideClickRef.current = outsideClick ?? onOutside;
    enabledRef.current = enabled;

    useEffect(() => {
        setEnabled(status);
    }, [status]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent | TouchEvent) {
            if (!enabledRef.current) return;
            if (r.current && event.target instanceof Node && !r.current.contains(event.target)) outsideClickRef.current?.();
        }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        }
    }, [r]);

    const props = useMemo(() => ({ref: r as React.Ref<T>}), [r]);
    return useMemo(() => {
        const api = {
            ref: r,
            props,
            bind: props,
            contains(target: EventTarget | null) {
                return !!(r.current && target instanceof Node && r.current.contains(target));
            },
            enable() { setEnabled(true); },
            disable() { setEnabled(false); },
            get enabled() { return enabledRef.current; },
        } as UseOutsideApi<T>;
        Object.defineProperty(api, "current", {
            configurable: true,
            get: () => r.current,
            set: (node: T | null) => { r.current = node; },
        });
        return api;
    }, [props, r]);
}

export function useOutside<T extends HTMLElement = HTMLDivElement>(options: UseOutsideOptions<T>) {
    return useOutsideApi(options);
}

export function useOutsideRef<T extends HTMLElement = HTMLDivElement>(options: UseOutsideOptions<T>) {
    return useOutsideApi(options).ref;
}

type ChildrenFunc = (api: {onClose: () => void}) => ReactElement | React.JSX.Element
type ButtonChildren = ReactElement | React.ReactNode | ChildrenFunc
type ButtonBaseProps = {
    children: ButtonChildren,
    button: ReactElement | ((status: boolean) => ReactElement),
    style?: React.CSSProperties,
    className?: string
}
type ButtonProps = ButtonBaseProps & {
    statusDef?: boolean, keySave?: string,
    outClick?: boolean | (() => void), zIndex?: number,
}

type ButtonState = {
    state: [boolean, React.Dispatch<React.SetStateAction<boolean>>],
}

export const OutsideClickArea = React.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & {
    outsideClick: () => void,
    status?: boolean,
    zIndex?: number,
}>( ({children, outsideClick, zIndex, style={}, status = true, ...other}, forwardedRef) => {
    const style2 = zIndex ? {...style, zIndex} : style
    const internalRef = useOutside({outsideClick, status});

    const combinedRef = React.useCallback((node: HTMLDivElement | null) => {
        internalRef.current = node;
        if (typeof forwardedRef === 'function') {
            forwardedRef(node);
        } else if (forwardedRef) {
            forwardedRef.current = node;
        }
    }, [forwardedRef, internalRef]);

    return <div ref={forwardedRef ? combinedRef : internalRef} style={style2} {...other}>{children}</div>;
});

function ButtonBase({children, button, style = {}, className = "", state: [a, setA]}: ButtonBaseProps & ButtonState) {
    return <div style={{position: "relative", width: "min-content", ...style}} className={className}>
        <div onClick={() => setA(!a)}>
            {typeof button == "function" ? button(a) : button}
        </div>
        {a && (typeof children == "function" ? children({onClose: () => setA(!a)}) : children)}
    </div>
}

const saveStatus: {[key: string]: boolean} = {}
export function Button({keySave, statusDef, outClick, ...data}: ButtonProps) {
    if (keySave && saveStatus[keySave] != null) statusDef = saveStatus[keySave]
    const [status, setStatusRaw] = useState(statusDef ?? false)
    const setStatus: typeof setStatusRaw = (v) => {
        setStatusRaw(prev => {
            const next = typeof v === "function" ? (v as (p: boolean) => boolean)(prev) : v
            if (keySave) saveStatus[keySave] = next
            return next
        })
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

export const OutsideButton: typeof Button = ({outClick = true, ...a}) => Button({...a, outClick})

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