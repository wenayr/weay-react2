import React from "react";
import {Resizable, ResizableProps} from "re-resizable";

type tSaveMap = {height?: number|string, width?: number|string}
// память всех размеров колонок
export const mapResiReact = new Map<string,tSaveMap >()
type t3 = Pick<ResizableProps, "style" | "enable" | "onResize" | "children" | "size" | "maxWidth"| "maxHeight"| "minWidth"| "minHeight">

export function FResizableReact(
    {style, onResize, enable, children, keyForSave, onResizeStop,
     size = {height: 50, width: 50},
        minWidth, minHeight,
        maxWidth = "100%", maxHeight = "100%",
        moveWith = true, moveHeight = true
    } : t3 & {
        keyForSave?: string,
        onResize?: (size?: tSaveMap) => void,
        onResizeStop?: (size: tSaveMap) => void,
        moveWith?: boolean,
        moveHeight?: boolean,
    }) {

    let obj : tSaveMap = size
    if (keyForSave) {
        let b = mapResiReact.get(keyForSave)
        if (b) obj = b
        else mapResiReact.set(keyForSave, obj)
    }
    return <Resizable style = {style}
                      onResize = {(event, direction, elementRef, delta)=> {
                          onResize?.()
                          // костыль устраняет какой-то баг - проявляется при изменении родительского дива
                          if (moveHeight == false && typeof obj.height == "string" && elementRef.style.height != obj.height) elementRef.style.height = obj.height
                      }}
                      enable = {enable}
                      onResizeStop = {(e, dir, elementRef, delta) => {
                          if (delta.width && moveWith)
                              if (typeof obj.width == "number") obj.width += delta.width;
                              else {obj.width = elementRef.style.width}
                          if (delta.height && moveHeight)
                              if (typeof obj.height == "number") obj.height += delta.height;
                              else {obj.height = elementRef.style.height}
                          // onResize?.(size)
                          onResizeStop?.(obj)
                          // this.Refresh()
                      }}
                      size = {obj}
                      defaultSize = {obj}
                      maxWidth = {maxWidth}
                      maxHeight = {maxHeight}
                      minWidth = {minWidth}
                      minHeight = {minHeight}
    >
        {children}
    </Resizable>
}