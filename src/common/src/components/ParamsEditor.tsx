import React, {ReactElement, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {const_Date, deepCloneMutable, isDate, Params, TF, timeLocalToStr_yyyymmdd, timeLocalToStr_yyyymmdd_hhmm, timeLocalToStr_yyyymmdd_hhmmss, timeLocalToStr_yyyymmdd_hhmmss_ms} from "wenay-common2";
import {setResizeableElement, removeResizeableElement} from "./MyResizeObserver";
import {ParamRow, ParamToggleLabel} from "./Parameters";
import {setAutoStepForElement} from "../utils";

function timeToStr(time: number | string | const_Date, step?: number) {
    function getTimeStep(time: number) {
        return [TF.D1.msec, TF.M1.msec, TF.S1.msec, 1].find(period => time % period == 0)!;
    }
    let t = new Date(time.valueOf());
    step ??= getTimeStep(t.valueOf());
    return step % TF.D1.msec == 0 ? timeLocalToStr_yyyymmdd(t) : step % TF.M1.msec == 0 ? timeLocalToStr_yyyymmdd_hhmm(t) : timeLocalToStr_yyyymmdd_hhmmss(t);
}

function CButton({name, className, status: statusDef, header, onExpand, children}: {
    children: React.JSX.Element,
    name: (type: boolean) => React.JSX.Element,
    header?: React.ReactNode,
    className?: string,
    status?: boolean,
    onExpand?: (flag: boolean) => void
}) {
    const [status, setStatus] = useState(statusDef ?? false)
    return <>
        <div className={"toLine" + (className ? " " + className : "")}>
            <div style={{width: "100%"}} onClick={() => {
                let status2 = !status;
                setStatus(status2);
                onExpand?.(status2);
            }}>
                {name(status)}
            </div>
            {header}
        </div>
        {status && children}
    </>
}

// Hover wrapper: when the wrapper around children is hovered, focus state is exposed.
function DivHover({children, className, style}: {
    children: (hover: boolean) => ReactElement,
    className?: string,
    style?: React.CSSProperties
}) {
    const [hover, setHover] = useState(false)
    return <div
        className={className}
        style={style}
        onMouseLeave={() => {setHover(false)}}
        onMouseEnter={() => {setHover(true)}}
    >
        {children(hover)}
    </div>
}

function CheckBox(set: (data: boolean) => void, val: boolean, style?: React.CSSProperties) {
    return <input
        type="checkbox"
        style={{marginTop: "auto", marginBottom: "auto", ...style}}
        checked={val}
        onChange={(a: React.ChangeEvent<HTMLInputElement>) => {
            set(a.target.checked)
        }}
    />
}
function InputString(set: (data: string)=>void, val :string, style?: React.CSSProperties) {
    return <input
        type="text"
        style={{marginTop: "auto", marginBottom: "auto", ...style}}
        value={val}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            set(e.target.value)
        }}
    />
}
function InputTime(set: (data: string) => void, value: string | const_Date, range?: Params.UserTimeRange) {
    let {min, max} = range ?? {};
    const timeSplits = typeof value == "string" ? value.split(":").length : 2;
    const hasDot = typeof value == "string" ? value.includes(".") : false;
    const step = range?.step ?? (timeSplits <= 1 ? TF.D1.msec : timeSplits == 2 ? TF.M1.msec : hasDot ? 1 : TF.S1.msec);
    const normalizedValue = new Date(Math.floor(toNum(value) / step) * step);

    function toNum(val: string | const_Date): number;
    function toNum(val: string | const_Date | undefined): number | undefined;
    function toNum(val: string | const_Date | undefined) {
        return val ? new Date(val as (string | Date)).valueOf() : undefined;
    }

    function setVal(val: number) {
        let str = timeToStr(val, step);
        set(str);
    }

    function toInputStr(val: string | const_Date | undefined) {
        if (!val) return undefined;
        let val_ = val as (string|Date)
        let timeStr= step % TF.D1.msec ==0 ? timeLocalToStr_yyyymmdd(new Date(val_)) :
            step % TF.M1.msec ==0 ? timeLocalToStr_yyyymmdd_hhmm(new Date(val_)) :
                step % TF.S1.msec ==0 ? timeLocalToStr_yyyymmdd_hhmmss(new Date(val_)) : timeLocalToStr_yyyymmdd_hhmmss_ms(new Date(val_));
        return timeStr.replace(" ", "T");
    }
    let _ref: HTMLInputElement | null = null;
    return <>
        <input type="range"
               min={toNum(range?.defaultMin ?? range?.min ?? "2015-01-01")}
               max={toNum(range?.defaultMax ?? range?.max ?? new Date())}
               step={range?.defaultStep ?? step}
               value={toNum(value) ?? ""}
               onInput={(e: React.FormEvent<HTMLInputElement>) => {
                   setVal(Number(e.currentTarget.value));
               }}
               ref={(ref) => {
                   if (ref) {
                       setResizeableElement(ref); return () => removeResizeableElement(ref);
                   }
               }}
        />
        <div>
            <input type={step % TF.D1.msec == 0 ? "date" : "datetime-local"}
                   style={{width: "calc(100% - 13px)", marginTop: 5}}
                   onInput={(e: React.FormEvent<HTMLInputElement>) => {
                       set(e.currentTarget.value);
                   }}
                   min={toInputStr(min)}
                   max={toInputStr(max)}
                   step={step % TF.D1.msec == 0 ? step / TF.D1.msec : step / TF.S1.msec}
                   value={toInputStr(normalizedValue)}
                   onMouseEnter={() => {
                       _ref?.focus();
                   }}
                   onMouseLeave={() => {
                       _ref?.blur()
                   }}
            />
        </div>
        <input required className="toNumberInput inputCan"
               type="number"
               style={{width: 18, marginLeft: -13, marginRight: 0}}
               min={toNum(min)}
               max={toNum(max)}
               step={step}
               value={toNum(value) ?? ""}
               onInput={(e: React.FormEvent<HTMLInputElement>) => {
                   setVal(Number(e.currentTarget.value));
               }}
               ref={(ref) => {
                   if (ref) {
                       _ref = ref;
                   }
               }}
        />
    </>
}
function InputList<T extends number | string | boolean | const_Date>(set: (data: T) => void, value: T, range: readonly T[], rangeLabels?: readonly string[]) {
    function toType(val: string, type: string) {
        return type == "number" ? Number(val) : type == "boolean" ? Boolean(val) : String(val);
    }

    function convertType(val: string) {
        return (value instanceof Date ? new Date(val) : toType(val, typeof value)) as T;
    }

    //return null;
    function toString(val: T) {
        return val instanceof Date ? timeToStr(val) : String(val);
    }

    return <select
        style={{width: "180px", marginTop: "auto", marginBottom: "auto", paddingTop: 5, paddingBottom: 5}}
        value={toString(value)}
        onChange={(select) => {
            set(convertType(select.target.value));
        }}
        ref={(ref) => {
            if (ref) {
                setResizeableElement(ref); return () => removeResizeableElement(ref);
            }
        }}>
        {
            range.map((a, i) => {
                return <option
                    key={toString(a)}
                    value={toString(a)}
                    label={rangeLabels?.at(i) ?? toString(a)}
                >{toString(a)}</option>
            })
        }
    </select>
}

const _inputNumStrMap = new WeakMap<Readonly<Params.UserNumRange>, { min: string, max: string, step: string, val: string, value: number }>();
function InputNumber(set: (data: number)=>void, value: number, range: Readonly<Params.UserNumRange>) {
    const data = _inputNumStrMap.get(range);
    let {min, max, step, val} =
        (data?.value == value)
            ? data
            : {min: range.min, max: range.max, step: range.defaultStep ?? range.step, val: value};
    _inputNumStrMap.delete(range);

    let _ref: HTMLInputElement | null;
    return <>
        <input type="range"
               min={range.defaultMin ?? range.min}
               max={range.defaultMax ?? range.max}
               step={range.defaultStep ?? range.step}
               value={String(value)}
               onInput={(e: React.FormEvent<HTMLInputElement>) => {
                   set(Number(e.currentTarget.value));
                   if (_ref) _ref.step = e.currentTarget.step;
               }}
               ref={(ref) => {
                   if (ref) {
                       setResizeableElement(ref); return () => removeResizeableElement(ref);
                   }
               }}
        />
        <input required className="toNumberInput inputCan"
               type="number"
               min={min}
               max={max}
               step={step}
               value={val}
               onInput={(e: React.FormEvent<HTMLInputElement>) => {
                   const target = e.currentTarget;
                   let value2 = target.value != "" ? Number(target.value) : value;
                   _inputNumStrMap.set(range, {
                       val: target.value,
                       min: target.min,
                       max: target.max,
                       step: target.step,
                       value: value2
                   });
                   if (target.value != "") set(Number(target.value)); else {
                       target.reportValidity();
                   }
               }}
               ref={(ref) => {
                   if (ref) {
                       _ref = ref;
                       ref.step = step + "";
                       setAutoStepForElement(ref, {minStep: range.step});
                   }
               }}
        />
    </>
}

function InputListArray(set: (data: number[]) => void, values: readonly number[], range: readonly number[], rangeLabels?: readonly string[]): React.JSX.Element;
function InputListArray(set: (data: string[]) => void, values: readonly string[], range: readonly string[], rangeLabels?: readonly string[]): React.JSX.Element;
function InputListArray(set: (data: number[] | string[]) => void, values: Readonly<number[] | string[]>, range: Readonly<number[] | string[]>, rangeLabels?: readonly string[]): React.JSX.Element;
function InputListArray<T extends number | string>(set: (data: T[]) => void, values: readonly T[], range: readonly T[], rangeLabels?: readonly string[]) {
    function toType(val: string, type: string) {
        return type == "number" ? Number(val) : String(val);
    }//type=="string" ? String(val) : Boolean(val); }
    function convertType(val: string) {
        return toType(val, typeof values[0]) as typeof values[0];
    }

    return <select style={{width: "180px", resize: "vertical"}}
                   value={values.map((a) => String(a))}
                   onChange={(select) => {
                       let values: T[] = [];
                       for (let option of Array.from(select.target.options))
                           if (option.selected) values.push(convertType(option.value));
                       set(values);
                   }}
                   multiple={true}
                   ref={(ref) => {
                       if (ref) {
                           setResizeableElement(ref); return () => removeResizeableElement(ref);
                       }
                   }}>
        {
            range.map((a, i) => {
                return <option
                    key={String(a)}
                    value={String(a)}
                    label={rangeLabels?.at(i) ?? String(a)}
                >{a}</option>
            })
        }
    </select>
}
export type ParamsEditorControllerOptions<TParams extends Params.IParamsExpandableReadonly = Params.IParamsExpandableReadonly> = {
    params: TParams,
    onChange: (params: TParams) => void,
    onExpand?: (params: TParams) => void
};

export type ParamsEditorController<TParams extends Params.IParamsExpandableReadonly = Params.IParamsExpandableReadonly> = {
    paramsRef: React.MutableRefObject<TParams>;
    params: TParams;
    refresh(): void;
    notifyChange(): void;
    notifyChangeDelayed(): void;
    notifyExpand(): void;
};

export function useParamsEditorController<TParams extends Params.IParamsExpandableReadonly = Params.IParamsExpandableReadonly>({
                                                                                                             params,
                                                                                                             onChange,
                                                                                                             onExpand
                                                                                                         }: ParamsEditorControllerOptions<TParams>): ParamsEditorController<TParams> {
    const [, setUpdate] = useState(0);
    const cloned = useMemo(() => deepCloneMutable(params), [params]) as TParams;
    const paramsRef = useRef<TParams>(cloned);
    if (paramsRef.current !== cloned) paramsRef.current = cloned;

    const callbacks = useRef({onChange, onExpand});
    callbacks.current = {onChange, onExpand};
    const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (timeoutId.current != null) clearTimeout(timeoutId.current);
    }, []);

    const refresh = useCallback(() => {
        setUpdate(e => e + 1);
    }, []);

    const notifyChange = useCallback(() => {
        callbacks.current.onChange(paramsRef.current);
    }, []);

    const notifyChangeDelayed = useCallback(() => {
        if (timeoutId.current != null) clearTimeout(timeoutId.current);
        timeoutId.current = setTimeout(() => {
            notifyChange();
        }, 200);
    }, [notifyChange]);

    const notifyExpand = useCallback(() => {
        callbacks.current.onExpand?.(paramsRef.current);
    }, []);

    return {
        paramsRef,
        params: paramsRef.current,
        refresh,
        notifyChange,
        notifyChangeDelayed,
        notifyExpand,
    };
}
export function ParamsEditor<TParams extends Params.IParamsExpandableReadonly = Params.IParamsExpandableReadonly>(data : {
    params: TParams,
    expandStatus?: boolean,
    expandStatusLvl?: number,
    onChange: (params: TParams) => void,  // when a value changes
    onExpand?: (params: TParams) => void  // when expanded
}) {
    // callbacks live in a ref: useMemo below intentionally freezes the element until
    // params identity changes, and would otherwise freeze a stale onChange/onExpand with it
    const callbacks = useRef({onChange: data.onChange, onExpand: data.onExpand});
    callbacks.current = {onChange: data.onChange, onExpand: data.onExpand};
    const result = useMemo(() => {
        return <ParamsEditorBase params={data.params}
                                    onChange={(p) => callbacks.current.onChange(p)}
                                    onExpand={(p) => callbacks.current.onExpand?.(p)}
                                    expandStatus={data.expandStatus} expandStatusLvl={data.expandStatusLvl}/>
    }, [data.params]);
    return result
}
function ParamsEditorBase<TParams extends Params.IParamsExpandableReadonly = Params.IParamsExpandableReadonly>(data : {
    params: TParams,
    expandStatus?: boolean,
    expandStatusLvl?: number,
    onChange: (params: TParams) => void,  // when a value changes
    onExpand?: (params: TParams) => void  // when expanded
}) {
    const controller = useParamsEditorController(data);
    const myParams = controller.paramsRef;
    function Refresh() {controller.refresh()}
    const styleColorDisable = "rgb(146,146,146)";
    function refreshIndicator() {
        controller.notifyChange();
    }

    function refreshIndicatorDelayed() {
        controller.notifyChangeDelayed();
    }

    function Param( //<T extends boolean|number|string|const_Date>(
        set: (data: boolean|number|string|const_Date) => void,
        val: boolean|number|string|const_Date,
        type?: string|undefined,
        range?: Readonly< Params.UserNumRange | Params.UserTimeRange | number[] | string[] | const_Date[] >,
        labels?: readonly string[])
    {
        if (typeof(val)=="boolean") return CheckBox(set, val);
        if (Array.isArray(range)) return InputList(set, val, range, labels);
        if (typeof(val)=="number" && range) return InputNumber(set, val, range as Params.UserNumRange);
        if ((typeof(val)=="string" && type=="time") || val instanceof Date) return InputTime(set, val, range as Params.UserTimeRange);
        if (typeof(val)=="string") return InputString(set, val);
        return null;
    }

    function onSetValueA(param: Params.IParam, value: unknown, enabled: boolean | undefined) {
        Refresh();
        if (enabled)
            if (typeof value == "number" || value instanceof Date || (value instanceof Array && (typeof value[0] == "number" || value[0] instanceof Date)))
                refreshIndicatorDelayed();  // process with delay
            else refreshIndicator();  // process without delay
    }

    function onExpandA(param: Params.IParam, flag: boolean) {
        controller.notifyExpand();
    }

    function ListParams(obj: Params.IParamsExpandable, parentEnabled: boolean | undefined = true, expandLevel: number = 0) {
        return Object.entries(obj).map(([key, param]: [string, Params.IParamExpandable]) => {
            // Indicator parameter changes
            const onSetValue = (value: unknown, currentEnabled = true) => {
                onSetValueA(param, value, parentEnabled && currentEnabled)
            }

            if (!Array.isArray(obj))
                if (typeof(param)=="boolean" || typeof(param)=="string") {
                    const set = (data: boolean | number | string | const_Date) => {
                        obj[key] = data as boolean | string; // this branch only renders boolean/string params
                        onSetValue(data);
                    }
                    return <ParamRow key={key + "#"+typeof(param)} name={key} enabled={parentEnabled}>
                        {
                            Param(set, param)
                        }
                    </ParamRow>
                }

            if (typeof(param)=="function") {
                return null;
            } else
            if (typeof(param)=="object") {
                if (param.hidden) return null;
                const {value, range, name = key, enabled} = param;
                const nameButton = (type: boolean) => ParamToggleLabel(type, name)
                const nameT = <p className={"toPTextIndicator"}>{name}</p>

                const set = (a: typeof value) => {
                    const aa = param.value instanceof Date ? new Date(a as any) : a;
                    param.value = aa;
                    onSetValue(aa, param.enabled ?? true);
                }

                const onExpand = (flag: boolean) => {
                    param.expanded = flag;
                    onExpandA(param, flag);
                }

                const expanded = param.expanded ?? (data.expandStatus || (expandLevel > 0));

                const simpleParameter = (element: React.JSX.Element | null) => {
                    if (!element) return null;
                    return <ParamRow key={key + "a1"} name={nameT} enabled={parentEnabled && enabled != false} commentary={param.commentary}>
                        {element}
                        {enabled != null ?
                            CheckBox(
                                (flag: boolean) => {
                                    param.enabled = flag;
                                    onSetValue(flag);
                                },
                                enabled,
                            )
                            : undefined
                        }
                    </ParamRow>
                }
                const nestedMarginLeft = 20;


                // @ts-ignore
                if (isDate(value)) {
                    param.type = "time";
                }
                else if (typeof(value)=="object") {
                    let type= param.type;
                    const enableHTML =
                        enabled != undefined ?
                            <div className="miniEl" style={{color: enabled ? "inherit" : styleColorDisable}}
                                 onClick={() => {
                                     param.enabled = !enabled;
                                     onSetValue(value);
                                 }}>
                                {param.enabled ? "ON " : "OFF"}
                            </div>
                            : null;

                    // If there are nested parameters, recurse with an offset.
                    if (!Array.isArray(value)) {

                        const enabledD = enabled != false && parentEnabled != false;

                        const list = ListParams(value, enabledD, expandLevel - 1);
                        return <CButton key={key + "#other"} className="toIndicatorMenuButton" name={nameButton}
                                        header={enableHTML}
                                        status={expanded} onExpand={onExpand}>
                            <div key={key + "##other"}
                                 className=""
                                 style={{
                                     paddingLeft: nestedMarginLeft,
                                     color: enabledD ? "inherit" : styleColorDisable
                                 }}
                            >{list}</div>
                        </CButton>
                    }
                    if (Array.isArray(value)) {
                        let arr = value;
                        if (Array.isArray(range)) {  // render a dropdown list
                            if (typeof arr[0] == "boolean") throw "boolean range is not supported!";
                            let arr2 = arr as Exclude<typeof value, boolean[]>;

                            function timeToStrings(data: typeof arr2) {
                                return data.map(item => item instanceof Date ? timeToStr(item) : item) as Exclude<typeof data, const_Date[]>
                            }

                            let arr3 = timeToStrings(arr2);
                            return simpleParameter(InputListArray(set, arr3, timeToStrings(range), (param as Params.IParamEnum).labels));
                        }
                        if (! type) {
                            const itemType= typeof(arr[0] ?? range?.min ?? range?.defaultMin);
                            if (itemType=="number" || itemType=="string" || itemType=="boolean")
                                type= itemType;
                        }
                        const elements = arr.map((itemVal, index: number, array) => {
                                // Render and add array elements.
                                const name_ = name + " #" + String(index + 1);
                                const nameElement = <div key={name_ + "#$3"}>{name_}</div>;
                                const enabledElements= Array.isArray(param.elementsEnabled) ? param.elementsEnabled : undefined;
                                const onHoverElement = <div style={{marginLeft: -18, marginTop: -7}}>
                                    <div className={"toButtonEasy"} style={{width: "15px", fontSize: "medium", marginRight: 3}}
                                         onClick={() => {
                                             (array as (typeof itemVal)[]).splice(index, 0, itemVal);
                                             enabledElements?.splice(index, 0, enabledElements[index]);
                                             set(array);
                                         }}
                                    >{"+"}</div>
                                    <div className={"toButtonEasy"} style={{width: "15px", fontSize: "medium"}}
                                         onClick={(e) => {
                                             array.splice(index, 1);
                                             enabledElements?.splice(index, 1);
                                             set(array);
                                         }}
                                    >{"–"}</div>
                                </div>

                                function onSet(data: typeof itemVal) {
                                    (array as (typeof itemVal)[]).splice(index, 1, data);
                                    set(array);
                                }
                                const paramL = (hover: boolean) =>
                                    <ParamRow name={<>{hover && !param.constLength && onHoverElement}{nameElement}</>} commentary={param.commentary}>
                                        {
                                            Param(onSet, itemVal, type, range, (param as Params.IParamEnum).labels)
                                        }
                                        {param.elementsEnabled != null ?
                                            CheckBox(
                                                (flag: boolean) => {
                                                    if (! Array.isArray(param.elementsEnabled))
                                                        param.elementsEnabled= new Array<boolean>(array.length).fill(param.elementsEnabled==true);
                                                    param.elementsEnabled[index]= flag;
                                                    onSetValue(value, enabled && flag);
                                                },
                                                Array.isArray(param.elementsEnabled) ? param.elementsEnabled[index] : param.elementsEnabled,
                                            )
                                            : undefined
                                        }
                                    </ParamRow>
                                return <DivHover key={name_ + "#$"}>{(hover) => paramL(hover)}</DivHover>
                            }
                        );
                        return <CButton key={key + "#$"} className="toIndicatorMenuButton" name={nameButton}
                                        status={expanded} header={enableHTML} onExpand={onExpand}>
                            <div className="" style={{overflow: "hidden", paddingLeft: nestedMarginLeft}}>
                                <div style={{animation: "0.1s ease 0s 1 normal none running moveDown"}}>
                                    <div className="" style={{color: "inherit"}}>{elements}
                                    </div>
                                    {
                                        !param.constLength &&
                                        <div className={"toButtonEasy"}
                                             style={{paddingLeft: 10, textAlign: "left" /*width: "255px"*/}}
                                             onClick={() => {
                                                 let element = arr.at(-1);
                                                 element ??= Array.isArray(param.range) ? param.range[0] : param.range ? param.range.min :
                                                     type=="boolean" ? false : type=="string" ? "" : (()=>{throw "unknown array param type: "+type})();
                                                 (arr as any[]).push(element);
                                                 set(arr);
                                             }}
                                        >{" ......add new element"}
                                        </div>
                                    }
                                </div>
                            </div>
                        </CButton>;
                    }
                }
                return simpleParameter(Param(set, value, undefined, range, (param as Params.IParamEnum).labels));
            }
            return null;
        })
    }

    return <>{ListParams(myParams.current as unknown as Params.IParamsExpandable, undefined, data.expandStatusLvl).filter((el) => el != null)}</>;
}