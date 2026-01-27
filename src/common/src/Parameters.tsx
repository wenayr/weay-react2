import React, {ReactElement} from "react";

//вид кнопки
export function FButton(name :string|ReactElement){
    return <div className="" style={{width:"100%"}}> {name}</div>
}
//стрелка для кнопки
export function FNameButton(type :boolean, name:string|ReactElement) {return FButton(<p className={"toPTextIndicator"}>{(type?"▼ ":"▶ ")+name}</p>);}

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

export function CParameter(props: {
    name: ReactElement | string,
    children?: React.ReactNode | readonly React.ReactNode[], //ReactElement|JSX.Element|null,
    style?: React.CSSProperties | undefined,
    enabled?: boolean,
    commentary?: string[] // Добавлено комментарий
}) {
    const [hovered, setHovered] = React.useState(false); // Состояние для отслеживания наведения мышки

    return (
        <div
            className="toLine LeftMenuParameters toIndicatorMenuButton"
            style={{position: "relative"}}
        >
            <div className="toLine" style={{width: "auto", ...props.style}}
                 onMouseEnter={() => setHovered(true)} // Показываем комментарий
                 onMouseLeave={() => setHovered(false)} // Скрываем комментарий
            >
                {props.name}
            </div>
            <div className="toLine toRight" style={props.enabled === false ? {opacity: 0.5} : {}}>
                {props.children}
            </div>
            {/* Комментарий отображается только при наведении */}
            {hovered && props.commentary?.length && (
                <div
                    className="commentary"
                    style={{
                        marginTop: "5px",
                        fontSize: "12px",
                        color: "gray",
                        position: "absolute", // Можно сделать абсолютно спозиционированным
                        bottom: "-20px", // Сдвигаем вниз, чтобы не перекрывать основной контент
                        left: "0",
                        backgroundColor: "white", // Чтобы выделялось на фоне
                        padding: "2px 4px",
                        border: "1px solid lightgray",
                        borderRadius: "4px",
                        zIndex: 10,
                    }}
                >
                    {props.commentary.join("\n")}
                </div>
            )}
        </div>
    );
}