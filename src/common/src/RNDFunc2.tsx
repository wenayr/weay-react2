import React, { useContext, useState, useRef, useEffect, createContext } from "react";
import { Rnd } from "react-rnd";

/** Типы */
type tPosition = { x: number; y: number };
type tSize = { height: number | string; width: number | string };
type tRND = { position: tPosition; size: tSize };

interface WindowSettings {
    id: string;
    position: tPosition;
    size: tSize;
    zIndex: number;
}

/** Контекст для окон */
const WindowsContext = createContext<{
    windows: WindowSettings[];
    updateWindow: (id: string, settings: Partial<WindowSettings>) => void;
    bringToFront: (id: string) => void;
} | null>(null);

/** Провайдер состояния окон */
const WindowsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [windows, setWindows] = useState<WindowSettings[]>([]);

    const updateWindow = (id: string, settings: Partial<WindowSettings>) => {
        setWindows((prevWindows) =>
            prevWindows.map((win) =>
                win.id === id
                    ? {
                        ...win,
                        ...settings,
                    }
                    : win
            )
        );
    };

    const bringToFront = (id: string) => {
        setWindows((prevWindows) => {
            const otherWindows = prevWindows.filter((win) => win.id !== id);
            const currentWindow = prevWindows.find((win) => win.id === id);
            if (!currentWindow) return prevWindows;
            return [...otherWindows, currentWindow];
        });
    };

    return (
        <WindowsContext.Provider value={{ windows, updateWindow, bringToFront }}>
            {children}
        </WindowsContext.Provider>
    );
};

/** Хук для работы с окнами */
const useWindows = () => {
    const context = useContext(WindowsContext);
    if (!context) {
        throw new Error("useWindows must be used within WindowsProvider");
    }
    return context;
};

/** Компонент окна с использованием react-rnd */
const DraggableWindow: React.FC<{
    id: string;
    initialPosition: tPosition;
    initialSize: tSize;
    children: React.ReactNode;
}> = ({ id, initialPosition, initialSize, children }) => {
    const { windows, updateWindow, bringToFront } = useWindows();
    const windowData = windows.find((win) => win.id === id);

    useEffect(() => {
        // Инициализация окна при первом рендере
        if (!windowData) {
            updateWindow(id, {
                id,
                position: initialPosition,
                size: initialSize,
                zIndex: windows.length + 1,
            });
        }
    }, []);

    if (!windowData) {
        return null;
    }

    const { position, size, zIndex } = windowData;

    return (
        <Rnd
            position={position}
            size={size}
            style={{
                zIndex,
                border: "1px solid #000",
                background: "#f9f9f9",
            }}
            onDragStop={(_, data) => {
                updateWindow(id, {
                    position: { x: data.x, y: data.y },
                });
            }}
            onResizeStop={(_, __, ref, ___, position) => {
                updateWindow(id, {
                    size: { width: ref.style.width, height: ref.style.height },
                    position,
                });
            }}
            onMouseDown={() => bringToFront(id)}
        >
            {children}
        </Rnd>
    );
};

/** Пример использования */
const App: React.FC = () => {
    return (
        <WindowsProvider>
            <DraggableWindow id="window1" initialPosition={{ x: 100, y: 100 }} initialSize={{ width: 300, height: 200 }}>
                <div>Окно 1</div>
            </DraggableWindow>
            <DraggableWindow id="window2" initialPosition={{ x: 400, y: 150 }} initialSize={{ width: 400, height: 300 }}>
                <div>Окно 2</div>
            </DraggableWindow>
        </WindowsProvider>
    );
};

export default App;