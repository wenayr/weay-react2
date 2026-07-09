import React, {useCallback, useEffect, useRef} from "react";
import {copyToClipboard, Params, timeLocalToStr_hhmmss, ArrayElementType} from "wenay-common2";
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
// varMin - minimum importance
export function getLogsApi<T extends object = {}>(setting: LogsApiOptions) {
    const datum = memoryGetOrCreate("settingLogs",settingLogs)
    const controller = createLogsController<T>({
        options: setting,
        state: createLogsControllerState<T>({
            full: datumConst,
            mini: datumMiniConst as {last: LogEntry<T>[]},
            settings: datum,
        }),
        onFullChange: () => renderBy(datumConst),
        onMiniChange: () => renderBy(datumMiniConst),
        onSettingsChange: () => renderBy(datum),
    })

    return {
        addLogs: controller.addLogs,
        params: controller.params,
        React: {
            Setting: InputSettingLogs,
            Message: MessageEventLogs,
            PageLogs: PageLogs
        }
    }
}
export const logsApi = getLogsApi<{}>({limitPer: 500})

function InputSettingLogs({}:{update?: number}) {
    const datum = memoryGetOrCreate("settingLogs",settingLogs)
    return <ParamsEditor
        // @ts-ignore
        params={Params.mergeParamValuesToInfos(getSettingLogs(), datum.params)}
        onChange = {(e)=>{
            datum.params = Params.GetSimpleParams(e)
            renderBy(datum)
        }}/>
}

export function PageLogs({update}: {update?: number}) {
    const datumFull = datumConst
    const rowData = [...datumFull.map.values()].flat()
    type el = ArrayElementType<typeof rowData >
    const datum = datumMiniConst
    const setting = memoryGetOrCreate("settingLogs",settingLogs)
    const apiGrid = useRef<GridReadyEvent<el>|null>(null)
    useEffect(()=> {
        apiGrid.current?.api.sizeColumnsToFit()
    },[update])
    updateBy(setting, ()=>{
        if (setting.params.minVarLogs) {
            apiGrid.current?.api.setFilterModel({
                var: {
                    filterType: 'number',
                    type: 'greaterThanOrEqual',
                    filter: setting.params.minVarLogs
                }})
        } else {
            apiGrid.current?.api.destroyFilter("var")
        }
    })

    updateBy(datum, ()=>{
        const data = datum.last[0]
        if (data) { // data.time timeLocalToStr_yyyymmdd_hhmmss_ms
            apiGrid.current?.api.applyTransactionAsync({
                add: [{...data}]
            })
        }
    })

    const Main = useCallback(()=>{
        const columns = [
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
        ] satisfies tColum2<el>[]
        return <div className={"maxSize"}>
            <AgGridTable
                // className = "ag-theme-alpine-dark ag-theme-alpine2" // ag-theme-alpine-dark3
                suppressCellFocus = {true}
                onGridReady = {(a)=>{
                    apiGrid.current = a  //as GridReadyEvent<tColum>
                    apiGrid.current.api.sizeColumnsToFit()
                    if (setting.params.minVarLogs) {
                        apiGrid.current.api.setFilterModel({
                            var: {
                                filterType: 'number',
                                type: 'greaterThanOrEqual',
                                filter: setting.params.minVarLogs
                            }})
                    }
                }}
                onSortChanged={(e)=>{

                }}
                defaultColDef = {logGridDefaultColDef}
                headerHeight = {30}
                rowHeight = {26}
                autoSizePadding = {1}
                rowData = {rowData}
                columnDefs = {columns}
                onCellMouseDown = {(e)=>{
                    if (e.event instanceof MouseEvent && e.event.button == 2) {
                        contextMenu.openAt(e.event, [
                            {
                                name: "copy", actionKey: "logs.copyCell", onClick: ()=> {copyToClipboard(e.value)}
                            }
                        ]);
                    }
                }}
            >

            </AgGridTable>
        </div>
    },[true])

    return <Main/>
}

function Message({logs}: {logs: LogEntry}) {
    return <div className={"testAnime"}
                style={{ width:"200px", color: logStyleTokens.text, height:"auto", marginTop:"10px", borderRight:`5px solid ${logStyleTokens.accent}`, background: logSeverityBackground(logs.var)}}
        //key={id}
    >
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
        <p style={{float:"inline-end", textAlign:"right",  marginRight:"10px"}}>{(new Date()).toLocaleDateString()}</p>
    </div>
}

const tt: {[key: string]: React.ReactElement} = {}
let r = 0
export function MessageEventLogs({zIndex} :{zIndex?: number}) {
    const setting = memoryGetOrCreate("settingLogs",settingLogs)
    updateBy(tt)
    updateBy(datumMiniConst, ()=>{
        const last = datumMiniConst.last[0]
        if (!last) return;
        if (setting.params.minVarMessage && (!last.var || last.var < setting.params.minVarMessage)) return;

        let key = String(r++)
        tt[key] = <div className={"example-exit"} key = {key}>
            <Message logs = {last} />
        </div>
        setTimeout(()=>{
            if (tt[key]) {
                delete tt[key];
                renderBy(tt, 100)
            }
        }, setting.params.timeShow ? setting.params.timeShow * 1000 : 2000)
        renderBy(tt)
    })
    const tr = [...Object.values(tt)].reverse().slice(0,10)

    return <div style={{maxHeight: "50vh", position: "absolute", right: "1px", zIndex}}>
        <div
            onClick={()=>{setting.params.show = !setting.params.show; renderBy(tt)}}
            style={{margin: 3, padding: 3, right: 0, position: "absolute", zIndex: 120,
                ...setting.params.show ?
                    {background: logStyleTokens.toggleBg, fontSize: "25px"} :
                    {background: logStyleTokens.toggleOffBg}
        }}>{setting.params.show ? "X" : "log"}</div>

        <div>{setting.params.show ? tr : null}</div>

         </div>
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