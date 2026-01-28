import {Button, ButtonHover, ButtonOutClick, ChatMessage, ChatWindow, DivRnd3, MenuBase, VoiceCallPanel, mouseMenuApi, renderBy, tMenuReact, updateBy} from "../api";
import {GridExample, tt} from "./useGrid";
import {ChartDemo} from "../src/myChart/1/myChartTest";
import {MyChartEngine} from "../src/myChart/chartEngine/chartEngineReact";
import {MegaWebGLChart} from "../src/myChart/3d/3d";
import {TestParams} from "./testParams";
import {createContext, Suspense, use, useContext, useEffect, useMemo, useState} from "react";
import {sleepAsync} from "wenay-common";
import {DropdownMenu, DropdownMenuTest} from "../src/RightMenu";
import {DemoItem, Playground} from "./Playground";
// import {AppGame} from "./test2";


const a = {}
const b = {}

const ChatWindowDemo = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: "m1",
            userId: "operator",
            text: "Hey! Need help with a connect setup?",
            timestamp: Date.now() - 1000 * 60 * 5,
        },
        {
            id: "m2",
            userId: "me",
            text: "Yes. I want a quick socket flow.",
            timestamp: Date.now() - 1000 * 60 * 4,
        },
        {
            id: "m3",
            userId: "operator",
            text: "Got it. Use the connect kit and preset states.",
            timestamp: Date.now() - 1000 * 60 * 3,
        },
    ]);
    const users = {
        operator: {id: "operator", name: "Support"},
        me: {id: "me", name: "You"},
    };

    return (
        <div className="demo-grid">
            <ChatWindow
                messages={messages}
                users={users}
                currentUserId="me"
                onSend={text => {
                    const next: ChatMessage = {
                        id: `m-${Date.now()}`,
                        userId: "me",
                        text,
                        timestamp: Date.now(),
                    };
                    setMessages(prev => [...prev, next]);
                }}
                header={<div>Connection chat</div>}
            />
        </div>
    );
};

const VoiceCallDemo = () => {
    const [muted, setMuted] = useState(false);
    const [onHold, setOnHold] = useState(false);
    return (
        <VoiceCallPanel
            title="Operator call"
            status={onHold ? "on-hold" : "live"}
            durationSeconds={42}
            isMuted={muted}
            isOnHold={onHold}
            participants={[{id: "operator", name: "Wenay Operator", role: "operator"}]}
            onToggleMute={() => setMuted(value => !value)}
            onToggleHold={() => setOnHold(value => !value)}
            onHangup={() => {
                setMuted(false);
                setOnHold(false);
            }}
        />
    );
};

const TimelineDemo = () => {
    return (
        <div className="demo-grid">
            <div className="demo-card demo-timeline">
                <div className="demo-track">
                    <div className="demo-clip" style={{left: "8%", width: "22%"}} />
                    <div className="demo-clip" style={{left: "36%", width: "18%", background: "rgba(100, 240, 194, 0.25)", borderColor: "rgba(100, 240, 194, 0.5)"}} />
                    <div className="demo-clip" style={{left: "58%", width: "30%"}} />
                    <div className="demo-playhead" style={{left: "42%"}} />
                </div>
                <div style={{fontSize: 12, color: "#aab4c2"}}>Storyboard timeline with clips and playhead.</div>
            </div>
        </div>
    );
};

const PhotoEditorDemo = () => {
    return (
        <div className="demo-grid">
            <div className="demo-card demo-photo">
                <div className="demo-photo-canvas">Photo canvas preview</div>
                <div className="demo-tools">
                    <div className="demo-tool">Crop</div>
                    <div className="demo-tool">Light</div>
                    <div className="demo-tool">Contrast</div>
                    <div className="demo-tool">Remove bg</div>
                    <div className="demo-tool">Voice commands</div>
                </div>
            </div>
        </div>
    );
};

export function TestMain() {
    const demos = useMemo<DemoItem[]>(() => ([
        {
            id: "chat-window",
            title: "Chat Window",
            description: "Core UI for chat and connection setup.",
            category: "Comms",
            badge: "MVP",
            render: () => <ChatWindowDemo/>,
        },
        {
            id: "voice-call",
            title: "Voice Call",
            description: "Operator voice call UI with basic controls.",
            category: "Comms",
            badge: "MVP",
            render: () => <VoiceCallDemo/>,
        },
        {
            id: "timeline",
            title: "Storyboard Timeline",
            description: "Tracks, clips and playhead for video editing.",
            category: "Media",
            badge: "Draft",
            render: () => <TimelineDemo/>,
        },
        {
            id: "photo-editor",
            title: "Photo Editor",
            description: "Canvas and tools with voice-edit hooks.",
            category: "Media",
            badge: "Draft",
            render: () => <PhotoEditorDemo/>,
        },
        {
            id: "legacy",
            title: "Legacy Playground",
            description: "Existing widgets and experiments.",
            category: "Legacy",
            render: () => <LegacyTestMain/>,
        },
    ]), []);

    return <Playground demos={demos} initialId="chat-window"/>;
}

function LegacyTestMain() {
    console.log(1111111)
    // return <div className={"maxSize"}>
    //     {/*<DropdownMenu/>*/}
    //
    //     {/*<TestLeft333/>*/}
    // </div>
    updateBy(b)
    return <div className={"maxSize"}>
        <DropdownMenuTest/>
        <div style={{margin: 80}}>
            <ButtonHover button={()=><div >menu</div>}>
                <MenuBase zIndex={12} coordinate={{x: 0, y: 0}} data={[
                    {
                        name: "test",
                        next: ()=> [
                            {
                                name: "test1",
                                status: true,
                            },
                            {
                                name: "test1",
                                getStatus: ()=> true,
                            },
                            {
                                name: "test1",
                                active: ()=> true,
                            },
                            {
                                name: "test1",
                                next: ()=> [
                                    {
                                        name: "test1",
                                    },
                                    {
                                        name: "test1",
                                    },
                                    {
                                        name: "test1",
                                    },
                                ]
                            },
                        ]
                    }
                ]}/>
            </ButtonHover>
        </div>
        <div  style={{background: "#545454", width: 400, height: 400}}>

        </div>
        <mouseMenuApi.ReactMouse zIndex={15}>
            <div style={{height: 2250}}
                onMouseDown={e=>{
                    console.log(e.button)
                    if (e.button == 2) {
                        const z: tMenuReact[] = [
                            {name: "eee", onClick: ()=> {console.log("eee")}},
                            {name: "eee", next: () => [
                                    {name: "eee", onClick: ()=> {console.log("eee")}},
                                    {name: "eee", next: () => [

                                        ]},
                                ]},
                            {name: "eee", next: async () => [
                                    {name: "eee", onClick: ()=> {console.log("eee")}},
                                    {name: "eee", next: () => [

                                        ]},
                                ]},
                            {name: "eee", func: async () => <MenuBase data={
                                    [
                                        {name: "eee", onClick: ()=> {console.log("eee")}},
                                        {name: "eee", next: () => [

                                            ]},
                                    ]
                                }/>},
                        ]
                        mouseMenuApi.map.set("sym", z)
                    }
                }}
            ></div>
        </mouseMenuApi.ReactMouse>
        <ExampleUsage/>
        <ButtonChart/>
        <ButtonChart3d/>
        <App/>
        <ButtonParams/>
        <div className={"msTradeAlt"}
            onClick={()=>{
                renderBy(tt)
            }}
        >menu</div>
        <div className={"msTradeAlt"}
            onClick={()=>{
                renderBy(a)
            }}
        >update</div>
        <mouseMenuApi.ReactMouse>
            <GridExample/>
        </mouseMenuApi.ReactMouse>
    </div>
}

const Container = () => {
    console.log(Date.now())
    updateBy(a)
    return <div className={"maxSize"}>
        <GridExample/>
    </div>
}
const ExampleUsage = () => {
    return <Button button={e => <div className={!e ? "msTradeAlt" : "msTradeAlt msTradeActive"}>menu</div>}>
        {(api) => {
            return <DivRnd3 keyForSave={"tt1232"}
                           key={"sds"}
                           size={{height: 300, width: 300}}
                           className={"fon border fonLight"} // fon border fonLight
                           moveOnlyHeader={true}
                           onCLickClose={api.onClose}
                           limit={{y: {min: 0}}}
                           onUpdate={() => {
                               // setUpdate(update + 1)
                           }}>
                <div className={"maxSize"}>
                    <Container/>
                </div>
                {/*<MenuSeries update={update} key={"2323"}/>*/}
            </DivRnd3>
        }}
    </Button>
};
const ButtonChart = () => {
    return <Button button={e => <div className={!e ? "msTradeAlt" : "msTradeAlt msTradeActive"}>chart</div>}>
        {(api) => {
            return <DivRnd3 keyForSave={"tt123322"}
                           key={"sds2"}
                           size={{height: 300, width: 300}}
                           className={"fon border fonLight"} // fon border fonLight
                           moveOnlyHeader={true}
                           onCLickClose={api.onClose}
                           limit={{y: {min: 0}}}
                           onUpdate={() => {
                               // setUpdate(update + 1)
                           }}>
                <div className={"maxSize"}>
                    <MyChartEngine/>
                </div>
                {/*<MenuSeries update={update} key={"2323"}/>*/}
            </DivRnd3>
        }}
    </Button>
};
const ButtonChart3d = () => {
    return <Button button={e => <div className={!e ? "msTradeAlt" : "msTradeAlt msTradeActive"}>chart</div>}>
        {(api) => {
            return <DivRnd3 keyForSave={"tt123322"}
                           key={"sds2"}
                           size={{height: 300, width: 300}}
                           className={"fon border fonLight"} // fon border fonLight
                           moveOnlyHeader={true}
                           onCLickClose={api.onClose}
                           limit={{y: {min: 0}}}
                           onUpdate={() => {
                               // setUpdate(update + 1)
                           }}>
                <div className={"maxSize"}>
                    <MegaWebGLChart/>
                </div>
                {/*<MenuSeries update={update} key={"2323"}/>*/}
            </DivRnd3>
        }}
    </Button>
};
const ButtonParams = () => {
    return <Button button={e => <div className={!e ? "msTradeAlt" : "msTradeAlt msTradeActive"}>chart</div>}>
        {(api) => {
            return <DivRnd3 keyForSave={"tt123322"}
                           key={"sds2"}
                           size={{height: 300, width: 300}}
                           className={"fon border fonLight"} // fon border fonLight
                           moveOnlyHeader={true}
                           onCLickClose={api.onClose}
                           limit={{y: {min: 0}}}
                           onUpdate={() => {
                               // setUpdate(update + 1)
                           }}>
                <div className={"maxSize"}>
                    <TestParams/>
                </div>
                {/*<MenuSeries update={update} key={"2323"}/>*/}
            </DivRnd3>
        }}
    </Button>
};
const UseTest2 = () => {
    return <Suspense fallback={<div>7777</div>}>
        <UseTest/>
    </Suspense>
}
const FFF = () => {
    return sleepAsync(500).then(()=>123)
}
const UseTest = () => {
    console.log("1233333")
    const r = use(FFF())
    console.log("!!!!!!")
    return <div>{r}</div>
}

// Функция имитирует асинхронный процесс (например, получение данных с сервера)
const fetchData = async (): Promise<string> => {
    console.log("!444")
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log("!111")
            resolve("Данные успешно загружены!")
        }, 2000); // Задержка 2 секунды
    });
};

// Компонент, использующий хук use для ожидания асинхронной операции
const FetchExample = () => {
    // Важно: хук use может быть вызван только на верхнем уровне компонента,
    // он возвращает результат асинхронной функции.
    const data = use(fetchData());

    // React "подвешивает" компонент, пока Promises (переданные в use) не будут разрешены.
    return <div>{data}</div>;
};
const FetchExample2 = () => {
    console.log("dsdsds")
    // Важно: хук use может быть вызван только на верхнем уровне компонента,
    // он возвращает результат асинхронной функции.
    return useMemo(()=><FetchExample/>,[])
};

const Ztr = createContext({a: 4 as number},)
// Главный компонент приложения
const Ttt2 = () => {
    console.log("Rrrrrrrrrrr")
    return useMemo(()=><Ttt3/>,[true])

}
const Ttt3 = () => {
    console.log("444444444444444444")
    return <Ttt/>

}
const Ttt = () => {
    const data = useContext(Ztr)
    console.log(data)
    return <div>{data.a}</div>

}

export const App = () => {
    const [a, setA] = useState(0)
    useEffect(()=>{
        sleepAsync(1000)
            .then(()=>{

                setA(e=>e+1)
            })
    }, [])
    console.log("FFFFFFFFFFFFFFFFFFF")
    return <div>
        <Ztr value={{a: a}}>
            {useMemo(()=><Ttt3 key = {1}/>,[true])}
        </Ztr>
        <Ttt3 key = {2}/>

        <Ttt3 key = {1}/>
    </div>
};


