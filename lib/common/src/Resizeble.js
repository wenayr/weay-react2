import { jsx as _jsx } from "react/jsx-runtime";
import { Resizable } from "re-resizable";
// память всех размеров колонок
export const mapResiReact = new Map();
export function FResizableReact({ style, onResize, enable, children, keyForSave, onResizeStop, size = { height: 50, width: 50 }, minWidth, minHeight, maxWidth = "100%", maxHeight = "100%", moveWith = true, moveHeight = true }) {
    let obj = size;
    if (keyForSave) {
        let b = mapResiReact.get(keyForSave);
        if (b)
            obj = b;
        else
            mapResiReact.set(keyForSave, obj);
    }
    return _jsx(Resizable, { style: style, onResize: (event, direction, elementRef, delta) => {
            onResize?.();
            // костыль устраняет какой-то баг - проявляется при изменении родительского дива
            if (moveHeight == false && typeof obj.height == "string" && elementRef.style.height != obj.height)
                elementRef.style.height = obj.height;
        }, enable: enable, onResizeStop: (e, dir, elementRef, delta) => {
            if (delta.width && moveWith)
                if (typeof obj.width == "number")
                    obj.width += delta.width;
                else {
                    obj.width = elementRef.style.width;
                }
            if (delta.height && moveHeight)
                if (typeof obj.height == "number")
                    obj.height += delta.height;
                else {
                    obj.height = elementRef.style.height;
                }
            // onResize?.(size)
            onResizeStop?.(obj);
            // this.Refresh()
        }, size: obj, defaultSize: obj, maxWidth: maxWidth, maxHeight: maxHeight, minWidth: minWidth, minHeight: minHeight, children: children });
}
