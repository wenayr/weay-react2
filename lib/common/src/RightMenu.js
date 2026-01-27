import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DivOutsideClick } from './commonFuncReact';
import { GetModalFuncJSX } from './modal';
import { sleepAsync } from 'wenay-common';
import { useDraggable } from './use_draggable_hook';
import { DraggableOutlineDiv } from './DraggableOutlineDiv';
export function DropdownMenu({ elements, style, position: initialPosition = 'right', position2: initialPos2 = 'top' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isFixed, setIsFixed] = useState(false);
    const [select, setSelect] = useState(null);
    const data = useRef({ m1: false, m2: false });
    // Получаем JSX-функции модального окна
    const jsx = useMemo(GetModalFuncJSX, []);
    const jsxRender = useMemo(() => _jsx(jsx.Render, {}), [jsx]);
    const [position, setPosition] = useState(initialPosition);
    const [isTop, setIsTop] = useState(initialPos2 === 'top');
    const positionLast = useRef({ x: 0, y: 0 });
    const handleDragEnd = useCallback((finalPosition) => {
        // Обработка горизонтального смещения
        if (position === 'left') {
            positionLast.current.x += finalPosition.x;
            if (positionLast.current.x > window.innerWidth * 0.6) {
                positionLast.current.x = window.innerWidth - positionLast.current.x;
                setPosition('right');
            }
        }
        else if (position === 'right') {
            positionLast.current.x -= finalPosition.x;
            if (positionLast.current.x > window.innerWidth * 0.6) {
                positionLast.current.x = window.innerWidth - positionLast.current.x;
                setPosition('left');
            }
        }
        // Обработка вертикального смещения
        if (isTop) {
            positionLast.current.y += finalPosition.y;
            if (positionLast.current.y > document.documentElement.clientHeight * 0.6) {
                positionLast.current.y = document.documentElement.clientHeight - positionLast.current.y;
                setIsTop(false);
            }
        }
        else {
            positionLast.current.y -= finalPosition.y;
            if (positionLast.current.y > document.documentElement.clientHeight * 0.6) {
                positionLast.current.y = document.documentElement.clientHeight - positionLast.current.y;
                setIsTop(true);
            }
        }
    }, [position, isTop]);
    const { position: pos, dragProps } = useDraggable(0, 0, 50, handleDragEnd, () => { });
    // Обработчики кликов и наведения
    const handleClickOutside = useCallback(() => {
        setIsOpen(false);
    }, []);
    const handleToggle = useCallback(() => {
        setIsFixed((prev) => !prev);
        setIsOpen((prev) => !prev);
    }, []);
    const handleSelect = useCallback((item, index) => {
        jsx.set(item.subMenuContent);
        setSelect(index);
    }, [jsx]);
    const handleContentMouseEnter = useCallback(() => {
        data.current.m1 = true;
    }, []);
    const handleContentMouseLeave = useCallback(async () => {
        data.current.m1 = false;
        await sleepAsync(50);
        if (!data.current.m1 && !data.current.m2) {
            jsx.set(null);
            setSelect(null);
        }
    }, [jsx]);
    const handleSubmenuMouseEnter = useCallback(() => {
        data.current.m2 = true;
    }, []);
    const handleSubmenuMouseLeave = useCallback(async () => {
        data.current.m2 = false;
        await sleepAsync(50);
        if (!data.current.m1 && !data.current.m2) {
            jsx.set(null);
            setSelect(null);
        }
    }, [jsx]);
    // Отрисовка выпадающего меню (dop)
    const dop = (isFixed || isOpen) && (_jsxs("div", { onMouseEnter: () => {
            data.current.m1 = true;
        }, onMouseLeave: () => {
            data.current.m1 = false;
            jsx.set(null);
            setSelect(null);
        }, className: `dropdown-content2 ${!isTop ? 'dropdown-up' : ''}`, style: {
            display: 'flex',
            [position]: 0,
            right: position === 'left' ? 'auto' : 0,
            flexDirection: position === 'left' ? 'row' : 'row-reverse'
        }, children: [_jsx("div", { className: "dropdown-content", onMouseEnter: handleContentMouseEnter, onMouseLeave: handleContentMouseLeave, children: elements.map((item, index) => (_jsx("div", { className: `menu-item ${select === index ? 'force-hover' : ''}`, onMouseEnter: () => handleSelect(item, index), onClick: () => handleSelect(item, index), children: item.label }, index))) }), _jsx("div", { onMouseEnter: handleSubmenuMouseEnter, onMouseLeave: handleSubmenuMouseLeave, children: jsx.JSX ? (_jsx("div", { className: "submenu", style: { width: '40vw', minHeight: '70vh' }, children: jsxRender })) : null })] }));
    // Вычисление смещений
    const computedX = position === 'left'
        ? positionLast.current.x + pos.x
        : positionLast.current.x - pos.x;
    const computedY = isTop
        ? positionLast.current.y + pos.y
        : positionLast.current.y - pos.y;
    // Вычисление стилей контейнера меню
    const containerStyle = useMemo(() => {
        const computedStyle = {
            ...style,
            display: 'flex'
        };
        // Горизонтальное позиционирование
        if (position === 'left') {
            computedStyle.left = Math.max(0, Math.min(computedX, window.innerWidth - 50));
            computedStyle.right = 'auto';
        }
        else {
            computedStyle.right = Math.max(0, Math.min(computedX, window.innerWidth - 50));
            computedStyle.left = 'auto';
        }
        // Вертикальное позиционирование
        if (isTop) {
            computedStyle.top = Math.max(0, Math.min(computedY, window.innerHeight - 50));
            computedStyle.bottom = 'auto';
        }
        else {
            computedStyle.bottom = Math.max(0, Math.min(computedY, window.innerHeight - 50));
            computedStyle.top = 'auto';
        }
        return computedStyle;
    }, [style, position, isTop, computedX, computedY]);
    return (_jsxs(DivOutsideClick, { outsideClick: handleClickOutside, className: `menu-container ${isFixed ? 'activeM' : ''}`, style: containerStyle, onMouseEnter: () => !isFixed && setIsOpen(true), onMouseLeave: () => !isFixed && setIsOpen(false), children: [_jsx("div", { ...dragProps, className: "menu-button", onClick: handleToggle, children: "\u2630" }), dop] }));
}
export function MenuRightApi() {
    const elements = [];
    let render = null;
    return {
        set(array) {
            const el = array.filter((e) => elements.indexOf(e) === -1);
            if (el.length === 0)
                return;
            elements.push(...el);
            render?.(elements);
        },
        delete(array) {
            array.forEach((e) => elements.splice(elements.indexOf(e), 1));
        },
        get() {
            return elements;
        },
        Render({ style }) {
            const [el, setEl] = useState(elements);
            useEffect(() => {
                render = setEl;
                return () => {
                    render = null;
                };
            }, []);
            return _jsx(DropdownMenu, { elements: el, style: style, position: "left" });
        }
    };
}
export function DropdownMenuTest() {
    const testData = [
        { label: "Item 1", subMenuContent: () => _jsx(SubMenu, {}) },
        { label: "Item 2", subMenuContent: () => _jsx(SubMenu2, {}) },
        { label: "Item 3", subMenuContent: () => _jsx(SubMenu, {}) }
    ];
    const menu = useMemo(MenuRightApi, []);
    useEffect(() => {
        menu.set(testData);
    }, []);
    return _jsx(menu.Render, {});
}
const SubMenu = () => {
    return (_jsxs("div", { className: "maxSize", children: [_jsx(DraggableOutlineDiv, {}), _jsx("div", { className: "submenu-item", children: "Subitem 1" }), _jsx("div", { className: "submenu-item", children: "Subitem 2" }), _jsx("div", { className: "submenu-item", children: "Subitem 3" })] }));
};
const SubMenu2 = () => {
    return (_jsxs("div", { children: [_jsx("div", { className: "submenu-item", children: "Subitem 33331" }), _jsx("div", { className: "submenu-item", children: "Subitem 33332" }), _jsx("div", { className: "submenu-item", children: "Subitem 33333" })] }));
};
