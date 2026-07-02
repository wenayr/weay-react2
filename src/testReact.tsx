import {createRoot} from "react-dom/client";
import "./index"
import {GridStyleDefault} from "./common/src/styles/styleGrid";
import {QABoard} from "./common/testUseReact/qa";
// import {LegacyTestMain} from "./common/testUseReact/use";  // old demo screen - uncomment if needed

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

