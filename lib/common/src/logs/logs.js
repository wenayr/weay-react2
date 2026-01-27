import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useEffect, useRef } from "react";
import { copyToClipboard, Params, timeLocalToStr_hhmmss } from "wenay-common";
import { renderBy, updateBy } from "../../updateBy";
import { ParametersReact } from "../Parameters2";
import { staticGetAdd } from "../mapMemory";
import { mouseMenuApi } from "../menu/menuMouse";
const cashLogs = new Map();
const datumConst = {
    map: cashLogs,
};
const datumMiniConst = {
    last: []
};
const getSettingLogs = () => ({
    minVarLogs: { name: "мин. важность для оповещения", range: { min: 0, max: 25, step: 1 }, value: 0 },
    minVarMessage: { name: "мин. важность для таблицы логов", range: { min: 0, max: 25, step: 1 }, value: 0 },
    timeShow: { name: "время отображение на экране", range: { min: 1, max: 20, step: 1 }, value: 2 },
    show: { name: "отображать", value: true }
});
const settingLogs = { params: Params.GetSimpleParams(getSettingLogs()) };
// varMin - минимальная важность
export function getLogsApi(setting) {
    const datum = staticGetAdd("settingLogs", settingLogs);
    function addToArr(arr, data, limit) {
        arr.unshift(data);
        if (arr.length > limit)
            arr.length = limit;
    }
    let num = 0;
    const SettingLogsReact = ({}) => _jsx(ParametersReact
    // @ts-ignore
    , { 
        // @ts-ignore
        params: Params.mergeParamValuesToInfos(getSettingLogs(), datum.params), onChange: (e) => {
            datum.params = Params.GetSimpleParams(e);
            renderBy(datum);
        } });
    return {
        addLogs(a) {
            addToArr(datumMiniConst.last, { ...a, num: num++ }, 50);
            addToArr(datumConst.map.get(a.id) ?? datumConst.map.set(a.id, []).get(a.id), { ...a, num: num++ }, setting.limitPer);
            renderBy(datumConst);
            renderBy(datumMiniConst);
        },
        params: {
            def: getSettingLogs,
            get() { return datum.params; },
            set(a) {
                datum.params = a;
                renderBy(datumMiniConst);
                renderBy(datumConst);
            },
        },
        React: {
            Setting: SettingLogsReact,
            Message: MessageEventLogs,
            PageLogs: PageLogs
        }
    };
}
export const logsApi = getLogsApi({ limitPer: 500 });
function InputSettingLogs({}) {
    const datum = staticGetAdd("settingLogs", settingLogs);
    return _jsx(ParametersReact
    // @ts-ignore
    , { 
        // @ts-ignore
        params: Params.mergeParamValuesToInfos(getSettingLogs(), datum.params), onChange: (e) => {
            datum.params = Params.GetSimpleParams(e);
            renderBy(datum);
        } });
}
export function PageLogs({ update }) {
    const datumFull = datumConst;
    const rowData = [...datumFull.map.values()].flatMap(e => e.map(e => ({
        ...e,
        time: (e.time)
    })));
    const datum = datumMiniConst;
    const setting = staticGetAdd("settingLogs", settingLogs);
    const apiGrid = useRef(null);
    useEffect(() => {
        apiGrid.current?.api.sizeColumnsToFit();
    }, [update]);
    updateBy(setting, () => {
        if (setting.params.minVarLogs) {
            apiGrid.current?.api.setFilterModel({
                var: {
                    filterType: 'number',
                    type: 'greaterThanOrEqual',
                    filter: setting.params.minVarLogs
                }
            });
        }
        else {
            apiGrid.current?.api.destroyFilter("var");
        }
    });
    updateBy(datum, () => {
        const data = datum.last[0];
        console.log({ data });
        if (data) { // data.time timeLocalToStr_yyyymmdd_hhmmss_ms
            apiGrid.current?.api.applyTransactionAsync({
                add: [
                    {
                        ...data,
                        time: data.time
                    }
                ]
            });
        }
    });
    const Main = useCallback(() => {
        const columns = [
            {
                field: "time",
                sort: "desc",
                width: 50,
                valueFormatter: (e) => e.value.time ? timeLocalToStr_hhmmss(e.value.time) : e.value.time
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
        ];
        return _jsx("div", { className: "maxSize", children: _jsx(AgGridReact
            // className = "ag-theme-alpine-dark ag-theme-alpine2" // ag-theme-alpine-dark3
            , { 
                // className = "ag-theme-alpine-dark ag-theme-alpine2" // ag-theme-alpine-dark3
                suppressCellFocus: true, onGridReady: (a) => {
                    apiGrid.current = a; //as GridReadyEvent<tColum>
                    apiGrid.current.api.sizeColumnsToFit();
                    if (setting.params.minVarLogs) {
                        apiGrid.current.api.setFilterModel({
                            var: {
                                filterType: 'number',
                                type: 'greaterThanOrEqual',
                                filter: setting.params.minVarLogs
                            }
                        });
                    }
                }, onSortChanged: (e) => {
                }, defaultColDef: {
                    headerClass: () => ("gridTable-header"),
                    resizable: true,
                    cellStyle: { textAlign: "center" },
                    sortable: true,
                    filter: true,
                    wrapText: true,
                }, headerHeight: 30, rowHeight: 26, autoSizePadding: 1, rowData: rowData, columnDefs: columns, onCellMouseDown: (e) => {
                    // @ts-ignore
                    if (e.event?.button == 2) {
                        // copyToClipboard(e.value)
                        mouseMenuApi.map.set("sym", [
                            {
                                name: "copy", onClick: () => { copyToClipboard(e.value); }
                            }
                        ]);
                    }
                } }) });
    }, [true]);
    return _jsx(Main, {});
}
function Message({ logs }) {
    let red = (logs.var ?? 0) * 10;
    if (red > 255)
        red = 255;
    return _jsxs("div", { className: "testAnime", style: { width: "200px", color: "rgb(255,255,255)", height: "auto", marginTop: "10px", borderRight: "5px solid #5D9FFA", background: `rgb(${red},73,35)` }, children: [_jsx("p", { style: { textAlign: "center", fontSize: "10px", marginBottom: "1px" }, children: "оповещение" }), _jsx("hr", { style: {
                    backgroundImage: "linear-gradient(to right, transparent, rgba(255, 255, 255, 1), transparent)",
                    border: 0,
                    height: "1px",
                    margin: "0 0 0 0",
                    boxSizing: "content-box",
                    display: "block"
                } }), _jsx("div", { style: { textAlign: "right", marginRight: "10px", height: "auto", overflowWrap: "break-word", textOverflow: "ellipsis" }, children: typeof logs.txt == "object" ? JSON.stringify(logs.txt) : logs.txt }), _jsx("p", { style: { float: "inline-end", textAlign: "right", marginRight: "10px" }, children: (new Date()).toLocaleDateString() })] });
}
const tt = {};
let r = 0;
export function MessageEventLogs({ zIndex }) {
    let max = 8;
    const setting = staticGetAdd("settingLogs", settingLogs);
    updateBy(tt);
    updateBy(datumMiniConst, () => {
        const last = datumMiniConst.last[0];
        if (setting.params.minVarMessage && (!last.var || last.var < setting.params.minVarMessage))
            return;
        let key = String(r++);
        tt[key] = _jsx("div", { className: "example-exit", children: _jsx(Message, { logs: last }) }, key);
        setTimeout(() => {
            if (tt[key]) {
                delete tt[key];
                if (Object.values(tt).length < max)
                    renderBy(tt);
            }
        }, setting.params.timeShow ? setting.params.timeShow * 1000 : 2000);
        renderBy(tt);
    });
    const tr = [...Object.values(tt)].reverse().slice(0, 10);
    return _jsxs("div", { style: { maxHeight: "50vh", position: "absolute", right: "1px", zIndex }, children: [tr && _jsx("div", { onClick: () => { setting.params.show = !setting.params.show; renderBy(tt); }, style: { margin: 3, padding: 3, right: 0, position: "absolute", zIndex: 120,
                    ...setting.params.show ?
                        { background: "rgb(58,58,58)", fontSize: "25px" } :
                        { background: "rgb(144,60,60)" }
                }, children: setting.params.show ? "X" : "log" }), tr && _jsx("div", { children: setting.params.show ? [...Object.values(tt)].reverse().slice(0, 10) : null })] });
}
const defPageBase = {
    keyPage: "PageLogs"
};
const pages = [
    { name: "message", key: "PageLogs", page: PageLogs },
    { name: "setting", key: "InputSettingLogs", page: InputSettingLogs },
];
const map = Object.fromEntries(pages.map(e => [e.key, e.page]));
export function PageLogs2({ update }) {
    const datum = defPageBase;
    updateBy(datum);
    const Page = map[datum.keyPage];
    return _jsxs("div", { className: "maxSize", style: { display: "flex", flexDirection: "column" }, children: [_jsx("div", { style: { width: "100%" }, children: _jsx("div", { style: { display: "flex", justifyContent: "center" }, children: pages.map((e, i) => (_jsx("div", { onClick: (z) => {
                            datum.keyPage = e.key;
                            renderBy(datum);
                        }, className: datum.keyPage == e.key ? "msTradeAlt msTradeActive" : "msTradeAlt", children: e.name }, i))) }) }), _jsx("div", { className: "maxSize", children: Page && _jsx(Page, { update: update }, datum.keyPage) })] });
}
