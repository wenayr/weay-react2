import React from "react";
import { Button } from "../../hooks/useOutside";

export function MiniButton({name, arr, get, onClick, style}: { name: string, arr: (string | number)[], get: () => { [k: string]: boolean }, onClick: (index: number) => void, style?: React.CSSProperties | undefined }) {
    const data = get()
    const a = Object.values(data)
    const status = a.length > 0 && !(a.indexOf(false) >= 0)
    return <Button style={style} className={"newButtonSimple"} button={(e) => <div className={status ? "msTradeAlt msTradeActive" : "msTradeAlt"}>{name}</div>}>
            <>
                <div className={"maxSize"} style={{height: "auto", display: "flex", flexWrap: "wrap"}}>
                    {
                        arr.map((k, i) =>
                            <div
                                className={data[k] ? 'msTradeAlt msTradeActive' : 'msTradeAlt'}
                                key={i}
                                onClick={() => {
                                    const t = data
                                    t[k] = !(t[k] ?? false)
                                    onClick(i)
                                }}
                            >
                                {k}</div>)
                    }
                </div>
            </>
        </Button>
}

export function MiniButton2({name, children, statusDef, className = "newButtonSimple"}: {
    name: string,
    statusDef?: boolean,
    children: React.ReactElement | (() => React.ReactElement),
    className?: string
}) {
    const content = typeof children === 'function' ? children() : children;
    return <Button
        className={className}
        statusDef={statusDef}
        button={(e) => <div className={e ? "msTradeAlt msTradeActive" : "msTradeAlt"}>{name}</div>}
    >
        {content}
    </Button>
}

// Deprecated: Use MiniButton2 instead
export const MiniButton3 = MiniButton2;
