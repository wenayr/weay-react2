import React, {
    JSX,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { sleepAsync } from 'wenay-common2';
import {type Position, useDraggable} from "../../hooks/useDraggable";
import {OutsideClickArea} from "../../hooks/useOutside";
import { OutlineDragDemo } from "../Dnd/OutlineDragDemo";
import { createModalRenderStore } from "../Modal/Modal";
import {
    mapRightMenu,
    type MenuRightPosition,
    type MenuRightVerticalPosition,
    type MenuRightSavedState
} from "./RightMenuStore";

export type MenuElement = {
    label: string;
    subMenuContent: () => JSX.Element;
};

export type MenuRightTriggerState = {isOpen: boolean; isFixed: boolean};
export type MenuRightTrigger = React.ReactNode | ((state: MenuRightTriggerState) => React.ReactNode);
export type MenuRightClassNames = Partial<{
    container: string;
    activeContainer: string;
    trigger: string;
    flyout: string;
    flyoutUp: string;
    list: string;
    item: string;
    itemActive: string;
    submenu: string;
}>;
export type MenuRightStyles = Partial<Record<
    'container' | 'trigger' | 'flyout' | 'list' | 'item' | 'submenu',
    React.CSSProperties
>>;

function cx(...parts: (string | false | null | undefined)[]) {
    return parts.filter(Boolean).join(' ');
}

function renderTrigger(trigger: MenuRightTrigger, state: MenuRightTriggerState) {
    return typeof trigger == 'function' ? trigger(state) : trigger;
}

export type DropdownMenuProps = {
    elements: MenuElement[];
    style?: React.CSSProperties;
    styles?: MenuRightStyles;
    classNames?: MenuRightClassNames;
    trigger?: MenuRightTrigger;
    position?: MenuRightPosition;
    verticalPosition?: MenuRightVerticalPosition;
    keyForSave?: string;
};

export type MenuRightRenderProps = Omit<DropdownMenuProps, 'elements'>;

export function DropdownMenu({
                                 elements,
                                 style,
                                 styles,
                                 classNames = {},
                                 trigger = '☰',
                                 position: initialPosition = 'right',
                                 verticalPosition: initialVerticalPosition = 'top',
                                 keyForSave
                             }: DropdownMenuProps) {
    const [initialState] = useState<MenuRightSavedState>(() => {
        const fallback: MenuRightSavedState = {
            position: initialPosition,
            verticalPosition: initialVerticalPosition,
            offset: { x: 0, y: 0 }
        };
        if (!keyForSave) return fallback;

        const saved = mapRightMenu.get(keyForSave);
        if (saved) return saved;

        mapRightMenu.set(keyForSave, fallback);
        return fallback;
    });
    const [isOpen, setIsOpen] = useState(false);
    const [isFixed, setIsFixed] = useState(false);
    const [select, setSelect] = useState<number | null>(null);
    const data = useRef({ m1: false, m2: false });
    // Get modal JSX functions
    const jsx = useMemo(createModalRenderStore, []);
    const jsxRender = useMemo(() => <jsx.Render />, [jsx]);
    const [position, setPosition] = useState<MenuRightPosition>(initialState.position);
    const [isTop, setIsTop] = useState(initialState.verticalPosition === 'top');
    const positionLast = useRef<{ x: number; y: number }>({ ...initialState.offset });
    const containerRef = useRef<HTMLDivElement | null>(null);

    const handleDragEnd = useCallback((finalPosition: Position) => {
        // Re-anchor from the computed dropped rect. useDraggable resets its delta
        // before React necessarily paints, so measuring the element position here
        // can read the pre-drop corner and cause a sudden relocation.
        const el = containerRef.current;
        if (!el) return;
        const parent = el.offsetParent as HTMLElement | null;
        // fixed positioning -> offsetParent is null -> viewport is the box
        const bounds = parent?.getBoundingClientRect()
            ?? new DOMRect(0, 0, window.innerWidth, document.documentElement.clientHeight);

        const measured = el.getBoundingClientRect();
        const width = measured.width;
        const height = measured.height;
        const baseLeft = position === 'left'
            ? bounds.left + positionLast.current.x
            : bounds.right - positionLast.current.x - width;
        const baseTop = isTop
            ? bounds.top + positionLast.current.y
            : bounds.bottom - positionLast.current.y - height;
        const left = baseLeft + finalPosition.x;
        const top = baseTop + finalPosition.y;
        const right = left + width;
        const bottom = top + height;

        const toLeft = left + width / 2 < bounds.left + bounds.width / 2;
        const toTop = top + height / 2 < bounds.top + bounds.height / 2;
        const nextPosition: MenuRightPosition = toLeft ? 'left' : 'right';
        const nextOffset = {
            x: Math.max(0, toLeft ? left - bounds.left : bounds.right - right),
            y: Math.max(0, toTop ? top - bounds.top : bounds.bottom - bottom)
        };

        positionLast.current = nextOffset;
        setPosition(nextPosition);
        setIsTop(toTop);

        if (keyForSave) {
            // mapRightMenu is observable: set() itself marks the cache dirty
            mapRightMenu.set(keyForSave, {
                position: nextPosition,
                verticalPosition: toTop ? 'top' : 'bottom',
                offset: { ...nextOffset }
            });
        }
    }, [isTop, keyForSave, position]);
    const { position: pos, dragProps } = useDraggable(0, 0, 50, handleDragEnd, () => {});

    // Click and hover handlers
    const handleClickOutside = useCallback(() => {
        setIsOpen(false);
    }, []);

    const handleToggle = useCallback(() => {
        setIsFixed((prev) => !prev);
        setIsOpen((prev) => !prev);
    }, []);

    const handleSelect = useCallback((item: MenuElement, index: number) => {
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

    // Render dropdown menu (dop)
    const dop = (isFixed || isOpen) && (
        <div
            onMouseEnter={handleContentMouseEnter}
            onMouseLeave={handleContentMouseLeave}
            className={cx(classNames.flyout ?? 'dropdown-content2', !isTop ? (classNames.flyoutUp ?? 'dropdown-up') : undefined)}
            style={{
                display: 'flex',
                [position]: 0,
                right: position === 'left' ? 'auto' : 0,
                flexDirection: position === 'left' ? 'row' : 'row-reverse',
                ...styles?.flyout
            }}
        >
            <div
                className={classNames.list ?? "dropdown-content"}
                style={styles?.list}
                onMouseEnter={handleContentMouseEnter}
                onMouseLeave={handleContentMouseLeave}
            >
                {elements.map((item, index) => (
                    <div
                        key={item.label}
                        className={cx(classNames.item ?? 'menu-item', select === index ? (classNames.itemActive ?? 'force-hover') : undefined)}
                        style={styles?.item}
                        onMouseEnter={() => handleSelect(item, index)}
                        onClick={() => handleSelect(item, index)}
                    >
                        {item.label}
                    </div>
                ))}
            </div>
            <div
                onMouseEnter={handleSubmenuMouseEnter}
                onMouseLeave={handleSubmenuMouseLeave}
            >
                {jsx.JSX ? (
                    // clamp to the viewport: with hard 40vw/70vh the submenu ran
                    // off screen when the menu sat near a bottom/side edge
                    <div className={classNames.submenu ?? "submenu"} style={{ width: '40vw', minHeight: '70vh',
                        maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', ...styles?.submenu }}>
                        {jsxRender}
                    </div>
                ) : null}
            </div>
        </div>
    );

    // Calculate offsets
    const computedX =
        position === 'left'
            ? positionLast.current.x + pos.x
            : positionLast.current.x - pos.x;
    const computedY = isTop
        ? positionLast.current.y + pos.y
        : positionLast.current.y - pos.y;

    // Calculate menu container styles
    const containerStyle = useMemo<React.CSSProperties>(() => {
        const computedStyle: React.CSSProperties = {
            ...style,
            ...styles?.container,
            display: 'flex'
        };

        // Horizontal positioning
        if (position === 'left') {
            computedStyle.left = Math.max(0, Math.min(computedX, window.innerWidth - 50));
            computedStyle.right = 'auto';
        } else {
            computedStyle.right = Math.max(0, Math.min(computedX, window.innerWidth - 50));
            computedStyle.left = 'auto';
        }
        // Vertical positioning
        if (isTop) {
            computedStyle.top = Math.max(0, Math.min(computedY, window.innerHeight - 50));
            computedStyle.bottom = 'auto';
        } else {
            computedStyle.bottom = Math.max(0, Math.min(computedY, window.innerHeight - 50));
            computedStyle.top = 'auto';
        }
        return computedStyle;
    }, [style, styles?.container, position, isTop, computedX, computedY]);

    return (
        <OutsideClickArea
            ref={containerRef}
            outsideClick={handleClickOutside}
            className={cx(classNames.container ?? 'menu-container', isFixed ? (classNames.activeContainer ?? 'activeM') : undefined)}
            style={containerStyle}
            onMouseEnter={() => !isFixed && setIsOpen(true)}
            onMouseLeave={() => !isFixed && setIsOpen(false)}
        >
            <div {...dragProps} className={classNames.trigger ?? "menu-button"} style={styles?.trigger} onClick={handleToggle}>
                {renderTrigger(trigger, {isOpen, isFixed})}
            </div>
            {dop}
        </OutsideClickArea>
    );
}

export function createRightMenuController() {
    const elements: MenuElement[] = [];
    let render: null | (React.Dispatch<React.SetStateAction<MenuElement[]>>) = null;

    return {
        set(array: MenuElement[]) {
            const el = array.filter((e) => elements.indexOf(e) === -1);
            if (el.length === 0) return;
            elements.push(...el);
            render?.([...elements]);
        },
        delete(array: MenuElement[]) {
            array.forEach((e) => {
                const i = elements.indexOf(e);
                if (i !== -1) elements.splice(i, 1);
            });
            render?.([...elements]);
        },
        get() {
            return elements;
        },
        Render(props: MenuRightRenderProps = {}) {
            const [el, setEl] = useState([...elements]);
            useEffect(() => {
                render = setEl;
                return () => {
                    render = null;
                };
            }, []);
            return <DropdownMenu {...props} elements={el} />;
        }
    };
}

export function RightMenuDemo() {
    const testData: MenuElement[] = [
        {label: "Item 1", subMenuContent: () => <SubMenu/>},
        {label: "Item 2", subMenuContent: () => <SubMenu2/>},
        {label: "Item 3", subMenuContent: () => <SubMenu/>}
    ]
    const menu = useMemo(createRightMenuController,[]);
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
