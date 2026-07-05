import React from "react";
import {renderBy, updateBy} from "../../../updateBy";
import {staticGetAdd, staticMarkDirty} from "../../utils/mapMemory";

/** One UI block shown in exactly one of several mount points; the point is a persisted setting.
 *  Persistence rides the existing staticProps -> Cash mechanics: staticProps is observable,
 *  setPlace announces its in-place mutation (staticMarkDirty), the app decides when to save
 *  via Cash.onDirty - same as window state (ExRNDMap3 etc.).
 *  Mount points render <Slot place="..."> themselves and decide nothing: the slot compares
 *  the persisted place with its own and renders children only on a match. */
export function createUiSlot<Places extends string>(opts: {
    key: string
    places: {[P in Places]: string}
    // NoInfer: Places must come from the places keys only; otherwise TS infers
    // Places = typeof def and rejects the other keys in places
    def: NoInfer<Places>
}) {
    const st = staticGetAdd<{place: Places}>(opts.key, {place: opts.def})
    // a stored place may no longer exist after an app update - fall back to def
    const isPlace = (p: unknown): p is Places => typeof p == "string" && p in opts.places

    const getPlace = (): Places => isPlace(st.place) ? st.place : opts.def
    const setPlace = (p: Places) => {
        if (st.place == p) return
        st.place = p
        renderBy(st)
        staticMarkDirty(opts.key)
    }

    function Slot(p: {place: Places, children: React.ReactNode}): React.JSX.Element | null {
        updateBy(st)
        return getPlace() == p.place ? <>{p.children}</> : null
    }

    /** Segmented row over opts.places; apps pass their own .chip / .chipActive classes */
    function PlacementSetting(p: {className?: string, activeClassName?: string} = {}) {
        updateBy(st)
        const cur = getPlace()
        const base = p.className ?? "wenaySegBtn"
        const activeCls = p.activeClassName ?? "wenaySegBtnActive"
        return <div style={{display: "inline-flex", gap: 4, flexWrap: "wrap"}}>
            {(Object.keys(opts.places) as Places[]).map(key => (
                <div key={key}
                     className={key == cur ? `${base} ${activeCls}` : base}
                     onClick={() => setPlace(key)}>{opts.places[key]}</div>
            ))}
        </div>
    }

    return {Slot, PlacementSetting, getPlace, setPlace}
}
