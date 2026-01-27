import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { deepCloneMutable, isDate, TF, timeLocalToStr_yyyymmdd, timeLocalToStr_yyyymmdd_hhmm, timeLocalToStr_yyyymmdd_hhmmss, timeLocalToStr_yyyymmdd_hhmmss_ms } from "wenay-common";
import { setResizeableElement } from "./MyResizeObserver";
import { SetAutoStepForElement } from "./inputAutoStep";
import { CParameter, FNameButton } from "./Parameters";
function timeToStr(time, step) {
    function getTimeStep(time) {
        return [TF.D1.msec, TF.M1.msec, TF.S1.msec, 1].find(period => time % period == 0);
    }
    let t = new Date(time.valueOf());
    step ??= getTimeStep(t.valueOf());
    return step % TF.D1.msec == 0 ? timeLocalToStr_yyyymmdd(t) : step % TF.M1.msec == 0 ? timeLocalToStr_yyyymmdd_hhmm(t) : timeLocalToStr_yyyymmdd_hhmmss(t);
}
function CButton({ name, className, status: statusDef, header, onExpand, children }) {
    const [status, setStatus] = useState(statusDef ?? false);
    return _jsxs(_Fragment, { children: [_jsxs("div", { className: "toLine" + (className ? " " + className : ""), children: [_jsx("div", { style: { width: "100%" }, onClick: () => {
                            let status2 = !status;
                            setStatus(status2);
                            onExpand?.(status2);
                        }, children: name(status) }), header] }), status && children] });
}
//класс наведение на объект, если на вели на оболочку над children то появиться onFocusUp/focusDw
function DivHover({ children, className, style }) {
    const [hover, setHover] = useState(false);
    return _jsx("div", { className: className, style: style, onMouseLeave: () => { setHover(false); }, onMouseEnter: () => { setHover(true); }, children: children(hover) });
}
function CheckBox(set, val, style) {
    return _jsx("input", { type: "checkbox", style: { marginTop: "auto", marginBottom: "auto", ...style }, checked: val, onChange: (a) => {
            set(a.currentTarget.checked);
        } });
}
function InputString(set, val, style) {
    return _jsx("input", { type: "text", style: { marginTop: "auto", marginBottom: "auto", ...style }, value: val, onChange: (e) => {
            set(e.currentTarget.value);
        } });
}
function InputTime(set, value, range) {
    //const data= this._inputNumStrMap.get(range);
    //let val= value;
    //if (1) return null;
    let { min, max } = range ?? {};
    // (data?.value==value)
    //     ? data
    //     : { min: range.min, max: range.max, step: range.defaultStep??range.step, val: value };
    //this._inputNumStrMap.delete(range);
    const timeSplits = typeof value == "string" ? value.split(":").length : 2;
    const hasDot = typeof value == "string" ? value.includes(".") : false;
    const step = range?.step ?? (timeSplits <= 1 ? TF.D1.msec : timeSplits == 2 ? TF.M1.msec : hasDot ? 1 : TF.S1.msec);
    const normalizedValue = new Date(Math.floor(toNum(value) / step) * step);
    function toNum(val) {
        return val ? new Date(val).valueOf() : undefined;
    }
    function setVal(val) {
        let str = timeToStr(val, step);
        set(str);
    }
    function toInputStr(val) {
        if (!val)
            return undefined;
        let val_ = val;
        let timeStr = step % TF.D1.msec == 0 ? timeLocalToStr_yyyymmdd(new Date(val_)) :
            step % TF.M1.msec == 0 ? timeLocalToStr_yyyymmdd_hhmm(new Date(val_)) :
                step % TF.S1.msec == 0 ? timeLocalToStr_yyyymmdd_hhmmss(new Date(val_)) : timeLocalToStr_yyyymmdd_hhmmss_ms(new Date(val_));
        return timeStr.replace(" ", "T");
    }
    //function toInputVal(val: string | const_Date | undefined) { return val ? new Date(val).valueOf() : undefined; }
    //const inputType : React.InputHTMLAttributes.type = ;
    let _ref = null;
    return _jsxs(_Fragment, { children: [_jsx("input", { type: "range", min: toNum(range?.defaultMin ?? range?.min ?? "2015.01.01"), max: toNum(range?.defaultMax ?? range?.max ?? new Date().toString()), step: range?.defaultStep ?? step, value: toNum(value), onInput: (e) => {
                    setVal(Number(e.currentTarget.value));
                }, ref: (ref) => {
                    if (ref) {
                        setResizeableElement(ref);
                    }
                } }), _jsx("div", { children: _jsx("input", { type: step % TF.D1.msec == 0 ? "date" : "datetime-local", style: { width: "calc(100% - 13px)", marginTop: 5 }, onInput: (e) => {
                        set(e.currentTarget.value);
                    }, min: toInputStr(min), max: toInputStr(max), step: step % TF.D1.msec == 0 ? step / TF.D1.msec : step / TF.S1.msec, value: toInputStr(normalizedValue), 
                    //onMouseOver={()=>{ console.log("over"); _ref?.dispatchEvent(new MouseEvent("mouseenter", { 'bubbles': true }));  _ref?.dispatchEvent(new MouseEvent("mouseover", { 'bubbles': true }))}}
                    onMouseEnter: () => {
                        _ref?.focus();
                    }, onMouseLeave: () => {
                        _ref?.blur();
                    } }) }), _jsx("input", { required: true, className: "toNumberInput inputCan", type: "number", style: { width: 18, marginLeft: -13, marginRight: 0 }, min: toNum(min), max: toNum(max), step: step, value: toNum(value), onInput: (e) => {
                    //console.log("value:",toNum(value),"->",e.currentTarget.value);
                    //<input type="number" value={this.vvv ?? 99} onInput={(e)=>{console.log(this.vvv= e.currentTarget.value); this.Refresh(); }}/>
                    const target = e.currentTarget;
                    setVal(Number(target.value));
                }, 
                //onMouseEnter={()=>console.log("!!!", deepClone(_ref?.classList))}
                ref: (ref) => {
                    if (ref) {
                        _ref = ref;
                    }
                } })] });
}
function InputList(set, value, range, rangeLabels) {
    function toType(val, type) {
        return type == "number" ? Number(val) : type == "boolean" ? Boolean(val) : String(val);
    }
    function convertType(val) {
        return (value instanceof Date ? new Date(val) : toType(val, typeof value));
    }
    //return null;
    function toString(val) {
        return val instanceof Date ? timeToStr(val) : String(val);
    }
    return _jsx("select", { style: { width: "180px", marginTop: "auto", marginBottom: "auto", paddingTop: 5, paddingBottom: 5 }, value: toString(value), onChange: (select) => {
            set(convertType(select.target.value));
        }, ref: (ref) => {
            if (ref) {
                setResizeableElement(ref);
            }
        }, children: range.map((a, i) => {
            return _jsx("option", { value: toString(a), label: rangeLabels?.at(i) ?? toString(a), children: toString(a) }, toString(a));
        }) });
}
const _inputNumStrMap = new WeakMap();
function InputNumber(set, value, range) {
    //if (1) return null;
    const data = _inputNumStrMap.get(range);
    //let val= value;
    let { min, max, step, val } = (data?.value == value)
        ? data
        : { min: range.min, max: range.max, step: range.defaultStep ?? range.step, val: value };
    _inputNumStrMap.delete(range);
    let _ref;
    return _jsxs(_Fragment, { children: [_jsx("input", { type: "range", min: range.defaultMin ?? range.min, max: range.defaultMax ?? range.max, step: range.defaultStep ?? range.step, value: String(value), onInput: (e) => {
                    set(Number(e.currentTarget.value));
                    if (_ref)
                        _ref.step = e.currentTarget.step;
                }, ref: (ref) => {
                    if (ref) {
                        setResizeableElement(ref);
                    }
                } }), _jsx("input", { required: true, className: "toNumberInput inputCan", type: "number", min: min, max: max, step: step, value: val, onInput: (e) => {
                    const target = e.currentTarget;
                    let value2 = target.value != "" ? Number(target.value) : value;
                    //if (target.value=="") console.log(value, range);
                    _inputNumStrMap.set(range, {
                        val: target.value,
                        min: target.min,
                        max: target.max,
                        step: target.step,
                        value: value2
                    });
                    if (target.value != "")
                        set(Number(target.value));
                    else {
                        target.reportValidity();
                        // this.Refresh();
                    }
                }, 
                //onBlur={ (a)=>{ console.log("blur"); if (! a.currentTarget.checkValidity()) set(Number(a.currentTarget.value)); } }
                ref: (ref) => {
                    if (ref) {
                        _ref = ref;
                        ref.step = step + "";
                        SetAutoStepForElement(ref, { minStep: range.step });
                    }
                } })] });
}
function InputListArray(set, values, range, rangeLabels) {
    function toType(val, type) {
        return type == "number" ? Number(val) : String(val);
    } //type=="string" ? String(val) : Boolean(val); }
    function convertType(val) {
        return toType(val, typeof values[0]);
    }
    return _jsx("select", { style: { width: "180px", resize: "vertical" }, value: values.map((a) => String(a)), onChange: (select) => {
            let values = [];
            for (let option of Array.from(select.target.options))
                if (option.selected)
                    values.push(convertType(option.value));
            set(values);
        }, multiple: true, ref: (ref) => {
            if (ref) {
                setResizeableElement(ref);
            }
        }, children: range.map((a, i) => {
            return _jsx("option", { value: String(a), label: rangeLabels?.at(i) ?? String(a), children: a }, String(a));
        }) });
}
export function ParametersReact(data) {
    const params = useRef(null);
    const result = useMemo(() => {
        params.current = data.params;
        return _jsx(ParametersBaseReact, { params: data.params, onChange: data.onChange, onExpand: data.onExpand, expandStatus: data.expandStatus, expandStatusLvl: data.expandStatusLvl });
    }, [data.params]);
    return result;
}
function ParametersBaseReact(data) {
    const [_, setUpdate] = useState(0);
    function Refresh() { setUpdate(e => ++e); }
    const styleColorDisable = "rgb(146,146,146)";
    const p = useMemo(() => deepCloneMutable(data.params), [data.params]);
    const myParams = useRef(p);
    useEffect(() => {
        myParams.current = p;
        Refresh();
    }, [p]);
    let timeoutId = null;
    function refreshIndicator() {
        data.onChange(myParams.current);
    }
    function refreshIndicatorDelayed() {
        if (timeoutId != null)
            clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            refreshIndicator();
        }, 200);
    }
    function Param(//<T extends boolean|number|string|const_Date>(
    set, val, type, range, labels) {
        if (typeof (val) == "boolean")
            return CheckBox(set, val);
        if (Array.isArray(range))
            return InputList(set, val, range, labels);
        if (typeof (val) == "number" && range)
            return InputNumber(set, val, range);
        if ((typeof (val) == "string" && type == "time") || val instanceof Date)
            return InputTime(set, val, range);
        if (typeof (val) == "string")
            return InputString(set, val);
        return null;
    }
    function onSetValueA(param, value, enabled) {
        Refresh();
        if (enabled)
            if (typeof value == "number" || value instanceof Date || (value instanceof Array && (typeof value[0] == "number" || value[0] instanceof Date)))
                refreshIndicatorDelayed(); // обрабатываем с задержкой
            else
                refreshIndicator(); // обрабатываем без задержки
        //SessionSave();
    }
    function onExpandA(param, flag) {
        data.onExpand?.(myParams.current);
    }
    function ListParams(obj, parentEnabled = true, expandLevel = 0) {
        return Object.entries(obj).map(([key, param]) => {
            //изменения параметров индикатора
            const onSetValue = (value, currentEnabled = true) => {
                onSetValueA(param, value, parentEnabled && currentEnabled);
            };
            if (!Array.isArray(obj))
                if (typeof (param) == "boolean" || typeof (param) == "string") {
                    const set = (data) => {
                        obj[key] = data;
                        onSetValue(data);
                    };
                    return _jsx(CParameter, { name: key, enabled: parentEnabled, children: Param(set, param) }, key + "#" + typeof (param));
                }
            if (typeof (param) == "function") {
                return null;
            }
            else if (typeof (param) == "object") {
                if (param.hidden)
                    return null;
                const { value, range, name = key, enabled } = param;
                const nameButton = (type) => FNameButton(type, name);
                const nameT = _jsx("p", { className: "toPTextIndicator", children: name });
                const set = (a) => {
                    //if (typeof a=="boolean") {a=!value;}
                    const aa = param.value instanceof Date ? new Date(a) : a;
                    param.value = aa;
                    onSetValue(aa, param.enabled ?? true);
                };
                const onExpand = (flag) => {
                    param.expanded = flag;
                    onExpandA(param, flag);
                };
                const expanded = param.expanded ?? (data.expandStatus || (expandLevel > 0));
                const simpleParameter = (element) => {
                    if (!element)
                        return null;
                    return _jsxs(CParameter, { name: nameT, enabled: parentEnabled && enabled != false, commentary: param.commentary, children: [element, enabled != null ?
                                CheckBox((flag) => {
                                    param.enabled = flag;
                                    onSetValue(flag);
                                }, enabled)
                                : undefined] }, key + "a1");
                };
                const nestedMarginLeft = 20;
                // @ts-ignore
                if (isDate(value)) {
                    param.type = "time";
                }
                else if (typeof (value) == "object") {
                    let type = param.type;
                    const enableHTML = enabled != undefined ?
                        _jsx("div", { className: "miniEl", style: { color: enabled ? "inherit" : styleColorDisable }, onClick: () => {
                                param.enabled = !enabled;
                                onSetValue(value);
                            }, children: param.enabled ? "ON " : "OFF" })
                        : null;
                    // если есть вложение, то делам рекурсию со сдвигом
                    if (!Array.isArray(value)) {
                        const enabledD = enabled != false && parentEnabled != false;
                        const list = ListParams(value, enabledD, expandLevel - 1);
                        return _jsx(CButton, { className: "toIndicatorMenuButton", name: nameButton, header: enableHTML, status: expanded, onExpand: onExpand, children: _jsx("div", { className: "", style: {
                                    paddingLeft: nestedMarginLeft,
                                    color: enabledD ? "inherit" : styleColorDisable
                                }, children: list }, key + "##other") }, key + "#other");
                    }
                    if (Array.isArray(value)) {
                        let arr = value;
                        if (Array.isArray(range)) { // значит рисуем выпадающий список
                            if (typeof arr[0] == "boolean")
                                throw "boolean range is not supported!";
                            let arr2 = arr;
                            function timeToStrings(data) {
                                return data.map(item => item instanceof Date ? timeToStr(item) : item);
                            }
                            let arr3 = timeToStrings(arr2);
                            return simpleParameter(InputListArray(set, arr3, timeToStrings(range), param.labels));
                        }
                        if (!type) {
                            const itemType = typeof (arr[0] ?? range?.min ?? range?.defaultMin);
                            if (itemType == "number" || itemType == "string" || itemType == "boolean")
                                type = itemType;
                        }
                        const elements = arr.map((itemVal, index, array) => {
                            //работа с массивом отображения и добавления
                            const name_ = name + " #" + String(index + 1);
                            const nameElement = _jsx("div", { children: name_ }, name_ + "#$3");
                            const enabledElements = Array.isArray(param.elementsEnabled) ? param.elementsEnabled : undefined;
                            //const onHoverElement = <div style={{position: "absolute", left: -30, top: 0, display: "flex"}}>
                            const onHoverElement = _jsxs("div", { style: { marginLeft: -18, marginTop: -7 }, children: [_jsx("div", { className: "toButtonEasy", style: { width: "15px", fontSize: "medium", marginRight: 3 }, onClick: () => {
                                            array.splice(index, 0, itemVal);
                                            enabledElements?.splice(index, 0, enabledElements[index]);
                                            set(array);
                                        }, children: "+" }), _jsx("div", { className: "toButtonEasy", style: { width: "15px", fontSize: "medium" }, onClick: (e) => {
                                            array.splice(index, 1);
                                            enabledElements?.splice(index, 1);
                                            set(array);
                                        }, children: "–" })] });
                            function onSet(data) {
                                array.splice(index, 1, data);
                                set(array);
                            }
                            const paramL = (hover) => _jsxs(CParameter, { name: _jsxs(_Fragment, { children: [hover && !param.constLength && onHoverElement, nameElement] }), commentary: param.commentary, children: [Param(onSet, itemVal, type, range, param.labels), param.elementsEnabled != null ?
                                        CheckBox((flag) => {
                                            if (!Array.isArray(param.elementsEnabled))
                                                param.elementsEnabled = new Array(array.length).fill(param.elementsEnabled == true);
                                            param.elementsEnabled[index] = flag;
                                            onSetValue(value, enabled && flag);
                                        }, Array.isArray(param.elementsEnabled) ? param.elementsEnabled[index] : param.elementsEnabled)
                                        : undefined] });
                            return _jsx(DivHover, { children: (hover) => paramL(hover) }, name_ + "#$");
                        });
                        return _jsx(CButton, { className: "toIndicatorMenuButton", name: nameButton, status: expanded, header: enableHTML, onExpand: onExpand, children: _jsx("div", { className: "", style: { overflow: "hidden", paddingLeft: nestedMarginLeft }, children: _jsxs("div", { style: { animation: "0.1s ease 0s 1 normal none running moveDown" }, children: [_jsx("div", { className: "", style: {
                                                //marginLeft: widthStr,
                                                //width: "calc(100%-" + widthStr + ")",
                                                color: "inherit"
                                            }, children: elements }), !param.constLength &&
                                            _jsx("div", { className: "toButtonEasy", style: { paddingLeft: 10, textAlign: "left" /*width: "255px"*/ }, onClick: () => {
                                                    let element = arr.at(-1);
                                                    element ??= Array.isArray(param.range) ? param.range[0] : param.range ? param.range.min :
                                                        type == "boolean" ? false : type == "string" ? "" : (() => { throw "unknown array param type: " + type; })();
                                                    arr.push(element);
                                                    set(arr);
                                                }, children: " ......add new element" })] }) }) }, key + "#$");
                    }
                }
                {
                    return simpleParameter(Param(set, value, undefined, range, param.labels));
                }
            }
            return null;
        });
    }
    return _jsx(_Fragment, { children: ListParams(myParams.current, undefined, data.expandStatusLvl).filter((el) => el != null) });
}
