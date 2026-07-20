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

function participantCountLabel(count: number) {
    const mod100 = count % 100;
    const mod10 = count % 10;
    const word = mod10 === 1 && mod100 !== 11 ? "участник" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "участника" : "участников";
    return `${count} ${word}`;
}

function panelTitle(panel: VideoCallPanel) {
    return panel === "chat" ? "Чат встречи" : panel === "people" ? "Участники" : panel === "rooms" ? "Комнаты" : panel === "assistant" ? "Ассистент" : "Режим встречи";
}

/** Controlled product surface: every transport/media edge is supplied by the app. */
export function VideoCall(props: VideoCallProps) {
    const c = props.controller;
    const active = props.phase === "active";
    const cameraLive = props.cameraState === "live" || props.cameraState === "requesting";
    const microphoneLive = props.microphoneState === "live" || props.microphoneState === "requesting";
    const ownScreenActive = props.screenShareState === "active";
    const presentingParticipantId = props.presentingParticipantId ?? (ownScreenActive ? props.selfParticipantId : null);
    const screenActive = Boolean(presentingParticipantId);
    const ownScreenPresented = screenActive && presentingParticipantId === props.selfParticipantId;
    const recording = props.recording?.state === "recording";
    const speaker = props.participants.find(item => item.id === c.speakerId) ?? props.participants[0];
    const activeRoom = props.rooms?.find(room => room.id === props.activeRoomId);
    const effects = props.effects ?? [
        {id: "none", label: "Без эффектов"},
        {id: "blur", label: "Размытие"},
        {id: "office", label: "Фон: офис"},
        {id: "light", label: "Коррекция света"},
    ];
    const sendMessage = () => {
        const text = c.draft.trim();
        if (!text) return;
        props.onSendMessage?.(text);
        c.setDraft("");
    };
    const runAssistant = (command = c.assistantDraft) => {
        const text = command.trim();
        if (!text) return;
        props.onAssistantCommand?.(text);
        c.setAssistantDraft("");
    };
    const focusClass = c.focusMode === "video" ? "wenayVideoCall_focus" : c.focusMode === "chat" ? "wenayVideoCall_focusChat" : c.focusMode === "video-chat" ? "wenayVideoCall_focusVideoChat" : "";

    const speakerStage = <div className={`wenayVideoCallSpeaker wenayVideoCallSpeaker_${c.layout}`} data-speaker={speaker?.id}>
        {ownScreenPresented && props.screenVideoRef ? <video ref={props.screenVideoRef} autoPlay muted playsInline aria-label="Демонстрация экрана" /> : <canvas ref={props.canvasRef} width={960} height={540} aria-label={screenActive ? "Демонстрация экрана участника" : "Видео активного участника"} />}
        {!screenActive && (!cameraLive || speaker?.id !== props.selfParticipantId) && <div className={`wenayVideoCallAvatar wenayVideoCallAvatar_${speaker?.id ?? "you"}`}>{speaker?.initials ?? "—"}</div>}
        {screenActive && <><div className="wenayVideoCallScreenBadge">🖥 Демонстрация экрана · {props.presentingParticipantName ?? (ownScreenPresented ? "Вы" : speaker?.name ?? "Участник")}</div>{c.laserPointer && <span className="wenayVideoCallLaser" />}</>}
        {props.caption && !screenActive && <div className="wenayVideoCallCaption"><b>{speaker?.name ?? "Участник"}:</b> {props.caption}{props.translationEnabled && props.translatedCaption && <small>{props.translatedCaption}</small>}</div>}
        <div className="wenayVideoCallSpeakerName"><span className="wenayVideoCallSignal">▮▮▮</span>{screenActive ? `${props.presentingParticipantName ?? (ownScreenPresented ? "Вы" : speaker?.name ?? "Участник")} · экран` : speaker?.name ?? "Участник"}</div>
    </div>;

    return <div className={`wenayVideoCall ${active ? "wenayVideoCall_active" : "wenayVideoCall_prejoin"} ${focusClass} wenayVideoCall_layout_${c.layout} wenayVideoCall_effect_${c.effect} ${props.className ?? ""}`.trim()}
                onMouseMove={c.revealControls} onPointerMove={c.revealControls} onPointerDown={c.revealControls}>
        <header className="wenayVideoCallTopbar">
            <div className="wenayVideoCallBrand"><span>{(props.meeting.brand ?? "С").slice(0, 1)}</span><b>{props.meeting.brand ?? "Собрание"}</b></div>
            <div className="wenayVideoCallMeetingMeta"><strong>{props.meeting.title}</strong>{active && <><span className="wenayVideoCallTimer">{callTime(c.elapsedSeconds)}</span><span className="wenayVideoCallMode">{props.meeting.mode ?? "Работа"}</span></>}</div>
            <div className="wenayVideoCallStatus" aria-live="polite">{recording && <span className="wenayVideoCallRecordingDot">REC</span>}<span className="wenayVideoCallLiveDot" />{props.statusLabel ?? (active ? `relay · ${props.frames ?? 0} кадров` : props.phase === "ringing" ? "подключение…" : "готово к подключению")}</div>
        </header>

        {!active ? <div className="wenayVideoCallLobby">
            <div className="wenayVideoCallLobbyStage">
                <canvas ref={props.canvasRef} width={640} height={360} aria-label="Предпросмотр камеры" />
                {!cameraLive && <div className="wenayVideoCallAvatar wenayVideoCallAvatar_you">Вы</div>}
                <div className="wenayVideoCallLobbyActions"><button className={microphoneLive ? "is-on" : "is-off"} onClick={props.onToggleMicrophone} aria-label={microphoneLive ? "Выключить микрофон" : "Включить микрофон"}>🎙</button><button className={cameraLive ? "is-on" : "is-off"} onClick={props.onToggleCamera} aria-label={cameraLive ? "Выключить камеру" : "Включить камеру"}>🎥</button></div>
            </div>
            <div className="wenayVideoCallEffects" aria-label="Эффекты камеры"><span>Эффекты и маски</span>{effects.map(item => <button key={item.id} className={c.effect === item.id ? "is-selected" : ""} onClick={() => c.setEffect(item.id)}>{item.label}</button>)}</div>
            <div className="wenayVideoCallJoinCard"><div><b>{props.meeting.schedule ?? "Встреча готова"}</b><span>{props.meeting.organizer ?? "Можно подключаться"}{props.meeting.participantCount ? ` · уже ждут ${participantCountLabel(props.meeting.participantCount)}` : ""}</span></div><button onClick={props.onJoin} disabled={props.joinDisabled || props.phase === "ringing"}>{props.phase === "ringing" ? "Подключаем…" : "Присоединиться"}</button></div>
            {props.phase === "ringing" && <div className="wenayVideoCallIncoming">Подключаем защищённый relay…</div>}
        </div> : <div className="wenayVideoCallBody">
            <main className="wenayVideoCallScene">
                <div className="wenayVideoCallSceneHead"><div>{recording && <span className="wenayVideoCallRec">REC</span>}<span>{props.onToggleTranslation || props.meeting.translation ? (props.translationEnabled ? props.meeting.translation ?? "Перевод включён" : "Перевод выключен") : "Защищённая связь"}</span>{screenActive && <span>Экран в эфире</span>}</div><span>{participantCountLabel(props.meeting.participantCount ?? props.participants.length)}</span></div>
                {activeRoom && <div className="wenayVideoCallRoomBanner"><b>🔉 {activeRoom.name}</b><span>Основная сессия приглушена · участники могут позвать вас обратно</span><button onClick={props.onLeaveRoom}>Вернуться</button></div>}
                {speakerStage}
                {!c.focusVideo && <div className="wenayVideoCallParticipants" aria-label="Участники звонка">{props.participants.map(item => <button key={item.id} className={`wenayVideoCallTile wenayVideoCallTile_${item.tone ?? "blue"} ${speaker?.id === item.id ? "is-active" : ""}`} onClick={() => c.setSpeakerId(item.id)}><span>{item.initials}</span><b>{item.name}</b>{item.away && <i title="В отдельной комнате">↗</i>}{item.hand && <i title="Поднята рука">✋</i>}{item.canSpeak === false && <em title="Нет права голоса">🔇</em>}</button>)}</div>}
                {props.poll && c.pollVisible && <aside className="wenayVideoCallPoll"><button className="wenayVideoCallPollClose" onClick={c.dismissPoll} aria-label="Пропустить опрос">×</button><small>{props.poll.eyebrow ?? "Быстрый опрос"}</small><b>{props.poll.question}</b>{props.poll.options.map(option => <button key={option.id} className={c.pollAnswer === option.id ? "is-selected" : ""} onClick={() => c.setPollAnswer(option.id)}>{option.label}{option.percent !== undefined && <span>{option.percent}%</span>}</button>)}</aside>}
                {props.notice && <div className="wenayVideoCallNotice" role="status">{props.notice}</div>}

                <div className={`wenayVideoCallDock ${c.controlsVisible ? "is-visible" : ""}`} aria-label="Управление звонком">
                    <button className={microphoneLive ? "is-on" : "is-off"} onClick={props.onToggleMicrophone} aria-label={microphoneLive ? "Выключить микрофон" : "Включить микрофон"}>🎙<span>Микрофон</span></button>
                    <button className={cameraLive ? "is-on" : "is-off"} onClick={props.onToggleCamera} aria-label={cameraLive ? "Выключить камеру" : "Включить камеру"}>🎥<span>Камера</span></button>
                    {props.onToggleScreenShare && <button className={ownScreenActive ? "is-on" : ""} onClick={props.onToggleScreenShare} disabled={screenActive && !ownScreenPresented} aria-label={ownScreenActive ? "Остановить демонстрацию" : screenActive ? "Экран уже показывает другой участник" : "Демонстрация экрана"}>🖥<span>Экран</span></button>}
                    {props.rooms && props.onJoinRoom && <button className={activeRoom ? "is-on" : ""} onClick={() => c.setPanel(c.panel === "rooms" ? "none" : "rooms")} aria-label="Комнаты">⇄<span>Комнаты</span></button>}
                    <button onClick={() => c.setPanel(c.panel === "chat" ? "none" : "chat")} className={c.panel === "chat" ? "is-on" : ""} aria-label="Чат">☵<span>Чат</span></button>
                    <button onClick={() => c.setPanel(c.panel === "more" ? "none" : "more")} className={c.panel === "more" ? "is-on" : ""} aria-label="Меню звонка">•••<span>Меню</span></button>
                    <button className="wenayVideoCallHangup" onClick={props.onHangup}>Завершить</button>
                </div>
            </main>

            {c.panel !== "none" && <aside className="wenayVideoCallSidePanel">
                <div className="wenayVideoCallSideHead"><b>{panelTitle(c.panel)}</b><button onClick={() => c.setPanel("none")} aria-label="Закрыть панель">×</button></div>
                {c.panel === "chat" && <><div className="wenayVideoCallMessages">{(props.messages ?? []).map(message => <p key={message.id}><b>{message.author}</b><span>{message.text}</span></p>)}</div><div className="wenayVideoCallComposer"><input aria-label="Сообщение всем" placeholder="Сообщение всем…" value={c.draft} onChange={event => c.setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") sendMessage(); }} /><button onClick={sendMessage} disabled={!c.draft.trim()} aria-label="Отправить сообщение">↑</button></div></>}
                {c.panel === "people" && <div className="wenayVideoCallPeople">{props.participants.map(item => <div key={item.id}><span>{item.initials}</span><b>{item.name}{item.moderator ? " · администратор" : ""}</b><small>{item.status ?? (item.away ? "отдельная комната" : item.hand ? "хочет выступить" : "в общем зале")}</small>{props.moderator && !item.moderator && <button className="wenayVideoCallSpeak" onClick={() => props.onToggleSpeak?.(item.id, item.canSpeak === false)}>{item.canSpeak === false ? "Дать слово" : "Забрать слово"}</button>}</div>)}{props.onInvite && <button className="wenayVideoCallInvite" onClick={props.onInvite}>＋ Пригласить участника</button>}</div>}
                {c.panel === "rooms" && <div className="wenayVideoCallRooms">{(props.rooms ?? []).map(room => <article key={room.id}><div><b>{room.private ? "🔒 " : "🔉 "}{room.name}</b><small>{room.participantIds.length} участников · {room.allowGuests ? "вход по приглашению" : "закрытая"}</small></div>{props.activeRoomId === room.id ? <button onClick={props.onLeaveRoom}>Вернуться</button> : <button onClick={() => props.onJoinRoom?.(room.id)}>Войти</button>}<button className="is-quiet" onClick={() => props.onPingRoom?.(room.id)}>Позвать обратно</button></article>)}</div>}
                {c.panel === "assistant" && <div className="wenayVideoCallAssistant"><div className={props.assistant?.listening ? "is-listening" : ""}><span>🎙</span><b>{props.assistant?.listening ? "Слушаю…" : props.assistant?.supported ? "Готов к команде" : "Голос недоступен"}</b></div>{props.assistant?.transcript && <p>«{props.assistant.transcript}»</p>}<div className="wenayVideoCallAssistantCommands">{["фокус на видео", "открой чат", "покажи комнаты", "начни запись"].map(command => <button key={command} onClick={() => runAssistant(command)}>{command}</button>)}</div><div className="wenayVideoCallComposer"><input aria-label="Команда ассистенту" placeholder="Например: включи сетку" value={c.assistantDraft} onChange={event => c.setAssistantDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") runAssistant(); }} /><button onClick={() => runAssistant()} disabled={!c.assistantDraft.trim()} aria-label="Выполнить команду">↑</button></div><button className="wenayVideoCallAssistantListen" onClick={props.onToggleAssistant}>{props.assistant?.listening ? "Остановить распознавание" : "Сказать команду"}</button>{props.assistant?.status && <small>{props.assistant.status}</small>}</div>}
                {c.panel === "more" && <div className="wenayVideoCallMore">
                    <section><b>Раскладка</b><div>{(["speaker", "grid", "multi"] as VideoCallLayout[]).map(value => <button key={value} className={c.layout === value ? "is-selected" : ""} onClick={() => c.setLayout(value)}>{value === "speaker" ? "Спикер" : value === "grid" ? "Сетка" : "Мульти"}</button>)}</div></section>
                    <section><b>Фокус внимания</b><div>{(["standard", "video", "chat", "video-chat"] as VideoCallFocusMode[]).map(value => <button key={value} className={c.focusMode === value ? "is-selected" : ""} onClick={() => { c.setFocusMode(value); c.setPanel(value === "chat" || value === "video-chat" ? "chat" : "none"); }}>{value === "standard" ? "Стандарт" : value === "video" ? "Видео" : value === "chat" ? "Чат" : "Видео + чат"}</button>)}</div></section>
                    {ownScreenPresented && <button className={c.laserPointer ? "is-selected" : ""} onClick={() => c.setLaserPointer(value => !value)}>⌁ Лазерная указка</button>}
                    {props.onToggleRecording && <button className={recording ? "is-danger" : ""} onClick={props.onToggleRecording}>{recording ? "■ Остановить запись" : "● Начать запись"}</button>}
                    {props.recording?.downloadUrl && <a href={props.recording.downloadUrl} download="meeting.webm">Скачать запись</a>}
                    {props.onToggleTranslation && <button className={props.translationEnabled ? "is-selected" : ""} onClick={props.onToggleTranslation}>文 {props.translationEnabled ? "Выключить перевод" : "Включить RU → EN"}</button>}
                    <button onClick={() => c.setPanel("people")}>♟ Участники и права голоса</button>
                    {props.onAssistantCommand && <button onClick={() => c.setPanel("assistant")}>🎙 Голосовой ассистент</button>}
                </div>}
            </aside>}
        </div>}
        {props.error && <div className="wenayVideoCallError">{props.error}</div>}
    </div>;
}
