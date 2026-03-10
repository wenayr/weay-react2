import React, {useEffect, useMemo, useRef, useState} from "react";
import {Color, colorGenerator2, ColorString, sleepAsync} from "wenay-common";
import {Drag2} from "./RNDFunc";
import {renderBy, updateBy} from "../updateBy";
import {GetModalJSX} from "./modal";
import {Drag22} from "./RNDFunc3";
function useViewport() {
    const [width, setWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return { width };
}

// Custom hook for smooth snap scrolling animation
function useSmoothSnapScroll() {
    const animationState = useRef({ isAnimating: false });
    const currentPosition = useRef({ x: 0, y: 0 });

    const animateTo = async (target: number, onUpdate: (value: number) => void, onComplete?: () => void) => {
        animationState.current.isAnimating = true;
        const step = 40;

        const animate = async () => {
            if (!animationState.current.isAnimating || currentPosition.current.x === target) {
                return;
            }

            const direction = target > currentPosition.current.x ? 1 : -1;
            await sleepAsync(10);
            const nextPosition = currentPosition.current.x + direction * step;

            if (Math.abs(target - nextPosition) < step) {
                animationState.current.isAnimating = false;
                currentPosition.current.x = target;
                onUpdate(target);
                onComplete?.();
                return;
            }

            currentPosition.current.x = nextPosition;
            onUpdate(nextPosition);
            animate();
        };

        await animate();
    };

    const stopAnimation = () => {
        animationState.current.isAnimating = false;
    };

    return { animateTo, stopAnimation, currentPosition };
}
const MENU_WIDTH_RATIO = 0.8;

// Main sidebar menu component with snap scrolling behavior
function SidebarMenuComponent({y_, x_, api, arr, zIndex}: {
    arr: [React.JSX.Element, React.JSX.Element][],
    zIndex: number,
    api: (s: {
        open: (a: boolean) => void,
        x: (x: number) => void,
        y: (y: number) => void,
        moveTo?: (x?: number) => void,
        moveToStart?: () => void,
        moveToEnd?: () => void,
        moveStop?: () => void,
        start?: () => void,
        stop?: () => void,
    }) => void,
    x_: number,
    y_: number
}) {
    const [page, setPage] = useState<React.JSX.Element | null>(null);
    const [x, setX] = useState(x_);
    const [y, setY] = useState(y_);
    const [open, setOpen] = useState(false);

    // Size references for menu and element dimensions
    const viewportSize = useRef<{width: number, height: number} | null>(null);
    const elementSize = useRef<{width: number, height: number} | null>(null);
    const lastPosition = useRef({x: 0, y: 0, auto: false});
    const currentPosition = useRef({x: 0, y: 0, auto: false});
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const dragStatus = useRef({status: 0});
    const {width: viewportWidth} = useViewport();

    const mainPage = useMemo(() => (
        <div
            ref={scrollRef}
            style={{
                height: "100vh",
                width: Math.round(MENU_WIDTH_RATIO * 100) + "vw",
                overflow: "auto",
                scrollbarWidth: "none",
                scrollBehavior: "smooth",
                scrollSnapType: "y mandatory"
            }}
        >
            {arr.map(([button, page], i) => (
                <div
                    ref={e => e?.scrollTo()}
                    key={i}
                    style={{scrollSnapAlign: "start"}}
                    id={String(i)}
                >
                    {page}
                </div>
            ))}
            <div></div>
        </div>
    ), [arr]);

    const menuItems = arr.map((e, i) => (
        <div
            key={i}
            style={{paddingBottom: 10, width: "100%"}}
            onMouseDown={() => setPage(mainPage)}
            onTouchStart={() => setPage(mainPage)}
        >
            <a
                rel={"ds"}
                href={`#${i}`}
                style={{
                    font: "inherit",
                    color: "inherit",
                    textDecoration: "inherit",
                    cursor: "default",
                }}
            >
                {e[0]}
            </a>
        </div>
    ));

    // Smooth animation function to target position
    const animateToPosition = async (target: number) => {
        lastPosition.current.auto = true;
        const step = 40;

        if (!lastPosition.current.auto) return;

        const animate = async () => {
            if (!lastPosition.current.auto || currentPosition.current.x === target) return;

            const direction = target > currentPosition.current.x ? 1 : -1;
            await sleepAsync(10);
            const nextPos = currentPosition.current.x + direction * step;

            if (Math.abs(target - nextPos) < step) {
                lastPosition.current.auto = false;
                currentPosition.current.x = target;
                if (target === 0) setOpen(false);
                setX(target);
                return;
            }

            currentPosition.current.x = nextPos;
            setX(nextPos);
            animate();
        };

        await animate();
    };
    useEffect(() => {
        const menuApi: Parameters<typeof api>[0] = {
            moveStop: () => {
                currentPosition.current.auto = false;
                lastPosition.current.auto = false;
            },
            moveToStart: () => {
                animateToPosition(0);
            },
            moveToEnd: () => {
                animateToPosition(viewportSize.current?.width ? viewportSize.current.width * -1 : -500);
            },
            y: yNew => {
                let newY = yNew + lastPosition.current.y;
                if (newY < 0) newY = 0;
                if (dragStatus.current.status === 1) {
                    currentPosition.current.y = newY;
                    setY(newY);
                }
            },
            open: setOpen,
            x: (xNew) => {
                let newX = xNew + lastPosition.current.x;
                currentPosition.current.x = newX;
                if (newX < 0) setOpen(true);
                if (newX === 0) setOpen(false);
                setX(newX);
            },
            start: () => {
                menuApi.moveStop?.();
                lastPosition.current.x = currentPosition.current.x;
                lastPosition.current.y = currentPosition.current.y;
            },
            stop: () => {
                if (lastPosition.current.x > currentPosition.current.x + 3) {
                    animateToPosition(viewportSize.current ? MENU_WIDTH_RATIO * viewportWidth * -1 : -300);
                } else if (lastPosition.current.x + 3 < currentPosition.current.x &&
                           Math.abs(lastPosition.current.y - currentPosition.current.y) <=
                           Math.abs(lastPosition.current.x - currentPosition.current.x)) {
                    animateToPosition(0);
                } else {
                    if (viewportSize.current) {
                        if (Math.abs(currentPosition.current.x) > viewportSize.current.width * 0.5) {
                            animateToPosition(viewportSize.current.width * -1);
                        } else {
                            animateToPosition(0);
                        }
                    }
                }
            },
        };
        api(menuApi);
    }, [viewportWidth]);
    return <>
        <div
            ref={e => {
                if (e) {
                    const rect = e.getBoundingClientRect();
                    elementSize.current = {
                        height: rect.height,
                        width: rect.width,
                    };
                }
            }}
            style={{position: "absolute", right: x * -1, top: y, zIndex}}
            onClick={() => {
                if (!open) {
                    setOpen(true);
                    animateToPosition(viewportSize.current ? MENU_WIDTH_RATIO * viewportWidth * -1 : -300);
                }
            }}
            onMouseDown={() => {
                dragStatus.current.status = 1;
            }}
            onMouseLeave={() => {
                dragStatus.current.status = 0;
            }}
            onMouseUp={() => {
                dragStatus.current.status = 0;
            }}
        >
            {menuItems}
        </div>
        <div
            ref={e => {
                if (e) {
                    const rect = e.getBoundingClientRect();
                    viewportSize.current = {
                        height: rect.height,
                        width: rect.width,
                    };
                }
            }}
            style={{position: "absolute", left: `calc(100% + ${x}px)`, zIndex}}
        >
        </div>

        {open && (
            <div style={{width: -x, overflow: "hidden"}}>
                <div
                    ref={e => {
                        if (e) {
                            const rect = e.getBoundingClientRect();
                            viewportSize.current = {
                                height: rect.height,
                                width: rect.width,
                            };
                        }
                    }}
                    className={"maxSize"}
                >
                </div>
                {mainPage}
            </div>
        )}
    </>;
}


export function LeftModal({arr, zIndex}: {arr: [React.JSX.Element, React.JSX.Element][], zIndex: number}) {
    const currentPos = useRef({x: 0, y: 0, auto: false});
    const menuApiRef = useRef<Parameters<Parameters<typeof SidebarMenuComponent>[0]["api"]>[0] | null>(null);

    const sidebarComponent = useMemo(() => (
        <SidebarMenuComponent
            arr={arr}
            zIndex={zIndex}
            api={(apiInstance) => {
                menuApiRef.current = apiInstance;
            }}
            x_={currentPos.current.x}
            y_={currentPos.current.y}
        />
    ), [arr, zIndex]);

    const draggableWrapper = useMemo(() => (
        <Drag22
            onX={(xNew) => menuApiRef.current?.x(xNew)}
            right={true}
            onY={(yNew) => menuApiRef.current?.y(yNew)}
            x={0}
            y={0}
            onStart={() => menuApiRef.current?.start?.()}
            onStop={() => menuApiRef.current?.stop?.()}
        >
            {sidebarComponent}
        </Drag22>
    ), [sidebarComponent]);

    return <div className={"maxSize"}>{draggableWrapper}</div>;
}
type MenuItem = {
    id?: number,
    button: React.JSX.Element,
    color?: ColorString,
    textB?: string,
    el: () => React.JSX.Element
};

type MenuItemPartial = Omit<MenuItem, "button"> & {button?: MenuItem["button"]};

function LeftMenuComponent({api, menu = [], zIndex}: {
    zIndex: number,
    api: (api: {setMenu: (arr: MenuItem[]) => void}) => void,
    menu?: MenuItem[]
}) {
    return <LeftModal arr={menu.map(item => [item.button, item.el()])} zIndex={zIndex}/>;
}

export function getApiLeftMenu() {
    const createDefaultButton = ({color, text}: {color: ColorString, text?: string}) => {
        return (
            <div
                className={"blur"}
                style={{
                    minHeight: "4vh",
                    minWidth: "50px",
                    marginBottom: 10,
                    fontSize: 12,
                    textAlign: "center",
                    background: color,
                    color: "rgba(255,255,255,0.1)"
                }}
            >
                {text ?? ""}
            </div>
        );
    };

    const createDefaultElement = ({color, children, textB}: {
        color: ColorString,
        children: () => React.JSX.Element,
        textB?: string
    }) => {
        const viewportWidth = window.innerWidth;
        return (
            <div
                className={"blur"}
                style={{
                    minHeight: "100vh",
                    width: viewportWidth > 800 ? "100%" : "calc(100vw - 50px)",
                    background: color,
                    position: "relative"
                }}
            >
                {textB && (
                    <div style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        fontSize: 28,
                        color: "rgba(255,255,255,0.1)"
                    }}>
                        {textB}
                    </div>
                )}
                {children()}
            </div>
        );
    };

    type MenuApiType = Parameters<Parameters<typeof LeftMenuComponent>[0]["api"]>[0] | null;
    let menuApi: MenuApiType = null;
    const menuStore = new Map<string, MenuItem[]>();

    const setMenu = (items: (MenuItemPartial | MenuItem)[], key = "base") => {
        const colorGen = colorGenerator2({min: 0, max: 90});
        const currentMenuLength = getAllMenuItems().length;
        const baseColors: ColorString[] = [];

        for (let i = 0; i < currentMenuLength + items.length; i++) {
            const colorResult = colorGen.next();
            if (!colorResult.done) {
                const [r, g, b] = colorResult.value;
                baseColors.push(`rgb(${r},${g},${b}, 0.3)` as ColorString);
            }
        }

        const itemColors = items.map((item, i) => item.color ?? baseColors[item.id ?? i + currentMenuLength]);
        const menuItems: MenuItem[] = items.map((item, i) => ({
            ...item,
            button: item.button ?? createDefaultButton({text: item.textB, color: itemColors[i]}),
            el: () => createDefaultElement({color: itemColors[i], children: item.el, textB: item.textB})
        }));

        menuStore.set(key, menuItems);
    };

    function getAllMenuItems() {
        return [...menuStore.values()].flat();
    }

    function Modal2({menu, zIndex, zIndex0, key}: {
        zIndex: number,
        zIndex0?: number,
        key?: string,
        menu?: (MenuItemPartial | MenuItem)[]
    }) {
        if (menu) setMenu(menu, key);
        updateBy(menuStore);
        return (
            <div className={"maxSize"} style={{position: "absolute", zIndex: zIndex0}}>
                <modal.Render/>
                <LeftMenuComponent zIndex={zIndex} api={a => menuApi = a} menu={getAllMenuItems()}/>
            </div>
        );
    }

    const modal = GetModalJSX();
    return {
        modal,
        renderBy() { renderBy(menuStore); },
        getMenu: () => menuStore,
        setMenu: setMenu,
        Modal2: Modal2
    };
}


export const ApiLeftMenu = getApiLeftMenu()
ApiLeftMenu.setMenu([
    {button: <div style={{width: 200, height: 50, background: "rgb(92,50,213)"}}>1</div>, el: () => <div>1</div>, color: "rgb(92,50,213)"},
    {button: <div style={{width: 200, height: 50, background: "rgb(98,149,58)"}}>2</div>, el: () => <div>2</div>},
], "test")
export function TestLeft333() {
    return <ApiLeftMenu.Modal2 zIndex={20} />
}


