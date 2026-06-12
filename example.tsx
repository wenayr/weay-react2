/* example.tsx — реактивность updateBy: как сейчас → как надо → под старые интерфейсы.
 * Справочный файл, в сборку не входит (tsconfig files: ["src/index.ts"]). */

import React, { useLayoutEffect, useSyncExternalStore } from "react";


/* === 1. КАК СЕЙЧАС ==========================================================
 * Состояние — внешний мутабельный объект. Мутируешь на месте → ссылка не
 * меняется → Object.is её не ловит → приходится отдавать React счётчик version
 * как «снапшот», а изменение и уведомление делать двумя отдельными шагами. */

const subsOld = new WeakMap<object, { v: number; ls: Set<() => void> }>();
const regOld = (a: object) => subsOld.get(a) ?? subsOld.set(a, { v: 0, ls: new Set() }).get(a)!;

function updateByOld<T extends object>(a: T) {
    const r = regOld(a);
    useSyncExternalStore(l => (r.ls.add(l), () => r.ls.delete(l)), () => r.v); // снапшот = счётчик
}
function renderByOld(a: object) {
    const r = regOld(a);
    r.v++;                    // 1) бамп счётчика
    r.ls.forEach(l => l());   // 2) уведомить — отдельный шаг, легко забыть/задвоить
}
// данные читаешь из самого `a`:  updateByOld(state); ... return <>{state.count}</>


/* === 2. КАК НАДО (современно, компактно) ====================================
 * Состояние принадлежит стору. set() меняет (новая ссылка) И уведомляет — одним
 * действием. Снапшот — сами данные через селектор: рендер только когда изменился
 * нужный срез. (useSyncExternalStore появился в React 18 (2022); в 2020 его не было.) */

type Upd<T> = T | ((p: T) => T);

function makeStore<T>(initial: T) {
    let state = initial, timer: ReturnType<typeof setTimeout> | undefined;
    const subs = new Set<() => void>();
    const emit = () => subs.forEach(f => f());
    return {
        get: () => state,
        set(next: Upd<T>, ms?: number) {
            const v = typeof next === "function" ? (next as (p: T) => T)(state) : next;
            if (Object.is(v, state)) return;                                   // нет изменения — нет рендера
            state = v;
            ms ? (clearTimeout(timer), timer = setTimeout(emit, ms)) : emit(); // встроенный дебаунс
        },
        subscribe: (f: () => void) => (subs.add(f), () => { subs.delete(f); }),
    };
}
function useSlice<T, S>(s: ReturnType<typeof makeStore<T>>, select: (st: T) => S): S {
    return useSyncExternalStore(s.subscribe, () => select(s.get()));
}
// использование:
//   const app = makeStore({ count: 0, theme: "light" });
//   const count = useSlice(app, s => s.count);            // рендер только на count
//   app.set(s => ({ ...s, count: s.count + 1 }));         // мгновенно
//   app.set(s => ({ ...s, count: s.count + 1 }), 300);    // с дебаунсом 300мс


/* === 3. ТО ЖЕ ПОД СТАРЫЕ ИНТЕРФЕЙСЫ =========================================
 * Имена и типы 1-в-1 с твоим updateBy.ts — потребители не меняют ни строки.
 * Внутри — стор из блока 2. Данные остаются во внешнем `a` (старый код читает их
 * напрямую), стор лишь уведомляет: tick будит подписчиков, cbs — режим updateBy(a, f). */

const reg = new WeakMap<object, { tick: ReturnType<typeof makeStore<number>>; cbs: Set<(a: any) => void>; timer?: ReturnType<typeof setTimeout> }>();
const regOf = (a: object) => reg.get(a) ?? reg.set(a, { tick: makeStore(0), cbs: new Set() }).get(a)!;

function fire(a: object, order: "normal" | "reverse" | "last", ms?: number) {
    const r = regOf(a);
    const run = () => {
        const cbs = [...r.cbs];
        order === "last" ? cbs.at(-1)?.(a) : (order === "reverse" ? cbs.reverse() : cbs).forEach(f => f(a));
        r.tick.set(t => t + 1);                                          // разбудить подписчиков updateBy(a)
    };
    ms ? (clearTimeout(r.timer), r.timer = setTimeout(run, ms)) : run(); // дебаунс как renderBy(a, ms)
}

/** @deprecated → makeStore + useSlice */
function updateBy<T extends object>(a: T, f?: React.Dispatch<React.SetStateAction<T>> | ((a: T) => void)) {
    const r = regOf(a);
    useSlice(r.tick, t => (f ? 0 : t));   // f-режим: снапшот-константа → без авто-рендера (как в старом коде)
    useLayoutEffect(() => {
        if (!f) return;
        const cb = f as (a: any) => void;
        r.cbs.add(cb);
        return () => { r.cbs.delete(cb); };
    }, [a, f]);
}
/** @deprecated → app.set(...) */
const renderBy = (a: object, ms?: number) => fire(a, "normal", ms);
/** @deprecated порядок имеет смысл только для f-колбэков */
const renderByRevers = (a: object, ms?: number, reverse = true) => fire(a, reverse ? "reverse" : "normal", ms);
/** @deprecated «последний» — для f-колбэков; реактивные подписчики обновятся все (безопаснее старого) */
const renderByLast = (a: object, ms?: number) => fire(a, "last", ms);
const useUpdateBy = updateBy;


export { updateByOld, renderByOld, makeStore, useSlice, updateBy, useUpdateBy, renderBy, renderByRevers, renderByLast };
