import {createRoot} from "react-dom/client";
import "../index.js"
import "../style/style.css"
import "../style/menuRight.css"
import "../style/communication.css"
import "./stand.css"
import {GridStyleDefault} from "../internal/styles/styleGrid.js";
import {QABoard} from "./testUseReact/qa.js";
// import {LegacyTestMain} from "./testUseReact/use.js";  // old demo screen - uncomment if needed

const r = GridStyleDefault()
export function Test() {
    return <QABoard/>
}
function GeneralInit(pare:HTMLElement){
    const root = createRoot(pare!); // createRoot(container!) if you use TypeScript
    root.render(<Test />)
}


export function TestReact(){
    document.body.style.margin = '0'

    const buf = document.createElement("project");
    buf.style.width = '100%';
    buf.style.height = '100%';
    document.body.appendChild(buf)

    GeneralInit(buf)
}

