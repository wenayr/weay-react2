import React, {
    ReactElement,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { PromiseArrayListen, sleepAsync } from "wenay-common";

/*******************************************************
 * Типы данных для меню
 *******************************************************/
export type tMenuReactStrictly<T = any> = {
    name: string | ((status?: T) => string);
    getStatus?: (() => T) | null;
    onClick?: ((
        e: any
    ) => void | undefined | null | ((void | undefined | null | Promise<any> | (() => Promise<any>))[]) | Promise<any>) | null;
    active?: (() => boolean) | null;
    status?: boolean;
    // Поддержка синхронного и асинхронного возвращения массива меню
    next?: (() => (tMenuReact<any> | false)[] | Promise<(tMenuReact<any> | false)[]>) | null;
    // Поддержка синхронного и асинхронного возвращения React-элемента
    func?: (() => React.ReactElement | Promise<React.ReactElement>) | null;
    // Поддержка синхронного и асинхронного возвращения массива меню для onFocus
    onFocus?: (() => tMenuReact<any>[] | Promise<tMenuReact<any>[]>) | null;
    menuElement?: typeof MenuElement;
};

export type tMenuReact<T = any> = tMenuReactStrictly<T> | false | null | undefined;

/*******************************************************
 * Вспомогательный тип
 *******************************************************/
type tCounters = { ok?: number; error?: number; count?: number };

/*******************************************************
 * Отображает счётчик/прогресс (анимация, кол-во ok/error)
 *******************************************************/
function TimeNum({ data }: { data: tCounters }): ReactElement {
    const refCounter = useRef(0);
    const [count, setCount] = useState(refCounter.current);
    refCounter.current = count;

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
 * Основной элемент меню (пункт с onClick, счётчиками и т.д.)
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
        // При размонтировании отписываемся
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
                // Если это массив "задач" (промисов или функций)
                if (Array.isArray(result)) {
                    const tasks = result.filter(Boolean) as (
                        | Promise<any>
                        | (() => Promise<any>)
                        )[];
                    const pa = PromiseArrayListen(tasks); // Допустим, внешняя функция
                    setProgress({});
                    unsubOk.current?.();
                    unsubErr.current?.();
                    unsubOk.current = pa.listenOk(
                        (
                            data: any,
                            i: number,
                            countOk: number,
                            countError: number,
                            count: number
                        ) => setProgress({ ok: countOk, error: countError, count })
                    );
                    unsubErr.current = pa.listenError(
                        (
                            error: any,
                            i: number,
                            countOk: number,
                            countError: number,
                            count: number
                        ) => setProgress({ ok: countOk, error: countError, count })
                    );
                }
                // Если это один промис
                else if (result instanceof Promise) {
                    setProgress({});
                    result
                        .then(async (val) => {
                            if (Array.isArray(val) && val.length) {
                                // Если вернулся массив из Promise.allSettled
                                // Считаем кол-во ok/error
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
 * Компонент MenuItemWrapper обрабатывает каждый пункт меню,
 * добавляя поддержку асинхронных значений для next, func и onFocus.
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
            const result = item.next();
            if (result instanceof Promise) {
                result.then((val) => {
                    setChildMenu(val.filter(Boolean) as tMenuReactStrictly[]);
                });
            } else {
                setChildMenu(result.filter(Boolean) as tMenuReactStrictly[]);
            }
        } else {
            setChildMenu([]);
        }
    }, [item.status, item.next]);

    useEffect(() => {
        if (item.status && item.func) {
            const result = item.func();
            if (result instanceof Promise) {
                result.then((val) => {
                    setAsyncFuncElement(val);
                });
            } else {
                setAsyncFuncElement(result);
            }
        } else {
            setAsyncFuncElement(null);
        }
    }, [item.status, item.func]);

    useEffect(() => {
        if (item.status && item.onFocus) {
            const result = item.onFocus();
            if (result instanceof Promise) {
                result.then((val) => {
                    setOnFocusMenu(val.filter(Boolean) as tMenuReactStrictly[]);
                });
            } else {
                setOnFocusMenu(result.filter(Boolean) as tMenuReactStrictly[]);
            }
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
 * Компонент MenuBase отвечает за отрисовку всплывающего меню с поддержкой
 * вложенных подменю и управления их состоянием.
 *
 * @param {Object} props - Пропсы компонента.
 * @param {Object} [props.coordinate] - Координаты и параметры отображения меню.
 * @param {number} props.coordinate.x - Координата X для размещения меню.
 * @param {number} props.coordinate.y - Координата Y для размещения меню.
 * @param {boolean} [props.coordinate.toLeft=false] - Указывает, должно ли меню быть смещено влево.
 * @param {number} [props.coordinate.left=0] - Дополнительное смещение влево, если меню отображается с вложенными элементами.
 * @param {tMenuReactStrictly[]} props.data - Массив объектов, описывающих элементы меню.
 * @param {number} [props.zIndex] - Z-index меню для управления видимостью при перекрытии.
 * @param {Function} [props.menu] - Функция, которая генерирует кастомный React элемент для отображения всего меню.
 * @param {Function} [props.menuElement] - Функция для генерации кастомного React элемента для отображения отдельного элемента меню.
 * @param {Function} [props.className] - Функция для задания CSS-классов для элементов меню.
 *
 * @returns {ReactElement} Визуальный элемент меню.
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
    const [_, forceUpdate] = useState(false);
    const update = () => forceUpdate((p) => !p);
    const refMenu = useRef<HTMLDivElement | null>(null);

    const dataMemo = useMemo(
        () => data.filter((e) => e as tMenuReactStrictly) as tMenuReactStrictly[],
        [data, data.length]
    );

    const [top, setTop] = useState(coordinate.y);
    const [leftPos, setLeftPos] = useState(coordinate.x);
    const [menuWidth, setMenuWidth] = useState(0);
    const [isLeftAligned, setIsLeftAligned] = useState(!!coordinate.toLeft);
    const [xOffset, setXOffset] = useState(0);

    useLayoutEffect(() => {
        if (!refMenu.current) return;
        const rect = refMenu.current.getBoundingClientRect();
        const w = window.innerWidth,
            h = window.innerHeight;
        if (h - rect.bottom < 8) setTop((prev) => prev + (h - rect.bottom));
        setLeftPos(rect.x);
        setMenuWidth(rect.width);
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
            ref={(el) => {
                if (el) refMenu.current = el;
            }}
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
                        key={i}
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
