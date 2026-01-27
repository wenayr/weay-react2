// import {renderBy} from "common/updateBy";
// import React from "react";
// import {Cash} from "../../../../utils/sis";
//
// export function CashSaveButton() {
//     return <div
//         className={'msTradeAlt msTradeActive'}
//         onClick={async ()=>{
//             await Cash.save()
//         }}
//     >Save cash</div>
// }
//
// export function CashLoadButton() {
//     return <div
//         className={'msTradeAlt msTradeActive'}
//         onClick={async ()=>{
//             await Cash.load()
//             Cash.getArr.forEach(([k,v])=>{
//                 v.forEach(e=> renderBy(e))
//             })
//             }
//         }
//     >Load cash</div>
// }
// export function CashCleanButton() {
//     return <div
//         className={'msTradeAlt msTradeActive'}
//         onClick={async ()=>{
//             await Cash.clean()
//         }
//         }
//     >Clean cash</div>
// }