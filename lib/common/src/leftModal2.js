import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { colorGenerator2, sleepAsync } from "wenay-common";
import { renderBy, updateBy } from "../updateBy";
import { GetModalJSX } from "./modal";
import { Drag22 } from "./RNDFunc3";
function useViewport() {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return { width };
}
;
const sizeWidthMenu = 0.8;
function Tttt({ y_, x_, api, arr, zIndex }) {
    const [page, setPage] = useState(null);
    const [x, setX] = useState(x_);
    const [y, setY] = useState(y_);
    const [open, setOpen] = useState(false);
    // const [ell, setEl] = useState(el)
    const ww = useRef(null);
    const we = useRef(null);
    const last = useRef({ x: 0, y: 0, auto: false });
    const now = useRef({ x: 0, y: 0, auto: false });
    const ref = useRef(null);
    const status = useRef({ status: 0 });
    const { width } = useViewport();
    const mainPage = useMemo(() => _jsxs("div", { ref: ref, style: { height: "100vh", width: Math.round(sizeWidthMenu * 100) + "vw", overflow: "auto", scrollbarWidth: "none", scrollBehavior: "smooth", scrollSnapType: "y mandatory" }, children: [arr.map(([b, page], i) => _jsx("div", { ref: e => { e?.scrollTo(); }, style: { scrollSnapAlign: "start" }, id: String(i), children: page }, i)), _jsx("div", {})] }), [arr]);
    const arrEl = arr.map((e, i) => _jsx("div", { style: { paddingBottom: 10, width: "100%" }, onMouseDown: e => setPage(mainPage) //setPage(arr[i][1])
        , onTouchStart: e => setPage(mainPage) // setPage(arr[i][1])
        , children: _jsx("a", { rel: "ds", href: `#` + i, style: { font: "inherit", color: "inherit",
                textDecoration: "inherit",
                cursor: "default",
            }, children: e[0] }) }, i));
    const { width: wwWidth } = useViewport();
    const tt = async (target) => {
        last.current.auto = true;
        let step = 40;
        if (!last.current.auto)
            return;
        const f = async () => {
            if (!last.current.auto || now.current.x == target)
                return;
            const k = target > now.current.x ? 1 : -1;
            await sleepAsync(10);
            const t = now.current.x + k * step;
            if (Math.abs(target - t) < step) {
                last.current.auto = false;
                now.current.x = target;
                if (target == 0)
                    setOpen(false);
                setX(target);
                return;
            }
            now.current.x = t;
            setX(t);
            f();
        };
        await f();
    };
    useEffect(() => {
        const tr = {
            moveStop: () => {
                now.current.auto = false;
                last.current.auto = false;
            },
            moveToStart: () => {
                tt(0);
            },
            moveToEnd: () => {
                tt(ww.current?.width ? ww.current.width * -1 : -500);
            },
            y: yNew => {
                let y = yNew + last.current.y;
                // if (y + (we.current?.height ?? 0) > (ww.current?.height ?? 0))
                //     y = (ww.current?.height ?? 0) - (we.current?.height ?? 0)
                if (y < 0)
                    y = 0;
                if (status.current.status == 1) {
                    now.current.y = y;
                    setY(y);
                }
            },
            open: setOpen,
            x: (xNew) => {
                let x = xNew + last.current.x;
                now.current.x = x;
                if (x < 0)
                    setOpen(true);
                if (x == 0)
                    setOpen(false);
                now.current.x = x;
                setX(x);
            },
            start: () => {
                tr.moveStop?.();
                last.current.x = now.current.x;
                last.current.y = now.current.y;
            },
            stop: () => {
                if (last.current.x > now.current.x + 3) {
                    tt(ww.current ? sizeWidthMenu * wwWidth * -1 : -300);
                }
                else if (last.current.x + 3 < now.current.x && Math.abs(last.current.y - now.current.y) <= Math.abs(last.current.x - now.current.x)) {
                    tt(0);
                }
                else {
                    if (ww.current) {
                        if (Math.abs(now.current.x) > ww.current.width * 0.5)
                            tt(ww.current.width * -1);
                        else
                            tt(0);
                    }
                }
            },
        };
        api(tr);
    }, [true, wwWidth]);
    return _jsxs(_Fragment, { children: [_jsx("div", { ref: e => {
                    if (e) {
                        const a = e.getBoundingClientRect();
                        we.current = {
                            height: a.height,
                            width: a.width,
                        };
                    }
                }, style: { position: "absolute", right: x * -1, top: y, zIndex }, onClick: () => {
                    if (!open) {
                        setOpen(true);
                        tt(ww.current ? sizeWidthMenu * wwWidth * -1 : -300);
                    }
                }, onMouseDown: () => {
                    status.current.status = 1;
                }, onMouseLeave: () => {
                    status.current.status = 0;
                }, onMouseUp: () => {
                    status.current.status = 0;
                }, children: arrEl }), _jsx("div", { ref: e => {
                    if (e) {
                        const a = e.getBoundingClientRect();
                        ww.current = {
                            height: a.height,
                            width: a.width,
                        };
                    }
                }, style: { position: "absolute", left: `calc(100% + ${x}px)`, zIndex, //overflow: "scroll"
                } }), open &&
                _jsxs("div", { style: { width: -x, overflow: "hidden"
                    }, children: [_jsx("div", { ref: e => {
                                if (e) {
                                    const a = e.getBoundingClientRect();
                                    ww.current = {
                                        height: a.height,
                                        width: a.width,
                                    };
                                }
                            }, className: "maxSize" }), mainPage] })] });
}
export function LeftModal({ arr, zIndex }) {
    const now = useRef({ x: 0, y: 0, auto: false });
    const api = useRef(null);
    const ell = useMemo(() => _jsx(Tttt, { arr: arr, zIndex: zIndex, api: (a) => {
            api.current = a;
        }, x_: now.current.x, y_: now.current.y }), [arr]);
    const tr = useMemo(() => _jsx(Drag22, { onX: (xNew) => api.current?.x(xNew), right: true, onY: yNew => api.current?.y(yNew), x: 0, y: 0, onStart: () => api.current?.start?.(), onStop: () => api.current?.stop?.(), children: ell }), [arr, ell]);
    return _jsx("div", { className: "maxSize", children: tr });
}
function LeftM({ api, menu: mm = [], zIndex }) {
    const menu = mm; // const [menu, setMenu] = useState<menu[]>(mm)
    return _jsx(LeftModal, { arr: menu.map(e => [e.button, e.el()]), zIndex: zIndex });
}
export function getApiLeftMenu() {
    const getNewButton = ({ color, text }) => {
        return _jsx("div", { className: "blur", style: { minHeight: "4vh", minWidth: "50px", marginBottom: 10, fontSize: 12, textAlign: "center", background: color, color: "rgba(255,255,255,0.1)" }, children: text ?? "" });
    };
    const getNewEl = ({ color, children, textB }) => {
        const w = window.innerWidth;
        return _jsxs("div", { className: "blur", style: { minHeight: "100vh", width: w > 800 ? "100%" : "calc(100vw - 50px)", background: color, position: "relative",
                // overflow: "scroll"
            }, children: [textB && _jsx("div", { style: { position: "absolute", right: 0, top: 0, fontSize: 28, color: "rgba(255,255,255,0.1)" }, children: textB }), children()] });
    };
    let api = null;
    const m = new Map();
    const setMenu = (e, key = "base") => {
        const getColor = colorGenerator2({ min: 0, max: 90 });
        // m.set(key, [])
        const i0 = getAllMenu().length;
        const colorBase = [];
        for (let i = 0; i < i0 + e.length; i++) {
            const t = getColor.next();
            if (t.done == false) {
                const [r, g, b] = t.value;
                colorBase.push(`rgb(${r},${g},${b}, 0.3)`);
            }
        }
        const color = e.map((e, i) => e.color ?? colorBase[e.id ?? i + i0]);
        const ar = e.map((e, i) => ({ ...e, button: e.button ?? getNewButton({ text: e.textB, color: color[i] }), el: () => getNewEl({ color: color[i], children: e.el, textB: e.textB }) }));
        m.set(key, ar);
    };
    function getAllMenu() {
        return [...m.values()].flat();
    }
    function Modal2({ menu: mm, zIndex, zIndex0, key }) {
        if (mm)
            setMenu(mm, key);
        updateBy(m);
        return _jsxs("div", { className: "maxSize", style: {
                position: "absolute",
                zIndex: zIndex0
            }, children: [_jsx(modal.Render, {}), _jsx(LeftM, { zIndex: zIndex, api: a => api = a, menu: getAllMenu() })] });
    }
    const modal = GetModalJSX();
    return {
        modal,
        renderBy() { renderBy(m); },
        getMenu: () => m,
        setMenu: setMenu,
        Modal2: Modal2
    };
}
export const ApiLeftMenu = getApiLeftMenu();
ApiLeftMenu.setMenu([
    { button: _jsx("div", { style: { width: 200, height: 50, background: "rgb(92,50,213)" }, children: "1" }), el: () => _jsx("div", { children: "1" }), color: "rgb(92,50,213)" },
    { button: _jsx("div", { style: { width: 200, height: 50, background: "rgb(98,149,58)" }, children: "2" }), el: () => _jsx("div", { children: "2" }) },
], "test");
export function TestLeft333() {
    return _jsx(ApiLeftMenu.Modal2, { zIndex: 20 });
}
