import React, {useRef} from "react";
import {OutsideClickArea} from "../hooks/useOutside";
import { FloatingWindow } from "./Dnd/FloatingWindow";

// Unified modal wrapper component
function ModalWrapper({
    outClick,
    children,
    zIndex,
    size = {height: 150, width: 300},
    keyForSave,
    position
}: {
    outClick: () => any,
    children: React.ReactElement,
    zIndex?: number,
    size?: {height: number, width: number},
    keyForSave: string,
    position?: {x: number, y: number}
}) {
    const defaultPosition = position ?? {y: -(size.height/2), x: -(size.width/2)};

    return <OutsideClickArea outsideClick={outClick} style={{position: "absolute", top: "50%", left: "50%"}}>
        <FloatingWindow
            keyForSave={keyForSave}
            size={size}
            zIndex={zIndex}
            position={defaultPosition}
            className={"fon border fonLight"}
            moveOnlyHeader={true}
        >
            {children}
        </FloatingWindow>
    </OutsideClickArea>
}

export function TextInputPanel({callback, name = "", txt =""}: {callback: (txt: string)=>void, name?: string, txt?: string}) {
    const txtName = useRef(txt)
    return <div className={"maxSize"} style={{padding: 20,}}>
        <label>{name}</label>
        <input type={"text"} style={{width:"100%"}}
               defaultValue={txtName.current}
               onChange={(e) => {
                   txtName.current = e.target.value
               }}/>
        <div style={{marginTop: 20}} className={"msTradeAlt msTradeActive"} onClick={()=>{callback(txtName.current)}}>send</div>
    </div>
}

export function TextInputModal({callback, name, outClick, keyForSave = "TextInputModal", txt}: Parameters<typeof TextInputPanel>[0] & {outClick: ()=>any, keyForSave?: string}) {
    return <ModalWrapper
        outClick={outClick}
        keyForSave={keyForSave}
        size={{height: 150, width: 300}}
        position={{y: -150, x: -250}}
    >
        <TextInputPanel callback={callback} name={name} txt={txt} />
    </ModalWrapper>
}
export function FileInputModal({callback, name, outClick, keyForSave = "FileInputModal"}: Parameters<typeof FileInputPanel>[0] & {outClick: ()=>any, keyForSave?: string}) {
    return <ModalWrapper
        outClick={outClick}
        keyForSave={keyForSave}
        size={{height: 150, width: 300}}
        position={{y: -150, x: -250}}
    >
        <FileInputPanel callback={callback} name={name} />
    </ModalWrapper>
}
export function FileInputPanel({callback, name = ""}: {callback: (file: File | null)=>void, name?: string}) {
    const file = useRef<File | null>(null)
    return <div className={"maxSize"} style={{padding: 20,}}>
        <label>{name}</label>
        <input type={"file"} style={{width:"100%"}} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            file.current = e.target.files?.[0] ?? null
        }}/>
        <div style={{marginTop: 20}} className={"msTradeAlt msTradeActive"} onClick={()=>{callback(file.current)}}>send</div>
    </div>
}
export function FreeModal({outClick, children, zIndex, size = {height: 150, width: 300}, keyForSave = "FreeModal"}: {zIndex?: number, outClick: ()=>any, children: React.JSX.Element, size?: {height: number, width: number}, keyForSave?: string}) {
    return <ModalWrapper
        outClick={outClick}
        keyForSave={keyForSave}
        size={size}
        zIndex={zIndex}
    >
        {children}
    </ModalWrapper>
}
