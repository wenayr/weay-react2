import React, {
    createContext,
    useContext,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent } from 'ag-grid-community';

// При необходимости раскомментируйте стили AG Grid:
// import 'ag-grid-community/styles/ag-grid.css';
// import 'ag-grid-community/styles/ag-theme-alpine.css';
// import 'ag-grid-community/styles/ag-theme-alpine-dark.css';

/** -----------------------------
 *  1. Типы для логов
 * -----------------------------
 */
export interface tLogsInput<T extends object = {}> {
    id: string;
    var?: number;
    time: Date;
    txt: string;
    [key: string]: any; // любые доп. поля
}

export interface tLogs<T extends object = {}> extends tLogsInput<T> {
    num: number;
}

/** -----------------------------
 *  2. Функция staticGetAdd —
 *     загружает/сохраняет данные в localStorage.
 * -----------------------------
 */
function staticGetAdd<T>(key: string, defaultValue: T): T {
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
    } catch (error) {
        console.error("Ошибка чтения localStorage:", error);
        return defaultValue;
    }
}

/** -----------------------------
 *  3. Интерфейс контекста
 * -----------------------------
 */
interface LogsContextValue {
    // Массив логов
    logs: tLogs[];
    // Функция добавления лога
    addLog: (input: tLogsInput) => void;

    // Настройки
    minVarLogs: number;
    setMinVarLogs: (value: number) => void;

    minVarMessage: number;
    setMinVarMessage: (value: number) => void;

    timeShow: number;
    setTimeShow: (value: number) => void;

    showMessages: boolean;
    setShowMessages: (value: boolean) => void;
}

/** -----------------------------
 *  4. Создаём сам контекст
 *     и провайдер для логов + настроек
 * -----------------------------
 */
const LogsContext = createContext<LogsContextValue | null>(null);

export function LogsProvider({ children }: { children: React.ReactNode }) {
    // 4.1. Загружаем настройки из localStorage через staticGetAdd
    const savedSettings = staticGetAdd("logSettings", {
        minVarLogs: 0,
        minVarMessage: 0,
        timeShow: 2,
        showMessages: true
    });

    // 4.2. Список логов в памяти (не сохраняем логи в localStorage,
    //      только настройки — но можно и логи, если нужно)
    const [logs, setLogs] = useState<tLogs[]>([]);
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
    const addLog = useCallback((input: tLogsInput) => {
        counterRef.current += 1;
        const num = counterRef.current;
        setLogs((prevLogs) => {
            const newLog: tLogs = { ...input, num };
            // ограничимся 500 логами (можно менять)
            return [newLog, ...prevLogs].slice(0, 500);
        });
    }, []);

    // 4.6. Возвращаем провайдер контекста
    return (
        <LogsContext.Provider
            value={{
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
            }}
        >
            {children}
        </LogsContext.Provider>
    );
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
    const gridRef = useRef<GridReadyEvent | null>(null);

    // Определения колонок
    const columnDefs: ColDef[] = useMemo(() => [
        {
            field: 'time',
            headerName: 'Время',
            sort: 'desc',
            valueFormatter: (params) => {
                const dateObj = params.value;
                if (!dateObj) return '';
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

    const defaultColDef: ColDef = useMemo(() => ({
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
            } else {
                gridRef.current.api.setFilterModel(null);
            }
        }
    }, [minVarLogs]);

    return (
        // <div className="ag-theme-alpine-dark" style={{ width: '100%', height: '100%' }}>
        <div style={{ width: '100%', height: '100%' }}>
            <AgGridReact
                ref={gridRef as any}
                onGridReady={(params) => {
                    gridRef.current = params;
                    params.api.sizeColumnsToFit();
                }}
                rowData={logs}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                headerHeight={30}
                rowHeight={26}
            />
        </div>
    );
}

/** -----------------------------
 *  7. Компонент LogsNotifications
 *     (аналог MessageEventLogs)
 * -----------------------------
 */
interface NotificationItem {
    id: number;
    log: tLogs;
}

export function LogsNotifications() {
    const {
        logs,
        minVarMessage,
        timeShow,
        showMessages,
        setShowMessages
    } = useLogsContext();

    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const counterRef = useRef(0);

    useEffect(() => {
        if (logs.length === 0) return;
        const newestLog = logs[0];
        if ((newestLog.var ?? 0) < minVarMessage) return;

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
        return (
            <div style={{ position: 'absolute', right: 10, top: 10, zIndex: 999 }}>
                <div
                    style={{
                        background: 'rgb(144,60,60)',
                        padding: '6px 10px',
                        cursor: 'pointer'
                    }}
                    onClick={() => setShowMessages(true)}
                >
                    log
                </div>
            </div>
        );
    }

    // Иначе выводим список текущих нотификаций
    return (
        <div style={{ position: 'absolute', right: 10, top: 10, zIndex: 999 }}>
            <div
                style={{
                    background: 'rgb(58,58,58)',
                    fontSize: '20px',
                    padding: '6px 10px',
                    cursor: 'pointer'
                }}
                onClick={() => setShowMessages(false)}
            >
                X
            </div>
            <div>
                {notifications.slice(0, 10).map(({ id, log }) => {
                    let red = (log.var ?? 0) * 10;
                    if (red > 255) red = 255;

                    return (
                        <div
                            key={id}
                            className="testAnime example-exit"
                            style={{
                                width: 200,
                                color: 'white',
                                marginTop: 10,
                                borderRight: '5px solid #5D9FFA',
                                backgroundColor: `rgb(${red},73,35)`,
                                padding: 8,
                                wordWrap: 'break-word'
                            }}
                        >
                            <p style={{ textAlign: 'center', fontSize: 10, marginBottom: 1 }}>оповещение</p>
                            <hr
                                style={{
                                    backgroundImage: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 1), transparent)',
                                    border: 0,
                                    height: 1,
                                    margin: 0
                                }}
                            />
                            <div style={{ textAlign: 'right', marginRight: 10 }}>
                                {typeof log.txt === 'object' ? JSON.stringify(log.txt) : log.txt}
                            </div>
                            <p style={{ textAlign: 'right', marginRight: 10 }}>
                                {log.time.toLocaleDateString()}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/** -----------------------------
 *  8. Компонент LogsSettings
 *     (аналог InputSettingLogs)
 * -----------------------------
 */
export function LogsSettings() {
    const {
        minVarLogs,
        setMinVarLogs,
        minVarMessage,
        setMinVarMessage,
        timeShow,
        setTimeShow,
        showMessages,
        setShowMessages
    } = useLogsContext();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
            <label>
                Минимальная важность для <b>таблицы</b> (minVarLogs):
                <input
                    type="number"
                    value={minVarLogs}
                    onChange={(e) => setMinVarLogs(Number(e.target.value))}
                    style={{ marginLeft: 8 }}
                />
            </label>

            <label>
                Минимальная важность для <b>оповещений</b> (minVarMessage):
                <input
                    type="number"
                    value={minVarMessage}
                    onChange={(e) => setMinVarMessage(Number(e.target.value))}
                    style={{ marginLeft: 8 }}
                />
            </label>

            <label>
                Время отображения (сек) (timeShow):
                <input
                    type="number"
                    value={timeShow}
                    onChange={(e) => setTimeShow(Number(e.target.value))}
                    style={{ marginLeft: 8 }}
                />
            </label>

            <label>
                Отображать всплывашки (showMessages):
                <input
                    type="checkbox"
                    checked={showMessages}
                    onChange={(e) => setShowMessages(e.target.checked)}
                    style={{ marginLeft: 8 }}
                />
            </label>
        </div>
    );
}

/** -----------------------------
 *  9. MainPage — вкладки (Таблица / Настройки)
 * -----------------------------
 */
export function MainPage() {
    const [currentTab, setCurrentTab] = useState<'table' | 'settings'>('table');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', gap: 8, padding: 10, background: '#333' }}>
                <button
                    onClick={() => setCurrentTab('table')}
                    style={{
                        backgroundColor: currentTab === 'table' ? '#666' : '#444',
                        color: 'white',
                        border: 'none',
                        padding: '8px',
                        cursor: 'pointer'
                    }}
                >
                    Таблица логов
                </button>
                <button
                    onClick={() => setCurrentTab('settings')}
                    style={{
                        backgroundColor: currentTab === 'settings' ? '#666' : '#444',
                        color: 'white',
                        border: 'none',
                        padding: '8px',
                        cursor: 'pointer'
                    }}
                >
                    Настройки
                </button>
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
                {currentTab === 'table' && <LogsTable />}
                {currentTab === 'settings' && <LogsSettings />}
            </div>
        </div>
    );
}

/** -----------------------------
 *  10. Корневой компонент App
 * -----------------------------
 */
export default function AppLogs() {
    return (
        <LogsProvider>
            <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
                <MainPage />
                <LogsNotifications />
            </div>
        </LogsProvider>
    );
}
