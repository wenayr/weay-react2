// import React, {ReactElement, useEffect, useLayoutEffect, useRef, useState} from 'react';
// import {PromiseArrayListen, sleepAsync} from "wenay-common";
//
// export type tMenuReactStrictly<T extends any = any> = {
//     name: string | ((a?: T) => string),
//     getStatus?: () => T,
//     onClick?: ((e: any) => void | undefined | null | ((void | undefined | null | Promise<any> | (() => Promise<any>))[]) | Promise<any>)|null,
//     active?: () => boolean,
//     status?: boolean,
//     next?: () => (tMenuReact<any> | false)[],
//     func?: () => ReactElement,
//     onFocus?: () => tMenuReact<any>[],
//     menuElement?: typeof MenuElement
// }
// export type tMenuReact<T extends any = any> = tMenuReactStrictly<T> | false | null | undefined
// type tt = {ok?: number, error?: number, count?: number}
//
// function TimeNum({data}: {data: tt}) {
//     const r = useRef(0);
//     const [a, setA] = useState(r.current)
//     r.current = a
//     const getStr = () => {
//         if (!data.ok && !data.error) return a
//         const t1 = data.ok ? "ok " + data.ok : ""
//         const t2 = data.error ? " er " + (data.error > 1 ? " " + data.error : "") : ""
//         const t3 = data.count ? "/" + data.count : ""
//         return t1 + t3 + t2
//     }
//     useEffect(() => {
//         let z = 0
//         const t = setInterval(() => setA(++z), 30)
//         return () => {if (t) clearInterval(t as any)}
//     }, [true, setA])
//     return <div
//         style={{
//             float: "right",
//             opacity: a < 45 ? a / 45 : 1,
//             width: a < 25 ? a * 3 : 25 * 3,
//             textAlign: "right"
//         }}>
//         {
//             getStr()
//         }
//     </div>
// }
//
// function MenuElement({data: e, toLeft, className, update}: {
//     className?: (active?: boolean) => string,
//     toLeft: boolean,
//     data: Pick<tMenuReactStrictly, "onClick" | "active" | "name" | "getStatus">
//     update: () => void
// }) {
//     const listenOk = useRef<null|(()=>any)>(null);
//     const listenError = useRef<null|(()=>any)>(null);
//     useEffect(() => {
//         return () => {
//             listenOk.current?.()
//             listenError.current?.()
//             listenOk.current = null
//             listenError.current = null
//         }
//     }, [true]);
//
//     const [num, setNum] = useState<tt | null>(null)
//     return <div className={className?.(e.active?.()) ?? "MenuR " + (e.active?.() ? "toButtonA" : "toButton")}
//                 style={{
//                     float: toLeft ? "left" : "right"
//                 }}
//                 onClick={() => {
//                     if (e.onClick) {
//                         const t = e.onClick?.(e);
//
//                         if (t) {
//                             if (Array.isArray(t)) {
//                                 const t4 = t.filter(e => e) as (Promise<any> | (() => Promise<any>))[]
//                                 const t2 = PromiseArrayListen(t4)
//                                 setNum({})
//                                 listenError.current?.()
//                                 listenOk.current?.()
//                                 listenOk.current = t2.listenOk((data: any, i: number, countOk: number, countError: number, count: number) => {
//                                     setNum({ok: countOk, error: countError, count})
//                                 })
//                                 listenError.current = t2.listenError((error: any, i: number, countOk: number, countError: number, count: number) => {
//                                     setNum({ok: countOk, error: countError, count})
//                                 })
//                             }
//                             else if (t instanceof Promise) {
//                                 // Promise.allSettled()
//                                 setNum({})
//                                 t
//                                     .then(async e => {
//                                         if (Array.isArray(e) && e.length) {
//                                             if (e[0]?.status == "fulfilled" || e[0]?.status == "rejected") {
//                                                 const tr = {ok: 0, error: 0} satisfies tt;
//                                                 e.forEach(e => {
//                                                     if (e[0]?.status == "fulfilled") {
//                                                         tr.ok++
//                                                     }
//                                                     if (e[0]?.status == "rejected") {
//                                                         tr.error++
//                                                     }
//                                                 })
//                                             }
//                                         } else {
//                                             setNum({ok: 1})
//                                             await sleepAsync(0)
//                                         }
//                                     })
//                                     .finally(async() => {
//                                         await sleepAsync(500)
//                                         setNum(null)
//                                     })
//                             } else update();
//                         } else update();
//                     }
//                 }}
//     >
//         <div className={"toLine"}>
//             {typeof e.name == "string" ? e.name : e.name(e.getStatus?.())}
//             {num && <TimeNum data={num}/>}
//         </div>
//     </div>
// }
//
// export function MenuBase({
//                                coordinate = {x: 0, y: 0, toLeft: false, left: 0},
//                                data,
//                                zIndex,
//                                menu,
//                                className,
//                                menuElement
//                            }: {
//     menu?: (a: tMenuReactStrictly[]) => ReactElement,
//     menuElement?: (a: tMenuReactStrictly) => ReactElement,
//     data: tMenuReactStrictly[],
//     zIndex?: number,
//     className?: (active?: boolean) => string,
//     coordinate?: {x: number, y: number, toLeft?: boolean, left?: number},
// }) {
//     const [_, setUpdate] = useState(false)
//     const update = () => setUpdate(e=>!e)
//     const ref = useRef<HTMLElement | null>(null);
//     const [top, setTop] = useState(coordinate.y)
//     const [left, setLeft] = useState(coordinate.x)
//     const [width, setWidth] = useState(0)
//     const [toLeft, setToLeft] = useState(coordinate.toLeft ?? false)
//     const [x, setX] = useState(0)
//     useLayoutEffect(() => {
//         const rect = ref.current!.getBoundingClientRect();
//         const w = window.innerWidth
//         const h = window.innerHeight
//         if (h - rect.bottom < 8) setTop(coordinate.y + (h - rect.bottom))
//         setLeft(rect.x)
//         setWidth(rect.width)
//         if ((!toLeft && w - rect.right < 8 && rect.width < (coordinate.left ?? 0))) {
//             setX(rect.x - (coordinate.left ?? 0))
//             if (!toLeft) setToLeft(true)
//         }
//         if (coordinate.toLeft) {
//             setX((coordinate.left ?? 0) - rect.x - 4)
//         }
//     }, [true])
//     const t: React.CSSProperties = toLeft ? {
//         display: "flex",
//         flexDirection: "column-reverse",
//         alignItems: "flex-end"
//     } : {}
//     return <div style={{
//         position: "absolute",
//         zIndex,
//         left: toLeft ? -1 * (width + 3 + (x ?? 0)) : coordinate.x,
//         top: top,
//         ...t
//     }}
//                 ref={(e) => {if (e) ref.current = e}}
//     >
//         {menu ? menu(data) : data.map((e, i, max) => {
//             e.status ??= false
//             if (menuElement) return menuElement(e)
//             return <div key={i} className={"toLine"}
//                         onMouseEnter={() => {
//                             if (e.status) return;
//                             for (let j = 0; j < max.length; j++) {
//                                 max[j].status = j == i
//                             }
//                             update();
//                         }}
//             >
//                 {e.menuElement?.({toLeft, data: e, className, update}) ?? MenuElement({
//                     toLeft,
//                     data: e,
//                     className,
//                     update
//                 })}
//                 <div>
//                     {e.status && e.next && <div style={{position: "relative"}}><MenuBase
//                         data={e.next().filter(e => e) as tMenuReactStrictly<any>[]}
//                         coordinate={{x: 3, y: 0, toLeft, left}}/></div>}
//                     {e.status && e.func && <div style={{position: "relative"}}><MenuBase
//                         menu={e.func}
//                         data={[] as typeof data}
//                         coordinate={{x: 3, y: 0, toLeft, left}}/></div>}
//                 </div>
//             </div>
//         })}
//     </div>
// }
//
