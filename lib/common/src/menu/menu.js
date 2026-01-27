import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, } from 'react';
import { PromiseArrayListen, sleepAsync } from "wenay-common";
/*******************************************************
 * Отображает счётчик/прогресс (анимация, кол-во ok/error)
 *******************************************************/
function TimeNum({ data }) {
    const refCounter = useRef(0);
    const [count, setCount] = useState(refCounter.current);
    refCounter.current = count;
    const formatLabel = () => {
        if (!data.ok && !data.error)
            return count;
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
    return (_jsx("div", { style: {
            float: "right",
            opacity: count < 45 ? count / 45 : 1,
            width: count < 25 ? count * 3 : 75,
            textAlign: "right",
        }, children: formatLabel() }));
}
/*******************************************************
 * Основной элемент меню (пункт с onClick, счётчиками и т.д.)
 *******************************************************/
function MenuElement({ data: item, toLeft, className, update, }) {
    const unsubOk = useRef(null);
    const unsubErr = useRef(null);
    useEffect(() => {
        // При размонтировании отписываемся
        return () => {
            unsubOk.current?.();
            unsubErr.current?.();
            unsubOk.current = null;
            unsubErr.current = null;
        };
    }, []);
    const [progress, setProgress] = useState(null);
    return (_jsx("div", { className: className?.(item.active?.()) ||
            "MenuR " + (item.active?.() ? "toButtonA" : "toButton"), style: { float: toLeft ? "left" : "right" }, onClick: () => {
            if (!item.onClick)
                return;
            const result = item?.onClick?.(item);
            if (!result) {
                update();
                return;
            }
            // Если это массив "задач" (промисов или функций)
            if (Array.isArray(result)) {
                const tasks = result.filter(Boolean);
                const pa = PromiseArrayListen(tasks); // Допустим, внешняя функция
                setProgress({});
                unsubOk.current?.();
                unsubErr.current?.();
                unsubOk.current = pa.listenOk((data, i, countOk, countError, count) => setProgress({ ok: countOk, error: countError, count }));
                unsubErr.current = pa.listenError((error, i, countOk, countError, count) => setProgress({ ok: countOk, error: countError, count }));
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
                            const t = { ok: 0, error: 0 };
                            val.forEach((res) => {
                                if (res?.status === "fulfilled")
                                    t.ok++;
                                if (res?.status === "rejected")
                                    t.error++;
                            });
                            setProgress(t);
                        }
                    }
                    else {
                        setProgress({ ok: 1 });
                        await sleepAsync(0);
                    }
                })
                    .finally(async () => {
                    await sleepAsync(500);
                    setProgress(null);
                });
            }
            else {
                update();
            }
        }, children: _jsxs("div", { className: "toLine", children: [typeof item.name === "string"
                    ? item.name
                    : item.name(item.getStatus?.()), progress && _jsx(TimeNum, { data: progress })] }) }));
}
const MenuItemWrapper = ({ item, index, update, className, isLeftAligned, leftPos, menuElement, fullArray, }) => {
    const [childMenu, setChildMenu] = useState([]);
    const [asyncFuncElement, setAsyncFuncElement] = useState(null);
    const [onFocusMenu, setOnFocusMenu] = useState([]);
    useEffect(() => {
        if (item.status && item.next) {
            const result = item.next();
            if (result instanceof Promise) {
                result.then((val) => {
                    setChildMenu(val.filter(Boolean));
                });
            }
            else {
                setChildMenu(result.filter(Boolean));
            }
        }
        else {
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
            }
            else {
                setAsyncFuncElement(result);
            }
        }
        else {
            setAsyncFuncElement(null);
        }
    }, [item.status, item.func]);
    useEffect(() => {
        if (item.status && item.onFocus) {
            const result = item.onFocus();
            if (result instanceof Promise) {
                result.then((val) => {
                    setOnFocusMenu(val.filter(Boolean));
                });
            }
            else {
                setOnFocusMenu(result.filter(Boolean));
            }
        }
        else {
            setOnFocusMenu([]);
        }
    }, [item.status, item.onFocus]);
    const onMouseEnter = () => {
        if (item.status)
            return;
        fullArray.forEach((it, j) => {
            it.status = j === index;
        });
        update();
    };
    return (_jsxs("div", { className: "toLine", onMouseEnter: onMouseEnter, children: [menuElement
                ? menuElement(item)
                : item.menuElement?.({
                    toLeft: isLeftAligned,
                    data: item,
                    className,
                    update,
                }) ?? (_jsx(MenuElement, { toLeft: isLeftAligned, data: item, className: className, update: update })), _jsxs("div", { children: [item.status && childMenu.length > 0 && (_jsx("div", { style: { position: "relative" }, children: _jsx(MenuBase, { data: childMenu, coordinate: {
                                x: 3,
                                y: 0,
                                toLeft: isLeftAligned,
                                left: leftPos,
                            } }) })), item.status && asyncFuncElement && (_jsx("div", { style: { position: "relative" }, children: _jsx(MenuBase, { menu: () => asyncFuncElement, data: [], coordinate: {
                                x: 3,
                                y: 0,
                                toLeft: isLeftAligned,
                                left: leftPos,
                            } }) })), item.status && onFocusMenu.length > 0 && (_jsx("div", { style: { position: "relative" }, children: _jsx(MenuBase, { data: onFocusMenu, coordinate: {
                                x: 3,
                                y: 0,
                                toLeft: isLeftAligned,
                                left: leftPos,
                            } }) }))] })] }));
};
export function MenuBase({ coordinate = { x: 0, y: 0, toLeft: false, left: 0 }, data, zIndex, menu, className, menuElement, }) {
    const [_, forceUpdate] = useState(false);
    const update = () => forceUpdate((p) => !p);
    const refMenu = useRef(null);
    const dataMemo = useMemo(() => data.filter((e) => e), [data, data.length]);
    const [top, setTop] = useState(coordinate.y);
    const [leftPos, setLeftPos] = useState(coordinate.x);
    const [menuWidth, setMenuWidth] = useState(0);
    const [isLeftAligned, setIsLeftAligned] = useState(!!coordinate.toLeft);
    const [xOffset, setXOffset] = useState(0);
    useLayoutEffect(() => {
        if (!refMenu.current)
            return;
        const rect = refMenu.current.getBoundingClientRect();
        const w = window.innerWidth, h = window.innerHeight;
        if (h - rect.bottom < 8)
            setTop((prev) => prev + (h - rect.bottom));
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
    const alignStyle = isLeftAligned
        ? { display: "flex", flexDirection: "column-reverse", alignItems: "flex-end" }
        : {};
    return (_jsx("div", { ref: (el) => {
            if (el)
                refMenu.current = el;
        }, style: {
            position: "absolute",
            zIndex,
            paddingLeft: 3,
            left: (isLeftAligned ? -1 * (menuWidth + 3 + xOffset) : coordinate.x) - 3,
            top,
            ...alignStyle,
        }, children: menu
            ? menu(dataMemo)
            : dataMemo.map((item, i, arr) => (_jsx(MenuItemWrapper, { item: item, index: i, update: update, className: className, isLeftAligned: isLeftAligned, leftPos: leftPos, menuElement: menuElement, fullArray: dataMemo }, i))) }));
}
export { TimeNum, MenuElement };
