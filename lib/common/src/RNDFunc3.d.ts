import React, { ReactNode } from "react";
type tPosition = {
    x: number;
    y: number;
};
type tSize = {
    height: number | string;
    width: number | string;
};
type tRND = {
    position: tPosition;
    size: tSize;
};
type tDivRndBase = {
    zIndex?: number;
    disableDragging?: () => boolean;
    keyForSave?: string;
    onUpdate?: (data: any) => void;
    position?: tPosition;
    size?: tSize;
    moveOnlyHeader?: boolean;
    onCLickClose?: () => void;
    header?: React.ReactElement | boolean;
    overflow?: boolean;
    sizeByWindow?: boolean;
    limit?: {
        x?: {
            max?: number;
            min?: number;
        };
        y?: {
            max?: number;
            min?: number;
        };
    };
    children: React.ReactElement | ((update: number) => React.ReactElement);
    className?: string;
};
export declare const ExRNDMap3: Map<string, tRND>;
export declare const DivRnd3: typeof DivRndBase3;
/**
 * Компонент-обёртка над react-rnd.
 * Обеспечивает перетаскивание и изменение размеров, опциональный заголовок и кнопку закрытия.
 */
export declare function DivRndBase3({ children, keyForSave: ks, position, size, overflow, zIndex, onUpdate, disableDragging, className, header, moveOnlyHeader, limit, onCLickClose, sizeByWindow }: tDivRndBase): import("react/jsx-runtime").JSX.Element;
/**
 * Пример простого перетаскивания (Drag2) без react-rnd
 */
export declare function Drag3(): import("react/jsx-runtime").JSX.Element;
/**
 * Пример более «раскачанного» перетаскивания (Drag) без react-rnd, с поддержкой touch
 */
export declare function DragBig3(): import("react/jsx-runtime").JSX.Element;
export type Drag2Props = {
    /** Элемент-«ребёнок», который хотим сделать перетаскиваемым */
    children: ReactNode;
    /** Коллбек при изменении координаты X */
    onX?: (val: number) => void;
    /** Коллбек при изменении координаты Y */
    onY?: (val: number) => void;
    /** Начальное (или контролируемое) значение X */
    x?: number;
    /** Начальное (или контролируемое) значение Y */
    y?: number;
    /** вести отчет с правого края*/
    right?: boolean;
    /**
     * Внешний ref для хранения координат.
     * Если передан, компонент будет обновлять ref при каждом движении.
     */
    last?: React.RefObject<{
        x: number;
        y: number;
    }>;
    /** Вызывается при начале перетаскивания (мышь или touch) */
    onStart?: () => void;
    /** Вызывается при окончании перетаскивания (мышь и touch) */
    onStop?: () => void;
    dragging?: boolean;
};
/**
 * Компонент-обёртка, позволяющий перетаскивать вложенный элемент
 * как мышью, так и касаниями (touch).
 *
 * Функция исключительно как хук на изменения параметров при движении - хоть и имеет свой компонент (для отсчета)
 * возвращает пройденное расстояние при перемещении дочернего элемента
 */
export declare function Drag22({ children, onX, onY, x, y, right, last, dragging, onStart, onStop }: Drag2Props): import("react/jsx-runtime").JSX.Element;
export {};
