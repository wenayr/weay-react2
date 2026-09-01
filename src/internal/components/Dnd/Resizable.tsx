import React, {useEffect, useRef} from "react";
import {Resizable, ResizableProps} from "re-resizable";
import {mapResiReact, type ResizableSavedSize} from "../../utils/persistedMaps.js";
import {isUsableDimension} from "./windowGeometry.js";

/** What re-resizable itself refuses to shrink below when the caller declares no minimum
 *  (its computedMinWidth/computedMinHeight). A stored number under the floor in force can
 *  therefore not have come from a drag - it is damage, and it outranks the size prop for good. */
const RESIZABLE_MIN = 10;

const floorFor = (min: number | string | undefined) => typeof min == "number" ? min : RESIZABLE_MIN;

type tSaveMap = ResizableSavedSize
// Memory for all column sizes; declared in utils/persistedMaps (memoryCache registry must not
// import the component layer) and re-exported here so the public surface is unchanged
export { mapResiReact }
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

    const floorW = floorFor(minWidth), floorH = floorFor(minHeight)
    const repaired = useRef(false)
    let obj : tSaveMap = size
    if (keyForSave) {
        let b = mapResiReact.get(keyForSave)
        if (b) {
            // The stored size wins over the prop - so a stored 0 (a parent that renders
            // size={{width: 0}} on its first, pre-measurement pass) would win forever, and a
            // box collapsed to nothing has no handle left to drag back out. Repair it in
            // place from the current prop: the map holds this very object and every write
            // below mutates it, so replacing the reference would silently stop persisting.
            if (!isUsableDimension(b.width, floorW)) { b.width = size.width; repaired.current = true }
            if (!isUsableDimension(b.height, floorH)) { b.height = size.height; repaired.current = true }
            obj = b
        }
        else mapResiReact.set(keyForSave, obj)
    }
    // Announce a repair out of the render phase, so the damaged record is rewritten once
    // instead of being healed again on every mount.
    useEffect(() => {
        if (!keyForSave || !repaired.current) return
        repaired.current = false
        mapResiReact.touch(keyForSave)
    })
    return <Resizable style = {style}
                      onResize = {(event, direction, elementRef, delta)=> {
                          onResize?.(obj)
                          // Workaround for a bug that appears when the parent div changes
                          if (moveHeight == false && typeof obj.height == "string" && elementRef.style.height != obj.height) elementRef.style.height = obj.height
                      }}
                      enable = {enable}
                      onResizeStop = {(e, dir, elementRef, delta) => {
                          // Accumulated deltas, so the floor is applied here too rather than
                          // trusted from the drag: what gets stored has to stay grabbable.
                          if (delta.width && moveWith)
                              if (typeof obj.width == "number") obj.width = Math.max(floorW, obj.width + delta.width);
                              else {obj.width = elementRef.style.width}
                          if (delta.height && moveHeight)
                              if (typeof obj.height == "number") obj.height = Math.max(floorH, obj.height + delta.height);
                              else {obj.height = elementRef.style.height}
                          // onResize?.(size)
                          // obj is mutated in place - invisible to the map, so announce it
                          if (keyForSave) mapResiReact.touch(keyForSave)
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