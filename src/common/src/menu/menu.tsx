import React, {
    ReactElement,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { promiseProgress, sleepAsync } from "wenay-common2";

/*******************************************************
 * Menu data types
 *******************************************************/
export type MenuItemStrict<T = any> = {
    name: string | ((status?: T) => string);
    /** Stable diagnostics key. Stats never fall back to visible labels. */
    actionKey?: string | null;
    getStatus?: (() => T) | null;
    onClick?: ((
        e: any
    ) => void | undefined | null | ((void | undefined | null | Promise<any> | (() => Promise<any>))[]) | Promise<any>) | null;
    active?: (() => boolean) | null;
    status?: boolean;
    // Supports returning a menu array synchronously or asynchronously
    next?: (() => (MenuItem<any> | false)[] | Promise<(MenuItem<any> | false)[]>) | null;
    // Supports returning a React element synchronously or asynchronously
    func?: (() => React.ReactElement | Promise<React.ReactElement>) | null;
    // Supports returning an onFocus menu array synchronously or asynchronously
    onFocus?: (() => MenuItem<any>[] | Promise<MenuItem<any>[]>) | null;
    menuElement?: typeof MenuElement;
};

export type MenuItem<T = any> = MenuItemStrict<T> | false | null | undefined;

export type MenuActionEventType = "click" | "ok" | "error" | "taskOk" | "taskError" | "submenuOpen" | "submenuOk" | "submenuError" | "funcOpen" | "funcOk" | "funcError" | "focusOpen" | "focusOk" | "focusError";
export type MenuActionEvent = {
    type: MenuActionEventType;
    item: MenuItemStrict;
    actionKey?: string;
    error?: unknown;
};
export type MenuActionHandler = (event: MenuActionEvent) => void;

/*******************************************************
 * Helper type
 *******************************************************/
type MenuProgressCounters = { ok?: number; error?: number; count?: number };

/*******************************************************
 * Displays counter/progress with animation and ok/error counts
 *******************************************************/
function MenuProgress({ data }: { data: MenuProgressCounters }): ReactElement {
    const [count, setCount] = useState(0);

    const formatLabel = (): string | number => {
        if (!data.ok && !data.error) return count;
        const txtOk = data.ok ? "ok " + data.ok : "";
        const txtEr = data.error ? " er " + (data.error > 1 ? data.error : "") : "";
        const txtCount = data.count ? "/" + data.count : "";
        return txtOk + txtCount + txtEr;
    };

    useEffect(() => {
        let local = 0;
        const timer = setInterval(() => setCount(++local), 30);
        return () => clearInterval(timer);
    }, []);

    return (
        <div
            style={{
                float: "right",
                opacity: count < 45 ? count / 45 : 1,
                width: count < 25 ? count * 3 : 75,
                textAlign: "right",
            }}
        >
            {formatLabel()}
        </div>
    );
}

/*******************************************************
 * Main menu element with onClick and counters
 *******************************************************/
function MenuElement({
                         data: item,
                         toLeft,
                         className,
                         update,
                         open,
                         onActionEvent,
                     }: {
    data: Pick<MenuItemStrict, "onClick" | "active" | "name" | "getStatus" | "actionKey">;
    toLeft: boolean;
    className?: (active?: boolean) => string;
    update: () => void;
    open?: boolean;
    onActionEvent?: MenuActionHandler;
}): ReactElement {
    const unsubOk = useRef<null | (() => any)>(null);
    const unsubErr = useRef<null | (() => any)>(null);

    useEffect(() => {
        // Unsubscribe on unmount
        return () => {
            unsubOk.current?.();
            unsubErr.current?.();
            unsubOk.current = null;
            unsubErr.current = null;
        };
    }, []);

    const [progress, setProgress] = useState<MenuProgressCounters | null>(null);
    const active = open || item.active?.();

    return (
        <div
            className={
                className?.(active) ||
                "MenuR " + (active ? "toButtonA" : "toButton")
            }
            style={{ float: toLeft ? "left" : "right" }}
            onClick={() => {
                if (!item.onClick) return;
                const actionKey = item.actionKey ?? undefined;
                onActionEvent?.({type: "click", item: item as MenuItemStrict, actionKey});
                let result;
                try {
                    result = item.onClick(item);
                } catch (error) {
                    onActionEvent?.({type: "error", item: item as MenuItemStrict, actionKey, error});
                    throw error;
                }
                if (!result) {
                    onActionEvent?.({type: "ok", item: item as MenuItemStrict, actionKey});
                    update();
                    return;
                }
                // If this is an array of tasks, promises, or functions
                if (Array.isArray(result)) {
                    const tasks = result.filter(Boolean) as (
                        | Promise<any>
                        | (() => Promise<any>)
                        )[];
                    const pa = promiseProgress(tasks);
                    setProgress({});
                    unsubOk.current?.();
                    unsubErr.current?.();
                    // clear progress when all tasks settle, same as the single-promise path;
                    // previously the counter (and its 30ms interval) lived until unmount
                    const onTick = async (countOk: number, countError: number, count: number) => {
                        setProgress({ ok: countOk, error: countError, count });
                        if (countOk + countError >= count) {
                            unsubOk.current?.();
                            unsubErr.current?.();
                            unsubOk.current = null;
                            unsubErr.current = null;
                            await sleepAsync(500);
                            setProgress(null);
                        }
                    };

                    unsubOk.current = pa.onOk(
                        (data: any, i: number, countOk: number, countError: number, count: number) => {
                            onActionEvent?.({type: "taskOk", item: item as MenuItemStrict, actionKey});
                            return onTick(countOk, countError, count);
                        }
                    );
                    unsubErr.current = pa.onError(
                        (error: any, i: number, countOk: number, countError: number, count: number) => {
                            onActionEvent?.({type: "taskError", item: item as MenuItemStrict, actionKey, error});
                            return onTick(countOk, countError, count);
                        }
                    );
                    void pa.allSettled();
                }
                // If this is a single promise
                else if (result instanceof Promise) {
                    setProgress({});
                    result
                        .then(async (val) => {
                            onActionEvent?.({type: "ok", item: item as MenuItemStrict, actionKey});
                            if (Array.isArray(val) && val.length) {
                                // If an array from Promise.allSettled was returned
                                // Count ok/error results
                                if (val[0]?.status === "fulfilled" || val[0]?.status === "rejected") {
                                    const t = { ok: 0, error: 0 } as MenuProgressCounters;
                                    val.forEach((res: any) => {
                                        if (res?.status === "fulfilled") t.ok!++;
                                        if (res?.status === "rejected") t.error!++;
                                    });
                                    setProgress(t);
                                }
                            } else {
                                setProgress({ ok: 1 });
                                await sleepAsync(0);
                            }
                        })
                        .catch((error) => {
                            onActionEvent?.({type: "error", item: item as MenuItemStrict, actionKey, error});
                            throw error;
                        })
                        .finally(async () => {
                            await sleepAsync(500);
                            setProgress(null);
                        });
                } else {
                    onActionEvent?.({type: "ok", item: item as MenuItemStrict, actionKey});
                    update();
                }
            }}
        >
            <div className="toLine">
                {typeof item.name === "string"
                    ? item.name
                    : item.name(item.getStatus?.())}
                {progress && <MenuProgress data={progress} />}
            </div>
        </div>
    );
}

/*******************************************************
 * MenuItemWrapper processes each menu item,
 * adding async value support for next, func, and onFocus.
 *******************************************************/
type MenuItemWrapperProps = {
    item: MenuItemStrict;
    index: number;
    update: () => void;
    className?: (active?: boolean) => string;
    isLeftAligned: boolean;
    leftPos: number;
    menuElement?: (item: MenuItem) => ReactElement;
    open: boolean;
    setOpenIndex: (index: number) => void;
    onActionEvent?: MenuActionHandler;
};

const MenuItemWrapper = ({
                             item,
                             index,
                             update,
                             className,
                             isLeftAligned,
                             leftPos,
                             menuElement,
                             open,
                             setOpenIndex,
                              onActionEvent,
                         }: MenuItemWrapperProps): ReactElement => {
    const [childMenu, setChildMenu] = useState<MenuItemStrict[]>([]);
    const [asyncFuncElement, setAsyncFuncElement] = useState<React.ReactElement | null>(null);
    const [onFocusMenu, setOnFocusMenu] = useState<MenuItemStrict[]>([]);

    useEffect(() => {
        if (open && item.next) {
            const actionKey = item.actionKey ?? undefined;
            onActionEvent?.({type: "submenuOpen", item, actionKey});
            let alive = true; // guard: do not set state after unmount or item change
            let result;
            try {
                result = item.next();
            } catch (error) {
                onActionEvent?.({type: "submenuError", item, actionKey, error});
                throw error;
            }
            if (result instanceof Promise) {
                result.then((val) => {
                    if (alive) setChildMenu(val.filter(Boolean) as MenuItemStrict[]);
                    onActionEvent?.({type: "submenuOk", item, actionKey});
                }).catch((error) => {
                    onActionEvent?.({type: "submenuError", item, actionKey, error});
                    throw error;
                });
            } else {
                setChildMenu(result.filter(Boolean) as MenuItemStrict[]);
                onActionEvent?.({type: "submenuOk", item, actionKey});
            }
            return () => { alive = false; };
        } else {
            setChildMenu([]);
        }
    }, [open, item, item.next, onActionEvent]);

    useEffect(() => {
        if (open && item.func) {
            const actionKey = item.actionKey ?? undefined;
            onActionEvent?.({type: "funcOpen", item, actionKey});
            let alive = true;
            let result;
            try {
                result = item.func();
            } catch (error) {
                onActionEvent?.({type: "funcError", item, actionKey, error});
                throw error;
            }
            if (result instanceof Promise) {
                result.then((val) => {
                    if (alive) setAsyncFuncElement(val);
                    onActionEvent?.({type: "funcOk", item, actionKey});
                }).catch((error) => {
                    onActionEvent?.({type: "funcError", item, actionKey, error});
                    throw error;
                });
            } else {
                setAsyncFuncElement(result);
                onActionEvent?.({type: "funcOk", item, actionKey});
            }
            return () => { alive = false; };
        } else {
            setAsyncFuncElement(null);
        }
    }, [open, item, item.func, onActionEvent]);

    useEffect(() => {
        if (open && item.onFocus) {
            const actionKey = item.actionKey ?? undefined;
            onActionEvent?.({type: "focusOpen", item, actionKey});
            let alive = true;
            let result;
            try {
                result = item.onFocus();
            } catch (error) {
                onActionEvent?.({type: "focusError", item, actionKey, error});
                throw error;
            }
            if (result instanceof Promise) {
                result.then((val) => {
                    if (alive) setOnFocusMenu(val.filter(Boolean) as MenuItemStrict[]);
                    onActionEvent?.({type: "focusOk", item, actionKey});
                }).catch((error) => {
                    onActionEvent?.({type: "focusError", item, actionKey, error});
                    throw error;
                });
            } else {
                setOnFocusMenu(result.filter(Boolean) as MenuItemStrict[]);
                onActionEvent?.({type: "focusOk", item, actionKey});
            }
            return () => { alive = false; };
        } else {
            setOnFocusMenu([]);
        }
    }, [open, item, item.onFocus, onActionEvent]);

    const onMouseEnter = () => {
        if (open) return;
        setOpenIndex(index);
    };
    const viewItem = open == !!item.status ? item : {...item, status: open};

    return (
        <div className="toLine" onMouseEnter={onMouseEnter}>
            {menuElement
                ? menuElement(viewItem)
                : item.menuElement?.({
                toLeft: isLeftAligned,
                data: viewItem,
                className,
                update,
            }) ?? (
                <MenuElement
                    toLeft={isLeftAligned}
                    data={viewItem}
                    className={className}
                    update={update}
                    open={open}
                    onActionEvent={onActionEvent}
                />
            )}
            <div>
                {open && childMenu.length > 0 && (
                    <div style={{ position: "relative" }}>
                        <Menu
                            data={childMenu}
                            coordinate={{
                                x: 3,
                                y: 0,
                                toLeft: isLeftAligned,
                                left: leftPos,
                            }}
                            onActionEvent={onActionEvent}
                        />
                    </div>
                )}
                {open && asyncFuncElement && (
                    <div style={{ position: "relative" }}>
                        <Menu
                            menu={() => asyncFuncElement}
                            data={[]}
                            coordinate={{
                                x: 3,
                                y: 0,
                                toLeft: isLeftAligned,
                                left: leftPos,
                            }}
                            onActionEvent={onActionEvent}
                        />
                    </div>
                )}
                {open && onFocusMenu.length > 0 && (
                    <div style={{ position: "relative" }}>
                        <Menu
                            data={onFocusMenu}
                            coordinate={{
                                x: 3,
                                y: 0,
                                toLeft: isLeftAligned,
                                left: leftPos,
                            }}
                            onActionEvent={onActionEvent}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

/*******************************************************
 * Menu renders the popup menu with support for
 * nested submenus and their state management.
 *
 * @param {Object} props - Component props.
 * @param {Object} [props.coordinate] - Menu coordinates and display parameters.
 * @param {number} props.coordinate.x - X coordinate for menu placement.
 * @param {number} props.coordinate.y - Y coordinate for menu placement.
 * @param {boolean} [props.coordinate.toLeft=false] - Whether the menu should be shifted left.
 * @param {number} [props.coordinate.left=0] - Additional left offset when the menu has nested items.
 * @param {MenuItemStrict[]} props.data - Array of objects describing menu items.
 * @param {number} [props.zIndex] - Menu z-index for overlap visibility.
 * @param {Function} [props.menu] - Function that generates a custom React element for the whole menu.
 * @param {Function} [props.menuElement] - Function that generates a custom React element for one menu item.
 * @param {Function} [props.className] - Function for assigning CSS classes to menu items.
 *
 * @returns {ReactElement} Visual menu element.
 */
type MenuProps = {
    menu?: (arr: MenuItem[]) => ReactElement;
    menuElement?: (item: MenuItem) => ReactElement;
    data: MenuItem[];
    zIndex?: number;
    className?: (active?: boolean) => string;
    onActionEvent?: MenuActionHandler;
    coordinate?: {
        x: number;
        y: number;
        toLeft?: boolean;
        left?: number;
    };
};

export function Menu({
                             coordinate = { x: 0, y: 0, toLeft: false, left: 0 },
                             data,
                             zIndex,
                             menu,
                             className,
                             menuElement,
                              onActionEvent,
                         }: MenuProps): ReactElement {
    const [, forceUpdate] = useState(false);
    const update = () => forceUpdate((p) => !p);
    const refMenu = useRef<HTMLDivElement | null>(null);

    const dataMemo = useMemo(
        () => data.filter(Boolean) as MenuItemStrict[],
        [data, data.length]
    );
    const initialActiveIndex = () => {
        const i = dataMemo.findIndex(item => item.status);
        return i == -1 ? null : i;
    };
    const [activeIndex, setActiveIndex] = useState<number | null>(initialActiveIndex);

    useEffect(() => {
        setActiveIndex(prev => prev != null && dataMemo[prev] ? prev : initialActiveIndex());
    }, [dataMemo]);

    const [top, setTop] = useState(coordinate.y);
    const [leftPos, setLeftPos] = useState(coordinate.x);
    const [menuWidth, setMenuWidth] = useState(0);
    const [isLeftAligned, setIsLeftAligned] = useState(!!coordinate.toLeft);
    const [xOffset, setXOffset] = useState(0);

    // Mirror of applied top: vertical snap is recalculated from the base coordinate.y,
    // not from prev; the setTop(prev + ...) delta formula accumulated between runs and drifted.
    const appliedTop = useRef(top);
    appliedTop.current = top;

    useLayoutEffect(() => {
        if (!refMenu.current) return;
        const rect = refMenu.current.getBoundingClientRect();
        const w = window.innerWidth,
            h = window.innerHeight;

        // Vertical: same bottom snap to viewport edge, but idempotently from the base.
        const baseBottom = rect.bottom - (appliedTop.current - coordinate.y);
        setTop(h - baseBottom < 8 ? coordinate.y + (h - baseBottom) : coordinate.y);

        setLeftPos(rect.x);
        setMenuWidth(rect.width);
        // Horizontal: original sticky logic; reflect once without rollback,
        // it is self-stabilizing and does not accumulate.
        if (!coordinate.toLeft && w - rect.right < 8 && rect.width < (coordinate.left ?? 0)) {
            setXOffset(rect.x - (coordinate.left ?? 0));
            setIsLeftAligned(true);
        }
        if (coordinate.toLeft) {
            setXOffset((coordinate.left ?? 0) - rect.x - 4);
        }
    }, [coordinate.x, coordinate.y, coordinate.toLeft, coordinate.left]);

    const alignStyle: React.CSSProperties = isLeftAligned
        ? { display: "flex", flexDirection: "column-reverse", alignItems: "flex-end" }
        : {};

    return (
        <div
            ref={refMenu}
            style={{
                position: "absolute",
                zIndex,
                paddingLeft: 3,
                left: (isLeftAligned ? -1 * (menuWidth + 3 + xOffset) : coordinate.x) - 3,
                top,
                ...alignStyle,
            }}
        >
            {menu
                ? menu(dataMemo)
                : dataMemo.map((item, i, arr) => (
                    <MenuItemWrapper
                        key={typeof item.name === "string" ? item.name : i}
                        item={item}
                        index={i}
                        update={update}
                        className={className}
                        isLeftAligned={isLeftAligned}
                        leftPos={leftPos}
                        menuElement={menuElement}
                        open={activeIndex === i}
                        setOpenIndex={setActiveIndex}
                        onActionEvent={onActionEvent}
                    />
                ))}
        </div>
    );
}

export { MenuProgress, MenuElement };
