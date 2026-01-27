import React, {
    JSX,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { DivOutsideClick } from './commonFuncReact';
import { GetModalFuncJSX } from './modal';
import { sleepAsync } from 'wenay-common';
import { Position, useDraggable } from './use_draggable_hook';
import { DraggableOutlineDiv } from './DraggableOutlineDiv';

type MenuElement = {
    label: string;
    subMenuContent: () => JSX.Element;
};

type DropdownMenuProps = {
    elements: MenuElement[];
    style?: React.CSSProperties;
    position?: 'left' | 'right';
    position2?: 'top' | 'bottom';
};

export function DropdownMenu({
                                 elements,
                                 style,
                                 position: initialPosition = 'right',
                                 position2: initialPos2 = 'top'
                             }: DropdownMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isFixed, setIsFixed] = useState(false);
    const [select, setSelect] = useState<number | null>(null);
    const data = useRef({ m1: false, m2: false });
    // Получаем JSX-функции модального окна
    const jsx = useMemo(GetModalFuncJSX, []);
    const jsxRender = useMemo(() => <jsx.Render />, [jsx]);

    const [position, setPosition] = useState<'left' | 'right'>(initialPosition);
    const [isTop, setIsTop] = useState(initialPos2 === 'top');
    const positionLast = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const handleDragEnd = useCallback(
        (finalPosition: Position) => {
            // Обработка горизонтального смещения
            if (position === 'left') {
                positionLast.current.x += finalPosition.x;
                if (positionLast.current.x > window.innerWidth * 0.6) {
                    positionLast.current.x = window.innerWidth - positionLast.current.x;
                    setPosition('right');
                }
            } else if (position === 'right') {
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
            } else {
                positionLast.current.y -= finalPosition.y;
                if (positionLast.current.y > document.documentElement.clientHeight * 0.6) {
                    positionLast.current.y = document.documentElement.clientHeight - positionLast.current.y;
                    setIsTop(true);
                }
            }
        },
        [position, isTop]
    );

    const { position: pos, dragProps } = useDraggable(0, 0, 50, handleDragEnd, () => {});

    // Обработчики кликов и наведения
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

    // Отрисовка выпадающего меню (dop)
    const dop = (isFixed || isOpen) && (
        <div
            onMouseEnter={() => {
                data.current.m1 = true;
            }}
            onMouseLeave={() => {
                data.current.m1 = false;
                jsx.set(null);
                setSelect(null);
            }}
            className={`dropdown-content2 ${!isTop ? 'dropdown-up' : ''}`}
            style={{
                display: 'flex',
                [position]: 0,
                right: position === 'left' ? 'auto' : 0,
                flexDirection: position === 'left' ? 'row' : 'row-reverse'
            }}
        >
            <div
                className="dropdown-content"
                onMouseEnter={handleContentMouseEnter}
                onMouseLeave={handleContentMouseLeave}
            >
                {elements.map((item, index) => (
                    <div
                        key={index}
                        className={`menu-item ${select === index ? 'force-hover' : ''}`}
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
                    <div className="submenu" style={{ width: '40vw', minHeight: '70vh' }}>
                        {jsxRender}
                    </div>
                ) : null}
            </div>
        </div>
    );

    // Вычисление смещений
    const computedX =
        position === 'left'
            ? positionLast.current.x + pos.x
            : positionLast.current.x - pos.x;
    const computedY = isTop
        ? positionLast.current.y + pos.y
        : positionLast.current.y - pos.y;

    // Вычисление стилей контейнера меню
    const containerStyle = useMemo<React.CSSProperties>(() => {
        const computedStyle: React.CSSProperties = {
            ...style,
            display: 'flex'
        };

        // Горизонтальное позиционирование
        if (position === 'left') {
            computedStyle.left = Math.max(0, Math.min(computedX, window.innerWidth - 50));
            computedStyle.right = 'auto';
        } else {
            computedStyle.right = Math.max(0, Math.min(computedX, window.innerWidth - 50));
            computedStyle.left = 'auto';
        }
        // Вертикальное позиционирование
        if (isTop) {
            computedStyle.top = Math.max(0, Math.min(computedY, window.innerHeight - 50));
            computedStyle.bottom = 'auto';
        } else {
            computedStyle.bottom = Math.max(0, Math.min(computedY, window.innerHeight - 50));
            computedStyle.top = 'auto';
        }
        return computedStyle;
    }, [style, position, isTop, computedX, computedY]);

    return (
        <DivOutsideClick
            outsideClick={handleClickOutside}
            className={`menu-container ${isFixed ? 'activeM' : ''}`}
            style={containerStyle}
            onMouseEnter={() => !isFixed && setIsOpen(true)}
            onMouseLeave={() => !isFixed && setIsOpen(false)}
        >
            <div {...dragProps} className="menu-button" onClick={handleToggle}>
                ☰
            </div>
            {dop}
        </DivOutsideClick>
    );
}

export function MenuRightApi() {
    const elements: MenuElement[] = [];
    let render: null | (React.Dispatch<React.SetStateAction<MenuElement[]>>) = null;

    return {
        set(array: MenuElement[]) {
            const el = array.filter((e) => elements.indexOf(e) === -1);
            if (el.length === 0) return;
            elements.push(...el);
            render?.(elements);
        },
        delete(array: MenuElement[]) {
            array.forEach((e) => elements.splice(elements.indexOf(e), 1));
        },
        get() {
            return elements;
        },
        Render({ style }: { style?: React.CSSProperties }) {
            const [el, setEl] = useState(elements);
            useEffect(() => {
                render = setEl;
                return () => {
                    render = null;
                };
            }, []);
            return <DropdownMenu elements={el} style={style} position="left" />;
        }
    };
}

export function DropdownMenuTest() {
    const testData: MenuElement[] = [
        {label: "Item 1", subMenuContent: () => <SubMenu/>},
        {label: "Item 2", subMenuContent: () => <SubMenu2/>},
        {label: "Item 3", subMenuContent: () => <SubMenu/>}
    ]
    const menu = useMemo(MenuRightApi,[]);
    useEffect(() => {
        menu.set(testData)
    }, []);

    return <menu.Render/>
}


const SubMenu = () => {
    return (
        <div className="maxSize">
            <DraggableOutlineDiv/>
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

