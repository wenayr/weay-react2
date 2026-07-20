/** Canonical full-feature adapter for the public VideoCall communication UI. */
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Media, Peer} from "wenay-common2";
import {
    VideoCall,
    type VideoCallAssistant,
    type VideoCallMessage,
    type VideoCallParticipant,
    type VideoCallRecording,
    type VideoCallRoom,
    type VideoCallScreenState,
    useVideoCallController,
} from "../src/components/Communication";
import {useMediaSource} from "../src/hooks/useMedia";
import {usePeerCalls} from "../src/hooks/usePeerCall";

const initialParticipants: VideoCallParticipant[] = [
    {id: "you", initials: "В", name: "Вы", tone: "violet", moderator: true},
    {id: "anna", initials: "АС", name: "Анна", tone: "blue", moderator: true},
    {id: "max", initials: "МР", name: "Максим", tone: "green", away: true},
    {id: "irina", initials: "ИЛ", name: "Ирина", tone: "pink", away: true},
    {id: "dmitry", initials: "ДК", name: "Дмитрий", tone: "amber", hand: true, canSpeak: false},
];
const initialMessages: VideoCallMessage[] = [
    {id: "message-anna", author: "Анна", text: "План уже прикрепила к встрече."},
    {id: "message-max", author: "Максим", text: "Уйдём с Ириной на 5 минут в комнату."},
];
const initialRooms: VideoCallRoom[] = [
    {id: "launch", name: "Обсудить запуск", participantIds: ["max", "irina"], allowGuests: true},
    {id: "finance", name: "Бюджет и риски", participantIds: ["anna"], private: true},
];

export function VideoCallShowcaseDemo() {
    const pair = useMemo(() => {
        const host = Peer.createPeerHost();
        const a = host.connection("qa-studio-a");
        const b = host.connection("qa-studio-b");
        return {host, caller: Peer.createCallManager({port: Peer.callPortOf(a.fragment), self: "qa-studio-a"}), callee: Peer.createCallManager({port: Peer.callPortOf(b.fragment), self: "qa-studio-b"})};
    }, []);
    useEffect(() => () => { pair.caller.close(); pair.callee.close(); pair.host.close(); }, [pair]);
    const caller = usePeerCalls(pair.caller);
    const callee = usePeerCalls(pair.callee);
    const incoming = callee.rings.find(call => call.direction === "in");
    const active = Boolean(caller.active || callee.active);
    const [autoAccept, setAutoAccept] = useState(false);
    const phase = active ? "active" : incoming || autoAccept ? "ringing" : "lobby";
    const ui = useVideoCallController({phase, speakerId: "anna", controlsHideMs: 6500});
    useEffect(() => { if (autoAccept && incoming) { incoming.accept(); setAutoAccept(false); } }, [autoAccept, incoming]);

    const allowed = useRef(false);
    allowed.current = active;
    const relay = useMemo(() => Peer.createMediaRelay({lines: {camera: "video", microphone: "audio"}, canWatch: () => allowed.current}), []);
    useEffect(() => () => relay.close(), [relay]);
    const video = useMediaSource("video", {fps: 12});
    const audio = useMediaSource("audio", {mode: "pcm", bufferSize: 4096});
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const screenVideoRef = useRef<HTMLVideoElement | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const [screenShareState, setScreenShareState] = useState<VideoCallScreenState>("idle");
    const playerRef = useRef<ReturnType<typeof Media.attachAudioPlayer> | null>(null);
    const audioWanted = useRef(false);
    const mainAudioEnabled = useRef(true);
    const [drawn, setDrawn] = useState(0);
    const [actionError, setActionError] = useState("");

    const publishVideo = useMemo(() => { const send = relay.publishOf("qa-studio-a"); return (frame: Uint8Array, sentAt?: number) => send("camera", frame, sentAt ?? Date.now()); }, [relay]);
    const publishAudio = useMemo(() => { const send = relay.publishOf("qa-studio-a"); return (frame: Uint8Array, sentAt?: number) => send("microphone", frame, sentAt ?? Date.now()); }, [relay]);
    useEffect(() => Media.pipeMediaPublish(video.listen, publishVideo, {onError: error => setActionError(String(error))}), [video.listen, publishVideo]);
    useEffect(() => Media.pipeMediaPublish(audio.listen, publishAudio, {onError: error => setActionError(String(error))}), [audio.listen, publishAudio]);
    useEffect(() => {
        if (active || !canvasRef.current) return;
        const preview = Media.attachVideoCanvas(video.listen, canvasRef.current, {onError: error => setActionError(String(error))});
        return () => preview.off();
    }, [active, video.listen]);
    useEffect(() => {
        if (!active || !canvasRef.current) return;
        const watcher: any = relay.watchOf("qa-studio-b");
        const view = Media.attachVideoCanvas(watcher["qa-studio-a"].camera, canvasRef.current, {onError: error => setActionError(String(error))});
        const player = Media.attachAudioPlayer(watcher["qa-studio-a"].microphone, {maxBacklogSec: .35, onError: error => setActionError(String(error))});
        playerRef.current = player;
        if (audioWanted.current && mainAudioEnabled.current) player.enable();
        const timer = window.setInterval(() => setDrawn(view.stats().drawn), 500);
        return () => { window.clearInterval(timer); view.off(); player.off(); playerRef.current = null; };
    }, [active, relay, screenShareState]);

    const cameraLive = video.state === "live" || video.state === "requesting";
    const microphoneLive = audio.state === "live" || audio.state === "requesting";
    const toggleCamera = () => { setActionError(""); cameraLive ? video.stop() : void video.start().catch(error => setActionError(String(error))); };
    const toggleMicrophone = () => {
        setActionError("");
        if (microphoneLive) { audioWanted.current = false; audio.stop(); }
        else { audioWanted.current = true; if (mainAudioEnabled.current) playerRef.current?.enable(); void audio.start().catch(error => setActionError(String(error))); }
    };

    const stopScreenShare = useCallback(() => {
        screenStreamRef.current?.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
        if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
        setScreenShareState("idle");
        ui.setLaserPointer(false);
    }, [ui.setLaserPointer]);
    const toggleScreenShare = useCallback(async () => {
        if (screenShareState === "active" || screenShareState === "requesting") { stopScreenShare(); return; }
        setActionError("");
        if (!navigator.mediaDevices?.getDisplayMedia) { setScreenShareState("error"); setActionError("Демонстрация экрана не поддерживается этим браузером"); return; }
        setScreenShareState("requesting");
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({video: true, audio: false});
            screenStreamRef.current = stream;
            stream.getVideoTracks()[0]?.addEventListener("ended", stopScreenShare, {once: true});
            setScreenShareState("active");
        } catch (error: any) {
            setScreenShareState("idle");
            if (error?.name !== "NotAllowedError") setActionError(String(error?.message ?? error));
        }
    }, [screenShareState, stopScreenShare]);
    useEffect(() => {
        if (screenShareState !== "active" || !screenVideoRef.current || !screenStreamRef.current) return;
        screenVideoRef.current.srcObject = screenStreamRef.current;
        void screenVideoRef.current.play().catch(error => setActionError(String(error)));
    }, [screenShareState]);
    useEffect(() => () => stopScreenShare(), [stopScreenShare]);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const recordStreamRef = useRef<MediaStream | null>(null);
    const recordChunks = useRef<Blob[]>([]);
    const recordingUrlRef = useRef("");
    const [recording, setRecording] = useState<VideoCallRecording>({state: "idle"});
    const toggleRecording = useCallback(() => {
        if (recorderRef.current?.state === "recording") { recorderRef.current.stop(); return; }
        setActionError("");
        const canvas = canvasRef.current;
        const screenStream = screenStreamRef.current;
        if ((!screenStream && !canvas?.captureStream) || typeof MediaRecorder === "undefined") { setRecording({state: "error"}); setActionError("Запись видео недоступна в этом браузере"); return; }
        if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
        recordingUrlRef.current = "";
        const stream = screenStream
            ? new MediaStream(screenStream.getTracks().map(track => track.clone()))
            : canvas!.captureStream(24);
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
        const recorder = new MediaRecorder(stream, {mimeType});
        recorderRef.current = recorder;
        recordStreamRef.current = stream;
        recordChunks.current = [];
        recorder.ondataavailable = event => { if (event.data.size) recordChunks.current.push(event.data); };
        recorder.onerror = () => { setRecording({state: "error"}); setActionError("Ошибка записи встречи"); };
        recorder.onstop = () => {
            const blob = new Blob(recordChunks.current, {type: recorder.mimeType || "video/webm"});
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

    const [participants, setParticipants] = useState(initialParticipants);
    const [messages, setMessages] = useState(initialMessages);
    const [rooms] = useState(initialRooms);
    const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
    const [notice, setNotice] = useState("");
    const [translationEnabled, setTranslationEnabled] = useState(true);
    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(""), 3600);
        return () => window.clearTimeout(timer);
    }, [notice]);
    const invite = () => setParticipants(current => current.some(item => item.id === "olga") ? current : [...current, {id: "olga", initials: "ОВ", name: "Ольга", tone: "violet"}]);
    const sendMessage = (text: string) => setMessages(current => [...current, {id: `message-${Date.now()}`, author: "Вы", text}]);
    const joinRoom = (roomId: string) => {
        setActiveRoomId(roomId);
        mainAudioEnabled.current = false;
        playerRef.current?.disable();
        setNotice("Вы вошли в комнату. Основной звук теперь приглушён.");
        ui.setPanel("none");
    };
    const leaveRoom = () => {
        setActiveRoomId(null);
        mainAudioEnabled.current = true;
        if (audioWanted.current) playerRef.current?.enable();
        setNotice("Вы вернулись в основную сессию");
    };
    const pingRoom = (roomId: string) => { const room = rooms.find(item => item.id === roomId); setNotice(`Тихий вызов отправлен в «${room?.name ?? "комнату"}»`); };
    const toggleSpeak = (participantId: string, canSpeak: boolean) => setParticipants(current => current.map(item => item.id === participantId ? {...item, canSpeak} : item));

    const join = () => { setAutoAccept(true); caller.call("qa-studio-b", {room: "launch-q3", mode: "work"}); };
    const hangup = useCallback(() => {
        caller.active?.hangup();
        callee.active?.hangup();
        video.stop(); audio.stop(); audioWanted.current = false; mainAudioEnabled.current = true;
        stopScreenShare();
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, [caller.active, callee.active, video, audio, stopScreenShare]);

    const speechCtor = typeof window !== "undefined" ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition : undefined;
    const recognitionRef = useRef<any>(null);
    const [assistant, setAssistant] = useState<VideoCallAssistant>({supported: Boolean(speechCtor), listening: false, status: "Команды выполняются локально"});
    const executeAssistantCommand = useCallback((command: string) => {
        const value = command.toLocaleLowerCase("ru-RU");
        setAssistant(current => ({...current, transcript: command, status: "Команда выполнена"}));
        if (value.includes("фокус")) { ui.setFocusMode("video"); ui.setPanel("none"); }
        else if (value.includes("чат")) ui.setPanel("chat");
        else if (value.includes("комнат")) ui.setPanel("rooms");
        else if (value.includes("участ")) ui.setPanel("people");
        else if (value.includes("сетк")) { ui.setLayout("grid"); ui.setPanel("none"); }
        else if (value.includes("мульти")) { ui.setLayout("multi"); ui.setPanel("none"); }
        else if (value.includes("запис")) toggleRecording();
        else if (value.includes("экран")) void toggleScreenShare();
        else if (value.includes("заверш")) hangup();
        else setAssistant(current => ({...current, status: "Команда не распознана"}));
    }, [ui, toggleRecording, toggleScreenShare, hangup]);
    const toggleAssistant = useCallback(() => {
        if (recognitionRef.current) { recognitionRef.current.stop(); return; }
        if (!speechCtor) { setAssistant(current => ({...current, status: "Web Speech API недоступен — используйте текстовую команду"})); return; }
        const recognition = new speechCtor();
        recognition.lang = "ru-RU";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onresult = (event: any) => executeAssistantCommand(String(event.results?.[0]?.[0]?.transcript ?? ""));
        recognition.onerror = (event: any) => setAssistant(current => ({...current, listening: false, status: `Распознавание: ${event.error ?? "ошибка"}`}));
        recognition.onend = () => { recognitionRef.current = null; setAssistant(current => ({...current, listening: false})); };
        recognitionRef.current = recognition;
        setAssistant(current => ({...current, listening: true, status: "Говорите команду"}));
        recognition.start();
    }, [speechCtor, executeAssistantCommand]);
    useEffect(() => () => recognitionRef.current?.stop(), []);

    return <VideoCall
        controller={ui} phase={phase}
        meeting={{brand: "Собрание", title: "Синк по запуску · Q3", schedule: "Сегодня, 14:00", organizer: "Организатор Анна Соколова", mode: "Работа", translation: "Перевод RU → EN", participantCount: participants.length + 1}}
        participants={participants} selfParticipantId="you" canvasRef={canvasRef} screenVideoRef={screenVideoRef}
        cameraState={video.state} microphoneState={audio.state} screenShareState={screenShareState}
        recording={recording} assistant={assistant} frames={drawn} notice={notice}
        caption="Коллеги, начнём с плана запуска — предлагаю целиться в сентябрь."
        translatedCaption="Colleagues, let’s begin with the launch plan — I suggest targeting September."
        translationEnabled={translationEnabled}
        poll={{question: "Когда выпускаем первую версию?", options: [{id: "august", label: "В августе", percent: 33}, {id: "september", label: "В сентябре", percent: 67}]}}
        messages={messages} rooms={rooms} activeRoomId={activeRoomId} moderator effects={undefined}
        error={actionError} joinDisabled={!caller.ready || Boolean(incoming)}
        onJoin={join} onHangup={hangup} onToggleCamera={toggleCamera} onToggleMicrophone={toggleMicrophone}
        onToggleScreenShare={() => void toggleScreenShare()} onToggleRecording={toggleRecording}
        onToggleTranslation={() => setTranslationEnabled(value => !value)} onToggleAssistant={toggleAssistant}
        onAssistantCommand={executeAssistantCommand} onSendMessage={sendMessage} onInvite={invite}
        onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} onPingRoom={pingRoom} onToggleSpeak={toggleSpeak}
    />;
}
