import {useEffect, useRef, useState} from "react";

const ANIMATION_DURATION = 500; // animation duration in ms
export function OutlineDragDemo(){
    const [isDragging, setIsDragging] = useState(false);
    const [animationFinished, setAnimationFinished] = useState(false);
    const timerRef = useRef<number | null>(null);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        // Check that the left mouse button was pressed
        if (e.button !== 0) return;
        setIsDragging(true);
        setAnimationFinished(false);

        // Start the animation - after the timeout, animationFinished becomes true
        timerRef.current = window.setTimeout(() => {
            setAnimationFinished(true); // Animation is complete - the outline remains
            timerRef.current = null;
        }, ANIMATION_DURATION);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setAnimationFinished(false);
        // If the animation has not finished yet, cancel the timer and remove the outline
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

    return (
        <div
            className={`draggable-div ${isDragging ? 'outline-animation' : ''} ${animationFinished ? 'outline-complete' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            Div content
        </div>
    );
};