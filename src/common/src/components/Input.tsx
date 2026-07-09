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

export type TextInputPanelProps = {callback: (txt: string)=>void, name?: string, txt?: string}

export function useTextInputPanel({callback, txt = ""}: Pick<TextInputPanelProps, "callback" | "txt">) {
    const txtName = useRef(txt)
    return {
        getValue: () => txtName.current,
        setValue: (next: string) => { txtName.current = next },
        submit: () => callback(txtName.current),
        inputProps: {
            defaultValue: txtName.current,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => { txtName.current = e.target.value },
        },
    }
}

export function TextInputPanel({callback, name = "", txt = ""}: TextInputPanelProps) {
    const input = useTextInputPanel({callback, txt})
    return <div className={"maxSize"} style={{padding: 20,}}>
        <label>{name}</label>
        <input type={"text"} style={{width:"100%"}} {...input.inputProps}/>
        <div style={{marginTop: 20}} className={"msTradeAlt msTradeActive"} onClick={input.submit}>send</div>
    </div>
}
export function TextInputModal({callback, name, outClick, keyForSave = "TextInputModal", txt}: TextInputPanelProps & {outClick: ()=>any, keyForSave?: string}) {
    return <ModalWrapper
        outClick={outClick}
        keyForSave={keyForSave}
        size={{height: 150, width: 300}}
        position={{y: -150, x: -250}}
    >
        <TextInputPanel callback={callback} name={name} txt={txt} />
    </ModalWrapper>
}
export function FileInputModal({callback, name, outClick, keyForSave = "FileInputModal"}: FileInputPanelProps & {outClick: ()=>any, keyForSave?: string}) {
    return <ModalWrapper
        outClick={outClick}
        keyForSave={keyForSave}
        size={{height: 150, width: 300}}
        position={{y: -150, x: -250}}
    >
        <FileInputPanel callback={callback} name={name} />
    </ModalWrapper>
}
export type FileInputPanelProps = {callback: (file: File | null)=>void, name?: string}

export function useFileInputPanel({callback}: Pick<FileInputPanelProps, "callback">) {
    const file = useRef<File | null>(null)
    return {
        getFile: () => file.current,
        setFile: (next: File | null) => { file.current = next },
        submit: () => callback(file.current),
        inputProps: {
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => { file.current = e.target.files?.[0] ?? null },
        },
    }
}

export function FileInputPanel({callback, name = ""}: FileInputPanelProps) {
    const input = useFileInputPanel({callback})
    return <div className={"maxSize"} style={{padding: 20,}}>
        <label>{name}</label>
        <input type={"file"} style={{width:"100%"}} {...input.inputProps}/>
        <div style={{marginTop: 20}} className={"msTradeAlt msTradeActive"} onClick={input.submit}>send</div>
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
