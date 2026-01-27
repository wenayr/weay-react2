import {FC, useRef, useState} from "react";

const ANIMATION_DURATION = 500; // длительность анимации в мс
export function DraggableOutlineDiv(){
    const [isDragging, setIsDragging] = useState(false);
    const [animationFinished, setAnimationFinished] = useState(false);
    const timerRef = useRef<number | null>(null);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        // Проверяем, что нажата именно левая кнопка мыши
        if (e.button !== 0) return;
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

    return (
        <div
            className={`draggable-div ${isDragging ? 'outline-animation' : ''} ${animationFinished ? 'outline-complete' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            Содержимое дива
        </div>
    );
};