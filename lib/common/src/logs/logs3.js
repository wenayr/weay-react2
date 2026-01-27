import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
/** -----------------------------
 *  2. Функция staticGetAdd —
 *     загружает/сохраняет данные в localStorage.
 * -----------------------------
 */
function staticGetAdd(key, defaultValue) {
    try {
        const stored = localStorage.getItem(key);
        // Если в localStorage ничего нет, то записываем defaultValue
        if (!stored) {
            localStorage.setItem(key, JSON.stringify(defaultValue));
            return defaultValue;
        }
        // Если что-то нашли, пытаемся объединить с defaultValue
        // (на случай, если в defaultValue появились новые поля)
        const parsed = JSON.parse(stored);
        return { ...defaultValue, ...parsed };
    }
    catch (error) {
        console.error("Ошибка чтения localStorage:", error);
        return defaultValue;
    }
}
/** -----------------------------
 *  4. Создаём сам контекст
 *     и провайдер для логов + настроек
 * -----------------------------
 */
const LogsContext = createContext(null);
export function LogsProvider({ children }) {
    // 4.1. Загружаем настройки из localStorage через staticGetAdd
    const savedSettings = staticGetAdd("logSettings", {
        minVarLogs: 0,
        minVarMessage: 0,
        timeShow: 2,
        showMessages: true
    });
    // 4.2. Список логов в памяти (не сохраняем логи в localStorage,
    //      только настройки — но можно и логи, если нужно)
    const [logs, setLogs] = useState([]);
    const counterRef = useRef(0);
    // 4.3. Сами настройки (инициализируем тем, что вернул staticGetAdd)
    const [minVarLogs, setMinVarLogs] = useState(savedSettings.minVarLogs);
    const [minVarMessage, setMinVarMessage] = useState(savedSettings.minVarMessage);
    const [timeShow, setTimeShow] = useState(savedSettings.timeShow);
    const [showMessages, setShowMessages] = useState(savedSettings.showMessages);
    // 4.4. Следим за изменениями настроек и сохраняем их обратно в localStorage
    useEffect(() => {
        const toSave = {
            minVarLogs,
            minVarMessage,
            timeShow,
            showMessages
        };
        localStorage.setItem("logSettings", JSON.stringify(toSave));
    }, [minVarLogs, minVarMessage, timeShow, showMessages]);
    // 4.5. Функция добавления лога (генерируем поле num автоматически)
    const addLog = useCallback((input) => {
        counterRef.current += 1;
        const num = counterRef.current;
        setLogs((prevLogs) => {
            const newLog = { ...input, num };
            // ограничимся 500 логами (можно менять)
            return [newLog, ...prevLogs].slice(0, 500);
        });
    }, []);
    // 4.6. Возвращаем провайдер контекста
    return (_jsx(LogsContext.Provider, { value: {
            logs,
            addLog,
            minVarLogs,
            setMinVarLogs,
            minVarMessage,
            setMinVarMessage,
            timeShow,
            setTimeShow,
            showMessages,
            setShowMessages,
        }, children: children }));
}
/** -----------------------------
 *  5. Хук для удобного доступа к контексту
 * -----------------------------
 */
export function useLogsContext() {
    const ctx = useContext(LogsContext);
    if (!ctx) {
        throw new Error('useLogsContext must be used within LogsProvider');
    }
    return ctx;
}
/** -----------------------------
 *  6. Компонент LogsTable
 *     (аналог PageLogs)
 * -----------------------------
 */
export function LogsTable() {
    const { logs, minVarLogs } = useLogsContext();
    const gridRef = useRef(null);
    // Определения колонок
    const columnDefs = useMemo(() => [
        {
            field: 'time',
            headerName: 'Время',
            sort: 'desc',
            valueFormatter: (params) => {
                const dateObj = params.value;
                if (!dateObj)
                    return '';
                return new Date(dateObj).toLocaleTimeString();
            },
            width: 120,
        },
        { field: 'id', headerName: 'ID', width: 80 },
        { field: 'var', headerName: 'Важность', width: 90 },
        {
            field: 'txt',
            headerName: 'Сообщение',
            flex: 1,
            wrapText: true,
            autoHeight: true
        }
    ], []);
    const defaultColDef = useMemo(() => ({
        resizable: true,
        sortable: true,
        filter: true,
        wrapText: true,
    }), []);
    // Следим за minVarLogs и настраиваем фильтр AG Grid
    useEffect(() => {
        if (gridRef.current?.api) {
            if (minVarLogs > 0) {
                gridRef.current.api.setFilterModel({
                    var: {
                        filterType: 'number',
                        type: 'greaterThanOrEqual',
                        filter: minVarLogs
                    }
                });
            }
            else {
                gridRef.current.api.setFilterModel(null);
            }
        }
    }, [minVarLogs]);
    return (
    // <div className="ag-theme-alpine-dark" style={{ width: '100%', height: '100%' }}>
    _jsx("div", { style: { width: '100%', height: '100%' }, children: _jsx(AgGridReact, { ref: gridRef, onGridReady: (params) => {
                gridRef.current = params;
                params.api.sizeColumnsToFit();
            }, rowData: logs, columnDefs: columnDefs, defaultColDef: defaultColDef, headerHeight: 30, rowHeight: 26 }) }));
}
export function LogsNotifications() {
    const { logs, minVarMessage, timeShow, showMessages, setShowMessages } = useLogsContext();
    const [notifications, setNotifications] = useState([]);
    const counterRef = useRef(0);
    useEffect(() => {
        if (logs.length === 0)
            return;
        const newestLog = logs[0];
        if ((newestLog.var ?? 0) < minVarMessage)
            return;
        counterRef.current += 1;
        const newItem = { id: counterRef.current, log: newestLog };
        setNotifications((prev) => [newItem, ...prev]);
        // убираем нотификацию через timeShow секунд
        const timer = setTimeout(() => {
            setNotifications((prev) => prev.filter((item) => item.id !== newItem.id));
        }, timeShow * 1000);
        return () => clearTimeout(timer);
    }, [logs, minVarMessage, timeShow]);
    if (!showMessages) {
        // Если скрыли всплывашки, показываем только "log"
        return (_jsx("div", { style: { position: 'absolute', right: 10, top: 10, zIndex: 999 }, children: _jsx("div", { style: {
                    background: 'rgb(144,60,60)',
                    padding: '6px 10px',
                    cursor: 'pointer'
                }, onClick: () => setShowMessages(true), children: "log" }) }));
    }
    // Иначе выводим список текущих нотификаций
    return (_jsxs("div", { style: { position: 'absolute', right: 10, top: 10, zIndex: 999 }, children: [_jsx("div", { style: {
                    background: 'rgb(58,58,58)',
                    fontSize: '20px',
                    padding: '6px 10px',
                    cursor: 'pointer'
                }, onClick: () => setShowMessages(false), children: "X" }), _jsx("div", { children: notifications.slice(0, 10).map(({ id, log }) => {
                    let red = (log.var ?? 0) * 10;
                    if (red > 255)
                        red = 255;
                    return (_jsxs("div", { className: "testAnime example-exit", style: {
                            width: 200,
                            color: 'white',
                            marginTop: 10,
                            borderRight: '5px solid #5D9FFA',
                            backgroundColor: `rgb(${red},73,35)`,
                            padding: 8,
                            wordWrap: 'break-word'
                        }, children: [_jsx("p", { style: { textAlign: 'center', fontSize: 10, marginBottom: 1 }, children: "\u043E\u043F\u043E\u0432\u0435\u0449\u0435\u043D\u0438\u0435" }), _jsx("hr", { style: {
                                    backgroundImage: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 1), transparent)',
                                    border: 0,
                                    height: 1,
                                    margin: 0
                                } }), _jsx("div", { style: { textAlign: 'right', marginRight: 10 }, children: typeof log.txt === 'object' ? JSON.stringify(log.txt) : log.txt }), _jsx("p", { style: { textAlign: 'right', marginRight: 10 }, children: log.time.toLocaleDateString() })] }, id));
                }) })] }));
}
/** -----------------------------
 *  8. Компонент LogsSettings
 *     (аналог InputSettingLogs)
 * -----------------------------
 */
export function LogsSettings() {
    const { minVarLogs, setMinVarLogs, minVarMessage, setMinVarMessage, timeShow, setTimeShow, showMessages, setShowMessages } = useLogsContext();
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }, children: [_jsxs("label", { children: ["\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0432\u0430\u0436\u043D\u043E\u0441\u0442\u044C \u0434\u043B\u044F ", _jsx("b", { children: "\u0442\u0430\u0431\u043B\u0438\u0446\u044B" }), " (minVarLogs):", _jsx("input", { type: "number", value: minVarLogs, onChange: (e) => setMinVarLogs(Number(e.target.value)), style: { marginLeft: 8 } })] }), _jsxs("label", { children: ["\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0432\u0430\u0436\u043D\u043E\u0441\u0442\u044C \u0434\u043B\u044F ", _jsx("b", { children: "\u043E\u043F\u043E\u0432\u0435\u0449\u0435\u043D\u0438\u0439" }), " (minVarMessage):", _jsx("input", { type: "number", value: minVarMessage, onChange: (e) => setMinVarMessage(Number(e.target.value)), style: { marginLeft: 8 } })] }), _jsxs("label", { children: ["\u0412\u0440\u0435\u043C\u044F \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F (\u0441\u0435\u043A) (timeShow):", _jsx("input", { type: "number", value: timeShow, onChange: (e) => setTimeShow(Number(e.target.value)), style: { marginLeft: 8 } })] }), _jsxs("label", { children: ["\u041E\u0442\u043E\u0431\u0440\u0430\u0436\u0430\u0442\u044C \u0432\u0441\u043F\u043B\u044B\u0432\u0430\u0448\u043A\u0438 (showMessages):", _jsx("input", { type: "checkbox", checked: showMessages, onChange: (e) => setShowMessages(e.target.checked), style: { marginLeft: 8 } })] })] }));
}
/** -----------------------------
 *  9. MainPage — вкладки (Таблица / Настройки)
 * -----------------------------
 */
export function MainPage() {
    const [currentTab, setCurrentTab] = useState('table');
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: [_jsxs("div", { style: { display: 'flex', gap: 8, padding: 10, background: '#333' }, children: [_jsx("button", { onClick: () => setCurrentTab('table'), style: {
                            backgroundColor: currentTab === 'table' ? '#666' : '#444',
                            color: 'white',
                            border: 'none',
                            padding: '8px',
                            cursor: 'pointer'
                        }, children: "\u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u043B\u043E\u0433\u043E\u0432" }), _jsx("button", { onClick: () => setCurrentTab('settings'), style: {
                            backgroundColor: currentTab === 'settings' ? '#666' : '#444',
                            color: 'white',
                            border: 'none',
                            padding: '8px',
                            cursor: 'pointer'
                        }, children: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438" })] }), _jsxs("div", { style: { flex: 1, position: 'relative' }, children: [currentTab === 'table' && _jsx(LogsTable, {}), currentTab === 'settings' && _jsx(LogsSettings, {})] })] }));
}
/** -----------------------------
 *  10. Корневой компонент App
 * -----------------------------
 */
export default function AppLogs() {
    return (_jsx(LogsProvider, { children: _jsxs("div", { style: { position: 'relative', width: '100%', height: '100vh' }, children: [_jsx(MainPage, {}), _jsx(LogsNotifications, {})] }) }));
}
