import { jsx as _jsx } from "react/jsx-runtime";
// import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
// import {Rnd} from "react-rnd";
// import {renderBy, updateBy} from "../updateBy";
// import {DivRndBase3} from "./RNDFunc3";
//
// type tPosition = {x: number, y: number}
// type tSize = {height: number | string, width: number | string}
// type tRND = {position: tPosition, size: tSize}
// type tDivRndBase = {
//     zIndex?: number,
//     disableDragging?: () => boolean,
//     keyForSave?: string,
//     onUpdate?: (data: any) => void,
//     position?: tPosition,
//     size?: tSize,
//     moveOnlyHeader?: boolean,
//     onCLickClose?: () => void,
//     header?: React.ReactElement | boolean,
//     overflow?: boolean,
//     sizeByWindow?: boolean,
//     limit?: {
//         x?: {max?: number, min?: number},
//         y?: {max?: number, min?: number},
//     }
//     // getApi?: (api: tExRNDApi)=> void
//     children: React.ReactElement | ((update: number) => React.ReactElement),
//     className?: string
// }
// // карта всех размеров всплывающих окон
// export const ExRNDMap = new Map<string, tRND>();
//
// // limit={{x:{min:0}, y:{min:0}}}
// let k = 0
// const openWindows: {ar: {k: number}[]} = {ar: []}
//
// export const DivRnd2: typeof DivRndBase2 = (a) => {
//     // const Base = ({ update }: { update: number }) => {
//     //     console.log(update)
//     //     return typeof a.children === "function" ? a.children(update) : a.children;
//     // }
//     const Base2 = ({ update }: { update: number }) => {
//         return typeof a.children === "function" ? a.children(update) : a.children;
//     }
//     // const ff = (update: number) => useMemo(() => <Base update={update} />, [update]);
//     const ff = (update: number) => useMemo(() => <Base2 update={update} />, [typeof a.children === "function"  ? update : true]);
//
//     return DivRndBase2({ ...a, children: ff });
// }
//
// export const DivRnd = DivRnd2
// export const DivRndBase = DivRndBase2
//
//
// /**
//  * This method is used to render a resizable and draggable component with optional header and close button.
//  *
//  * @param {Object} props - The component props.
//  * @param {React.ReactNode} props.children - The content inside the component.
//  * @param {string} props.keyForSave - The key used to save the component's position and size.
//  * @param {Object} props.position - The initial position of the component.
//  * @param {Object} props.size - The initial size of the component.
//  * @param {boolean} [props.overflow=true] - Whether to enable overflow scrolling on the component.
//  * @param {number} [props.zIndex=9] - The z-index of the component.
//  * @param {Function} [props.onUpdate] - Callback function called when the component is resized.
//  * @param {Function} [props.disableDragging] - Callback function to disable dragging.
//  * @param {string} [props.className] - The CSS class name for the component.
//  * @param {React.ReactNode} [props.header] - The header component to be displayed. If not provided, a default header will be used.
//  * @param {boolean} [props.moveOnlyHeader] - Whether to allow moving the component only by dragging the header.
//  * @param {Object} [props.limit] - The limits for the component's position.
//  * @param {Object} [props.limit.x] - The x-axis limits for the component's position.
//  * @param {number} [props.limit.x.min] - The minimum x-axis limit.
//  * @param {number} [props.limit.x.max] - The maximum x-axis limit.
//  * @param {Object} [props.limit.y] - The y-axis limits for the component's position.
//  * @param {number} [props.limit.y.min] - The minimum y-axis limit.
//  * @param {number} [props.limit.y.max] - The maximum y-axis limit.
//  * @param {Function} [props.onCLickClose] - Callback function called when the close button is clicked.
//  * @returns {React.ReactNode} - The rendered component.
//  */
// export function DivRndBase2({
//                                 children,
//                                 keyForSave: ks,
//                                 position,
//                                 size,
//                                 overflow = true,
//                                 zIndex = 9,
//                                 onUpdate,
//                                 disableDragging,
//                                 className,
//                                 header,
//                                 moveOnlyHeader,
//                                 limit,
//                                 onCLickClose,
//                                 sizeByWindow = true
//                             }: tDivRndBase) {
//     if (onCLickClose && !limit) limit = {y: {min:0}}
//
//     const positionDef: tPosition = {x: 0, y: 0, ...(position ?? {})}
//     const sizeDef: tSize = {height: 0, width: 0, ...(size ?? {})}
//     let map: tRND | undefined;
//     if (ks) map = ExRNDMap.get(ks) ?? ExRNDMap.set(ks, {size: sizeDef, position: positionDef}).get(ks)
//     position = map?.position ?? positionDef
//     size = map?.size ?? sizeDef
//     if (sizeByWindow) {
//         // window.
//     }
//
//     const id2 = useRef({k: k++});
//     const id = id2.current
//     const [zIndexX, setZIndexX] = useState(0)
//
//     const lastC = useRef<{x: number, y: number} | null>(null);
//     const lastT = useRef<{x: number, y: number, id: number} | null>(null);
//     const [a, setA] = useState(false)
//     const [b, setB] = useState(false)
//     // const [x, setX] = useState(0)
//     // const [y, setY] = useState(0)
//
//
//     const [x, setX] = React.useState(position?.x ?? 0)
//     const [y, setY] = React.useState(position?.y ?? 30)
//     const [width, setWidth] = React.useState(size?.width ?? 400)
//     const [height, setHeight] = React.useState(size?.height ?? 400)
//     const [drag, setDrag] = React.useState(true)
//     const [mouseOn, setMouseOn] = React.useState(true)
//     const [update, setUpdate] = React.useState(0)
//     const zindex = useRef(zIndexX);
//     zindex.current = zIndexX
//     updateBy(openWindows, ()=> {
//         const z = openWindows.ar.findIndex((v) => v.k == id.k)
//         if (z >= 0 && z != zindex.current) {
//             setZIndexX(z)
//         }
//     })
//     useEffect(() => {
//         if (a) {
//             const f1 = (e: MouseEvent) => {
//                 e.stopPropagation()
//                 if (lastC.current == null)
//                     lastC.current = {
//                         x: e.clientX,
//                         y: e.clientY
//                     }
//                 const data = lastC.current
//                 if (e.buttons == 1) {
//                     let x = e.clientX + data.x
//                     let y = e.clientY + data.y
//                     if (limit) {
//                         if (limit.x?.min != undefined && limit.x.min > x) x = limit.x.min
//                         if (limit.x?.max != undefined && limit.x.max < x) x = limit.x.max
//
//                         if (limit.y?.min != undefined && limit.y.min > y) y = limit.y.min
//                         if (limit.y?.max != undefined && limit.y.max < y) y = limit.y.max
//
//                     }
//                     setX(x)
//                     setY(y)
//                 }
//                 else f()
//             }
//             const f = () => {
//                 document.removeEventListener("mouseup",f)
//                 document.removeEventListener("mousemove",f1)
//                 lastC.current = null
//                 setA(false)
//             }
//             document.addEventListener("mousemove", f1)
//             document.addEventListener("mouseup", f)
//         }
//         if (b) {
//             const f1 = (e: TouchEvent) => {
//                 const data = lastT.current
//                 if (!data) return f(e);
//                 let t: Touch | null = null
//                 for (let i = 0; i < e.changedTouches.length; i++) {
//                     const z = e.changedTouches[i]
//                     if (z.identifier == data.id) t = z
//                 }
//                 if (!t) return;
//                 let x = t.clientX + data.x
//                 let y = t.clientY + data.y
//                 if (limit) {
//                     if (limit.x?.min != undefined && limit.x.min > x) x = limit.x.min
//                     if (limit.x?.max != undefined && limit.x.max < x) x = limit.x.max
//
//                     if (limit.y?.min != undefined && limit.y.min > y) y = limit.y.min
//                     if (limit.y?.max != undefined && limit.y.max < y) y = limit.y.max
//
//                 }
//                 setY(y)
//                 setX(x)
//             }
//             const f = (e: TouchEvent) => {
//                 const data = lastT.current
//                 if (data)
//                     for (let i = 0; i < e.changedTouches.length; i++) {
//                         const z = e.changedTouches[i]
//                         if (z.identifier == data.id) {
//                             lastT.current = null
//                         }
//                     }
//                 if (lastT.current == null) {
//                     document.removeEventListener("touchend",f)
//                     document.removeEventListener("touchmove",f1)
//                     setB(false)
//                 }
//             }
//             document.addEventListener("touchend",f)
//             document.addEventListener("touchmove",f1)
//         }
//     }, [a, b]);
//
//
//     useEffect(() => {
//         const t = id
//         openWindows.ar.push(t)
//         renderBy(openWindows)
//         return () => {
//             const z = openWindows.ar.findIndex((v) => v.k == id.k)
//             if (z>=0) {
//                 openWindows.ar.splice(z, 1)
//                 renderBy(openWindows)
//             }
//         }
//     },[true])
//
//     size.height = height
//     size.width = width
//     position.x = x
//     position.y = y
//     const headerD =
//         <div
//             ref={e=>{
//
//                 const a = e?.getBoundingClientRect()
//                 if (a) {
//                     if (sizeByWindow) {
//                         if (a.x < 0) setX(x - a.x)
//                         if (a.y < 0) setY(y - a.y)
//
//                         if (typeof width == "number" && width > window.innerWidth ) setWidth(window.innerWidth)
//                         if (typeof height == "number" && height > window.innerHeight) setHeight(window.innerHeight)
//                     }
//                 }
//             }}
//             onTouchStart={(e)=>{
//                 const a = e.changedTouches[0]
//                 if (a) {
//                     lastT.current = {
//                         x: x - a.clientX,
//                         y: y - a.clientY,
//                         id: a.identifier
//                     }
//                 }
//                 setB(true)
//             }}
//             onMouseDown={e=>{
//                 lastC.current = {
//                     x: x - e.clientX,
//                     y: y - e.clientY
//                 }
//                 setA(true)
//             }}
//             style={{userSelect: "none",
//                 cursor: "grabbing",
//             }}
//         >
//             {header ?? <div style={{
//                 height: 20, width: "100%",
//                 backgroundImage: "repeating-linear-gradient(139deg, hsla(0,0%,100%,.1), hsla(0,0%,100%,.1) 15px, transparent 0, transparent 30px)"
//             }}></div>}
//         </div>
//     let dtr = false
//     return <Rnd disableDragging={true}// || (moveOnlyHeader && drag)) ?? false)}
//                 style={{
//                     zIndex: zIndexX * 2 + zIndex
//                 }}
//                 className={className as string}
//                 onResizeStop={(e, dir, elementRef, delta, {x, y}) => {
//                     setX(x)
//                     setY(y)
//                     setHeight(+height + delta.height)
//                     setWidth(+width + delta.width)
//                     setUpdate(update + 1)
//                 }}
//                 onResize={(e, dir, elementRef, delta, position) => {
//                     onUpdate?.({e, dir, elementRef, delta, position});
//                 }}
//                 position={position}
//                 size={{width, height}}
//                 default={{...position, ...size}}
//     >
//         <div style={{
//             width: "100%",
//             height: "100%",
//             display: "flex",
//             flexDirection: "column",
//             position: "relative",
//             flex: "auto"
//         }}
//              onMouseDown={(e)=>{
//                  // ставим на макс высот - если мы не на ней
//                  const z = openWindows.ar.findIndex((v) => v == id)
//                  if (z != openWindows.ar.length - 1 || zindex.current != z) {
//                      const buf = openWindows.ar[z]
//                      openWindows.ar.splice(z,1)
//                      openWindows.ar.push(buf)
//                      renderBy(openWindows)
//                  }
//              }}
//         >
//             {
//                 moveOnlyHeader || header ? headerD : null
//             }
//             {
//                 <div className={"maxSize"}
//                      style={{overflow: overflow ? "auto" : undefined}}>
//                     {(a || b) && <div className={"maxSize"} style={{position: "absolute", zIndex: zIndexX * 2 + zIndex + 1}}></div>}
//                     {typeof children == "function" ? children(update) : children}
//                 </div>
//             }
//             {
//                 onCLickClose && <div key={"323"} className={"msTradeAlt"}
//                                      style={{position: "absolute", right: -15, top: -15,  fontSize: "32px", zIndex: zIndexX * 2 + zIndex + 1 }}
//                                      onClick={onCLickClose}>x</div>
//             }
//         </div>
//     </Rnd>
// }
//
//
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
//
export function Drag2({ children, onY, onX, x = 0, y = 0, last, onStart, onStop, }) {
    const lastC = useRef(null);
    const lastT = useRef(null);
    const [a, setA] = useState(false);
    const [b, setB] = useState(false);
    const lastD = useRef(last?.current ?? { y: x, x: y });
    // Обновляем значения `lastD` при изменении `x` или `y`
    useLayoutEffect(() => {
        lastD.current.x = x;
        lastD.current.y = y;
    }, [x, y]);
    // Основная логика обработки событий перемещения
    useEffect(() => {
        if (!(a || b)) {
            onStop?.();
            return;
        }
        if (a) {
            const handleMouseMove = (e) => {
                if (!lastC.current) {
                    lastC.current = { x: e.clientX, y: e.clientY };
                }
                const data = lastC.current;
                // Вычисляем и обновляем координаты
                lastD.current.x = e.clientX + data.x;
                lastD.current.y = e.clientY + data.y;
                onX?.(lastD.current.x);
                onY?.(lastD.current.y);
                e.stopPropagation();
            };
            const handleMouseUp = () => {
                document.body.removeEventListener("mousemove", handleMouseMove);
                document.body.removeEventListener("mouseup", handleMouseUp);
                lastC.current = null;
                setA(false);
            };
            document.body.addEventListener("mousemove", handleMouseMove);
            document.body.addEventListener("mouseup", handleMouseUp);
            onStart?.();
            return () => {
                document.body.removeEventListener("mousemove", handleMouseMove);
                document.body.removeEventListener("mouseup", handleMouseUp);
            };
        }
        if (b) {
            const handleTouchMove = (e) => {
                const data = lastT.current;
                if (!data)
                    return;
                const touch = Array.from(e.changedTouches).find((t) => t.identifier === data.id);
                if (!touch)
                    return;
                // Вычисляем и обновляем координаты
                lastD.current.x = touch.clientX + data.x;
                lastD.current.y = touch.clientY + data.y;
                onX?.(lastD.current.x);
                onY?.(lastD.current.y);
                e.stopPropagation();
            };
            const handleTouchEnd = (e) => {
                const data = lastT.current;
                if (data) {
                    const touch = Array.from(e.changedTouches).find((t) => t.identifier === data.id);
                    if (touch) {
                        lastT.current = null;
                    }
                }
                if (!lastT.current) {
                    document.body.removeEventListener("touchmove", handleTouchMove);
                    document.body.removeEventListener("touchend", handleTouchEnd);
                    setB(false);
                }
            };
            document.body.addEventListener("touchmove", handleTouchMove);
            document.body.addEventListener("touchend", handleTouchEnd);
            onStart?.();
            return () => {
                document.body.removeEventListener("touchmove", handleTouchMove);
                document.body.removeEventListener("touchend", handleTouchEnd);
            };
        }
    }, [a, b, onX, onY, onStart, onStop]);
    // Создаем элемент для перемещения
    return useMemo(() => (_jsx("div", { style: {
            width: "auto",
            height: "auto",
        }, onTouchStart: (e) => {
            const touch = e.changedTouches[0];
            if (touch) {
                lastD.current.x = x;
                lastD.current.y = y;
                lastT.current = {
                    x: lastD.current.x - touch.clientX,
                    y: lastD.current.y - touch.clientY,
                    id: touch.identifier,
                };
            }
            setB(true);
        }, onMouseDown: (e) => {
            lastD.current.x = x;
            lastD.current.y = y;
            lastC.current = {
                x: lastD.current.x - e.clientX,
                y: lastD.current.y - e.clientY,
            };
            setA(true);
        }, children: children })), [children, x, y]);
}
