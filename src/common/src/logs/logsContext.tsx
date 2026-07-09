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
import {logDividerGradient, logSeverityBackground, logStyleTokens} from './logStyles';

// Uncomment AG Grid styles if needed:
// import 'ag-grid-community/styles/ag-grid.css';
// import 'ag-grid-community/styles/ag-theme-alpine.css';
// import 'ag-grid-community/styles/ag-theme-alpine-dark.css';

/** -----------------------------
 *  1. Log types
 * -----------------------------
 */
export interface LogInput<T extends object = {}> {
    id: string;
    var?: number;
    time: Date;
    txt: string;
    [key: string]: any; // any additional fields
}

export interface LogEntry<T extends object = {}> extends LogInput<T> {
    num: number;
}

/** -----------------------------
 *  2. memoryGetOrCreate function -
 *     loads and saves data in localStorage.
 * -----------------------------
 */
function memoryGetOrCreate<T>(key: string, defaultValue: T): T {
    try {
        const stored = localStorage.getItem(key);
        // If localStorage has no value, write defaultValue
        if (!stored) {
            localStorage.setItem(key, JSON.stringify(defaultValue));
            return defaultValue;
        }
        // If a value was found, try to merge it with defaultValue
        // in case new fields were added to defaultValue
        const parsed = JSON.parse(stored);
        return { ...defaultValue, ...parsed };
    } catch (error) {
        console.error("localStorage read error:", error);
        return defaultValue;
    }
}

/** -----------------------------
 *  3. Context interface
 * -----------------------------
 */
interface LogsContextValue {
    // Log array
    logs: LogEntry[];
    // Function for adding a log
    addLog: (input: LogInput) => void;

    // Settings
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
 *  4. Create the context itself
 *     and provider for logs and settings
 * -----------------------------
 */
const LogsContext = createContext<LogsContextValue | null>(null);

export function LogsProvider({ children }: { children: React.ReactNode }) {
    // 4.1. Load settings from localStorage once (lazy init: the provider rerenders on every addLog)
    const [savedSettings] = useState(() => memoryGetOrCreate("logSettings", {
        minVarLogs: 0,
        minVarMessage: 0,
        timeShow: 2,
        showMessages: true
    }));

    // 4.2. In-memory log list (logs are not saved to localStorage,
    //      only settings are, but logs can be saved too if needed)
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const counterRef = useRef(0);

    // 4.3. Settings themselves, initialized from memoryGetOrCreate output
    const [minVarLogs, setMinVarLogs] = useState(savedSettings.minVarLogs);
    const [minVarMessage, setMinVarMessage] = useState(savedSettings.minVarMessage);
    const [timeShow, setTimeShow] = useState(savedSettings.timeShow);
    const [showMessages, setShowMessages] = useState(savedSettings.showMessages);

    // 4.4. Watch settings changes and save them back to localStorage
    useEffect(() => {
        const toSave = {
            minVarLogs,
            minVarMessage,
            timeShow,
            showMessages
        };
        localStorage.setItem("logSettings", JSON.stringify(toSave));
    }, [minVarLogs, minVarMessage, timeShow, showMessages]);

    // 4.5. Function for adding a log, generates the num field automatically
    const addLog = useCallback((input: LogInput) => {
        counterRef.current += 1;
        const num = counterRef.current;
        setLogs((prevLogs) => {
            const newLog: LogEntry = { ...input, num };
            // Limit to 500 logs; this can be changed
            return [newLog, ...prevLogs].slice(0, 500);
        });
    }, []);

    // 4.6. Return the context provider
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
 *  5. Hook for convenient context access
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
 *  6. LogsTable component
 *     (PageLogs equivalent)
 * -----------------------------
 */
export function LogsTable() {
    const { logs, minVarLogs } = useLogsContext();
    const gridRef = useRef<GridReadyEvent | null>(null);

    // Column definitions
    const columnDefs: ColDef[] = useMemo(() => [
        {
            field: 'time',
            headerName: 'Time',
            sort: 'desc',
            valueFormatter: (params) => {
                const dateObj = params.value;
                if (!dateObj) return '';
                return new Date(dateObj).toLocaleTimeString();
            },
            width: 120,
        },
        { field: 'id', headerName: 'ID', width: 80 },
        { field: 'var', headerName: 'Importance', width: 90 },
        {
            field: 'txt',
            headerName: 'Message',
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

    // Watch minVarLogs and configure the AG Grid filter
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
 *  7. LogsNotifications component
 *     (MessageEventLogs equivalent)
 * -----------------------------
 */
interface NotificationItem {
    id: number;
    log: LogEntry;
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
    const lastLogRef = useRef<LogEntry | null>(null);
    const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());

    useEffect(() => {
        if (logs.length === 0) return;
        const newestLog = logs[0];
        // gate by log identity: a settings change must not re-add the same log
        if (newestLog === lastLogRef.current) return;
        lastLogRef.current = newestLog;
        if ((newestLog.var ?? 0) < minVarMessage) return;

        counterRef.current += 1;
        const newItem = { id: counterRef.current, log: newestLog };
        setNotifications((prev) => [newItem, ...prev]);

        // Remove notification after timeShow seconds; per-item timers are NOT cancelled
        // when the next log arrives - the old cleanup froze every notification but the last
        const timer = setTimeout(() => {
            timersRef.current.delete(timer);
            setNotifications((prev) => prev.filter((item) => item.id !== newItem.id));
        }, timeShow * 1000);
        timersRef.current.add(timer);
    }, [logs, minVarMessage, timeShow]);

    useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

    if (!showMessages) {
        // If popups are hidden, show only "log"
        return (
            <div style={{ position: 'absolute', right: 10, top: 10, zIndex: 999 }}>
                <div
                    style={{
                        background: logStyleTokens.toggleOffBg,
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

    // Otherwise render the current notification list
    return (
        <div style={{ position: 'absolute', right: 10, top: 10, zIndex: 999 }}>
            <div
                style={{
                    background: logStyleTokens.toggleBg,
                    fontSize: '20px',
                    padding: '6px 10px',
                    cursor: 'pointer'
                }}
                onClick={() => setShowMessages(false)}
            >
                X
            </div>
            <div>
                {notifications.slice(0, 10).map(({ id, log }) => (
                        <div
                            key={id}
                            className="testAnime example-exit"
                            style={{
                                width: 200,
                                color: logStyleTokens.text,
                                marginTop: 10,
                                borderRight: `5px solid ${logStyleTokens.accent}`,
                                backgroundColor: logSeverityBackground(log.var),
                                padding: 8,
                                wordWrap: 'break-word'
                            }}
                        >
                            <p style={{ textAlign: 'center', fontSize: 10, marginBottom: 1 }}>notification</p>
                            <hr
                                style={{
                                    backgroundImage: logDividerGradient(),
                                    border: 0,
                                    height: 1,
                                    margin: 0
                                }}
                            />
                            <div style={{ textAlign: 'right', marginRight: 10 }}>
                                {typeof log.txt === 'object' ? JSON.stringify(log.txt) : log.txt}
                            </div>
                            <p style={{ textAlign: 'right', marginRight: 10 }}>
                                {new Date(log.time).toLocaleDateString()}
                            </p>
                        </div>
                    ))}
            </div>
        </div>
    );
}

/** -----------------------------
 *  8. LogsSettings component
 *     (InputSettingLogs equivalent)
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
                Minimum importance for the <b>table</b> (minVarLogs):
                <input
                    type="number"
                    value={minVarLogs}
                    onChange={(e) => setMinVarLogs(Number(e.target.value))}
                    style={{ marginLeft: 8 }}
                />
            </label>

            <label>
                Minimum importance for <b>notifications</b> (minVarMessage):
                <input
                    type="number"
                    value={minVarMessage}
                    onChange={(e) => setMinVarMessage(Number(e.target.value))}
                    style={{ marginLeft: 8 }}
                />
            </label>

            <label>
                Display time (sec) (timeShow):
                <input
                    type="number"
                    value={timeShow}
                    onChange={(e) => setTimeShow(Number(e.target.value))}
                    style={{ marginLeft: 8 }}
                />
            </label>

            <label>
                Show popups (showMessages):
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
 *  9. MainPage - tabs (Table / Settings)
 * -----------------------------
 */
export function MainPage() {
    const [currentTab, setCurrentTab] = useState<'table' | 'settings'>('table');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', gap: 8, padding: 10, background: logStyleTokens.tabNavBg }}>
                <button
                    onClick={() => setCurrentTab('table')}
                    style={{
                        backgroundColor: currentTab === 'table' ? logStyleTokens.tabActiveBg : logStyleTokens.tabBg,
                        color: logStyleTokens.tabText,
                        border: 'none',
                        padding: '8px',
                        cursor: 'pointer'
                    }}
                >
                    Log table
                </button>
                <button
                    onClick={() => setCurrentTab('settings')}
                    style={{
                        backgroundColor: currentTab === 'settings' ? logStyleTokens.tabActiveBg : logStyleTokens.tabBg,
                        color: logStyleTokens.tabText,
                        border: 'none',
                        padding: '8px',
                        cursor: 'pointer'
                    }}
                >
                    Settings
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
 *  10. Root App component
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
