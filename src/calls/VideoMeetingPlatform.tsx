import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {io} from "socket.io-client";
import {createRpcClientHub, Media} from "wenay-common2";
import {
    VideoCall,
    type VideoCallMessage,
    type VideoCallParticipant,
    type VideoCallRecording,
    useVideoCallController,
} from "../common/src/components/Communication";
import {useMediaSource} from "../common/src/hooks/useMedia";

type MeetingMember = {
    id: string;
    name: string;
    joinedAt: number;
    host: boolean;
    canSpeak: boolean;
    camera: boolean;
    microphone: boolean;
    screen: boolean;
};
type MeetingMessage = {id: string; authorId: string; author: string; text: string; sentAt: number};
type MeetingRoom = {
    id: string;
    title: string;
    hostId: string;
    createdAt: number;
    updatedAt: number;
    revision: number;
    participants: MeetingMember[];
    messages: MeetingMessage[];
};
type RoomChange = {roomId: string; revision: number; closed?: boolean};
type MeetingApi = any;

function meetingAccountId() {
    const key = "wenay.video-call.account";
    const stored = window.sessionStorage.getItem(key);
    if (stored) return stored;
    const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const account = `seat-${suffix.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64)}`;
    window.sessionStorage.setItem(key, account);
    return account;
}

function participantInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2) || "?").toLocaleUpperCase("ru-RU");
}

function participantTone(id: string): VideoCallParticipant["tone"] {
    const tones: NonNullable<VideoCallParticipant["tone"]>[] = ["violet", "blue", "green", "pink", "amber"];
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return tones[hash % tones.length];
}

function participantsLabel(count: number) {
    const mod100 = count % 100;
    const mod10 = count % 10;
    const word = mod10 === 1 && mod100 !== 11 ? "участник" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "участника" : "участников";
    return `${count} ${word}`;
}

function roomLink(roomId: string) {
    return `${location.origin}${location.pathname}#video-calls/room/${encodeURIComponent(roomId)}`;
}

export function VideoMeetingPlatform({roomId}: {roomId?: string}) {
    const accountId = useMemo(meetingAccountId, []);
    const hub = useMemo(() => createRpcClientHub(
        () => io({path: "/__video-call-rpc", transports: ["websocket"], auth: {account: accountId}}),
        rpc => ({videoCall: rpc<any>("videoCall")}),
    ), [accountId]);
    const [api, setApi] = useState<MeetingApi | null>(null);
    const [connected, setConnected] = useState(false);
    const [room, setRoom] = useState<MeetingRoom | null>(null);
    const [loading, setLoading] = useState(Boolean(roomId));
    const [closed, setClosed] = useState(false);
    const [error, setError] = useState("");
    const [name, setName] = useState(() => window.sessionStorage.getItem("wenay.video-call.name") ?? "");
    const [title, setTitle] = useState("Встреча команды");
    const [joinValue, setJoinValue] = useState("");

    useEffect(() => {
        let alive = true;
        const offConnect = hub.connectListen(() => { if (alive) setConnected(true); });
        const offDisconnect = hub.disconnectListen(() => { if (alive) setConnected(false); });
        void hub.setToken(null).then(async clients => {
            await clients.videoCall.readyStrict();
            if (!alive) return;
            // RPC `func` is itself callable; wrap it so React does not treat the
            // proxy as a functional state updater.
            setApi(() => clients.videoCall.func);
            setConnected(true);
        }).catch(cause => { if (alive) setError(`Не удалось подключиться к серверу: ${String(cause)}`); });
        return () => {
            alive = false;
            offConnect();
            offDisconnect();
            hub.socket?.disconnect?.();
        };
    }, [hub]);

    useEffect(() => {
        if (!api || !roomId) { setLoading(false); return; }
        let alive = true;
        const refresh = async () => {
            try {
                const next = await api.rooms.get(roomId) as MeetingRoom | null;
                if (!alive) return;
                setRoom(next);
                setClosed(!next);
                setLoading(false);
            } catch (cause) {
                if (alive) { setError(String(cause)); setLoading(false); }
            }
        };
        const off = api.rooms.changed.on((change: RoomChange) => {
            if (change.roomId !== roomId || !alive) return;
            if (change.closed) { setRoom(null); setClosed(true); return; }
            void refresh();
        });
        void refresh();
        return () => { alive = false; off(); };
    }, [api, roomId]);

    const rememberName = (value: string) => {
        const clean = value.replace(/\s+/g, " ").trim().slice(0, 48);
        if (clean) window.sessionStorage.setItem("wenay.video-call.name", clean);
        return clean;
    };
    const createRoom = async () => {
        const cleanName = rememberName(name);
        if (!api || !cleanName) { setError(cleanName ? "Сервер ещё подключается" : "Введите ваше имя"); return; }
        setError("");
        try {
            const next = await api.rooms.create({name: cleanName, title}) as MeetingRoom;
            setRoom(next);
            location.hash = `video-calls/room/${next.id}`;
        } catch (cause) { setError(String(cause)); }
    };
    const joinRoom = async () => {
        const cleanName = rememberName(name);
        if (!api || !roomId || !cleanName) { setError(cleanName ? "Сервер ещё подключается" : "Введите ваше имя"); return; }
        setError("");
        try { setRoom(await api.rooms.join(roomId, cleanName)); }
        catch (cause) { setError(String(cause)); }
    };
    const openRoom = () => {
        const value = joinValue.trim();
        const match = value.match(/video-calls\/room\/([^?#/]+)/i);
        const code = decodeURIComponent(match?.[1] ?? value).replace(/^#?/, "");
        if (!/^[a-z0-9]+-[a-z0-9]+$/i.test(code)) { setError("Вставьте ссылку встречи или код комнаты"); return; }
        location.hash = `video-calls/room/${code}`;
    };

    if (!roomId) return <MeetingHome
        connected={connected} name={name} title={title} joinValue={joinValue} error={error}
        onName={setName} onTitle={setTitle} onJoinValue={setJoinValue} onCreate={() => void createRoom()} onOpen={openRoom}
    />;
    if (loading) return <MeetingState title="Подключаемся к комнате…" detail="Проверяем ссылку и защищённое соединение." />;
    if (!room) return <MeetingState title={closed ? "Встреча завершена" : "Комната не найдена"} detail="Попросите организатора создать новую ссылку." action="На главную" />;

    const joined = room.participants.some(participant => participant.id === accountId);
    if (!joined) return <MeetingJoin
        room={room} name={name} connected={connected} error={error}
        onName={setName} onJoin={() => void joinRoom()}
    />;

    return <MeetingRoomView
        api={api} accountId={accountId} room={room} connected={connected}
        onRoom={setRoom} onError={setError}
        onExit={() => { setRoom(null); location.hash = "video-calls"; }}
    />;
}

function MeetingHome(props: {
    connected: boolean; name: string; title: string; joinValue: string; error: string;
    onName(value: string): void; onTitle(value: string): void; onJoinValue(value: string): void; onCreate(): void; onOpen(): void;
}) {
    return <main className="wenayMeetingLanding">
        <nav className="wenayMeetingNav"><a href="#">Wenay</a><span className={props.connected ? "is-online" : ""}>{props.connected ? "Сервис доступен" : "Подключение…"}</span></nav>
        <section className="wenayMeetingHero">
            <div className="wenayMeetingHeroCopy"><small>WENAY CALLS</small><h1>Связь, в которую входят по одной ссылке</h1><p>Создайте комнату, отправьте ссылку коллегам и начинайте разговор. Без регистрации и тестовых аккаунтов.</p><div><span>✓ Живая серверная комната</span><span>✓ Видео, звук и экран</span><span>✓ Чат и запись</span></div></div>
            <div className="wenayMeetingCreateCard">
                <label>Ваше имя<input autoFocus value={props.name} onChange={event => props.onName(event.target.value)} placeholder="Например, Анна" maxLength={48} /></label>
                <label>Название встречи<input value={props.title} onChange={event => props.onTitle(event.target.value)} placeholder="Встреча команды" maxLength={80} /></label>
                <button className="wenayMeetingPrimary" onClick={props.onCreate} disabled={!props.connected}>Создать встречу <span>→</span></button>
                <div className="wenayMeetingDivider"><span>или присоединиться</span></div>
                <label>Ссылка или код комнаты<div className="wenayMeetingInline"><input value={props.joinValue} onChange={event => props.onJoinValue(event.target.value)} onKeyDown={event => { if (event.key === "Enter") props.onOpen(); }} placeholder="abcd-1234" /><button onClick={props.onOpen}>Войти</button></div></label>
                {props.error && <p className="wenayMeetingFormError">{props.error}</p>}
            </div>
        </section>
    </main>;
}

function MeetingJoin(props: {room: MeetingRoom; name: string; connected: boolean; error: string; onName(value: string): void; onJoin(): void}) {
    return <main className="wenayMeetingLanding wenayMeetingJoinPage">
        <nav className="wenayMeetingNav"><a href="#video-calls">← Wenay Calls</a><span className={props.connected ? "is-online" : ""}>{props.connected ? "Комната доступна" : "Подключение…"}</span></nav>
        <section className="wenayMeetingJoinShell">
            <div className="wenayMeetingJoinVisual"><div className="wenayMeetingJoinOrb">{participantInitials(props.name || "Вы")}</div><span>Камеру и микрофон можно включить после входа</span></div>
            <div className="wenayMeetingCreateCard"><small>ВАС ПРИГЛАСИЛИ</small><h1>{props.room.title}</h1><p>{props.room.participants.length ? `В комнате ${participantsLabel(props.room.participants.length)}` : "Организатор ещё не подключился"}</p><label>Как вас представить?<input autoFocus value={props.name} onChange={event => props.onName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") props.onJoin(); }} placeholder="Ваше имя" maxLength={48} /></label><button className="wenayMeetingPrimary" onClick={props.onJoin} disabled={!props.connected}>Присоединиться <span>→</span></button>{props.error && <p className="wenayMeetingFormError">{props.error}</p>}</div>
        </section>
    </main>;
}

function MeetingState({title, detail, action}: {title: string; detail: string; action?: string}) {
    return <main className="wenayMeetingLanding wenayMeetingState"><div><span className="wenayMeetingStateMark">W</span><h1>{title}</h1><p>{detail}</p>{action && <a href="#video-calls">{action}</a>}</div></main>;
}

function MeetingRoomView(props: {
    api: MeetingApi; accountId: string; room: MeetingRoom; connected: boolean;
    onRoom(room: MeetingRoom): void; onError(error: string): void; onExit(): void;
}) {
    const {api, accountId, room} = props;
    const self = room.participants.find(participant => participant.id === accountId)!;
    const presenter = room.participants.find(participant => participant.screen);
    const ui = useVideoCallController({phase: "active", speakerId: presenter?.id ?? room.hostId, controlsHideMs: 6500});
    const camera = useMediaSource("video", {sourceId: `camera-${accountId}`, fps: 12, width: 960, codec: "webp", quality: .78});
    const microphone = useMediaSource("audio", {sourceId: `microphone-${accountId}`, mode: "pcm", bufferSize: 4096});
    const screenStreamRef = useRef<MediaStream | null>(null);
    const screenEndedRef = useRef<() => void>(() => {});
    const screen = useMediaSource("video", {
        sourceId: `screen-${accountId}`,
        fps: 10,
        width: 1280,
        codec: "webp",
        quality: .76,
        stream: async () => {
            const stream = await navigator.mediaDevices.getDisplayMedia({video: true, audio: false});
            screenStreamRef.current = stream;
            stream.getVideoTracks()[0]?.addEventListener("ended", () => screenEndedRef.current(), {once: true});
            return stream;
        },
    });
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const screenVideoRef = useRef<HTMLVideoElement | null>(null);
    const playersRef = useRef(new Map<string, ReturnType<typeof Media.attachAudioPlayer>>());
    const [frames, setFrames] = useState(0);
    const [notice, setNotice] = useState("");
    const [localError, setLocalError] = useState("");

    const updateRoom = useCallback(async (work: Promise<MeetingRoom>) => {
        try { props.onRoom(await work); }
        catch (cause) { setLocalError(String(cause)); props.onError(String(cause)); }
    }, [props.onRoom, props.onError]);
    const publishCamera = useMemo(() => (frame: Uint8Array, sentAt?: number) => api.media.publish("camera", frame, sentAt ?? Date.now()), [api]);
    const publishMicrophone = useMemo(() => (frame: Uint8Array, sentAt?: number) => api.media.publish("microphone", frame, sentAt ?? Date.now()), [api]);
    const publishScreen = useMemo(() => (frame: Uint8Array, sentAt?: number) => api.media.publish("screen", frame, sentAt ?? Date.now()), [api]);
    useEffect(() => Media.pipeMediaPublish(camera.listen, publishCamera, {onError: cause => setLocalError(String(cause))}), [camera.listen, publishCamera]);
    useEffect(() => Media.pipeMediaPublish(microphone.listen, publishMicrophone, {onError: cause => setLocalError(String(cause))}), [microphone.listen, publishMicrophone]);
    useEffect(() => Media.pipeMediaPublish(screen.listen, publishScreen, {onError: cause => setLocalError(String(cause))}), [screen.listen, publishScreen]);

    const activeVideoOwner = presenter?.id ?? ui.speakerId ?? room.hostId;
    const activeVideoLine = presenter ? "screen" : "camera";
    useEffect(() => {
        if (presenter?.id === accountId || !canvasRef.current) return;
        let attachment: ReturnType<typeof Media.attachVideoCanvas> | null = null;
        const attach = () => {
            if (attachment || !canvasRef.current) return;
            try {
                const line = activeVideoOwner === accountId ? camera.listen : api.media.watch?.[activeVideoOwner]?.[activeVideoLine];
                if (!line?.on) return;
                attachment = Media.attachVideoCanvas(line, canvasRef.current, {onError: cause => setLocalError(String(cause))});
            } catch { /* ACL may still be converging; retry below */ }
        };
        attach();
        const retry = window.setInterval(attach, 900);
        const stats = window.setInterval(() => { if (attachment) setFrames(attachment.stats().drawn); }, 500);
        return () => { window.clearInterval(retry); window.clearInterval(stats); attachment?.off(); };
    }, [accountId, activeVideoLine, activeVideoOwner, api, camera.listen, presenter?.id]);

    const participantKey = room.participants.map(participant => participant.id).sort().join("|");
    useEffect(() => {
        const attachMissing = () => {
            for (const participant of room.participants) {
                if (participant.id === accountId || playersRef.current.has(participant.id)) continue;
                try {
                    const line = api.media.watch?.[participant.id]?.microphone;
                    if (!line?.on) continue;
                    const player = Media.attachAudioPlayer(line, {maxBacklogSec: .35, onError: cause => setLocalError(String(cause))});
                    playersRef.current.set(participant.id, player);
                    player.enable();
                } catch { /* ACL may still be converging */ }
            }
        };
        attachMissing();
        const retry = window.setInterval(attachMissing, 1200);
        return () => {
            window.clearInterval(retry);
            for (const player of playersRef.current.values()) player.off();
            playersRef.current.clear();
        };
    }, [accountId, api, participantKey]);

    useEffect(() => {
        if (self.canSpeak || microphone.state === "idle") return;
        microphone.stop();
    }, [microphone, self.canSpeak]);
    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(""), 3600);
        return () => window.clearTimeout(timer);
    }, [notice]);
    useEffect(() => {
        if (screen.state !== "live" || !screenVideoRef.current || !screenStreamRef.current) return;
        screenVideoRef.current.srcObject = screenStreamRef.current;
        void screenVideoRef.current.play().catch(cause => setLocalError(String(cause)));
    }, [screen.state]);

    const toggleCamera = async () => {
        setLocalError("");
        if (camera.state === "live" || camera.state === "requesting") {
            camera.stop();
            await updateRoom(api.rooms.setMedia(room.id, {camera: false}));
            return;
        }
        const state = await camera.start().catch(cause => { setLocalError(String(cause)); return "error"; });
        await updateRoom(api.rooms.setMedia(room.id, {camera: state === "live"}));
    };
    const toggleMicrophone = async () => {
        setLocalError("");
        for (const player of playersRef.current.values()) player.enable();
        if (!self.canSpeak) { setNotice("Организатор пока не дал вам право голоса"); return; }
        if (microphone.state === "live" || microphone.state === "requesting") {
            microphone.stop();
            await updateRoom(api.rooms.setMedia(room.id, {microphone: false}));
            return;
        }
        const state = await microphone.start().catch(cause => { setLocalError(String(cause)); return "error"; });
        await updateRoom(api.rooms.setMedia(room.id, {microphone: state === "live"}));
    };
    const stopScreen = useCallback(() => {
        screen.stop();
        screenStreamRef.current = null;
        if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
        void updateRoom(api.rooms.setMedia(room.id, {screen: false}));
    }, [api, room.id, screen, updateRoom]);
    screenEndedRef.current = stopScreen;
    const toggleScreen = async () => {
        if (screen.state === "live" || screen.state === "requesting") { stopScreen(); return; }
        if (presenter && presenter.id !== accountId) { setNotice(`${presenter.name} уже показывает экран`); return; }
        setLocalError("");
        const state = await screen.start().catch(cause => { setLocalError(String(cause)); return "error"; });
        await updateRoom(api.rooms.setMedia(room.id, {screen: state === "live"}));
    };

    const recorderRef = useRef<MediaRecorder | null>(null);
    const recordStreamRef = useRef<MediaStream | null>(null);
    const recordChunksRef = useRef<Blob[]>([]);
    const recordingUrlRef = useRef("");
    const [recording, setRecording] = useState<VideoCallRecording>({state: "idle"});
    const toggleRecording = useCallback(() => {
        if (recorderRef.current?.state === "recording") { recorderRef.current.stop(); return; }
        const source = screenStreamRef.current
            ? new MediaStream(screenStreamRef.current.getTracks().map(track => track.clone()))
            : canvasRef.current?.captureStream?.(24);
        if (!source || typeof MediaRecorder === "undefined") { setRecording({state: "error"}); setLocalError("Запись недоступна в этом браузере"); return; }
        if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
        const recorder = new MediaRecorder(source, {mimeType});
        recorderRef.current = recorder;
        recordStreamRef.current = source;
        recordChunksRef.current = [];
        recorder.ondataavailable = event => { if (event.data.size) recordChunksRef.current.push(event.data); };
        recorder.onerror = () => { setRecording({state: "error"}); setLocalError("Не удалось записать встречу"); };
        recorder.onstop = () => {
            const blob = new Blob(recordChunksRef.current, {type: recorder.mimeType || "video/webm"});
            recordStreamRef.current?.getTracks().forEach(track => track.stop());
            recordStreamRef.current = null;
            recorderRef.current = null;
            const downloadUrl = URL.createObjectURL(blob);
            recordingUrlRef.current = downloadUrl;
            setRecording({state: "ready", downloadUrl, label: `${Math.max(1, Math.round(blob.size / 1024))} КБ`});
        };
        recorder.start(250);
        setRecording({state: "recording"});
    }, []);
    useEffect(() => () => {
        if (recorderRef.current) {
            recorderRef.current.ondataavailable = null;
            recorderRef.current.onstop = null;
            recorderRef.current.onerror = null;
            if (recorderRef.current.state === "recording") recorderRef.current.stop();
        }
        recordStreamRef.current?.getTracks().forEach(track => track.stop());
        if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    }, []);

    const participants: VideoCallParticipant[] = room.participants.map(participant => ({
        id: participant.id,
        initials: participantInitials(participant.name),
        name: participant.id === accountId ? `${participant.name} (вы)` : participant.name,
        tone: participantTone(participant.id),
        moderator: participant.host,
        canSpeak: participant.canSpeak,
        status: participant.screen ? "показывает экран" : participant.camera && participant.microphone ? "камера и микрофон включены" : participant.camera ? "камера включена" : participant.microphone ? "микрофон включён" : "в комнате",
    }));
    const messages: VideoCallMessage[] = room.messages.map(message => ({id: message.id, author: message.authorId === accountId ? "Вы" : message.author, text: message.text}));
    const link = roomLink(room.id);
    const copyLink = async () => {
        try { await navigator.clipboard.writeText(link); setNotice("Ссылка на встречу скопирована"); }
        catch { setNotice("Скопируйте ссылку из поля приглашения"); }
    };
    const hangup = async () => {
        camera.stop(); microphone.stop(); screen.stop();
        screenStreamRef.current = null;
        if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
        try {
            if (self.host) await api.rooms.close(room.id);
            else await api.rooms.leave(room.id);
        } catch (cause) { setLocalError(String(cause)); }
        props.onExit();
    };

    return <main className="wenayMeetingRoomPage">
        <div className="wenayMeetingInviteBar"><div><span className={props.connected ? "is-online" : ""} /> <b>{props.connected ? "Комната в сети" : "Переподключение…"}</b><small>Код {room.id}</small></div><div><input aria-label="Ссылка приглашения" readOnly value={link} onFocus={event => event.currentTarget.select()} /><button onClick={() => void copyLink()}>Скопировать ссылку</button></div></div>
        <VideoCall
            controller={ui} phase="active"
            meeting={{brand: "Wenay Calls", title: room.title, organizer: `Организатор: ${room.participants.find(item => item.host)?.name ?? "—"}`, mode: self.host ? "Организатор" : "Участник", participantCount: room.participants.length}}
            participants={participants} selfParticipantId={accountId} canvasRef={canvasRef}
            screenVideoRef={presenter?.id === accountId ? screenVideoRef : undefined}
            cameraState={camera.state} microphoneState={microphone.state}
            screenShareState={screen.state === "live" ? "active" : screen.state === "requesting" ? "requesting" : "idle"}
            presentingParticipantId={presenter?.id ?? null} presentingParticipantName={presenter?.name}
            recording={recording} frames={frames} notice={notice}
            messages={messages} moderator={self.host}
            statusLabel={props.connected ? `серверная комната · ${room.participants.length} онлайн` : "восстанавливаем соединение…"}
            error={localError}
            onJoin={() => {}} onHangup={() => void hangup()}
            onToggleCamera={() => void toggleCamera()} onToggleMicrophone={() => void toggleMicrophone()}
            onToggleScreenShare={() => void toggleScreen()} onToggleRecording={toggleRecording}
            onSendMessage={text => void updateRoom(api.rooms.sendMessage(room.id, text))}
            onInvite={self.host ? () => void copyLink() : undefined}
            onToggleSpeak={self.host ? (participantId, allowed) => void updateRoom(api.rooms.setSpeak(room.id, participantId, allowed)) : undefined}
        />
    </main>;
}
