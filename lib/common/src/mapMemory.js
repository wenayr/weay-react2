import { mapResiReact } from "./Resizeble";
import { ExRNDMap3 } from "./RNDFunc3";
import { CashFuncMapCash } from "./cash";
import { deepClone } from "wenay-common";
const staticProps = new Map();
export function staticSet(key, data) {
    if (!staticProps.has(key))
        staticProps.set(key, data);
}
export function staticGet(key) {
    return staticProps.get(key);
}
function isObject(item) {
    return item !== null && typeof item === 'object' && !Array.isArray(item);
}
export function deepMergeWithMap(target, source, visited = new Map()) {
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) {
                    target[key] = {};
                }
                // Check if the source object has already been visited
                if (!visited.has(source[key])) {
                    visited.set(source[key], {});
                    deepMergeWithMap(target[key], source[key], visited);
                }
                else {
                    target[key] = visited.get(source[key]);
                }
            }
            else {
                target[key] = source[key];
            }
        }
    }
    return target;
}
const map = new Map;
export function staticGetAdd(key, def, options = { reversDeep: false }) {
    if (options.deepAutoMerge && !map.get(def)) {
        map.set(def, true);
        if (options.deepAutoMerge) {
            if (!options.reversDeep)
                staticProps.set(key, deepMergeWithMap(staticProps.get(key) ?? {}, def));
            else
                staticProps.set(key, deepMergeWithMap(deepClone(def), staticProps.get(key) ?? {}));
        }
    }
    if (options.abs)
        staticProps.set(key, def);
    const t = (staticProps.get(key) || staticProps.set(key, def).get(key));
    return t; // Object.assign(def, t) // t //
}
export function staticGetById(key, def, id) {
    const t = map.get(key);
    const el = { __id: id, data: def };
    if ((el && el.__id != id) || !el) {
        return staticGetAdd(key, el, { abs: true }).data;
    }
    return el.data;
}
export const Cash = CashFuncMapCash([
    ["mapResiReact", mapResiReact],
    ["ExRNDMap3", ExRNDMap3],
    ["staticProps", staticProps]
]);
export const MemoryMap = {
    rnd: ExRNDMap3,
    resize: mapResiReact,
    other: staticProps
};
