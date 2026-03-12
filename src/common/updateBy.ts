import { useSyncExternalStore } from "react";
import { waitRun } from "wenay-common2"; // Оставляем твою утилиту

// Тип для слушателей (функции без аргументов)
type Listener = () => void;

// Внутреннее состояние для каждого объекта-наблюдателя
interface ObserverState {
    listeners: Set<Listener>;
    version: number;
}

// Глобальные карты для хранения стейта и таймаутов
const map3 = new WeakMap<object, ObserverState>();
export const mapWait = new Map<object, ReturnType<typeof waitRun>>();

// Вспомогательная функция ленивой инициализации стейта
function getObserverState(obj: object): ObserverState {
    let state = map3.get(obj);
    if (!state) {
        state = {
            listeners: new Set(),
            version: 0
        };
        map3.set(obj, state);
    }
    return state;
}

// Общая логика оповещения React-а об изменениях
function triggerUpdate(obj: object, reverse = false, lastOnly = false) {
    const state = map3.get(obj);
    if (!state || state.listeners.size === 0) return;

    // Увеличиваем версию — это триггер для useSyncExternalStore
    state.version += 1;

    let listenersArray = Array.from(state.listeners);

    if (lastOnly) {
        const last = listenersArray.at(-1);
        if (last) last();
        return;
    }

    if (reverse) {
        listenersArray.reverse();
    }

    listenersArray.forEach(listener => listener());
}

// ----------------------------------------------------------------------
// ПУБЛИЧНОЕ API
// ----------------------------------------------------------------------

export function renderBy(a: object, ms?: number) {
    if (ms) {
        (mapWait.get(a) || mapWait.set(a, waitRun()).get(a)!)
            .refreshAsync(ms, () => {
                mapWait.delete(a);
                triggerUpdate(a);
            });
    } else {
        triggerUpdate(a);
    }
}

export function renderByRevers(a: object, ms?: number, reverse = true) {
    if (ms) {
        (mapWait.get(a) || mapWait.set(a, waitRun()).get(a)!)
            .refreshAsync(ms, () => {
                mapWait.delete(a);
                triggerUpdate(a, reverse);
            });
    } else {
        triggerUpdate(a, reverse);
    }
}

export function renderByLast(a: object, ms?: number) {
    if (ms) {
        (mapWait.get(a) || mapWait.set(a, waitRun()).get(a)!)
            .refreshAsync(ms, () => {
                mapWait.delete(a);
                triggerUpdate(a, false, true);
            });
    } else {
        triggerUpdate(a, false, true);
    }
}

export function useUpdateBy<T extends object>(a: T) {
    useSyncExternalStore(
        (listener) => {
            const state = getObserverState(a);
            state.listeners.add(listener);

            return () => {
                state.listeners.delete(listener);
                if (state.listeners.size === 0) {
                    map3.delete(a);
                }
            };
        },
        () => getObserverState(a).version
    );
}

// Backward-compatible alias
export function updateBy<T extends object>(a: T) {
    useUpdateBy(a);
}

// import {useLayoutEffect, useState} from "react";
// import {waitRun} from "wenay-common2";
//
// type tFunc2 = Map<object, (a?: any) => void>
// export const map3 = new WeakMap<object, tFunc2>();
// export const mapWait = new Map<object, ReturnType<typeof waitRun>>();
//
//
// export function renderBy(a: object, ms?: number) {
//     const t = () => map3.get(a)?.forEach(e=>e(a))
//     if (ms) {
//         (mapWait.get(a) || mapWait.set(a, waitRun()).get(a)!)
//             .refreshAsync(ms, ()=> {
//                 mapWait.delete(a)
//                 t()})
//     }
//     else t()
// }
//
// export function renderByRevers(a: object, ms?: number, reverse = true) {
//     const ar: ((a?: any) => void)[] = []
//     map3.get(a)?.forEach(e=>ar.push(e))
//     const t = reverse ? () => ar.reverse().forEach(e=>e(a))
//         : () => ar.forEach(e=>e(a))
//     if (ms) {
//         (mapWait.get(a) || mapWait.set(a, waitRun()).get(a)!)
//             .refreshAsync(ms, ()=> {
//                 mapWait.delete(a)
//                 t()})
//     }
//     else t()
// }
//
// export function renderByLast(a: object, ms?: number) {
//     const ar: ((a?: any) => void)[] = []
//     map3.get(a)?.forEach(e=>ar.push(e))
//     const t =  () => ar.at(-1)?.()
//     if (ms) {
//         (mapWait.get(a) || mapWait.set(a, waitRun()).get(a)!)
//             .refreshAsync(ms, ()=> {
//                 mapWait.delete(a)
//                 t()})
//     }
//     else t()
// }
//
// // Главная функция
// export function useUpdateBy<T extends object>(
//     a: T,
//     f?: React.Dispatch<React.SetStateAction<T>> | ((a: T) => void)
// ) {
//     const [_, setCounter] = useState(0); // Состояние счётчика для обновлений
//
//     // Эффект для работы с объектом и картой
//     useLayoutEffect(() => {
//         // Если передан второй аргумент `f`, используем его, иначе создаём default-функцию
//         const func = f ?? (() => {
//             setCounter(prev => prev + 1);
//         });
//
//         // Получаем карту из глобальной переменной map3 или создаём новую для объекта `a`
//         const funcMap = map3.get(a) || map3.set(a, new Map()).get(a)!;
//         funcMap.set(func, func); // Привязываем функцию обновления к объекту `a`
//
//         // Возвращаем функцию очистки (cleanup), чтобы удалить привязки
//         return () => {
//             funcMap.delete(func); // Удаляем функцию из карты
//             if (funcMap.size === 0) {
//                 map3.delete(a); // Удаляем объект из `map3`, если он больше не нужен
//             }
//         };
//     }, [a, f]); // Указываем зависимости: объект `a` и функция `f`
// }
//
// // Backward-compatible name (hook rules are the same).
// export function updateBy<T extends object>(
//     a: T,
//     f?: React.Dispatch<React.SetStateAction<T>> | ((a: T) => void)
// ) {
//     return useUpdateBy(a, f);
// }
//
// // export function updateBy<T extends object>(a: T, f?: React.Dispatch<React.SetStateAction<T>> | ((a: T) => void)) {
// //     const t = useState(0)
// //     useLayoutEffect(() => {
// //         const func = f ?? ((a: T) =>{
// //             // без особых причин только для первого рендера - необходима два вызова, иначе - вызов не проходит
// //             if (t[0] == 0) {
// //                 t[1](t[0]++)
// //                 // t[1](t[0]++)
// //             }
// //             else t[1](t[0]++)
// //         })
// //         const r = (map3.get(a) || map3.set(a, new Map()).get(a)!)
// //         r.set(func, func)
// //         return ()=> {
// //             r?.delete(func)
// //         }
// //     },[true])
// // }
