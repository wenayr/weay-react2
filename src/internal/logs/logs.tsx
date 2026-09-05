import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {copyToClipboard, Params, timeLocalToStr_hhmmss} from "wenay-common2/client";
import {renderBy, updateBy} from "../updateBy.js";
import {ColDef, ColGroupDef, GridReadyEvent} from "ag-grid-community";
import {contextMenu} from "../menu/menuMouse.js";
import { memoryGetOrCreate } from "../utils/memoryStore.js";
import { ParamsEditor } from "../components/ParamsEditor/index.js";
import {logDividerGradient, logSeverityBackground, logStyleTokens} from "./logStyles.js";
import {AgGridTable, colDefCentered} from "../grid/agGrid4/index.js";
import {
    createLogsController,
    createLogsControllerState,
    getSettingLogs,
    type LogEntry,
    type LogsApiOptions,
    type LogsChange,
    type LogsControllerState,
    type LogsFullState,
    type LogsMiniState,
    type LogsSettingsState,
} from "./logsController.js";

export {
    createLogsController,
    createLogsControllerState,
    getSettingLogs,
} from "./logsController.js";
export type {
    CreateLogsControllerOptions,
    LogsApiOptions,
    LogsChange,
    LogsController,
    LogsControllerState,
    LogsFullState,
    LogsMiniState,
    LogEntry,
    LogInput,
    LogsSettings,
    LogsSettingsDefinition,
    LogsSettingsState,
} from "./logsController.js";

const cashLogs = new Map<string, LogEntry<any>[]>()

const datumConst: LogsFullState<any> = {
    map: cashLogs,
}
const datumMiniConst: LogsMiniState<any> = {
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
    const apiGrid = useRef<GridReadyEvent<LogRow>|null>(null)
    // mount-time snapshot: the live grid is fed by transactions, not re-renders
    const [rowData] = useState(() => [...full.map.values()].flat())
    const shownRows = useRef(new Map(rowData.map(row => [row.num, row])))
    // identity of the change already pushed into the grid, so a wake-up carrying no new delta
    // (settings write, a second subscriber) does not re-apply the same transaction
    const appliedChange = useRef<LogsChange<any> | undefined>(undefined)

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
    // Full reconcile: O(total logs). It walks every per-id array (500 entries each by
    // default), so it is NOT the per-entry path any more - only this explicit resync, used
    // once at onGridReady to catch up with whatever landed before the grid existed.
    const resync = useCallback(() => {
        const api = apiGrid.current?.api
        if (!api) return
        const next = new Map([...full.map.values()].flat().map(row => [row.num, row]))
        const add = [...next].filter(([num]) => !shownRows.current.has(num)).map(([, row]) => row)
        const remove = [...shownRows.current].filter(([num]) => !next.has(num)).map(([, row]) => row)
        shownRows.current = next
        appliedChange.current = full.lastChange
        if (add.length || remove.length) api.applyTransactionAsync({add, remove})
    }, [full])
    // Per-entry path: one addLogs -> one added row plus whatever limitPer evicted, both
    // carried by the change the controller stamped on the full state. O(1) in the log count.
    const syncRows = useCallback(() => {
        const api = apiGrid.current?.api
        if (!api) return
        const change = full.lastChange as LogsChange<any> | undefined
        // no delta at all (state built without the change channel) -> full reconcile;
        // a delta already applied (params.set also fires onFullChange) -> nothing to do
        if (!change) { resync(); return }
        if (change === appliedChange.current) return
        appliedChange.current = change

        const remove: LogRow[] = []
        for (const evicted of change.evictedFull) {
            if (shownRows.current.delete(evicted.num)) remove.push(evicted)
        }
        // limitPer 0 evicts the entry that was just pushed: never add a row we also remove
        const evictedItself = change.evictedFull.some(evicted => evicted.num === change.item.num)
        const add = !evictedItself && !shownRows.current.has(change.item.num) ? [change.item] : []
        if (add.length) shownRows.current.set(change.item.num, change.item)
        if (add.length || remove.length) api.applyTransactionAsync({add, remove})
    }, [full, resync])

    // settings change -> single filter method (no re-render: updateBy with a callback)
    updateBy(setting, ()=>{
        applyImportanceFilter(setting.params.minVarLogs)
    })
    // The full state owns retention, so reconcile additions and evictions together.
    updateBy(full, ()=>{
        syncRows()
    })

    const onGridReady = useCallback((a: GridReadyEvent<LogRow>)=>{
        apiGrid.current = a
        // the grid missed every change that happened before it existed -> full reconcile once
        resync()
        fit()
        // fresh grid has no filter - only apply when the setting asks for one
        if (setting.params.minVarLogs) applyImportanceFilter(setting.params.minVarLogs)
    }, [applyImportanceFilter, fit, resync, setting])

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
        getRowId: (p: {data: LogRow}) => String(p.data.num),
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

    return {getApi, fit, applyImportanceFilter, syncRows, resync, onGridReady, columnDefs, gridProps}
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

/** memo + the two per-item strings computed once: the card used to re-stringify the payload
 *  and rebuild a Date on every parent render, and the parent re-renders on every new log. */
export const MessageEventLogCard = React.memo(function MessageEventLogCard({logs}: {logs: LogEntry}) {
    const text = useMemo(() => typeof logs.txt == "object" ? JSON.stringify(logs.txt) : logs.txt, [logs.txt])
    const dateText = useMemo(() => (new Date(logs.time)).toLocaleDateString(), [logs.time])
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
        <div style={{textAlign:"right", marginRight:"10px", height:"auto", overflowWrap: "break-word", textOverflow: "ellipsis"}}>{text}</div>
        <p style={{float:"inline-end", textAlign:"right",  marginRight:"10px"}}>{dateText}</p>
    </div>
})

export function useMessageEventLogsController(options: UseMessageEventLogsControllerOptions = {}): MessageEventLogsController {
    const setting = options.settings ?? memoryGetOrCreate("settingLogs",settingLogs)
    const mini = options.mini ?? datumMiniConst
    const maxVisible = Math.max(1, options.maxVisible ?? 10)
    const [notifications, setNotifications] = useState<MessageEventLogsItem[]>([])
    const counterRef = useRef(0)
    const lastLogRef = useRef<LogEntry | null>(null)
    const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
    // mirror of `notifications`: the cap has to clear the timer of every dropped item, and a
    // setState updater must stay side-effect free (React double-invokes it in StrictMode)
    const itemsRef = useRef<MessageEventLogsItem[]>([])

    updateBy(setting)

    const addNotification = useCallback((last: LogEntry) => {
        if ((last.var ?? 0) < (setting.params.minVarMessage ?? 0)) return

        const key = String(counterRef.current++)
        const item = {key, logs: last}
        const displayMs = (setting.params.timeShow ? setting.params.timeShow : 2) * 1000

        // Cap at maxVisible: only that many are ever rendered, so everything past the cap was
        // retained memory plus a re-render per arrival and nothing else. Oldest drop first,
        // and their pending expiry timers drop with them.
        const next = [item, ...itemsRef.current]
        const dropped = next.length > maxVisible ? next.splice(maxVisible) : []
        for (const old of dropped) {
            const oldTimer = timersRef.current.get(old.key)
            if (oldTimer !== undefined) {
                clearTimeout(oldTimer)
                timersRef.current.delete(old.key)
            }
        }
        itemsRef.current = next
        setNotifications(next)

        const timer = setTimeout(()=>{
            timersRef.current.delete(key)
            itemsRef.current = itemsRef.current.filter(e => e.key !== key)
            setNotifications(itemsRef.current)
        }, displayMs)
        timersRef.current.set(key, timer)
    }, [maxVisible, setting])

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
