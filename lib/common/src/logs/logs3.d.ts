import React from 'react';
/** -----------------------------
 *  1. Типы для логов
 * -----------------------------
 */
export interface tLogsInput<T extends object = {}> {
    id: string;
    var?: number;
    time: Date;
    txt: string;
    [key: string]: any;
}
export interface tLogs<T extends object = {}> extends tLogsInput<T> {
    num: number;
}
/** -----------------------------
 *  3. Интерфейс контекста
 * -----------------------------
 */
interface LogsContextValue {
    logs: tLogs[];
    addLog: (input: tLogsInput) => void;
    minVarLogs: number;
    setMinVarLogs: (value: number) => void;
    minVarMessage: number;
    setMinVarMessage: (value: number) => void;
    timeShow: number;
    setTimeShow: (value: number) => void;
    showMessages: boolean;
    setShowMessages: (value: boolean) => void;
}
export declare function LogsProvider({ children }: {
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
/** -----------------------------
 *  5. Хук для удобного доступа к контексту
 * -----------------------------
 */
export declare function useLogsContext(): LogsContextValue;
/** -----------------------------
 *  6. Компонент LogsTable
 *     (аналог PageLogs)
 * -----------------------------
 */
export declare function LogsTable(): import("react/jsx-runtime").JSX.Element;
export declare function LogsNotifications(): import("react/jsx-runtime").JSX.Element;
/** -----------------------------
 *  8. Компонент LogsSettings
 *     (аналог InputSettingLogs)
 * -----------------------------
 */
export declare function LogsSettings(): import("react/jsx-runtime").JSX.Element;
/** -----------------------------
 *  9. MainPage — вкладки (Таблица / Настройки)
 * -----------------------------
 */
export declare function MainPage(): import("react/jsx-runtime").JSX.Element;
/** -----------------------------
 *  10. Корневой компонент App
 * -----------------------------
 */
export default function AppLogs(): import("react/jsx-runtime").JSX.Element;
export {};
