import React, { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { OutsideClickArea } from '../hooks/useOutside';

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
}: OverlayProps) {
    // callbacks through refs: inline closures must not resubscribe the document listener
    const callbacksRef = useRef({ onEscape, onOutsideClick });
    callbacksRef.current = { onEscape, onOutsideClick };
    const hasEscape = !!onEscape;

    useEffect(() => {
        if (!hasEscape) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key == 'Escape') callbacksRef.current.onEscape?.();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [hasEscape]);

    return createPortal(
        <div className={scrimClassName} style={scrimStyle}>
            <OutsideClickArea
                outsideClick={() => callbacksRef.current.onOutsideClick?.()}
                status={outsideStatus}
                className={outsideClassName}
            >
                {children}
            </OutsideClickArea>
        </div>,
        container ?? document.body
    );
}
