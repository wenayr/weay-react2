import { jsx as _jsx } from "react/jsx-runtime";
import { useRef, useState } from "react";
const ANIMATION_DURATION = 500; // длительность анимации в мс
export function DraggableOutlineDiv() {
    const [isDragging, setIsDragging] = useState(false);
    const [animationFinished, setAnimationFinished] = useState(false);
    const timerRef = useRef(null);
    const handleMouseDown = (e) => {
        // Проверяем, что нажата именно левая кнопка мыши
        if (e.button !== 0)
            return;
        setIsDragging(true);
        setAnimationFinished(false);
        // Запускаем анимацию - по истечении времени флаг animationFinished становится true
        timerRef.current = window.setTimeout(() => {
            setAnimationFinished(true); // Анимация завершена – обводка остается
            timerRef.current = null;
        }, ANIMATION_DURATION);
    };
    const handleMouseUp = () => {
        setIsDragging(false);
        setAnimationFinished(false);
        // Если анимация еще не завершилась, отменяем таймер и убираем обводку
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };
    return (_jsx("div", { className: `draggable-div ${isDragging ? 'outline-animation' : ''} ${animationFinished ? 'outline-complete' : ''}`, onMouseDown: handleMouseDown, onMouseUp: handleMouseUp, onMouseLeave: handleMouseUp, children: "\u0421\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0435 \u0434\u0438\u0432\u0430" }));
}
;
