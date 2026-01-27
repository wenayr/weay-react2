import {ParametersReact} from "../src/Parameters2";
import {Params} from "wenay-common";

const getParams = () => {
    return new class testParams extends Params.CParams{
        test= {value: 1, range: {min: 1, max: 10, step: 1}}
        test2= {value: 1, commentary: ["this test tttt 222"], range: {min: 1, max: 10, step: 1}}
        test3= {value: 1, name: "t33", commentary: ["this test tttt 333"], range: {min: 1, max: 10, step: 1}}
    } satisfies Params.CParams
}
const paramsDef = getParams()
let params = Params.GetSimpleParams(paramsDef)
export function TestParams() {
    return <ParametersReact params={Params.mergeParamValuesToInfos(paramsDef, params)} onChange={e=> {}}/>
}