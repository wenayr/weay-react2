import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import React from "react";
//вид кнопки
export function FButton(name) {
    return _jsxs("div", { className: "", style: { width: "100%" }, children: [" ", name] });
}
//стрелка для кнопки
export function FNameButton(type, name) { return FButton(_jsx("p", { className: "toPTextIndicator", children: (type ? "▼ " : "▶ ") + name })); }
// export function CParameter(props: {
//     name: ReactElement | string,
//     children?: React.ReactNode | readonly React.ReactNode[], //ReactElement|JSX.Element|null,
//     style?: React.CSSProperties | undefined,
//     enabled?: boolean
// }) {
//     return <div className="toLine LeftMenuParameters toIndicatorMenuButton" style={{position: "relative"}}>
//         <div className="toLine" style={{width: "auto", ...props.style}}>
//             {props.name}
//         </div>
//         <div className="toLine toRight" style={props.enabled == false ? {opacity: 0.5} : {}}>
//             {props.children}
//         </div>
//     </div>
// }
export function CParameter(props) {
    const [hovered, setHovered] = React.useState(false); // Состояние для отслеживания наведения мышки
    return (_jsxs("div", { className: "toLine LeftMenuParameters toIndicatorMenuButton", style: { position: "relative" }, children: [_jsx("div", { className: "toLine", style: { width: "auto", ...props.style }, onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false), children: props.name }), _jsx("div", { className: "toLine toRight", style: props.enabled === false ? { opacity: 0.5 } : {}, children: props.children }), hovered && props.commentary?.length && (_jsx("div", { className: "commentary", style: {
                    marginTop: "5px",
                    fontSize: "12px",
                    color: "gray",
                    position: "absolute",
                    bottom: "-20px",
                    left: "0",
                    backgroundColor: "white",
                    padding: "2px 4px",
                    border: "1px solid lightgray",
                    borderRadius: "4px",
                    zIndex: 10,
                }, children: props.commentary.join("\n") }))] }));
}
