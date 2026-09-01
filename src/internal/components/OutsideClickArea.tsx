import React, {HTMLAttributes, useRef} from "react";
import {useOutside} from "../hooks/useOutside.js";

/** Lived in hooks/useOutside.tsx next to the hook it wraps; it is a component, so it
 *  belongs in the component layer. The hook module stays React-DOM-free of components. */
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

