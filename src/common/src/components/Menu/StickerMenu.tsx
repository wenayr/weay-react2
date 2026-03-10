import React, { useState, useRef, useEffect, MouseEvent, TouchEvent } from 'react';

interface StickerMenuProps {}

const StickerMenu: React.FC<StickerMenuProps> = () => {
    // Флаг состояния: открыто меню или закрыто
    const [isOpen, setIsOpen] = useState<boolean>(false);
    // Сдвиг по X в процессе перетаскивания
    const [dragX, setDragX] = useState<number>(0);
    // Рефы для отслеживания начала перетаскивания и самого процесса
    const startXRef = useRef<number | null>(null);
    const draggingRef = useRef<boolean>(false);

    // Настройки размеров: общая ширина меню и ширина видимой части (стикер) при закрытом состоянии
    const menuWidth = 250; // общая ширина открытого меню
    const stickerWidth = 50; // ширина видимой части при закрытом меню

    // Начало перетаскивания (мышь)
    const handleMouseDown = (e: MouseEvent<HTMLDivElement>): void => {
        draggingRef.current = true;
        startXRef.current = e.clientX;
    };

    // Начало перетаскивания (касание)
    const handleTouchStart = (e: TouchEvent<HTMLDivElement>): void => {
        draggingRef.current = true;
        startXRef.current = e.touches[0].clientX;
    };

    // Обработка движения мыши
    const handleMouseMove = (e: MouseEvent<Document>): void => {
        if (!draggingRef.current || startXRef.current === null) return;
        const deltaX = e.clientX - startXRef.current;
        setDragX(deltaX);
    };

    // Обработка движения при касании
    const handleTouchMove = (e: TouchEvent<Document>): void => {
        if (!draggingRef.current || startXRef.current === null) return;
        const deltaX = e.touches[0].clientX - startXRef.current;
        setDragX(deltaX);
    };

    // Завершение перетаскивания (мышь)
    const handleMouseUp = (): void => {
        if (!draggingRef.current) return;
        finishDrag();
    };

    // Завершение перетаскивания (касание)
    const handleTouchEnd = (): void => {
        if (!draggingRef.current) return;
        finishDrag();
    };

    // Функция завершения перетаскивания: если сдвиг больше половины ширины меню — переключаем состояние
    const finishDrag = (): void => {
        draggingRef.current = false;
        if (dragX < -menuWidth / 2) {
            setIsOpen(true);
        } else if (dragX > menuWidth / 2) {
            setIsOpen(false);
        }
        setDragX(0);
        startXRef.current = null;
    };

    // Подписываемся на глобальные события движения и завершения перетаскивания
    useEffect(() => {
        document.addEventListener('mousemove', handleMouseMove as any);
        document.addEventListener('touchmove', handleTouchMove as any);
        document.addEventListener('mouseup', handleMouseUp as any);
        document.addEventListener('touchend', handleTouchEnd as any);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove as any);
            document.removeEventListener('touchmove', handleTouchMove as any);
            document.removeEventListener('mouseup', handleMouseUp as any);
            document.removeEventListener('touchend', handleTouchEnd as any);
        };
    }, [dragX]);

    // Переключение состояния меню по клику
    const handleClick = (): void => {
        setIsOpen(!isOpen);
    };

    /*
      Вычисляем итоговый сдвиг по X:
      - Когда меню закрыто, сдвигаем его влево так, чтобы виден был только стикер.
      - При перетаскивании корректируем позицию относительно текущего сдвига.
    */
    let translateX = 0;
    if (dragX !== 0) {
        // Если меню открыто, перетаскиваем вправо (открытие) только в отрицательном направлении
        // Если закрыто — перетаскиваем влево (открытие) только в положительном направлении
        translateX = isOpen ? Math.min(0, dragX) : Math.max(0, dragX);
    }
    const baseTranslate = isOpen ? 0 : -(menuWidth - stickerWidth);
    const finalTranslate = baseTranslate + translateX;

    // Стили для контейнера меню
    const containerStyle: React.CSSProperties = {
        position: 'fixed',
        top: '50%',
        right: 0,
        transform: `translateX(${finalTranslate}px) translateY(-50%)`,
        width: `${menuWidth}px`,
        height: '300px',
        backgroundColor: '#ffeb3b',
        borderRadius: '8px 0 0 8px',
        boxShadow: '0 0 5px rgba(0,0,0,0.3)',
        transition: draggingRef.current ? 'none' : 'transform 0.3s ease',
        cursor: 'pointer',
        userSelect: 'none',
        overflow: 'hidden'
    };

    return (
        <div
            style={containerStyle}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onClick={handleClick}
        >
            <div style={{ padding: '10px' }}>
                <h3>Меню</h3>
                {isOpen && (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        <li>Пункт 1</li>
                        <li>Пункт 2</li>
                        <li>Пункт 3</li>
                    </ul>
                )}
            </div>
        </div>
    );
};

export default StickerMenu;
