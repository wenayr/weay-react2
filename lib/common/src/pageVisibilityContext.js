import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useEffect, useState } from "react";
export const PageVisibilityContext = createContext(true);
export function PageVisibilityProvider({ children }) {
    const [isVisible, setIsVisible] = useState(typeof document !== 'undefined' ? !document.hidden : true);
    useEffect(() => {
        if (typeof document === 'undefined')
            return;
        const handleVisibilityChange = () => {
            setIsVisible(!document.hidden);
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);
    return (_jsx(PageVisibilityContext.Provider, { value: isVisible, children: children }));
}
