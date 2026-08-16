import React, {HTMLAttributes, ReactElement, useEffect, useMemo, useRef, useState} from "react";
import {buttonStatusMap} from "../utils/persistedMaps";

export const StyleOtherRow: React.CSSProperties = {display: "flex", flexDirection: "row", flex: "auto 1 1"}
export const StyleOtherColumn: React.CSSProperties = {display: "flex", flexDirection: "column", flex: "auto 0 1"}

export type UseOutsideOptions<T extends HTMLElement = HTMLDivElement> = {
    ref?: React.RefObject<T | null>;
    outsideClick?: () => void;
    onOutside?: () => void;
    status?: boolean;
    enabled?: boolean;
    /** Treat a logically nested React portal event as an inside interaction. */
    isInsideEvent?: (event: MouseEvent | TouchEvent) => boolean;
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
    const {outsideClick, onOutside, ref, status = options.enabled ?? true, isInsideEvent} = options;
    const internalRef = useRef<T|null>(null);
    const r = ref ?? internalRef;
    const outsideClickRef = useRef(outsideClick ?? onOutside);
    const isInsideEventRef = useRef(isInsideEvent);
    const [enabled, setEnabled] = useState(status);
    const enabledRef = useRef(enabled);

    outsideClickRef.current = outsideClick ?? onOutside;
    isInsideEventRef.current = isInsideEvent;
    enabledRef.current = enabled;

    useEffect(() => {
        setEnabled(status);
    }, [status]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent | TouchEvent) {
            if (!enabledRef.current) return;
            if (
                r.current &&
                event.target instanceof Node &&
                !r.current.contains(event.target) &&
                !isInsideEventRef.current?.(event)
            ) outsideClickRef.current?.();
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
    statusDef?: boolean,
    /** Persist the open/closed status under this key (module-lifetime). Same naming as FloatingWindow/Resizable/RightMenu. */
    keyForSave?: string,
    /** @deprecated alias of {@link keyForSave}; kept for compatibility, `keyForSave` wins when both are set. */
    keySave?: string,
    outClick?: boolean | (() => void), zIndex?: number,
}

type ButtonState = {
    state: [boolean, React.Dispatch<React.SetStateAction<boolean>>],
}

export const OutsideClickArea = React.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & {
    outsideClick: () => void,
    status?: boolean,
    zIndex?: number,
}>( ({
          children,
          outsideClick,
          zIndex,
          style = {},
          status = true,
          onMouseDownCapture,
          onTouchStartCapture,
          ...other
      }, forwardedRef) => {
    const style2 = zIndex ? {...style, zIndex} : style
    // React portal events still travel through their logical React ancestors even
    // when DOM contains() is false. Mark those native events during React capture
    // so the document listener does not mistake a portalled child for an outside click.
    const insideEvents = useRef(new WeakSet<Event>());
    const internalRef = useOutside({
        outsideClick,
        status,
        isInsideEvent: event => insideEvents.current.has(event),
    });

    const combinedRef = React.useCallback((node: HTMLDivElement | null) => {
        internalRef.current = node;
        if (typeof forwardedRef === 'function') {
            forwardedRef(node);
        } else if (forwardedRef) {
            forwardedRef.current = node;
        }
    }, [forwardedRef, internalRef]);

    return <div
        ref={forwardedRef ? combinedRef : internalRef}
        style={style2}
        {...other}
        onMouseDownCapture={event => {
            insideEvents.current.add(event.nativeEvent);
            onMouseDownCapture?.(event);
        }}
        onTouchStartCapture={event => {
            insideEvents.current.add(event.nativeEvent);
            onTouchStartCapture?.(event);
        }}
    >{children}</div>;
});

function ButtonBase({children, button, style = {}, className = "", state: [a, setA]}: ButtonBaseProps & ButtonState) {
    return <div style={{position: "relative", width: "min-content", ...style}} className={className}>
        <div onClick={() => setA(!a)}>
            {typeof button == "function" ? button(a) : button}
        </div>
        {a && (typeof children == "function" ? children({onClose: () => setA(!a)}) : children)}
    </div>
}

export function Button({keyForSave, keySave, statusDef, outClick, ...data}: ButtonProps) {
    // keyForSave means the same thing here as on FloatingWindow and FResizableReact: the state
    // rides an ObservableMap registered in memoryCache, and the APP decides when storage is
    // written. This used to be a private module object instead - a second, undeclared
    // persistence path that PROJECT_FUNCTIONALITY lists under Non-Goals ("a hidden persistence
    // service"), and one that made keyForSave mean "until reload" on this component only.
    const saveKey = keyForSave ?? keySave
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

    const setStatus: typeof setStatusRaw = (v) => {
        setStatusRaw(prev => {
            const next = typeof v === "function" ? (v as (p: boolean) => boolean)(prev) : v
            if (saveKey && buttonStatusMap.get(saveKey)?.open !== next) buttonStatusMap.set(saveKey, {open: next})
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
