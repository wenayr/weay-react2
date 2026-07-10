/**
 * Shipped interactive Peer/Media demonstrations. The QA board imports these exact
 * components; consumers can import them from `wenay-react2/demo/peer-media`.
 * They use an in-process host intentionally, so no server credentials are needed.
 */
import React, {useEffect, useMemo, useRef, useState} from "react";
import {Media, Peer} from "wenay-common2";
import {useMediaSource} from "../src/hooks/useMedia";
import {usePeerCalls, usePeerPresence} from "../src/hooks/usePeerCall";
/* ---------- 41/42. Peer calls and host presence ---------- */
export const PeerCallDemo = () => {
    const pair = useMemo(() => {
        const host = Peer.createPeerHost();
        const a = host.connection("qa-call-a");
        const b = host.connection("qa-call-b");
        return {
            host,
            caller: Peer.createCallManager({port: Peer.callPortOf(a.fragment), self: "qa-call-a"}),
            callee: Peer.createCallManager({port: Peer.callPortOf(b.fragment), self: "qa-call-b"}),
        };
    }, []);
    useEffect(() => () => { pair.caller.close(); pair.callee.close(); pair.host.close(); }, [pair]);
    const a = usePeerCalls(pair.caller);
    const b = usePeerCalls(pair.callee);
    const incoming = b.rings.find(call => call.direction === "in");
    return <div style={{display: "grid", gap: 8}}>
        <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
            <button disabled={!a.ready || Boolean(a.active)} onClick={() => a.call("qa-call-b", {from: "QA"})}>call B</button>
            {incoming && <><button onClick={() => incoming.accept()}>B accept</button><button onClick={() => incoming.decline()}>B decline</button></>}
            {a.active && <button onClick={() => a.active?.hangup()}>A hang up</button>}
            <b>A: {a.active?.state() ?? "idle"}; B: {b.active?.state() ?? (incoming ? "ringing" : "idle")}</b>
        </div>
        <span style={{fontSize: 12}}>manager ready: A={String(a.ready)} B={String(b.ready)}; rings B={b.rings.length}</span>
    </div>;
};

export const PeerPresenceDemo = () => {
    const pair = useMemo(() => {
        const host = Peer.createPeerHost();
        const a = host.connection("qa-presence-a");
        const b = host.connection("qa-presence-b");
        return {host, a, b};
    }, []);
    const [connected, setConnected] = useState(true);
    useEffect(() => () => { pair.a.close(); pair.b.close(); pair.host.close(); }, [pair]);
    const presence = usePeerPresence(pair.a.fragment.presence);
    return <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
        <button disabled={!connected} onClick={() => { pair.b.close(); setConnected(false); }}>disconnect B</button>
        <button disabled={connected} onClick={() => { pair.b = pair.host.connection("qa-presence-b"); setConnected(true); }}>reconnect B</button>
        <b>online: {presence.accounts.join(", ") || "none"}</b>
    </div>;
};
export const MediaRelayAclDemo = () => {
    const media = useMediaSource("video", {fps: 12, replay: {history: 8, current: "last"}});
    const allowed = useRef(true);
    const relay = useMemo(() => Peer.createMediaRelay({lines: {camera: "video"}, canWatch: () => allowed.current}), [allowed]);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [granted, setGranted] = useState(true);
    const [stats, setStats] = useState({frames: 0, drawn: 0, ageMs: 0});
    const [error, setError] = useState<string | null>(null);
    const publish = useMemo(() => {
        const publishLine = relay.publishOf("qa-media-owner");
        return (frame: Uint8Array, sentAt?: number) => publishLine("camera", frame, sentAt ?? Date.now());
    }, [relay]);
    useEffect(() => Media.pipeMediaPublish(media.listen, publish, {onError: error => setError(String(error))}), [media.listen, publish]);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const watcher: any = relay.watchOf("qa-media-watcher");
        const view = Media.attachVideoCanvas(watcher["qa-media-owner"].camera, canvas, {onError: error => setError(String(error))});
        const timer = window.setInterval(() => setStats(view.stats()), 500);
        return () => { window.clearInterval(timer); view.off(); };
    }, [relay]);
    useEffect(() => () => relay.close(), [relay]);
    const setAccess = (next: boolean) => { allowed.current = next; setGranted(next); };
    return <div style={{display: "grid", gap: 8}}>
        <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
            <button onClick={() => void media.start()}>start relay camera</button>
            <button onClick={media.stop}>stop</button>
            <button onClick={() => setAccess(!granted)}>{granted ? "revoke ACL" : "grant ACL"}</button>
            <b>source: {media.state}; ACL: {granted ? "granted" : "revoked"}</b>
            <span style={{fontSize: 12}}>viewer drawn {stats.drawn}, frames {stats.frames}, age {Math.round(stats.ageMs)}ms</span>
        </div>
        {error && <div style={{color: "#cf222e"}}>relay viewer error: {error}</div>}
        <canvas ref={canvasRef} width={320} height={180} style={{width: 320, height: 180, background: "#111", borderRadius: 8}} />
    </div>;
};
export const MediaRelayAudioDemo = () => {
    const media = useMediaSource("audio", {mode: "pcm", bufferSize: 4096, replay: {history: 64, current: "last"}});
    const allowed = useRef(true);
    const relay = useMemo(() => Peer.createMediaRelay({lines: {mic: "audio"}, canWatch: () => allowed.current}), [allowed]);
    const playerRef = useRef<ReturnType<typeof Media.attachAudioPlayer> | null>(null);
    const [granted, setGranted] = useState(true);
    const [stats, setStats] = useState({frames: 0, played: 0, dropped: 0, ageMs: 0});
    const [error, setError] = useState<string | null>(null);
    const publish = useMemo(() => {
        const publishLine = relay.publishOf("qa-audio-owner");
        return (frame: Uint8Array, sentAt?: number) => publishLine("mic", frame, sentAt ?? Date.now());
    }, [relay]);
    useEffect(() => Media.pipeMediaPublish(media.listen, publish, {onError: error => setError(String(error))}), [media.listen, publish]);
    useEffect(() => {
        const watcher: any = relay.watchOf("qa-audio-watcher");
        const player = Media.attachAudioPlayer(watcher["qa-audio-owner"].mic, {maxBacklogSec: .35, onError: error => setError(String(error))});
        playerRef.current = player;
        const timer = window.setInterval(() => setStats(player.stats()), 500);
        return () => { window.clearInterval(timer); player.off(); playerRef.current = null; };
    }, [relay]);
    useEffect(() => () => relay.close(), [relay]);
    const setAccess = (next: boolean) => { allowed.current = next; setGranted(next); };
    return <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
        <button onClick={() => { playerRef.current?.enable(); void media.start(); }}>enable + start relay mic</button>
        <button onClick={media.stop}>stop</button>
        <button onClick={() => setAccess(!granted)}>{granted ? "revoke audio ACL" : "grant audio ACL"}</button>
        <b>source: {media.state}; ACL: {granted ? "granted" : "revoked"}</b>
        <span style={{fontSize: 12}}>played {stats.played}, frames {stats.frames}, dropped {stats.dropped}, age {Math.round(stats.ageMs)}ms</span>
        {error && <span style={{color: "#cf222e"}}>player error: {error}</span>}
    </div>;
};

/** Complete messenger-style call: viewer attachment follows the active call. */
export const PeerCallVideoAudioDemo = () => {
    const pair = useMemo(() => {
        const host = Peer.createPeerHost();
        const a = host.connection("qa-av-a"); const b = host.connection("qa-av-b");
        return {host, caller: Peer.createCallManager({port: Peer.callPortOf(a.fragment), self: "qa-av-a"}), callee: Peer.createCallManager({port: Peer.callPortOf(b.fragment), self: "qa-av-b"})};
    }, []);
    useEffect(() => () => { pair.caller.close(); pair.callee.close(); pair.host.close(); }, [pair]);
    const caller = usePeerCalls(pair.caller); const callee = usePeerCalls(pair.callee);
    const active = Boolean(caller.active || callee.active);
    const allowed = useRef(false); allowed.current = active;
    const relay = useMemo(() => Peer.createMediaRelay({lines: {camera: "video", microphone: "audio"}, canWatch: () => allowed.current}), [allowed]);
    useEffect(() => () => relay.close(), [relay]);
    const video = useMediaSource("video", {fps: 12}); const audio = useMediaSource("audio", {mode: "pcm", bufferSize: 4096});
    const canvasRef = useRef<HTMLCanvasElement | null>(null); const playerRef = useRef<ReturnType<typeof Media.attachAudioPlayer> | null>(null);
    const [drawn, setDrawn] = useState(0);
    const publishVideo = useMemo(() => { const send = relay.publishOf("qa-av-a"); return (frame: Uint8Array, sentAt?: number) => send("camera", frame, sentAt ?? Date.now()); }, [relay]);
    const publishAudio = useMemo(() => { const send = relay.publishOf("qa-av-a"); return (frame: Uint8Array, sentAt?: number) => send("microphone", frame, sentAt ?? Date.now()); }, [relay]);
    useEffect(() => Media.pipeMediaPublish(video.listen, publishVideo), [video.listen, publishVideo]);
    useEffect(() => Media.pipeMediaPublish(audio.listen, publishAudio), [audio.listen, publishAudio]);
    useEffect(() => {
        if (!active || !canvasRef.current) return;
        const watcher: any = relay.watchOf("qa-av-b"); const view = Media.attachVideoCanvas(watcher["qa-av-a"].camera, canvasRef.current);
        const player = Media.attachAudioPlayer(watcher["qa-av-a"].microphone, {maxBacklogSec: .35}); playerRef.current = player;
        const timer = window.setInterval(() => setDrawn(view.stats().drawn), 500);
        return () => { window.clearInterval(timer); view.off(); player.off(); playerRef.current = null; };
    }, [active, relay]);
    const incoming = callee.rings.find(call => call.direction === "in");
    return <div style={{display: "grid", gap: 8}}>
        <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
            <button onClick={() => { playerRef.current?.enable(); void video.start(); void audio.start(); }}>enable camera + mic</button>
            {!active && !incoming && <button onClick={() => caller.call("qa-av-b")}>call B</button>}
            {incoming && <button onClick={() => incoming.accept()}>B accept call</button>}
            {caller.active && <button onClick={() => caller.active?.hangup()}>hang up</button>}
            <b>call: {active ? "active — media attached" : incoming ? "ringing" : "idle"}; video frames: {drawn}</b>
        </div>
        <canvas ref={canvasRef} width={320} height={180} style={{width: 320, height: 180, background: "#111", borderRadius: 8}} />
    </div>;
};