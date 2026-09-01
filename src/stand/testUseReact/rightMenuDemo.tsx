import React, { useEffect, useMemo } from "react";
import { createRightMenuController, type MenuElement } from "../../api.js";
import { OutlineDragDemo } from "./OutlineDragDemo.js";

/** Demo for the RightMenu dropdown controller. Moved out of the library
 *  (src/internal/components/Menu/RightMenu.tsx) in 2.0.0 - the lib ships the
 *  controller, the stand ships the demo. */
export function RightMenuDemo() {
    const testData: MenuElement[] = [
        {label: "Item 1", subMenuContent: () => <SubMenu/>},
        {label: "Item 2", subMenuContent: () => <SubMenu2/>},
        {label: "Item 3", subMenuContent: () => <SubMenu/>}
    ]
    const menu = useMemo(createRightMenuController, []);
    useEffect(() => {
        menu.set(testData)
    }, []);

    return <menu.Render/>
}

const SubMenu = () => {
    return (
        <div className="maxSize">
            <OutlineDragDemo/>
            <div className="submenu-item">Subitem 1</div>
            <div className="submenu-item">Subitem 2</div>
            <div className="submenu-item">Subitem 3</div>
        </div>
    );
};

const SubMenu2 = () => {
    return (
        <div>
            <div className="submenu-item">Subitem 33331</div>
            <div className="submenu-item">Subitem 33332</div>
            <div className="submenu-item">Subitem 33333</div>
        </div>
    );
};
