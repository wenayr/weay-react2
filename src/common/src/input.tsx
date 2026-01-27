import React, {useRef} from "react";
import {DivRnd3} from "./RNDFunc3";
import {DivOutsideClick, useOutside} from "./commonFuncReact";

export function InputPage({callback, name = "", txt =""}: {callback: (txt: string)=>void, name?: string, txt?: string}) {
    const txtName = useRef(txt)
    return <div className={"maxSize"} style={{padding: 20,}}>
        <label>{name}</label>
        <input type={"text"} style={{width:"100%"}}
               defaultValue={txtName.current}
               onChange={(e) => {
                   txtName.current = e.target.value //?? txt
               }}/>
        <div style={{marginTop: 20}} className={"msTradeAlt msTradeActive"} onClick={()=>{callback(txtName.current)}}>send</div>
    </div>
}

export function InputPageModal({callback, name, outClick, keyForSave = "InputPage2", txt}: Parameters<typeof InputPage>[0] & {outClick: ()=>any, keyForSave?: string}) {
    return <DivOutsideClick outsideClick={outClick} style={{position: "absolute", top: "50%", left: "50%"}}>
        <DivRnd3 keyForSave={keyForSave}
                size={{height: 150, width: 300}}
                position={{y: -150, x: -250}}
                className={"fon border fonLight"}
                moveOnlyHeader={true}>
            {InputPage({callback, name, txt})}
        </DivRnd3>
    </DivOutsideClick>
}
export function InputFileModal({callback, name, outClick, keyForSave = "InputFile2"}: Parameters<typeof InputFile>[0] & {outClick: ()=>any, keyForSave?: string}) {
    const ref = useRef<HTMLDivElement>(null);
    useOutside({ref, outsideClick: outClick});
    return <div ref={ref} style={{position: "absolute", top: "50%", left: "50%"}}>
        <DivRnd3 keyForSave={keyForSave}
                size={{height: 150, width: 300}}
                position={{y: -150, x: -250}}
                className={"fon border fonLight"}
                moveOnlyHeader={true}>
            {InputFile({callback, name})}
        </DivRnd3>
    </div>
}
export function InputFile({callback, name = ""}: {callback: (file: File | null)=>void, name?: string}) {
    let file: File | null = null
    return <div className={"maxSize"} style={{padding: 20,}}>
        <label>{name}</label>
        <input type={"file"} style={{width:"100%"}} onChange={(e) => {
            file = e.target.files?.[0] ?? null
        }}/>
        <div style={{marginTop: 20}} className={"msTradeAlt msTradeActive"} onClick={()=>{callback(file)}}>send</div>
    </div>
}
export function PageModalFree({outClick, children, zIndex, size = {height: 150, width: 300}, keyForSave = "PageModalFree2"}: {zIndex?: number, outClick: ()=>any, children: React.JSX.Element, size?: {height: number, width: number}, keyForSave?: string}) {
    const ref = useRef<HTMLDivElement>(null);
    useOutside({ref, outsideClick: outClick});
    return <div ref={ref} style={{position: "absolute", top: "50%", left: "50%"}}>
        <DivRnd3 keyForSave={keyForSave}
                size={size}
                zIndex={zIndex}
                position={{y: -(size.height/2), x: -(size.width/2)}}
                className={"fon border fonLight"}
                moveOnlyHeader={true}>
            {children}
        </DivRnd3>
    </div>
}
