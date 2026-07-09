import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {copyToClipboard, Params, timeLocalToStr_hhmmss} from "wenay-common2";
import {renderBy, updateBy} from "../../updateBy";
import {ColDef, ColGroupDef, GridReadyEvent} from "ag-grid-community";
import {contextMenu} from "../menu/menuMouse";
import { memoryGetOrCreate } from "../utils/memoryStore";
import { ParamsEditor } from "../components/ParamsEditor";
import {logDividerGradient, logSeverityBackground, logStyleTokens} from "./logStyles";
import {AgGridTable, colDefCentered} from "../grid/agGrid4";
import {
    createLogsController,
    createLogsControllerState,
    getSettingLogs,
    type LogEntry,
    type LogsApiOptions,
    type LogsControllerState,
    type LogsFullState,
    type LogsMiniState,
    type LogsSettingsState,
} from "./logsController";

export {
    createLogsController,
    createLogsControllerState,
    getSettingLogs,
} from "./logsController";
export type {
    CreateLogsControllerOptions,
    LogsApiOptions,
    LogsController,
    LogsControllerState,
    LogsFullState,
    LogsMiniState,
} from "./logsController";

const cashLogs = new Map<string, LogEntry<any>[]>()

const datumConst = {
    map: cashLogs,
}
const datumMiniConst = {
    last: [] as LogEntry[]
}
const settingLogs = {params: Params.GetSimpleParams(getSettingLogs())}

type tColum2<TData extends any = any> = (ColDef<TData> | ColGroupDef<TData>)
const logGridDefaultColDef = {...colDefCentered, wrapText: true} satisfies ColDef<any>
/** Optional external state for the log views/hooks; every omitted part falls back to the
 *  legacy module-level state (datumConst/datumMiniConst/"settingLogs"). */
export type LogsViewState = {
    full?: LogsFullState<any>
    mini?: LogsMiniState<any>
    settings?: LogsSettingsState
}
// varMin - minimum importance
// Each call builds its OWN state (fresh map, fresh mini feed, own settings - persisted under
// setting.settingsKey when provided). The global logsApi below injects the legacy module-level
// state explicitly, so existing consumers of datumConst/datumMiniConst/"settingLogs" keep
// seeing the same objects as before.
export function getLogsApi<T extends object = {}>(setting: LogsApiOptions, sharedState?: LogsControllerState<T>) {
    const state = sharedState ?? createLogsControllerState<T>({
        settings: setting.settingsKey
            ? memoryGetOrCreate(setting.settingsKey, {params: Params.GetSimpleParams(getSettingLogs())})
            : undefined,
    })
    const controller = createLogsController<T>({
        options: setting,
        state,
        onFullChange: () => renderBy(state.full),
        onMiniChange: () => renderBy(state.mini),
        onSettingsChange: () => renderBy(state.settings),
    })

    // legacy module state -> keep the exact same component identities as before;
    // custom instances get views bound to THEIR state via closures
    const usesLegacyState = (state.full as LogsFullState<any>) === datumConst
        && (state.mini as LogsMiniState<any>) === datumMiniConst
    const Setting = usesLegacyState ? InputSettingLogs
        : (props: {update?: number}) => <InputSettingLogs {...props} settings={state.settings}/>
    const Message = usesLegacyState ? MessageEventLogs
        : (props: {zIndex?: number}) => <MessageEventLogs {...props} settings={state.settings} mini={state.mini}/>
    const Page = usesLegacyState ? PageLogs
        : (props: {update?: number}) => <PageLogs {...props} state={state}/>

    return {
        addLogs: controller.addLogs,
        params: controller.params,
        React: {
            Setting: Setting,
            Message: Message,
            PageLogs: Page
        }
    }
}
export const logsApi = getLogsApi<{}>({limitPer: 500}, {
    full: datumConst,
    mini: datumMiniConst,
    settings: memoryGetOrCreate("settingLogs", settingLogs),
})

function InputSettingLogs({settings}:{update?: number, settings?: LogsSettingsState}) {
    const datum = settings ?? memoryGetOrCreate("settingLogs",settingLogs)
    return <ParamsEditor
        // @ts-ignore
        params={Params.mergeParamValuesToInfos(getSettingLogs(), datum.params)}
        onChange = {(e)=>{
            datum.params = Params.GetSimpleParams(e)
            renderBy(datum)
        }}/>
}

type LogRow = LogEntry<any>

/** Controller for the full-page logs table: owns the ag-grid imperative surface that
 *  `PageLogs` used to drive inline. The importance filter lives in ONE method
 *  (`applyImportanceFilter`) - it used to be duplicated between the settings effect and
 *  `onGridReady`. Rows keep the original identity semantics: the grid receives the mount-time
 *  snapshot once, later entries arrive as `applyTransactionAsync` copies of the mini feed. */
export function useLogsPageTable(state?: LogsViewState) {
    const setting = state?.settings ?? memoryGetOrCreate("settingLogs",settingLogs)
    const full = state?.full ?? datumConst
    const mini = state?.mini ?? datumMiniConst
    const apiGrid = useRef<GridReadyEvent<LogRow>|null>(null)
    // mount-time snapshot: the live grid is fed by transactions, not re-renders
    const [rowData] = useState(() => [...full.map.values()].flat())

    const getApi = useCallback(() => apiGrid.current, [])
    const fit = useCallback(() => { apiGrid.current?.api.sizeColumnsToFit() }, [])
    const applyImportanceFilter = useCallback((min?: number) => {
        const api = apiGrid.current?.api
        if (!api) return
        if (min) {
            api.setFilterModel({
                var: {
                    filterType: 'number',
                    type: 'greaterThanOrEqual',
                    filter: min
                }})
        } else {
            api.destroyFilter("var")
        }
    }, [])
    const appendRow = useCallback((row: LogRow) => {
        apiGrid.current?.api.applyTransactionAsync({add: [row]})
    }, [])

    // settings change -> single filter method (no re-render: updateBy with a callback)
    updateBy(setting, ()=>{
        applyImportanceFilter(setting.params.minVarLogs)
    })
    // new mini-feed entry -> async append, copy like before (row identity per event)
    updateBy(mini, ()=>{
        const data = mini.last[0]
        if (data) appendRow({...data})
    })

    const onGridReady = useCallback((a: GridReadyEvent<LogRow>)=>{
        apiGrid.current = a
        fit()
        // fresh grid has no filter - only apply when the setting asks for one
        if (setting.params.minVarLogs) applyImportanceFilter(setting.params.minVarLogs)
    }, [applyImportanceFilter, fit, setting])

    const columnDefs = useMemo(() => [
        {
            field: "time",
            sort: "desc",
            width: 50,
            valueFormatter: (e)=>e.value ? timeLocalToStr_hhmmss(e.value) : e.value
        },
        {
            field: "id",
            width: 20,
        },
        {
            field: "var",
            width: 50,
        },
        {
            field: "type1",
            width: 50,
        },
        {
            field: "type2",
            width: 50,
        },
        {
            field: "type3",
            width: 50,
        },
        {
            field: "txt",
            wrapText: true,
            autoHeight: true,
            width: 350
        },
        {
            field: "address",
            width: 150,
        },
    ] satisfies tColum2<LogRow>[], [])

    const gridProps = useMemo(() => ({
        suppressCellFocus: true,
        onGridReady,
        defaultColDef: logGridDefaultColDef,
        headerHeight: 30,
        rowHeight: 26,
        autoSizePadding: 1,
        rowData,
        columnDefs,
        onCellMouseDown: (e: any)=>{
            if (e.event instanceof MouseEvent && e.event.button == 2) {
                contextMenu.openAt(e.event, [
                    {
                        name: "copy", actionKey: "logs.copyCell", onClick: ()=> {copyToClipboard(e.value)}
                    }
                ]);
            }
        },
    }), [columnDefs, onGridReady, rowData])

    return {getApi, fit, applyImportanceFilter, appendRow, onGridReady, columnDefs, gridProps}
}

export type LogsPageTableController = ReturnType<typeof useLogsPageTable>

export function PageLogs({update, state}: {update?: number, state?: LogsViewState}) {
    const table = useLogsPageTable(state)
    useEffect(()=> {
        table.fit()
    },[update])
    return <div className={"maxSize"}>
        <AgGridTable {...table.gridProps} />
    </div>
}

export type MessageEventLogsItem = {
    key: string
    logs: LogEntry
}

export type UseMessageEventLogsControllerOptions = {
    maxVisible?: number
    settings?: LogsSettingsState
    mini?: LogsMiniState<any>
}

export type MessageEventLogsController = {
    show: boolean
    setShow(value: boolean): void
    toggleShow(): void
    notifications: MessageEventLogsItem[]
    visibleNotifications: MessageEventLogsItem[]
    maxVisible: number
}

export type MessageEventLogsViewProps = {
    controller: MessageEventLogsController
    zIndex?: number
    className?: string
    style?: React.CSSProperties
}

export function MessageEventLogCard({logs}: {logs: LogEntry}) {
    return <div className={"testAnime"}
                style={{ width:"200px", color: logStyleTokens.text, height:"auto", marginTop:"10px", borderRight:`5px solid ${logStyleTokens.accent}`, background: logSeverityBackground(logs.var)}}>
        <p style = {{textAlign:"center", fontSize: "10px", marginBottom:"1px"}}>{"notification"}</p>
        <hr style = {{
            backgroundImage: logDividerGradient(),
            border: 0,
            height: "1px",
            margin: "0 0 0 0",
            boxSizing: "content-box",
            display: "block"
        }}/>
        <div style={{textAlign:"right", marginRight:"10px", height:"auto", overflowWrap: "break-word", textOverflow: "ellipsis"}}>{typeof logs.txt == "object" ? JSON.stringify(logs.txt) : logs.txt}</div>
        <p style={{float:"inline-end", textAlign:"right",  marginRight:"10px"}}>{(new Date(logs.time)).toLocaleDateString()}</p>
    </div>
}

export function useMessageEventLogsController(options: UseMessageEventLogsControllerOptions = {}): MessageEventLogsController {
    const setting = options.settings ?? memoryGetOrCreate("settingLogs",settingLogs)
    const mini = options.mini ?? datumMiniConst
    const maxVisible = Math.max(1, options.maxVisible ?? 10)
    const [notifications, setNotifications] = useState<MessageEventLogsItem[]>([])
    const counterRef = useRef(0)
    const lastLogRef = useRef<LogEntry | null>(null)
    const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

    updateBy(setting)

    const addNotification = useCallback((last: LogEntry) => {
        if ((last.var ?? 0) < (setting.params.minVarMessage ?? 0)) return

        const key = String(counterRef.current++)
        const item = {key, logs: last}
        const displayMs = (setting.params.timeShow ? setting.params.timeShow : 2) * 1000

        setNotifications(prev => [item, ...prev])
        const timer = setTimeout(()=>{
            timersRef.current.delete(key)
            setNotifications(prev => prev.filter(e => e.key !== key))
        }, displayMs)
        timersRef.current.set(key, timer)
    }, [setting])

    const onMiniChange = useCallback(() => {
        const last = mini.last[0]
        if (!last || last === lastLogRef.current) return
        lastLogRef.current = last
        addNotification(last)
    }, [addNotification, mini])

    updateBy(mini, onMiniChange)

    useEffect(() => () => {
        timersRef.current.forEach(clearTimeout)
        timersRef.current.clear()
    }, [])

    const setShow = useCallback((value: boolean) => {
        // LogsSettingsState.params is readonly at the type level; keep the legacy in-place mutation
        ;(setting.params as {show: boolean}).show = value
        renderBy(setting)
    }, [setting])

    const toggleShow = useCallback(() => {
        setShow(!setting.params.show)
    }, [setShow, setting])

    return useMemo(() => ({
        show: Boolean(setting.params.show),
        setShow,
        toggleShow,
        notifications,
        visibleNotifications: notifications.slice(0, maxVisible),
        maxVisible,
    }), [maxVisible, notifications, setShow, setting.params.show, toggleShow])
}

export function MessageEventLogsView({controller, zIndex, className, style}: MessageEventLogsViewProps) {
    const toggleTitle = controller.show ? "Hide log notifications" : "Show log notifications"
    const toggleStyle: React.CSSProperties = {
        position: "absolute",
        right: 0,
        top: 0,
        zIndex: 120,
        minWidth: controller.show ? 24 : 42,
        height: 24,
        padding: controller.show ? 0 : "0 8px",
        border: `1px solid ${logStyleTokens.accent}`,
        borderRadius: 999,
        background: controller.show ? logStyleTokens.toggleBg : logStyleTokens.toggleOffBg,
        color: logStyleTokens.text,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: controller.show ? 18 : 12,
        lineHeight: 1,
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
    }

    return <div className={className} style={{maxHeight: "50vh", position: "absolute", right: "1px", zIndex, ...style}}>
        <button
            type="button"
            aria-label={toggleTitle}
            title={toggleTitle}
            onClick={controller.toggleShow}
            style={toggleStyle}
        >{controller.show ? "\u00d7" : "log"}</button>

        <div>{controller.show ? controller.visibleNotifications.map(e => (
            <div className={"example-exit"} key={e.key}>
                <MessageEventLogCard logs={e.logs} />
            </div>
        )) : null}</div>

    </div>
}

export function MessageEventLogs({zIndex, settings, mini} :{zIndex?: number, settings?: LogsSettingsState, mini?: LogsMiniState<any>}) {
    const controller = useMessageEventLogsController({settings, mini})
    return <MessageEventLogsView controller={controller} zIndex={zIndex} />
}
type ty = {name: string, key: string, page: (a?: any) => React.JSX.Element | null}

const defPageBase = {
    keyPage: "PageLogs"
}

const pages   = [
    {name: "message", key: "PageLogs", page: PageLogs},
    {name: "setting", key: "InputSettingLogs", page: InputSettingLogs},
] satisfies ty[]

const map = Object.fromEntries(pages.map(e=>[e.key,e.page]))
export function LogsPage({update}: {update?: number}) {
    const datum = defPageBase
    updateBy(datum)

    const Page = map[datum.keyPage]
    return <div className={"maxSize"} style={{display: "flex", flexDirection: "column"}}>
        <div style={{width: "100%"}}>
            <div style={{display: "flex", justifyContent: "center"}}>
                {
                    pages.map((e,i) => (
                        <div key = {i}
                             onClick = {(z)=> {
                                 datum.keyPage = e.key
                                 renderBy(datum)
                             }}
                             className = {datum.keyPage == e.key ? "msTradeAlt msTradeActive" : "msTradeAlt"}>{e.name}</div>
                    ))
                }
            </div>
        </div>
        <div className={"maxSize"}>
            {Page && <Page key={datum.keyPage} update={update}/>}
        </div>

    </div>
}