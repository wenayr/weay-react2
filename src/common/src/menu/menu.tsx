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
export type tMenuReactStrictly<T = any> = {
    name: string | ((status?: T) => string);
    getStatus?: (() => T) | null;
    onClick?: ((
        e: any
    ) => void | undefined | null | ((void | undefined | null | Promise<any> | (() => Promise<any>))[]) | Promise<any>) | null;
    active?: (() => boolean) | null;
    status?: boolean;
    // Supports returning a menu array synchronously or asynchronously
    next?: (() => (tMenuReact<any> | false)[] | Promise<(tMenuReact<any> | false)[]>) | null;
    // Supports returning a React element synchronously or asynchronously
    func?: (() => React.ReactElement | Promise<React.ReactElement>) | null;
    // Supports returning an onFocus menu array synchronously or asynchronously
    onFocus?: (() => tMenuReact<any>[] | Promise<tMenuReact<any>[]>) | null;
    menuElement?: typeof MenuElement;
};

export type tMenuReact<T = any> = tMenuReactStrictly<T> | false | null | undefined;

/*******************************************************
 * Helper type
 *******************************************************/
type tCounters = { ok?: number; error?: number; count?: number };

/*******************************************************
 * Displays counter/progress with animation and ok/error counts
 *******************************************************/
function TimeNum({ data }: { data: tCounters }): ReactElement {
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
                     }: {
    data: Pick<tMenuReactStrictly, "onClick" | "active" | "name" | "getStatus">;
    toLeft: boolean;
    className?: (active?: boolean) => string;
    update: () => void;
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

    const [progress, setProgress] = useState<tCounters | null>(null);

    return (
        <div
            className={
                className?.(item.active?.()) ||
                "MenuR " + (item.active?.() ? "toButtonA" : "toButton")
            }
            style={{ float: toLeft ? "left" : "right" }}
            onClick={() => {
                if (!item.onClick) return;
                const result = item?.onClick?.(item);
                if (!result) {
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
                        (data: any, i: number, countOk: number, countError: number, count: number) =>
                            onTick(countOk, countError, count)
                    );
                    unsubErr.current = pa.onError(
                        (error: any, i: number, countOk: number, countError: number, count: number) =>
                            onTick(countOk, countError, count)
                    );
                    void pa.allSettled();
                }
                // If this is a single promise
                else if (result instanceof Promise) {
                    setProgress({});
                    result
                        .then(async (val) => {
                            if (Array.isArray(val) && val.length) {
                                // If an array from Promise.allSettled was returned
                                // Count ok/error results
                                if (val[0]?.status === "fulfilled" || val[0]?.status === "rejected") {
                                    const t = { ok: 0, error: 0 } as tCounters;
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
                        .finally(async () => {
                            await sleepAsync(500);
                            setProgress(null);
                        });
                } else {
                    update();
                }
            }}
        >
            <div className="toLine">
                {typeof item.name === "string"
                    ? item.name
                    : item.name(item.getStatus?.())}
                {progress && <TimeNum data={progress} />}
            </div>
        </div>
    );
}

/*******************************************************
 * MenuItemWrapper processes each menu item,
 * adding async value support for next, func, and onFocus.
 *******************************************************/
type MenuItemWrapperProps = {
    item: tMenuReactStrictly;
    index: number;
    update: () => void;
    className?: (active?: boolean) => string;
    isLeftAligned: boolean;
    leftPos: number;
    menuElement?: (item: tMenuReact) => ReactElement;
    fullArray: tMenuReactStrictly[];
};

const MenuItemWrapper = ({
                             item,
                             index,
                             update,
                             className,
                             isLeftAligned,
                             leftPos,
                             menuElement,
                             fullArray,
                         }: MenuItemWrapperProps): ReactElement => {
    const [childMenu, setChildMenu] = useState<tMenuReactStrictly[]>([]);
    const [asyncFuncElement, setAsyncFuncElement] = useState<React.ReactElement | null>(null);
    const [onFocusMenu, setOnFocusMenu] = useState<tMenuReactStrictly[]>([]);

    useEffect(() => {
        if (item.status && item.next) {
            let alive = true; // guard: do not set state after unmount or item change
            const result = item.next();
            if (result instanceof Promise) {
                result.then((val) => {
                    if (alive) setChildMenu(val.filter(Boolean) as tMenuReactStrictly[]);
                });
            } else {
                setChildMenu(result.filter(Boolean) as tMenuReactStrictly[]);
            }
            return () => { alive = false; };
        } else {
            setChildMenu([]);
        }
    }, [item.status, item.next]);

    useEffect(() => {
        if (item.status && item.func) {
            let alive = true;
            const result = item.func();
            if (result instanceof Promise) {
                result.then((val) => {
                    if (alive) setAsyncFuncElement(val);
                });
            } else {
                setAsyncFuncElement(result);
            }
            return () => { alive = false; };
        } else {
            setAsyncFuncElement(null);
        }
    }, [item.status, item.func]);

    useEffect(() => {
        if (item.status && item.onFocus) {
            let alive = true;
            const result = item.onFocus();
            if (result instanceof Promise) {
                result.then((val) => {
                    if (alive) setOnFocusMenu(val.filter(Boolean) as tMenuReactStrictly[]);
                });
            } else {
                setOnFocusMenu(result.filter(Boolean) as tMenuReactStrictly[]);
            }
            return () => { alive = false; };
        } else {
            setOnFocusMenu([]);
        }
    }, [item.status, item.onFocus]);

    const onMouseEnter = () => {
        if (item.status) return;
        fullArray.forEach((it, j) => {
            it.status = j === index;
        });
        update();
    };

    return (
        <div className="toLine" onMouseEnter={onMouseEnter}>
            {menuElement
                ? menuElement(item)
                : item.menuElement?.({
                toLeft: isLeftAligned,
                data: item,
                className,
                update,
            }) ?? (
                <MenuElement
                    toLeft={isLeftAligned}
                    data={item}
                    className={className}
                    update={update}
                />
            )}
            <div>
                {item.status && childMenu.length > 0 && (
                    <div style={{ position: "relative" }}>
                        <MenuBase
                            data={childMenu}
                            coordinate={{
                                x: 3,
                                y: 0,
                                toLeft: isLeftAligned,
                                left: leftPos,
                            }}
                        />
                    </div>
                )}
                {item.status && asyncFuncElement && (
                    <div style={{ position: "relative" }}>
                        <MenuBase
                            menu={() => asyncFuncElement}
                            data={[]}
                            coordinate={{
                                x: 3,
                                y: 0,
                                toLeft: isLeftAligned,
                                left: leftPos,
                            }}
                        />
                    </div>
                )}
                {item.status && onFocusMenu.length > 0 && (
                    <div style={{ position: "relative" }}>
                        <MenuBase
                            data={onFocusMenu}
                            coordinate={{
                                x: 3,
                                y: 0,
                                toLeft: isLeftAligned,
                                left: leftPos,
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

/*******************************************************
 * MenuBase renders the popup menu with support for
 * nested submenus and their state management.
 *
 * @param {Object} props - Component props.
 * @param {Object} [props.coordinate] - Menu coordinates and display parameters.
 * @param {number} props.coordinate.x - X coordinate for menu placement.
 * @param {number} props.coordinate.y - Y coordinate for menu placement.
 * @param {boolean} [props.coordinate.toLeft=false] - Whether the menu should be shifted left.
 * @param {number} [props.coordinate.left=0] - Additional left offset when the menu has nested items.
 * @param {tMenuReactStrictly[]} props.data - Array of objects describing menu items.
 * @param {number} [props.zIndex] - Menu z-index for overlap visibility.
 * @param {Function} [props.menu] - Function that generates a custom React element for the whole menu.
 * @param {Function} [props.menuElement] - Function that generates a custom React element for one menu item.
 * @param {Function} [props.className] - Function for assigning CSS classes to menu items.
 *
 * @returns {ReactElement} Visual menu element.
 */
type MenuBaseProps = {
    menu?: (arr: tMenuReact[]) => ReactElement;
    menuElement?: (item: tMenuReact) => ReactElement;
    data: tMenuReact[];
    zIndex?: number;
    className?: (active?: boolean) => string;
    coordinate?: {
        x: number;
        y: number;
        toLeft?: boolean;
        left?: number;
    };
};

export function MenuBase({
                             coordinate = { x: 0, y: 0, toLeft: false, left: 0 },
                             data,
                             zIndex,
                             menu,
                             className,
                             menuElement,
                         }: MenuBaseProps): ReactElement {
    const [, forceUpdate] = useState(false);
    const update = () => forceUpdate((p) => !p);
    const refMenu = useRef<HTMLDivElement | null>(null);

    const dataMemo = useMemo(
        () => data.filter(Boolean) as tMenuReactStrictly[],
        [data, data.length]
    );

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
                        fullArray={dataMemo}
                    />
                ))}
        </div>
    );
}

export { TimeNum, MenuElement };
