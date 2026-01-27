export type ObserveID = {
    readonly [Symbol.species]: ObserveID;
};
export declare class CResizeObserver {
    #private;
    add(element: Element, onResize: () => void): ObserveID;
    delete(id: ObserveID): void;
}
export declare function setResizeableElement(el: HTMLElement): HTMLElement | undefined;
export declare function removeResizeableElement(el: HTMLElement): void;
