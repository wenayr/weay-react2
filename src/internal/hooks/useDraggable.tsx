import React, {useEffect, useMemo, useRef, useState} from "react";

export interface Position { x: number; y: number }
export type DraggableInputMode = "mouse" | "touch" | "keyboard";
export type DraggableKeyboardOptions = {
    /** Delta units per arrow key. Default 10. */
    step?: number;
    /** Multiplier with modifier held. Default 5. */
    multiplier?: number;
    modifier?: "shift" | "alt" | "ctrl" | "meta";
};
export type DraggableHandleProps = Pick<React.ButtonHTMLAttributes<HTMLButtonElement>,
    "type" | "disabled" | "aria-pressed" | "style" | "onMouseDown" | "onTouchStart" |
    "onKeyDown" | "onKeyUp" | "onClick" | "onBlur">;
export type UseDraggableOptions = {
    initialPosition?: Position;
    holdMs?: number;
    enabled?: boolean;
    /** Opt-in keyboard gestures on handleProps, not on legacy row bindings. */
    keyboard?: boolean | DraggableKeyboardOptions;
    onDragEnd?: (finalPosition: Position) => void;
    onDragStart?: () => void;
    /** Once for an active cancelled gesture, including unmount; never a commit. */
    onDragCancel?: () => void;
    /** Per input move, not setters, reset, release or cancellation. */
    onMove?: (position: Position) => void;
    /** Default true. False keeps move updates imperative; gesture boundaries still render. */
    trackState?: boolean;
};
export interface UseDraggableReturn {
    readonly position: Position;
    dragProps: {
        onMouseDown: React.MouseEventHandler<HTMLDivElement>;
        onTouchStart: React.TouchEventHandler<HTMLDivElement>;
    };
}
export interface UseDraggableApi extends UseDraggableReturn {
    props: UseDraggableReturn["dragProps"];
    bind: UseDraggableReturn["dragProps"];
    readonly handleProps: DraggableHandleProps;
    readonly positionRef: React.RefObject<Position>;
    readonly isDragging: boolean;
    readonly inputMode: DraggableInputMode | null;
    getPosition(): Position;
    setPosition(position: Position): void;
    resetPosition(): void;
    cancelDrag(): void;
}

export function useDraggableApi(options: UseDraggableOptions = {}): UseDraggableApi {
    const opts = useRef(options);
    opts.current = options;
    const positionRef = useRef<Position>({...options.initialPosition ?? {x: 0, y: 0}});
    const [, render] = useState(0);
    const mounted = useRef(true);
    const [api, dispose] = useMemo<readonly [UseDraggableApi, () => void]>(() => {
        let mode: DraggableInputMode | null = null;
        let pending: DraggableInputMode | null = null;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let origin = {x: 0, y: 0};
        let touchId: number | null = null;
        function refresh() { if (mounted.current) render(n => n + 1); }
        function setPosition(p: Position) {
            positionRef.current = {...p};
            if (opts.current.trackState !== false) refresh();
        }
        function resetPosition() { setPosition({x: 0, y: 0}); }
        function detach() {
            clearTimeout(timer);
            timer = undefined;
            pending = null;
            touchId = null;
            document.removeEventListener("mousemove", mouseMove);
            document.removeEventListener("mouseup", mouseUp, true);
            document.removeEventListener("touchmove", touchMove);
            document.removeEventListener("touchend", touchEnd, true);
            document.removeEventListener("touchcancel", touchCancel, true);
            window.removeEventListener("blur", cancelDrag);
        }
        function cancelDrag() {
            const active = mode != null;
            mode = null;
            detach();
            resetPosition();
            if (active) { refresh(); opts.current.onDragCancel?.(); }
        }
        function finish() {
            if (!mode) return;
            const final = {...positionRef.current};
            mode = null;
            detach();
            resetPosition();
            refresh();
            opts.current.onDragEnd?.(final);
        }
        function begin(next: DraggableInputMode) {
            if (!mounted.current || opts.current.enabled === false) { cancelDrag(); return; }
            pending = null;
            timer = undefined;
            mode = next;
            refresh();
            opts.current.onDragStart?.();
        }
        function move(p: Position) {
            setPosition(p);
            opts.current.onMove?.({...p});
        }
        function mouseMove(e: MouseEvent) {
            if (mode === "mouse") move({x: e.clientX - origin.x, y: e.clientY - origin.y});
        }
        function mouseUp() {
            if (mode === "mouse") finish();
            else if (pending === "mouse") detach();
        }
        function matchingTouch(e: TouchEvent) {
            return Array.from(e.changedTouches).find(t => t.identifier === touchId);
        }
        function touchMove(e: TouchEvent) {
            const t = matchingTouch(e);
            if (mode === "touch" && t) move({x: t.clientX - origin.x, y: t.clientY - origin.y});
        }
        function touchEnd(e: TouchEvent) {
            if (!matchingTouch(e)) return;
            if (mode === "touch") finish();
            else if (pending === "touch") detach();
        }
        function touchCancel(e: TouchEvent) { if (matchingTouch(e)) cancelDrag(); }
        function available() { return mounted.current && opts.current.enabled !== false && !mode && !pending; }
        function pointer(next: "mouse" | "touch", x: number, y: number) {
            origin = {x, y};
            pending = next;
            window.addEventListener("blur", cancelDrag);
            if (next === "mouse") {
                document.addEventListener("mousemove", mouseMove);
                document.addEventListener("mouseup", mouseUp, true);
            } else {
                document.addEventListener("touchmove", touchMove);
                document.addEventListener("touchend", touchEnd, true);
                document.addEventListener("touchcancel", touchCancel, true);
            }
            const hold = opts.current.holdMs ?? 500;
            if (hold > 0) timer = setTimeout(() => begin(next), hold);
            else begin(next);
        }
        function mouseDown(e: React.MouseEvent<HTMLElement>) {
            if (e.button !== 0 || !available()) return;
            e.preventDefault();
            pointer("mouse", e.clientX, e.clientY);
        }
        function touchStart(e: React.TouchEvent<HTMLElement>) {
            const touch = e.changedTouches[0];
            if (!touch || !available()) return;
            touchId = touch.identifier;
            pointer("touch", touch.clientX, touch.clientY);
        }
        function keyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
            if (e.target !== e.currentTarget || !opts.current.keyboard || opts.current.enabled === false) return;
            if (e.key === "Escape" && (mode || pending)) { e.preventDefault(); cancelDrag(); return; }
            if (mode && mode !== "keyboard" || pending) return;
            if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                if (e.repeat) return;
                if (mode === "keyboard") finish();
                else { window.addEventListener("blur", cancelDrag); begin("keyboard"); }
            } else if (mode === "keyboard" && e.key === "Escape") {
                e.preventDefault(); cancelDrag();
            } else if (mode === "keyboard" && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                e.preventDefault();
                const config = typeof opts.current.keyboard === "object" ? opts.current.keyboard : {};
                const modifier = config.modifier ?? "shift";
                const modified = {shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey}[modifier];
                const base = config.step ?? 10, factor = config.multiplier ?? 5;
                const step = (Number.isFinite(base) && base > 0 ? base : 10) *
                    (modified ? Number.isFinite(factor) && factor > 0 ? factor : 5 : 1);
                move({x: positionRef.current.x + (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0),
                    y: positionRef.current.y + (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0)});
            }
        }
        const bind = {onMouseDown: mouseDown, onTouchStart: touchStart};
        return [{
            get position() { return positionRef.current; },
            positionRef,
            get isDragging() { return mode != null; },
            get inputMode() { return mode; },
            get handleProps(): DraggableHandleProps {
                return {
                    type: "button", disabled: opts.current.enabled === false, "aria-pressed": mode != null,
                    style: {touchAction: "none"},
                    onMouseDown(e) { if (available() && e.button === 0) e.currentTarget.focus({preventScroll: true}); mouseDown(e); },
                    onTouchStart: touchStart, onKeyDown: keyDown,
                    onKeyUp(e) { if (opts.current.keyboard && (e.key === " " || e.key === "Enter")) e.preventDefault(); },
                    onClick(e) { e.preventDefault(); },
                    onBlur() { if (mode || pending) cancelDrag(); },
                };
            },
            props: bind, bind, dragProps: bind,
            getPosition() { return {...positionRef.current}; },
            setPosition, resetPosition, cancelDrag,
        }, () => { if (mode) cancelDrag(); else detach(); }];
    }, []);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; dispose(); };
    }, [dispose]);
    useEffect(() => {
        if (options.enabled === false || (!options.keyboard && api.inputMode === "keyboard")) api.cancelDrag();
    }, [api, options.enabled, !!options.keyboard]);
    return api;
}

export function useDraggable(initialX = 0, initialY = 0, timeOut = 500,
    onDragEnd?: UseDraggableOptions["onDragEnd"], onDragStart?: UseDraggableOptions["onDragStart"]): UseDraggableApi {
    return useDraggableApi({initialPosition: {x: initialX, y: initialY}, holdMs: timeOut, onDragEnd, onDragStart});
}
