import React, {createContext, useEffect, useState} from "react";

export const PageVisibilityContext = createContext(true);

export function PageVisibilityProvider({children}: {children: React.ReactNode}) {
    const [isVisible, setIsVisible] = useState(
        typeof document !== 'undefined' ? !document.hidden : true
    );

    useEffect(() => {
        if (typeof document === 'undefined') return;

        const handleVisibilityChange = () => {
            setIsVisible(!document.hidden);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);
    return (
        <PageVisibilityContext.Provider value={isVisible}>
            {children}
        </PageVisibilityContext.Provider>
    );
}
