import {GetMenuR} from "./menuR";
import {MenuBase, tMenuReact} from "./menu";

function GetMouseMenuApi(data?: {name?: string}){
    const {name = "mouse"} = data ?? {}
    const {MenuR, bb} = GetMenuR()
    const value = {
        status: true,
        clicks: 0
    }
    const menuMouse = {
        name,
        get value() {return value}
    }

    const map = new Map<string, (tMenuReact|false)[]>

    function other() {
        if (map.has("only")) return  map.get("only")!
        const t: tMenuReact[] = []
        map.forEach(e=>{t.unshift(...e)})
        return t
    }
    function ReactMouse(agr: Parameters<typeof MenuR>[0]) {
        const datum = menuMouse.value //staticGetAdd(menuMouse.name, menuMouse.value

        return MenuR({...(agr ?? {}), other: agr.other ? agr.other : other, statusOn: datum.status, onUnClick: ()=> {
                map.clear() }})
    }

    return {
        bb, get map(){return map}, get menuMouse(){return menuMouse}, ReactMouse, ReactMenu: MenuBase
    }
}

export const mouseMenuApi = GetMouseMenuApi()
