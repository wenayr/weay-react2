import React, {
    ReactElement,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { promiseProgress, sleepAsync } from "wenay-common2/client";

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

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
    return !!value && (typeof value === "object" || typeof value === "function") &&
        typeof (value as PromiseLike<T>).then === "function";
}

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
    const operation = useRef(0);

    useEffect(() => {
        // Unsubscribe on unmount
        return () => {
            operation.current++;
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
                const currentOperation = ++operation.current;
                const isCurrent = () => operation.current === currentOperation;
                unsubOk.current?.();
                unsubErr.current?.();
                unsubOk.current = null;
                unsubErr.current = null;
                const actionKey = item.actionKey ?? undefined;
                onActionEvent?.({type: "click", item: item as MenuItemStrict, actionKey});
                let result;
                try {
                    result = item.onClick(item);
                } catch (error) {
                    onActionEvent?.({type: "error", item: item as MenuItemStrict, actionKey, error});
                    return;
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
                    // clear progress when all tasks settle, same as the single-promise path;
                    // previously the counter (and its 30ms interval) lived until unmount
                    const onTick = async (countOk: number, countError: number, count: number) => {
                        if (!isCurrent()) return;
                        setProgress({ ok: countOk, error: countError, count });
                        if (countOk + countError >= count) {
                            unsubOk.current?.();
                            unsubErr.current?.();
                            unsubOk.current = null;
                            unsubErr.current = null;
                            await sleepAsync(500);
                            if (isCurrent()) setProgress(null);
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
                else if (isPromiseLike(result)) {
                    setProgress({});
                    Promise.resolve(result)
                        .then(async (val) => {
                            if (!isCurrent()) return;
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
                            if (!isCurrent()) return;
                            onActionEvent?.({type: "error", item: item as MenuItemStrict, actionKey, error});
                        })
                        .finally(async () => {
                            await sleepAsync(500);
                            if (isCurrent()) setProgress(null);
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

const EMPTY_MENU_ITEMS: MenuItemStrict[] = [];

type AsyncMenuEventType = Extract<
    MenuActionEventType,
    "submenuOpen" | "submenuOk" | "submenuError" |
    "funcOpen" | "funcOk" | "funcError" |
    "focusOpen" | "focusOk" | "focusError"
>;

/** One lifecycle for all lazy menu resources. Rejections are reported through
 * onActionEvent and stale completions are ignored; internal promise chains must
 * never turn a handled menu error into an unhandled rejection. */
function useAsyncMenuValue<T>({
    open,
    load,
    empty,
    normalize,
    item,
    events,
    onActionEvent,
}: {
    open: boolean;
    load?: (() => T | Promise<T>) | null;
    empty: T;
    normalize: (value: T) => T;
    item: MenuItemStrict;
    events: readonly [AsyncMenuEventType, AsyncMenuEventType, AsyncMenuEventType];
    onActionEvent?: MenuActionHandler;
}) {
    const [value, setValue] = useState<T>(empty);

    // item/events/onActionEvent/empty/normalize are routinely inline at the call site, so
    // keeping them in the deps tore down and restarted the load on every parent render:
    // submenu flicker plus duplicate submenuOpen entries in the menu statistics. Only
    // open/load really gate the subscription; the rest are read through a ref, and the
    // handlers at the moment they fire.
    const latest = useRef({empty, normalize, item, events, onActionEvent});
    latest.current = {empty, normalize, item, events, onActionEvent};

    useEffect(() => {
        if (!open || !load) {
            setValue(latest.current.empty);
            return;
        }

        let alive = true;
        const {item, events} = latest.current;
        const actionKey = item.actionKey ?? undefined;
        latest.current.onActionEvent?.({type: events[0], item, actionKey});
        const succeed = (next: T) => {
            if (!alive) return;
            setValue(latest.current.normalize(next));
            latest.current.onActionEvent?.({type: events[1], item, actionKey});
        };
        const fail = (error: unknown) => {
            if (!alive) return;
            setValue(latest.current.empty);
            latest.current.onActionEvent?.({type: events[2], item, actionKey, error});
        };

        try {
            const result = load();
            if (isPromiseLike<T>(result)) void Promise.resolve(result).then(succeed, fail);
            else succeed(result);
        } catch (error) {
            fail(error);
        }

        return () => { alive = false; };
    }, [open, load]);

    return value;
}

const normalizeMenuItems = (items: MenuItem[]) => items.filter(Boolean) as MenuItemStrict[];
const normalizeMenuElement = (element: React.ReactElement) => element;
const SUBMENU_EVENTS = ["submenuOpen", "submenuOk", "submenuError"] as const;
const FUNC_EVENTS = ["funcOpen", "funcOk", "funcError"] as const;
const FOCUS_EVENTS = ["focusOpen", "focusOk", "focusError"] as const;

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
    const childMenu = useAsyncMenuValue<MenuItemStrict[]>({
        open, load: item.next as (() => MenuItemStrict[] | Promise<MenuItemStrict[]>) | null | undefined,
        empty: EMPTY_MENU_ITEMS, normalize: normalizeMenuItems, item, events: SUBMENU_EVENTS, onActionEvent,
    });
    const asyncFuncElement = useAsyncMenuValue<React.ReactElement | null>({
        open, load: item.func, empty: null,
        normalize: normalizeMenuElement as (element: React.ReactElement | null) => React.ReactElement | null,
        item, events: FUNC_EVENTS, onActionEvent,
    });
    const onFocusMenu = useAsyncMenuValue<MenuItemStrict[]>({
        open, load: item.onFocus as (() => MenuItemStrict[] | Promise<MenuItemStrict[]>) | null | undefined,
        empty: EMPTY_MENU_ITEMS, normalize: normalizeMenuItems, item, events: FOCUS_EVENTS, onActionEvent,
    });

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
    const [xShift, setXShift] = useState(0);

    // Mirror of applied top: vertical snap is recalculated from the base coordinate.y,
    // not from prev; the setTop(prev + ...) delta formula accumulated between runs and drifted.
    const appliedTop = useRef(top);
    appliedTop.current = top;
    const appliedShift = useRef(xShift);
    appliedShift.current = xShift;

    useLayoutEffect(() => {
        if (!refMenu.current) return;
        const rect = refMenu.current.getBoundingClientRect();
        const w = window.innerWidth,
            h = window.innerHeight;

        // Vertical: same bottom snap to viewport edge, but idempotently from the base, and
        // never pulled past the top edge - a menu taller than the viewport used to be pushed
        // up by its whole overflow, putting its first items above y=0 with no way to scroll
        // to them. Floored the same way the horizontal clamp below is.
        const baseTop = rect.top - (appliedTop.current - coordinate.y);
        const baseBottom = rect.bottom - (appliedTop.current - coordinate.y);
        const overflowBottom = h - baseBottom;
        setTop(coordinate.y + (overflowBottom < 8 ? Math.max(overflowBottom, -baseTop) : 0));

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
        // The flip above is a submenu manoeuvre: it needs the parent's left edge to know
        // there is room on the other side, and a root menu passes no `left` (Layer and MenuR
        // hand over x/y only), so `rect.width < 0` made it dead code and a right-click near
        // the right edge simply ran off the viewport. This clamp is the horizontal twin of
        // the vertical snap above - measured from the unshifted base so it stays idempotent,
        // and never pulled so far that the left edge leaves the viewport instead.
        const baseLeft = rect.left - appliedShift.current;
        const overflowRight = w - (rect.right - appliedShift.current);
        setXShift(overflowRight < 8 ? Math.max(overflowRight, -baseLeft) : 0);
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
                left: (isLeftAligned ? -1 * (menuWidth + 3 + xOffset) : coordinate.x + xShift) - 3,
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
