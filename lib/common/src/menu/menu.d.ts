import React, { ReactElement } from 'react';
/*******************************************************
 * Типы данных для меню
 *******************************************************/
export type tMenuReactStrictly<T = any> = {
    name: string | ((status?: T) => string);
    getStatus?: (() => T) | null;
    onClick?: ((e: any) => void | undefined | null | ((void | undefined | null | Promise<any> | (() => Promise<any>))[]) | Promise<any>) | null;
    active?: (() => boolean) | null;
    status?: boolean;
    next?: (() => (tMenuReact<any> | false)[] | Promise<(tMenuReact<any> | false)[]>) | null;
    func?: (() => React.ReactElement | Promise<React.ReactElement>) | null;
    onFocus?: (() => tMenuReact<any>[] | Promise<tMenuReact<any>[]>) | null;
    menuElement?: typeof MenuElement;
};
export type tMenuReact<T = any> = tMenuReactStrictly<T> | false | null | undefined;
/*******************************************************
 * Вспомогательный тип
 *******************************************************/
type tCounters = {
    ok?: number;
    error?: number;
    count?: number;
};
/*******************************************************
 * Отображает счётчик/прогресс (анимация, кол-во ok/error)
 *******************************************************/
declare function TimeNum({ data }: {
    data: tCounters;
}): ReactElement;
/*******************************************************
 * Основной элемент меню (пункт с onClick, счётчиками и т.д.)
 *******************************************************/
declare function MenuElement({ data: item, toLeft, className, update, }: {
    data: Pick<tMenuReactStrictly, "onClick" | "active" | "name" | "getStatus">;
    toLeft: boolean;
    className?: (active?: boolean) => string;
    update: () => void;
}): ReactElement;
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
export declare function MenuBase({ coordinate, data, zIndex, menu, className, menuElement, }: MenuBaseProps): ReactElement;
export { TimeNum, MenuElement };
