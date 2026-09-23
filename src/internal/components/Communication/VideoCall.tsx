import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";

export type VideoCallPhase = "lobby" | "ringing" | "active";
export type VideoCallPanel = "none" | "chat" | "people" | "rooms" | "assistant" | "more";
export type VideoCallTone = "violet" | "blue" | "green" | "pink" | "amber";
export type VideoCallMediaState = "idle" | "requesting" | "live" | "denied" | "no-device" | "error";
export type VideoCallLayout = "speaker" | "grid" | "multi";
export type VideoCallFocusMode = "standard" | "video" | "chat" | "video-chat";
export type VideoCallScreenState = "idle" | "requesting" | "active" | "error";
export type VideoCallRecordingState = "idle" | "recording" | "ready" | "error";

export type VideoCallParticipant = {
    id: string;
    initials: string;
    name: string;
    tone?: VideoCallTone;
    status?: string;
    away?: boolean;
    hand?: boolean;
    canSpeak?: boolean;
    moderator?: boolean;
};

export type VideoCallMessage = {id: string; author: string; text: string};
export type VideoCallPoll = {eyebrow?: string; question: string; options: Array<{id: string; label: string; percent?: number}>};
export type VideoCallRoom = {id: string; name: string; participantIds: string[]; private?: boolean; allowGuests?: boolean};
export type VideoCallMeeting = {
    brand?: string;
    title: string;
    schedule?: string;
    organizer?: string;
    mode?: string;
    translation?: string;
    participantCount?: number;
};
export type VideoCallRecording = {state: VideoCallRecordingState; downloadUrl?: string; label?: string};
export type VideoCallAssistant = {supported: boolean; listening: boolean; transcript?: string; status?: string};

export type UseVideoCallControllerOptions = {phase: VideoCallPhase; speakerId?: string; controlsHideMs?: number};

/** UI-only state for VideoCall. Call, media and authorization ownership stay outside. */
export function useVideoCallController(options: UseVideoCallControllerOptions) {
    const {phase, controlsHideMs = 6500} = options;
    const [panel, setPanel] = useState<VideoCallPanel>("none");
    const [focusMode, setFocusMode] = useState<VideoCallFocusMode>("standard");
    const [layout, setLayout] = useState<VideoCallLayout>("speaker");
    const [speakerId, setSpeakerId] = useState(options.speakerId ?? "");
    const [pollVisible, setPollVisible] = useState(true);
    const [pollAnswer, setPollAnswer] = useState("");
    const [effect, setEffect] = useState("none");
    const [draft, setDraft] = useState("");
    const [assistantDraft, setAssistantDraft] = useState("");
    const [laserPointer, setLaserPointer] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [controlsVisible, setControlsVisible] = useState(true);
    const hideTimer = useRef<number | null>(null);

    const revealControls = useCallback(() => {
        setControlsVisible(true);
        if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
        if (phase === "active" && controlsHideMs > 0)
            hideTimer.current = window.setTimeout(() => setControlsVisible(false), controlsHideMs);
    }, [phase, controlsHideMs]);
    const setFocusVideo = useCallback((next: React.SetStateAction<boolean>) => {
        setFocusMode(current => {
            const enabled = typeof next === "function" ? next(current === "video") : next;
            return enabled ? "video" : "standard";
        });
    }, []);

    useEffect(() => {
        revealControls();
        if (phase !== "active") {
            setElapsedSeconds(0);
            setPanel("none");
            setFocusMode("standard");
        }
        return () => { if (hideTimer.current !== null) window.clearTimeout(hideTimer.current); };
    }, [phase, revealControls]);
    useEffect(() => {
        if (phase !== "active") return;
        const timer = window.setInterval(() => setElapsedSeconds(value => value + 1), 1000);
        return () => window.clearInterval(timer);
    }, [phase]);

    const focusVideo = focusMode === "video";
    return useMemo(() => ({
        panel, setPanel,
        focusMode, setFocusMode,
        focusVideo, setFocusVideo,
        layout, setLayout,
        speakerId, setSpeakerId,
        pollVisible, showPoll: () => setPollVisible(true), dismissPoll: () => setPollVisible(false),
        pollAnswer, setPollAnswer,
        effect, setEffect,
        draft, setDraft,
        assistantDraft, setAssistantDraft,
        laserPointer, setLaserPointer,
        elapsedSeconds,
        controlsVisible, revealControls,
    }), [panel, focusMode, focusVideo, setFocusVideo, layout, speakerId, pollVisible, pollAnswer, effect, draft, assistantDraft, laserPointer, elapsedSeconds, controlsVisible, revealControls]);
}

export type VideoCallController = ReturnType<typeof useVideoCallController>;

/** Every visible and assistive text of VideoCall. `labels` takes any subset; the rest falls
 *  back to `videoCallLabelsRu`. `assistantCommands` are sent verbatim to `onAssistantCommand`,
 *  so the application's command parser must speak the same language. */
export type VideoCallLabels = {
    you: string;
    participant: string;
    participantCount: (count: number) => string;
    brand: string;
    meetingMode: string;
    statusLive: (frames: number) => string;
    statusConnecting: string;
    statusReady: string;
    screenShare: string;
    participantScreen: string;
    speakerVideo: string;
    screenSuffix: string;
    cameraPreview: string;
    microphoneOn: string;
    microphoneOff: string;
    cameraOn: string;
    cameraOff: string;
    cameraEffects: string;
    effectsTitle: string;
    effectNone: string;
    effectBlur: string;
    effectOffice: string;
    effectLight: string;
    meetingReady: string;
    canJoin: string;
    waiting: (count: number) => string;
    joining: string;
    join: string;
    connectingRelay: string;
    translationOn: string;
    translationOff: string;
    secureConnection: string;
    screenLive: string;
    roomBanner: string;
    backToMain: string;
    callParticipants: string;
    inRoom: string;
    handRaised: string;
    noVoice: string;
    skipPoll: string;
    quickPoll: string;
    callControls: string;
    microphone: string;
    camera: string;
    stopScreenShare: string;
    screenBusy: string;
    screen: string;
    rooms: string;
    chat: string;
    callMenu: string;
    menu: string;
    hangup: string;
    panelChat: string;
    panelPeople: string;
    panelRooms: string;
    panelAssistant: string;
    panelMore: string;
    closePanel: string;
    messageAll: string;
    messageAllPlaceholder: string;
    sendMessage: string;
    moderatorSuffix: string;
    statusInRoom: string;
    statusHand: string;
    statusMain: string;
    giveVoice: string;
    takeVoice: string;
    invite: string;
    roomGuests: string;
    roomClosed: string;
    enterRoom: string;
    callBack: string;
    assistantListening: string;
    assistantReady: string;
    assistantUnavailable: string;
    transcript: (text: string) => string;
    assistantCommands: readonly string[];
    assistantCommand: string;
    assistantPlaceholder: string;
    runCommand: string;
    stopListening: string;
    speakCommand: string;
    layoutTitle: string;
    layoutSpeaker: string;
    layoutGrid: string;
    layoutMulti: string;
    focusTitle: string;
    focusStandard: string;
    focusVideo: string;
    focusChat: string;
    focusVideoChat: string;
    laserPointer: string;
    stopRecording: string;
    startRecording: string;
    downloadRecording: string;
    translationDisable: string;
    translationEnable: string;
    peopleAndVoice: string;
    voiceAssistant: string;
};

function ruParticipants(count: number) {
    const mod100 = count % 100;
    const mod10 = count % 10;
    const word = mod10 === 1 && mod100 !== 11 ? "участник" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "участника" : "участников";
    return `${count} ${word}`;
}

export const videoCallLabelsRu: VideoCallLabels = {
    you: "Вы",
    participant: "Участник",
    participantCount: ruParticipants,
    brand: "Собрание",
    meetingMode: "Работа",
    statusLive: frames => `relay · ${frames} кадров`,
    statusConnecting: "подключение…",
    statusReady: "готово к подключению",
    screenShare: "Демонстрация экрана",
    participantScreen: "Демонстрация экрана участника",
    speakerVideo: "Видео активного участника",
    screenSuffix: "экран",
    cameraPreview: "Предпросмотр камеры",
    microphoneOn: "Включить микрофон",
    microphoneOff: "Выключить микрофон",
    cameraOn: "Включить камеру",
    cameraOff: "Выключить камеру",
    cameraEffects: "Эффекты камеры",
    effectsTitle: "Эффекты и маски",
    effectNone: "Без эффектов",
    effectBlur: "Размытие",
    effectOffice: "Фон: офис",
    effectLight: "Коррекция света",
    meetingReady: "Встреча готова",
    canJoin: "Можно подключаться",
    waiting: count => `уже ждут ${ruParticipants(count)}`,
    joining: "Подключаем…",
    join: "Присоединиться",
    connectingRelay: "Подключаем защищённый relay…",
    translationOn: "Перевод включён",
    translationOff: "Перевод выключен",
    secureConnection: "Защищённая связь",
    screenLive: "Экран в эфире",
    roomBanner: "Основная сессия приглушена · участники могут позвать вас обратно",
    backToMain: "Вернуться",
    callParticipants: "Участники звонка",
    inRoom: "В отдельной комнате",
    handRaised: "Поднята рука",
    noVoice: "Нет права голоса",
    skipPoll: "Пропустить опрос",
    quickPoll: "Быстрый опрос",
    callControls: "Управление звонком",
    microphone: "Микрофон",
    camera: "Камера",
    stopScreenShare: "Остановить демонстрацию",
    screenBusy: "Экран уже показывает другой участник",
    screen: "Экран",
    rooms: "Комнаты",
    chat: "Чат",
    callMenu: "Меню звонка",
    menu: "Меню",
    hangup: "Завершить",
    panelChat: "Чат встречи",
    panelPeople: "Участники",
    panelRooms: "Комнаты",
    panelAssistant: "Ассистент",
    panelMore: "Режим встречи",
    closePanel: "Закрыть панель",
    messageAll: "Сообщение всем",
    messageAllPlaceholder: "Сообщение всем…",
    sendMessage: "Отправить сообщение",
    moderatorSuffix: "администратор",
    statusInRoom: "отдельная комната",
    statusHand: "хочет выступить",
    statusMain: "в общем зале",
    giveVoice: "Дать слово",
    takeVoice: "Забрать слово",
    invite: "Пригласить участника",
    roomGuests: "вход по приглашению",
    roomClosed: "закрытая",
    enterRoom: "Войти",
    callBack: "Позвать обратно",
    assistantListening: "Слушаю…",
    assistantReady: "Готов к команде",
    assistantUnavailable: "Голос недоступен",
    transcript: text => `«${text}»`,
    assistantCommands: ["фокус на видео", "открой чат", "покажи комнаты", "начни запись"],
    assistantCommand: "Команда ассистенту",
    assistantPlaceholder: "Например: включи сетку",
    runCommand: "Выполнить команду",
    stopListening: "Остановить распознавание",
    speakCommand: "Сказать команду",
    layoutTitle: "Раскладка",
    layoutSpeaker: "Спикер",
    layoutGrid: "Сетка",
    layoutMulti: "Мульти",
    focusTitle: "Фокус внимания",
    focusStandard: "Стандарт",
    focusVideo: "Видео",
    focusChat: "Чат",
    focusVideoChat: "Видео + чат",
    laserPointer: "Лазерная указка",
    stopRecording: "Остановить запись",
    startRecording: "Начать запись",
    downloadRecording: "Скачать запись",
    translationDisable: "Выключить перевод",
    translationEnable: "Включить RU → EN",
    peopleAndVoice: "Участники и права голоса",
    voiceAssistant: "Голосовой ассистент",
};

const enParticipants = (count: number) => `${count} ${count === 1 ? "participant" : "participants"}`;

export const videoCallLabelsEn: VideoCallLabels = {
    you: "You",
    participant: "Participant",
    participantCount: enParticipants,
    brand: "Meeting",
    meetingMode: "Work",
    statusLive: frames => `relay · ${frames} frames`,
    statusConnecting: "connecting…",
    statusReady: "ready to join",
    screenShare: "Screen sharing",
    participantScreen: "Participant's screen",
    speakerVideo: "Active speaker video",
    screenSuffix: "screen",
    cameraPreview: "Camera preview",
    microphoneOn: "Turn microphone on",
    microphoneOff: "Turn microphone off",
    cameraOn: "Turn camera on",
    cameraOff: "Turn camera off",
    cameraEffects: "Camera effects",
    effectsTitle: "Effects and masks",
    effectNone: "No effects",
    effectBlur: "Blur",
    effectOffice: "Background: office",
    effectLight: "Light correction",
    meetingReady: "The meeting is ready",
    canJoin: "You can join",
    waiting: count => `${enParticipants(count)} waiting`,
    joining: "Joining…",
    join: "Join",
    connectingRelay: "Connecting the secure relay…",
    translationOn: "Translation on",
    translationOff: "Translation off",
    secureConnection: "Secure connection",
    screenLive: "Screen is live",
    roomBanner: "Main session muted · participants can call you back",
    backToMain: "Return",
    callParticipants: "Call participants",
    inRoom: "In a breakout room",
    handRaised: "Hand raised",
    noVoice: "Cannot speak",
    skipPoll: "Skip poll",
    quickPoll: "Quick poll",
    callControls: "Call controls",
    microphone: "Microphone",
    camera: "Camera",
    stopScreenShare: "Stop sharing",
    screenBusy: "Another participant is sharing the screen",
    screen: "Screen",
    rooms: "Rooms",
    chat: "Chat",
    callMenu: "Call menu",
    menu: "Menu",
    hangup: "Leave",
    panelChat: "Meeting chat",
    panelPeople: "Participants",
    panelRooms: "Rooms",
    panelAssistant: "Assistant",
    panelMore: "Meeting mode",
    closePanel: "Close panel",
    messageAll: "Message everyone",
    messageAllPlaceholder: "Message everyone…",
    sendMessage: "Send message",
    moderatorSuffix: "moderator",
    statusInRoom: "breakout room",
    statusHand: "wants to speak",
    statusMain: "in the main room",
    giveVoice: "Allow to speak",
    takeVoice: "Revoke speaking",
    invite: "Invite a participant",
    roomGuests: "by invitation",
    roomClosed: "closed",
    enterRoom: "Enter",
    callBack: "Call back",
    assistantListening: "Listening…",
    assistantReady: "Ready for a command",
    assistantUnavailable: "Voice unavailable",
    transcript: text => `“${text}”`,
    assistantCommands: ["focus on video", "open chat", "show rooms", "start recording"],
    assistantCommand: "Assistant command",
    assistantPlaceholder: "For example: switch to grid",
    runCommand: "Run command",
    stopListening: "Stop listening",
    speakCommand: "Say a command",
    layoutTitle: "Layout",
    layoutSpeaker: "Speaker",
    layoutGrid: "Grid",
    layoutMulti: "Multi",
    focusTitle: "Focus",
    focusStandard: "Standard",
    focusVideo: "Video",
    focusChat: "Chat",
    focusVideoChat: "Video + chat",
    laserPointer: "Laser pointer",
    stopRecording: "Stop recording",
    startRecording: "Start recording",
    downloadRecording: "Download recording",
    translationDisable: "Turn translation off",
    translationEnable: "Turn on RU → EN",
    peopleAndVoice: "Participants and speaking rights",
    voiceAssistant: "Voice assistant",
};

export type VideoCallProps = {
    controller: VideoCallController;
    phase: VideoCallPhase;
    meeting: VideoCallMeeting;
    participants: VideoCallParticipant[];
    selfParticipantId: string;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    screenVideoRef?: React.RefObject<HTMLVideoElement | null>;
    cameraState: VideoCallMediaState;
    microphoneState: VideoCallMediaState;
    screenShareState?: VideoCallScreenState;
    presentingParticipantId?: string | null;
    presentingParticipantName?: string;
    recording?: VideoCallRecording;
    assistant?: VideoCallAssistant;
    statusLabel?: string;
    notice?: string;
    frames?: number;
    caption?: string;
    translatedCaption?: string;
    translationEnabled?: boolean;
    poll?: VideoCallPoll;
    messages?: VideoCallMessage[];
    rooms?: VideoCallRoom[];
    activeRoomId?: string | null;
    effects?: Array<{id: string; label: string}>;
    moderator?: boolean;
    error?: string;
    joinDisabled?: boolean;
    className?: string;
    /** Interface texts; missing keys fall back to `videoCallLabelsRu` (`videoCallLabelsEn` ships too). */
    labels?: Partial<VideoCallLabels>;
    onJoin(): void;
    onHangup(): void;
    onToggleCamera(): void;
    onToggleMicrophone(): void;
    onToggleScreenShare?(): void;
    onToggleRecording?(): void;
    onToggleTranslation?(): void;
    onToggleAssistant?(): void;
    onAssistantCommand?(command: string): void;
    onSendMessage?(text: string): void;
    onInvite?(): void;
    onJoinRoom?(roomId: string): void;
    onLeaveRoom?(): void;
    onPingRoom?(roomId: string): void;
    onToggleSpeak?(participantId: string, allowed: boolean): void;
};

function callTime(totalSeconds: number) {
    return `${Math.floor(totalSeconds / 60).toString().padStart(2, "0")}:${(totalSeconds % 60).toString().padStart(2, "0")}`;
}

function panelTitle(panel: VideoCallPanel, L: VideoCallLabels) {
    return panel === "chat" ? L.panelChat : panel === "people" ? L.panelPeople : panel === "rooms" ? L.panelRooms
        : panel === "assistant" ? L.panelAssistant : L.panelMore;
}

/** Controlled product surface: every transport/media edge is supplied by the app. */
export function VideoCall(props: VideoCallProps) {
    const c = props.controller;
    const L = props.labels ? {...videoCallLabelsRu, ...props.labels} : videoCallLabelsRu;
    const active = props.phase === "active";
    const cameraLive = props.cameraState === "live" || props.cameraState === "requesting";
    const microphoneLive = props.microphoneState === "live" || props.microphoneState === "requesting";
    const ownScreenActive = props.screenShareState === "active";
    const presentingParticipantId = props.presentingParticipantId ?? (ownScreenActive ? props.selfParticipantId : null);
    const screenActive = Boolean(presentingParticipantId);
    const ownScreenPresented = screenActive && presentingParticipantId === props.selfParticipantId;
    const recording = props.recording?.state === "recording";
    const speaker = props.participants.find(item => item.id === c.speakerId) ?? props.participants[0];
    const speakerName = speaker?.name ?? L.participant;
    const presenterName = props.presentingParticipantName ?? (ownScreenPresented ? L.you : speakerName);
    const activeRoom = props.rooms?.find(room => room.id === props.activeRoomId);
    const brand = props.meeting.brand ?? L.brand;
    const effects = props.effects ?? [
        {id: "none", label: L.effectNone},
        {id: "blur", label: L.effectBlur},
        {id: "office", label: L.effectOffice},
        {id: "light", label: L.effectLight},
    ];
    const sendMessage = () => {
        const text = c.draft.trim();
        if (!text) return;
        props.onSendMessage?.(text);
        c.setDraft("");
    };
    const runAssistant = (command = c.assistantDraft) => {
        const text = command.trim();
        if (!text || !props.onAssistantCommand) return;
        props.onAssistantCommand(text);
        c.setAssistantDraft("");
    };
    const focusClass = c.focusMode === "video" ? "wenayVideoCall_focus" : c.focusMode === "chat" ? "wenayVideoCall_focusChat"
        : c.focusMode === "video-chat" ? "wenayVideoCall_focusVideoChat" : "";

    const speakerStage = <div className={`wenayVideoCallSpeaker wenayVideoCallSpeaker_${c.layout}`} data-speaker={speaker?.id}>
        {ownScreenPresented && props.screenVideoRef
            ? <video ref={props.screenVideoRef} autoPlay muted playsInline aria-label={L.screenShare} />
            : <canvas ref={props.canvasRef} width={960} height={540} aria-label={screenActive ? L.participantScreen : L.speakerVideo} />}
        {!screenActive && (!cameraLive || speaker?.id !== props.selfParticipantId) &&
            <div className={`wenayVideoCallAvatar wenayVideoCallAvatar_${speaker?.id ?? "you"}`}>{speaker?.initials ?? "—"}</div>}
        {screenActive && <>
            <div className="wenayVideoCallScreenBadge">🖥 {L.screenShare} · {presenterName}</div>
            {c.laserPointer && <span className="wenayVideoCallLaser" />}
        </>}
        {props.caption && !screenActive && <div className="wenayVideoCallCaption">
            <b>{speakerName}:</b> {props.caption}
            {props.translationEnabled && props.translatedCaption && <small>{props.translatedCaption}</small>}
        </div>}
        <div className="wenayVideoCallSpeakerName">
            <span className="wenayVideoCallSignal">▮▮▮</span>
            {screenActive ? `${presenterName} · ${L.screenSuffix}` : speakerName}
        </div>
    </div>;

    return <div className={`wenayVideoCall ${active ? "wenayVideoCall_active" : "wenayVideoCall_prejoin"} ${focusClass} wenayVideoCall_layout_${c.layout} wenayVideoCall_effect_${c.effect} ${props.className ?? ""}`.trim()}
                onMouseMove={c.revealControls} onPointerMove={c.revealControls} onPointerDown={c.revealControls}>
        <header className="wenayVideoCallTopbar">
            <div className="wenayVideoCallBrand"><span>{brand.slice(0, 1)}</span><b>{brand}</b></div>
            <div className="wenayVideoCallMeetingMeta">
                <strong>{props.meeting.title}</strong>
                {active && <>
                    <span className="wenayVideoCallTimer">{callTime(c.elapsedSeconds)}</span>
                    <span className="wenayVideoCallMode">{props.meeting.mode ?? L.meetingMode}</span>
                </>}
            </div>
            <div className="wenayVideoCallStatus" aria-live="polite">
                {recording && <span className="wenayVideoCallRecordingDot">REC</span>}
                <span className="wenayVideoCallLiveDot" />
                {props.statusLabel ?? (active ? L.statusLive(props.frames ?? 0) : props.phase === "ringing" ? L.statusConnecting : L.statusReady)}
            </div>
        </header>

        {!active ? <div className="wenayVideoCallLobby">
            <div className="wenayVideoCallLobbyStage">
                <canvas ref={props.canvasRef} width={640} height={360} aria-label={L.cameraPreview} />
                {!cameraLive && <div className="wenayVideoCallAvatar wenayVideoCallAvatar_you">{L.you}</div>}
                <div className="wenayVideoCallLobbyActions">
                    <button className={microphoneLive ? "is-on" : "is-off"} onClick={props.onToggleMicrophone}
                            aria-label={microphoneLive ? L.microphoneOff : L.microphoneOn}>🎙</button>
                    <button className={cameraLive ? "is-on" : "is-off"} onClick={props.onToggleCamera}
                            aria-label={cameraLive ? L.cameraOff : L.cameraOn}>🎥</button>
                </div>
            </div>
            <div className="wenayVideoCallEffects" aria-label={L.cameraEffects}>
                <span>{L.effectsTitle}</span>
                {effects.map(item => <button key={item.id} className={c.effect === item.id ? "is-selected" : ""}
                                             onClick={() => c.setEffect(item.id)}>{item.label}</button>)}
            </div>
            <div className="wenayVideoCallJoinCard">
                <div>
                    <b>{props.meeting.schedule ?? L.meetingReady}</b>
                    <span>{props.meeting.organizer ?? L.canJoin}{props.meeting.participantCount ? ` · ${L.waiting(props.meeting.participantCount)}` : ""}</span>
                </div>
                <button onClick={props.onJoin} disabled={props.joinDisabled || props.phase === "ringing"}>
                    {props.phase === "ringing" ? L.joining : L.join}
                </button>
            </div>
            {props.phase === "ringing" && <div className="wenayVideoCallIncoming">{L.connectingRelay}</div>}
        </div> : <div className="wenayVideoCallBody">
            <main className="wenayVideoCallScene">
                <div className="wenayVideoCallSceneHead">
                    <div>
                        {recording && <span className="wenayVideoCallRec">REC</span>}
                        <span>{props.onToggleTranslation || props.meeting.translation
                            ? (props.translationEnabled ? props.meeting.translation ?? L.translationOn : L.translationOff)
                            : L.secureConnection}</span>
                        {screenActive && <span>{L.screenLive}</span>}
                    </div>
                    <span>{L.participantCount(props.meeting.participantCount ?? props.participants.length)}</span>
                </div>
                {activeRoom && <div className="wenayVideoCallRoomBanner">
                    <b>🔉 {activeRoom.name}</b>
                    <span>{L.roomBanner}</span>
                    <button onClick={props.onLeaveRoom}>{L.backToMain}</button>
                </div>}
                {speakerStage}
                {!c.focusVideo && <div className="wenayVideoCallParticipants" aria-label={L.callParticipants}>
                    {props.participants.map(item => <button key={item.id} onClick={() => c.setSpeakerId(item.id)}
                        className={`wenayVideoCallTile wenayVideoCallTile_${item.tone ?? "blue"} ${speaker?.id === item.id ? "is-active" : ""}`}>
                        <span>{item.initials}</span>
                        <b>{item.name}</b>
                        {item.away && <i title={L.inRoom}>↗</i>}
                        {item.hand && <i title={L.handRaised}>✋</i>}
                        {item.canSpeak === false && <em title={L.noVoice}>🔇</em>}
                    </button>)}
                </div>}
                {props.poll && c.pollVisible && <aside className="wenayVideoCallPoll">
                    <button className="wenayVideoCallPollClose" onClick={c.dismissPoll} aria-label={L.skipPoll}>×</button>
                    <small>{props.poll.eyebrow ?? L.quickPoll}</small>
                    <b>{props.poll.question}</b>
                    {props.poll.options.map(option => <button key={option.id} className={c.pollAnswer === option.id ? "is-selected" : ""}
                                                              onClick={() => c.setPollAnswer(option.id)}>
                        {option.label}{option.percent !== undefined && <span>{option.percent}%</span>}
                    </button>)}
                </aside>}
                {props.notice && <div className="wenayVideoCallNotice" role="status">{props.notice}</div>}

                <div className={`wenayVideoCallDock ${c.controlsVisible ? "is-visible" : ""}`} aria-label={L.callControls}>
                    <button className={microphoneLive ? "is-on" : "is-off"} onClick={props.onToggleMicrophone}
                            aria-label={microphoneLive ? L.microphoneOff : L.microphoneOn}>🎙<span>{L.microphone}</span></button>
                    <button className={cameraLive ? "is-on" : "is-off"} onClick={props.onToggleCamera}
                            aria-label={cameraLive ? L.cameraOff : L.cameraOn}>🎥<span>{L.camera}</span></button>
                    {props.onToggleScreenShare && <button className={ownScreenActive ? "is-on" : ""} onClick={props.onToggleScreenShare}
                        disabled={screenActive && !ownScreenPresented}
                        aria-label={ownScreenActive ? L.stopScreenShare : screenActive ? L.screenBusy : L.screenShare}>🖥<span>{L.screen}</span></button>}
                    {props.rooms && props.onJoinRoom && <button className={activeRoom ? "is-on" : ""}
                        onClick={() => c.setPanel(c.panel === "rooms" ? "none" : "rooms")} aria-label={L.rooms}>⇄<span>{L.rooms}</span></button>}
                    <button onClick={() => c.setPanel(c.panel === "chat" ? "none" : "chat")} className={c.panel === "chat" ? "is-on" : ""}
                            aria-label={L.chat}>☵<span>{L.chat}</span></button>
                    <button onClick={() => c.setPanel(c.panel === "more" ? "none" : "more")} className={c.panel === "more" ? "is-on" : ""}
                            aria-label={L.callMenu}>•••<span>{L.menu}</span></button>
                    <button className="wenayVideoCallHangup" onClick={props.onHangup}>{L.hangup}</button>
                </div>
            </main>

            {c.panel !== "none" && <aside className="wenayVideoCallSidePanel">
                <div className="wenayVideoCallSideHead">
                    <b>{panelTitle(c.panel, L)}</b>
                    <button onClick={() => c.setPanel("none")} aria-label={L.closePanel}>×</button>
                </div>
                {c.panel === "chat" && <>
                    <div className="wenayVideoCallMessages">
                        {(props.messages ?? []).map(message => <p key={message.id}><b>{message.author}</b><span>{message.text}</span></p>)}
                    </div>
                    <div className="wenayVideoCallComposer">
                        <input aria-label={L.messageAll} placeholder={L.messageAllPlaceholder} value={c.draft}
                               onChange={event => c.setDraft(event.target.value)}
                               onKeyDown={event => { if (event.key === "Enter") sendMessage(); }} />
                        <button onClick={sendMessage} disabled={!c.draft.trim()} aria-label={L.sendMessage}>↑</button>
                    </div>
                </>}
                {c.panel === "people" && <div className="wenayVideoCallPeople">
                    {props.participants.map(item => <div key={item.id}>
                        <span>{item.initials}</span>
                        <b>{item.name}{item.moderator ? ` · ${L.moderatorSuffix}` : ""}</b>
                        <small>{item.status ?? (item.away ? L.statusInRoom : item.hand ? L.statusHand : L.statusMain)}</small>
                        {props.moderator && !item.moderator && <button className="wenayVideoCallSpeak"
                            onClick={() => props.onToggleSpeak?.(item.id, item.canSpeak === false)}>
                            {item.canSpeak === false ? L.giveVoice : L.takeVoice}
                        </button>}
                    </div>)}
                    {props.onInvite && <button className="wenayVideoCallInvite" onClick={props.onInvite}>＋ {L.invite}</button>}
                </div>}
                {c.panel === "rooms" && <div className="wenayVideoCallRooms">
                    {(props.rooms ?? []).map(room => <article key={room.id}>
                        <div>
                            <b>{room.private ? "🔒 " : "🔉 "}{room.name}</b>
                            <small>{L.participantCount(room.participantIds.length)} · {room.allowGuests ? L.roomGuests : L.roomClosed}</small>
                        </div>
                        {props.activeRoomId === room.id
                            ? <button onClick={props.onLeaveRoom}>{L.backToMain}</button>
                            : <button onClick={() => props.onJoinRoom?.(room.id)}>{L.enterRoom}</button>}
                        <button className="is-quiet" onClick={() => props.onPingRoom?.(room.id)}>{L.callBack}</button>
                    </article>)}
                </div>}
                {c.panel === "assistant" && <div className="wenayVideoCallAssistant">
                    <div className={props.assistant?.listening ? "is-listening" : ""}>
                        <span>🎙</span>
                        <b>{props.assistant?.listening ? L.assistantListening : props.assistant?.supported ? L.assistantReady : L.assistantUnavailable}</b>
                    </div>
                    {props.assistant?.transcript && <p>{L.transcript(props.assistant.transcript)}</p>}
                    <div className="wenayVideoCallAssistantCommands">
                        {L.assistantCommands.map(command => <button key={command} onClick={() => runAssistant(command)}>{command}</button>)}
                    </div>
                    <div className="wenayVideoCallComposer">
                        <input aria-label={L.assistantCommand} placeholder={L.assistantPlaceholder} value={c.assistantDraft}
                               onChange={event => c.setAssistantDraft(event.target.value)}
                               onKeyDown={event => { if (event.key === "Enter") runAssistant(); }} />
                        <button onClick={() => runAssistant()} disabled={!c.assistantDraft.trim()} aria-label={L.runCommand}>↑</button>
                    </div>
                    {props.onToggleAssistant && <button className="wenayVideoCallAssistantListen" onClick={props.onToggleAssistant}
                                                        aria-pressed={Boolean(props.assistant?.listening)}>
                        {props.assistant?.listening ? L.stopListening : L.speakCommand}
                    </button>}
                    {props.assistant?.status && <small role="status" aria-live="polite">{props.assistant.status}</small>}
                </div>}
                {c.panel === "more" && <div className="wenayVideoCallMore">
                    <section>
                        <b>{L.layoutTitle}</b>
                        <div>{(["speaker", "grid", "multi"] as VideoCallLayout[]).map(value =>
                            <button key={value} className={c.layout === value ? "is-selected" : ""} onClick={() => c.setLayout(value)}>
                                {value === "speaker" ? L.layoutSpeaker : value === "grid" ? L.layoutGrid : L.layoutMulti}
                            </button>)}</div>
                    </section>
                    <section>
                        <b>{L.focusTitle}</b>
                        <div>{(["standard", "video", "chat", "video-chat"] as VideoCallFocusMode[]).map(value =>
                            <button key={value} className={c.focusMode === value ? "is-selected" : ""} onClick={() => {
                                c.setFocusMode(value);
                                c.setPanel(value === "chat" || value === "video-chat" ? "chat" : "none");
                            }}>
                                {value === "standard" ? L.focusStandard : value === "video" ? L.focusVideo : value === "chat" ? L.focusChat : L.focusVideoChat}
                            </button>)}</div>
                    </section>
                    {ownScreenPresented && <button className={c.laserPointer ? "is-selected" : ""}
                                                   onClick={() => c.setLaserPointer(value => !value)}>⌁ {L.laserPointer}</button>}
                    {props.onToggleRecording && <button className={recording ? "is-danger" : ""} onClick={props.onToggleRecording}>
                        {recording ? `■ ${L.stopRecording}` : `● ${L.startRecording}`}
                    </button>}
                    {props.recording?.downloadUrl && <a href={props.recording.downloadUrl} download="meeting.webm">{L.downloadRecording}</a>}
                    {props.onToggleTranslation && <button className={props.translationEnabled ? "is-selected" : ""} onClick={props.onToggleTranslation}>
                        文 {props.translationEnabled ? L.translationDisable : L.translationEnable}
                    </button>}
                    <button onClick={() => c.setPanel("people")}>♟ {L.peopleAndVoice}</button>
                    {props.onAssistantCommand && <button onClick={() => c.setPanel("assistant")}>🎙 {L.voiceAssistant}</button>}
                </div>}
            </aside>}
        </div>}
        {props.error && <div className="wenayVideoCallError">{props.error}</div>}
    </div>;
}
