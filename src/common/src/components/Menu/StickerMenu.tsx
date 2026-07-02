import React, { useState, useRef, useEffect, MouseEvent, TouchEvent } from 'react';

const StickerMenu: React.FC = () => {
    // State flag: menu is open or closed
    const [isOpen, setIsOpen] = useState<boolean>(false);
    // X offset during dragging; duplicated in a ref so document listeners
    // subscribe once instead of on every drag tick
    const [dragX, setDragX] = useState<number>(0);
    const dragXRef = useRef(0);
    const setDrag = (v: number): void => {
        dragXRef.current = v;
        setDragX(v);
    };
    // Refs for tracking drag start and dragging itself
    const startXRef = useRef<number | null>(null);
    const draggingRef = useRef<boolean>(false);
    const movedRef = useRef<boolean>(false);

    // Size settings: total menu width and visible sticker width when closed
    const menuWidth = 250; // total width of the open menu
    const stickerWidth = 50; // width of the visible part when the menu is closed

    // Start dragging with mouse
    const handleMouseDown = (e: MouseEvent<HTMLDivElement>): void => {
        draggingRef.current = true;
        startXRef.current = e.clientX;
    };

    // Start dragging with touch
    const handleTouchStart = (e: TouchEvent<HTMLDivElement>): void => {
        draggingRef.current = true;
        startXRef.current = e.touches[0].clientX;
    };

    // Handle mouse movement
    const handleMouseMove = (e: MouseEvent<Document>): void => {
        if (!draggingRef.current || startXRef.current === null) return;
        const deltaX = e.clientX - startXRef.current;
        setDrag(deltaX);
    };

    // Handle touch movement
    const handleTouchMove = (e: TouchEvent<Document>): void => {
        if (!draggingRef.current || startXRef.current === null) return;
        const deltaX = e.touches[0].clientX - startXRef.current;
        setDrag(deltaX);
    };

    // Finish dragging with mouse
    const handleMouseUp = (): void => {
        if (!draggingRef.current) return;
        finishDrag();
    };

    // Finish dragging with touch
    const handleTouchEnd = (): void => {
        if (!draggingRef.current) return;
        finishDrag();
    };

    // Finish dragging: switch state if offset is greater than half of the menu width
    const finishDrag = (): void => {
        draggingRef.current = false;
        const delta = dragXRef.current;
        if (delta < -menuWidth / 2) {
            setIsOpen(true);
            movedRef.current = true; // suppress the click that follows mouseup, it would toggle back
        } else if (delta > menuWidth / 2) {
            setIsOpen(false);
            movedRef.current = true;
        }
        setDrag(0);
        startXRef.current = null;
    };

    // Subscribe to global movement and drag-finish events
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
    }, []);

    // Toggle menu state on click
    const handleClick = (): void => {
        if (movedRef.current) {
            movedRef.current = false;
            return;
        }
        setIsOpen(!isOpen);
    };

    /*
      Calculate the final X offset:
      - When the menu is closed, shift it left so only the sticker is visible.
      - During dragging, adjust the position relative to the current offset.
    */
    let translateX = 0;
    if (dragX !== 0) {
        // If the menu is open, drag right only in the negative direction
        // If closed, drag left only in the positive direction
        translateX = isOpen ? Math.min(0, dragX) : Math.max(0, dragX);
    }
    const baseTranslate = isOpen ? 0 : -(menuWidth - stickerWidth);
    const finalTranslate = baseTranslate + translateX;

    // Menu container styles
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
                <h3>Menu</h3>
                {isOpen && (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        <li>Item 1</li>
                        <li>Item 2</li>
                        <li>Item 3</li>
                    </ul>
                )}
            </div>
        </div>
    );
};

export default StickerMenu;
