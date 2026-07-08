import React, {ReactElement} from "react";

// Button view
export function ParamLabelContent(name :string|ReactElement){
    return <div className="" style={{width:"100%"}}> {name}</div>
}
// Arrow for the button
export function ParamToggleLabel(type :boolean, name:string|ReactElement) {return ParamLabelContent(<p className={"toPTextIndicator"}>{(type?"▼ ":"▶ ")+name}</p>);}

export function ParamRow(props: {
    name: ReactElement | string,
    children?: React.ReactNode | readonly React.ReactNode[], //ReactElement|JSX.Element|null,
    style?: React.CSSProperties | undefined,
    enabled?: boolean,
    commentary?: string[] // Added comment text
}) {
    const [hovered, setHovered] = React.useState(false); // Tracks mouse hover state

    return (
        <div
            className="toLine LeftMenuParameters toIndicatorMenuButton"
            style={{position: "relative"}}
        >
            <div className="toLine" style={{width: "auto", ...props.style}}
                 onMouseEnter={() => setHovered(true)} // Show comment
                 onMouseLeave={() => setHovered(false)} // Hide comment
            >
                {props.name}
            </div>
            <div className="toLine toRight" style={props.enabled === false ? {opacity: 0.5} : {}}>
                {props.children}
            </div>
            {/* Comment is displayed only on hover */}
            {hovered && props.commentary && props.commentary.length > 0 && (
                <div
                    className="commentary"
                    style={{
                        marginTop: "5px",
                        fontSize: "12px",
                        color: "gray",
                        position: "absolute", // Can be absolutely positioned
                        bottom: "-20px", // Shift down to avoid covering the main content
                        left: "0",
                        backgroundColor: "white", // Make it stand out from the background
                        padding: "2px 4px",
                        border: "1px solid lightgray",
                        borderRadius: "4px",
                        zIndex: 10,
                        whiteSpace: "pre-line", // otherwise "\n" collapses into spaces
                    }}
                >
                    {props.commentary.join("\n")}
                </div>
            )}
        </div>
    );
}