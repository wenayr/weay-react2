import React, { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { OutsideClickArea } from '../hooks/useOutside.js';
import {createUpdateApi} from '../../updateBy.js';

let overlayKey = 0;
const overlayStack = {entries: [] as Array<{key: number}>};
const overlayStackApi = createUpdateApi(overlayStack);

function useTopOverlay() {
    const entryRef = useRef({key: overlayKey++});
    const entry = entryRef.current;
    const [top, setTop] = useState(false);
    const topRef = useRef(top);
    topRef.current = top;

    overlayStackApi.use(() => {
        const next = overlayStack.entries.at(-1) === entry;
        if (next != topRef.current) setTop(next);
    });

    useEffect(() => {
        overlayStack.entries.push(entry);
        overlayStackApi.render();
        return () => {
            const index = overlayStack.entries.indexOf(entry);
            if (index >= 0) overlayStack.entries.splice(index, 1);
            overlayStackApi.render();
        };
    }, []);

    return top;
}

export type OverlayProps = {
    children: ReactNode;
    /** Scrim look: a CSS class (SettingsDialog: `wenayDlgScrim`) and/or inline style
     *  (ModalProvider: flex-centered token scrim). The scrim div gets both verbatim. */
    scrimClassName?: string;
    scrimStyle?: React.CSSProperties;
    /** Forwarded to the OutsideClickArea that wraps children (e.g. `wenayDlgOutside`). */
    outsideClassName?: string;
    outsideStatus?: boolean;
    /** Attach a document-level Escape handler while mounted. Omit when the host owns
     *  its own keydown logic (SettingsDialog's two-stage Escape stays in its controller). */
    onEscape?: () => void;
    onOutsideClick?: () => void;
    container?: Element;
    trapFocus?: boolean;
    role?: React.AriaRole;
    ariaLabel?: string;
};

/** INTERNAL (A9): the one portal+scrim+outside-click+Escape composition for the
 *  scrim-based modal systems - ModalProvider and SettingsDialog adapt to it.
 *  Deliberately NOT exported from the public barrels: apps keep using
 *  ModalProvider/useModal/SettingsDialog. The render-slot stores
 *  (createModalElementStore) and the LeftModal drawer are not overlays and stay
 *  separate. Keeping all scrim/portal DOM in this one leaf is also the seam for a
 *  future react-native view layer (headless state stays in the hosts). */
export function Overlay({
    children,
    scrimClassName,
    scrimStyle,
    outsideClassName,
    outsideStatus = true,
    onEscape,
    onOutsideClick,
    container,
    trapFocus = true,
    role = 'dialog',
    ariaLabel,
}: OverlayProps) {
    // callbacks through refs: inline closures must not resubscribe the document listener
    const callbacksRef = useRef({ onEscape, onOutsideClick });
    callbacksRef.current = { onEscape, onOutsideClick };
    const hasEscape = !!onEscape;
    const top = useTopOverlay();
    const contentRef = useRef<HTMLDivElement | null>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        return () => {
            const target = returnFocusRef.current;
            if (target?.isConnected) target.focus();
        };
    }, []);

    useLayoutEffect(() => {
        if (!top || !trapFocus) return;
        const root = contentRef.current;
        if (!root || root.contains(document.activeElement)) return;
        const focusable = root.querySelector<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        (focusable ?? root).focus();
    }, [top, trapFocus]);

    useEffect(() => {
        if (!top || (!hasEscape && !trapFocus)) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key == 'Escape' && hasEscape) {
                e.preventDefault();
                callbacksRef.current.onEscape?.();
                return;
            }
            if (e.key != 'Tab' || !trapFocus) return;
            const root = contentRef.current;
            if (!root) return;
            const focusable = Array.from(root.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )).filter(element => element.getAttribute('aria-hidden') != 'true');
            if (focusable.length == 0) {
                e.preventDefault();
                root.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const inside = root.contains(document.activeElement);
            if (e.shiftKey && (document.activeElement == first || !inside)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (document.activeElement == last || !inside)) {
                // !inside covers a plain Tab while focus sits outside the trap (the user
                // clicked the scrim): without it the focus walked out of the overlay
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [hasEscape, top, trapFocus]);

    // The overlay is client-only: document is read straight in render, so a server pass would
    // throw rather than render nothing. Renders null on the server instead.
    if (!container && typeof document == "undefined") return null;

    return createPortal(
        <div className={scrimClassName} style={scrimStyle}>
            <OutsideClickArea
                ref={contentRef}
                outsideClick={() => callbacksRef.current.onOutsideClick?.()}
                status={outsideStatus && top}
                className={outsideClassName}
                role={role}
                aria-modal={role == 'dialog' ? true : undefined}
                aria-label={ariaLabel}
                tabIndex={-1}
            >
                {children}
            </OutsideClickArea>
        </div>,
        container ?? document.body
    );
}
