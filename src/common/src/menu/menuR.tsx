import React, {useEffect, useRef} from "react";
import {MenuBase, tMenuReact, tMenuReactStrictly} from "./menu";
import {DivOutsideClick} from "../hooks/useOutside";

// Wrapper function for creating MenuR and managing the global `bb` variable.
export function GetMenuR(){
    let bb = false; // Global activity flag that prevents opening multiple menus.

    // Main MenuR component
    function MenuR({children, other = () => [], statusOn = true, onUnClick, onConsume, zIndex, className}: {
        children: React.ReactElement,                        // Child component
        zIndex?: number,                                     // Context menu z-index value
        other?: () => (tMenuReact)[],                        // Additional menu items
        statusOn?: boolean,                                  // Enable or disable the menu
        onUnClick?: (e: boolean) => void,                    // Callback when the menu closes
        onConsume?: () => void,                              // Called on open after snapshotting items
        className?: (active?: boolean) => string,            // CSS class for the menu
    }) {
        const data = {x: 0, y: 0}; // Current position of the interaction element
        const [show, setShow] = React.useState<{
            status: boolean,                                 // Whether to show the menu
            plusMenu?: tMenuReactStrictly[],                 // Additional menu
            menu?: tMenuReactStrictly[],                     // Main menu
            coordinate?: {x: number, y: number}              // Coordinates where the menu opens
        }>({status: false});

        useEffect(() => {
            return () => {
                bb = false; // Reset activity flag when the component unmounts
            };
        }, []);

        const timeEvent = useRef(Date.now()); // Timestamp for tracking double clicks
        const touchXY = useRef({x: 0, y: 0}); // Current touch coordinates (ref: survives rerenders mid-gesture)
        const touchTime = useRef<null | number>(null); // Touch start time

        return (
            <div className={"maxSize"} style={{position: "relative"}}
                // Disable the native context menu
                 onContextMenu={e => {
                     if (statusOn) {
                         e.preventDefault();
                         e.stopPropagation();
                     }
                 }}
                // Determine the interaction position for the current element
                 ref={(e) => {
                     if (e) {
                         const r = e.getBoundingClientRect();
                         data.x = r.x;
                         data.y = r.y;
                     }
                 }}
                // Store initial touch coordinates
                 onTouchStart={(e) => {
                     if (touchXY.current.x == 0) touchXY.current.x = e.touches[0].screenX;
                     if (touchXY.current.y == 0) touchXY.current.y = e.touches[0].screenY;
                     touchTime.current = Date.now();
                 }}
                // Check for significant movement to avoid showing the menu while scrolling
                 onTouchMove={(e) => {
                     let x2 = e.touches[0].screenX;
                     let y2 = e.touches[0].screenY;
                     let pX = e.touches[0].pageX;
                     let pY = e.touches[0].pageY;
                     if ((Math.abs(x2 - touchXY.current.x) / pX > 0.05) || (Math.abs(y2 - touchXY.current.y) / pY > 0.05)) {
                         touchTime.current = null; // If movement is too large, disable menu display
                     }
                 }}
                // Detect long touch for opening the context menu
                 onTouchEnd={(e) => {
                     if (statusOn) {
                         if (touchTime.current && Date.now() - touchTime.current > 300) {
                             // More than 300 ms counts as a long press
                             touchTime.current = null;
                             touchXY.current.x = touchXY.current.y = 0;
                             if (bb) return; // Menu is already active
                             bb = true;
                             const menu = other().filter(el => el) as tMenuReactStrictly[];
                             onConsume?.();
                             setShow({
                                 status: true,
                                 menu,
                                 coordinate: {
                                     x: e.changedTouches[0].clientX - data.x,
                                     y: e.changedTouches[0].clientY - data.y
                                 }
                             });
                         }
                     }
                 }}
                // Track double click
                 onDoubleClick={(event) => {
                     timeEvent.current = Date.now();
                 }}
                // Handle right mouse click or double click
                 onMouseUp={(event) => {
                     if (statusOn) {
                         if (event.button == 2 || Date.now() - timeEvent.current < 300) {
                             if (bb) return; // Menu is already active
                             bb = true;
                             const menu = other().filter(el => el) as tMenuReactStrictly[];
                             onConsume?.();
                             setShow({status: true, menu, coordinate: {x: event.clientX - data.x, y: event.clientY - data.y}});
                         }
                     }
                 }}
            >
                {children /* Child element whose events are tracked */}
                {show.status && statusOn && (
                    // Show the context menu
                    <DivOutsideClick
                        outsideClick={() => {
                            if (!bb) return; // Menu is already inactive; do not call close handler
                            bb = false; // Menu is no longer active
                            onUnClick?.(false); // Call close handler
                            setShow({status: false}); // Hide the menu
                        }}
                    >
                        <MenuBase
                            className={className}
                            data={[
                                ...(show.plusMenu ?? []),
                                ...(show.menu ?? [])
                            ]}
                            coordinate={{...show.coordinate!}} // Pass current menu coordinates
                            zIndex={zIndex}                   // Pass z-index
                        />
                    </DivOutsideClick>
                )}
            </div>
        );
    }

    return {
        /**
         * Manage the global `bb` variable that prevents opening multiple
         * menus.
         */
        bb(b?: boolean) {
            if (b != undefined) {
                bb = b;
            } else return bb;
        },
        MenuR // Return the created component
    };
}