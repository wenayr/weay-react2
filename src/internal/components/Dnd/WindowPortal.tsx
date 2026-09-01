/** Portal layer of the floating-window stack. Split out of FloatingWindow.tsx: the context is
 *  the only thing the window body and its popups share, so keeping it in a leaf module lets a
 *  consumer import WindowPortal without pulling the whole window implementation.
 *  FloatingWindow.tsx re-exports both public names, so import paths are unchanged. */
import React, {ReactNode, useContext} from "react";
import {createPortal} from "react-dom";

/** Container a popup should portal into: the owning window's root, or null outside one. */
export const WindowPortalContext = React.createContext<Element | null>(null);

export function useWindowPortalContainer() {
    return useContext(WindowPortalContext);
}

/** Portal a popup/menu/tooltip into the stacking context of its owning window. */
export function WindowPortal({children, className, style}: {
    children: ReactNode;
    className?: string;
    style?: React.CSSProperties;
}) {
    const container = useWindowPortalContainer();
    if (!container) return <>{children}</>;
    return createPortal(
        <div className={className} style={{position: "absolute", zIndex: 2147483646, pointerEvents: "auto", ...style}}>
            {children}
        </div>,
        container,
    );
}
