export type ObserveID = { readonly [Symbol.species]: ObserveID };

// Класс для отслеживания изменения размеров элементов

export class CResizeObserver {
    #idMap = new WeakMap<ObserveID, { element: Element, func: () => void }>();
    #funcMap = new WeakMap<Element, (() => void)[]>();
    #observer = typeof ResizeObserver !== "undefined"
        ? new ResizeObserver((entries) => {
            for (let entry of entries) {
                let functions = this.#funcMap.get(entry.target as Element);
                if (functions)
                    for (let func of functions) func();
            }
        })
        : null;

    add(element: Element, onResize: () => void): ObserveID {
        let functions = this.#funcMap.get(element);
        if (!functions) {
            this.#funcMap.set(element, functions = []);
            this.#observer?.observe(element);
        }
        functions.push(onResize);
        let id: ObserveID = new class {
            [Symbol.species] = this; //{} as ObserveID
        }();
        this.#idMap.set(id, {element, func: onResize});
        return id;
    }

    delete(id: ObserveID) {
        let data = this.#idMap.get(id);
        if (!data) return;
        this.#idMap.delete(id);
        let el = data.element;
        let functions = this.#funcMap.get(el)!;
        let i = functions.indexOf(data.func);
        if (i >= 0) functions.splice(i, 1);
        if (functions.length == 0) {
            this.#funcMap.delete(el);
            this.#observer?.unobserve(el);
        }
    }
}

const global_resizeObserver = new CResizeObserver();

const resizeableElementMap = new WeakMap<HTMLElement, ObserveID>();

// Задаём автоматическое изменение размеров элемента в зависимости от размеров родительского элемента
//
export function setResizeableElement(el: HTMLElement) {
    const parent = el.parentElement;
    if (!parent) return;
    const parentParent = parent.parentElement!; // на один уровень выше
    if (!parentParent) return;
    const lastEl = parent.lastElementChild! as HTMLElement;
    if (!lastEl) return;
    let defaultWidth: number | undefined;
    const existing = resizeableElementMap.get(el);
    if (existing) global_resizeObserver.delete(existing);
    const observerId = global_resizeObserver.add(parentParent, () => {
        let lastRangeDelta = 0;
        let i = 0;
        //console.log("###",el.style.width, el.clientWidth);
        for (let width = el.clientWidth; ;) {//} width>=20;  width--) {
            let rangeDelta = Math.floor(lastEl.getBoundingClientRect().right - parentParent.getBoundingClientRect().right - 0);
            if (rangeDelta == 0) break;
            if (lastRangeDelta && rangeDelta * lastRangeDelta < 0) break;
            lastRangeDelta = rangeDelta;
            if (rangeDelta > 0) width--; else width++;
            defaultWidth ??= el.clientWidth;
            if (width < 10 || width > defaultWidth) break;
            el.style.width = width + "px";
            //console.log(i+": "+numEl.getBoundingClientRect().right,"<", parentParent.getBoundingClientRect().right, rangeEl.clientWidth); //numEl.clientLeft, numEl.clientWidth);
            i++;
        }
    });
    resizeableElementMap.set(el, observerId);
    return el;
}

export function removeResizeableElement(el: HTMLElement) {
    const id = resizeableElementMap.get(el);
    if (!id) return;
    global_resizeObserver.delete(id);
    resizeableElementMap.delete(el);
}
